// api/generate-pdf.js
// Fonction séparée dédiée au watermark PDF
// Appelée par campay.js (action claim_book) UNIQUEMENT
// N'a aucun impact sur les paiements

import { PDFDocument, rgb, StandardFonts, PDFName, PDFString } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { pdf_url, phone, book_id, book_title } = req.body;

  if (!pdf_url) {
    return res.status(400).json({ error: "pdf_url manquant" });
  }

  try {
    // 1. Télécharger le PDF original
    const pdfRes = await fetch(pdf_url);
    if (!pdfRes.ok) throw new Error("PDF inaccessible : " + pdf_url);
    const pdfBytes = await pdfRes.arrayBuffer();

    // 2. Charger dans pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ── Helper lien cliquable ──
    function addLink(page, x, y, w, h, url) {
      try {
        const annot = pdfDoc.context.register(pdfDoc.context.obj({
          Type: "Annot", Subtype: "Link",
          Rect: [x, y, x + w, y + h],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
        }));
        const existing = page.node.lookup(PDFName.of("Annots"));
        if (existing) { existing.push(annot); }
        else { page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annot])); }
      } catch (e) { /* non bloquant */ }
    }

    // ── Formater le numéro ──
    function formatPhone(p) {
      if (!p) return "";
      const digits = String(p).replace(/\D/g, "").replace(/^237/, "");
      if (digits.length === 9) {
        return digits[0] + " " + digits.slice(1,3) + " " + digits.slice(3,5) + " " + digits.slice(5,7) + " " + digits.slice(7,9);
      }
      return p;
    }

    const formattedPhone = formatPhone(phone);
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const purchaseDate = dd + "/" + mm + "/" + yy;
    const BASE_URL = "https://carrybooks.com";

    // 3. Watermark sur chaque page existante
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width } = page.getSize();

      // Bas gauche : date + téléphone
      const bottomLeftText = formattedPhone
        ? "Le " + purchaseDate + " - Tel : " + formattedPhone
        : "Le " + purchaseDate;
      page.drawText(bottomLeftText, {
        x: 20, y: 12, size: 8,
        font: helveticaFont,
        color: rgb(0.40, 0.40, 0.40),
      });

      // Bas droite : "Plus de livres sur carrybooks.com"
      const prefixText = "Plus de livres sur ";
      const linkText = "carrybooks.com";
      const prefixW = helveticaFont.widthOfTextAtSize(prefixText, 8);
      const linkW = helveticaBold.widthOfTextAtSize(linkText, 8);
      const startX = width - prefixW - linkW - 20;
      page.drawText(prefixText, {
        x: startX, y: 12, size: 8,
        font: helveticaFont, color: rgb(0.15, 0.15, 0.15),
      });
      page.drawText(linkText, {
        x: startX + prefixW, y: 12, size: 8,
        font: helveticaBold, color: rgb(0.10, 0.36, 0.74),
      });
      addLink(page, startX + prefixW - 2, 10, linkW + 4, 12, BASE_URL);
    }

    // Dimensions des pages
    const existingPages = pdfDoc.getPages();
    let PAGE_WIDTH = 419;
    let PAGE_HEIGHT = 595;
    if (existingPages.length > 0) {
      const size = existingPages[0].getSize();
      PAGE_WIDTH = size.width;
      PAGE_HEIGHT = size.height;
    }

    const grayDark  = rgb(0.15, 0.15, 0.15);
    const grayMid   = rgb(0.40, 0.40, 0.40);
    const blueColor = rgb(0.10, 0.36, 0.74);
    const purple    = rgb(0.616, 0.306, 0.867);

    // 4. PAGE PUB 1 : CarryCare
    try {
      const imgRes = await fetch(BASE_URL + "/pdf-pub-carrycare.jpeg");
      if (imgRes.ok) {
        const imgBytes = await imgRes.arrayBuffer();
        const img = await pdfDoc.embedJpg(imgBytes);
        const page1 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        const dims = img.scaleToFit(PAGE_WIDTH - 20, PAGE_HEIGHT - 60);
        const xImg = (PAGE_WIDTH - dims.width) / 2;
        const yImg = PAGE_HEIGHT - dims.height - 10;
        page1.drawImage(img, { x: xImg, y: yImg, width: dims.width, height: dims.height });

        const zones = [
          [0.04, 0.43, 0.50, 0.62, BASE_URL + "/?go=carrycare-body"],
          [0.50, 0.43, 0.96, 0.62, BASE_URL + "/?go=carrycare-facial"],
          [0.04, 0.63, 0.50, 0.82, BASE_URL + "/?go=carrycare-hair"],
          [0.50, 0.63, 0.96, 0.82, BASE_URL + "/?go=carrycare-line"],
        ];
        zones.forEach(([x1, y1, x2, y2, url]) => {
          addLink(page1,
            xImg + x1 * dims.width,
            yImg + dims.height - y2 * dims.height,
            (x2 - x1) * dims.width,
            (y2 - y1) * dims.height,
            url
          );
        });

        const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const bandText = "Cliquez ici pour acceder a CarryCare";
        const bandW = fontB.widthOfTextAtSize(bandText, 13);
        page1.drawText(bandText, {
          x: (PAGE_WIDTH - bandW) / 2, y: 22,
          size: 13, font: fontB, color: purple,
        });
        addLink(page1, (PAGE_WIDTH - bandW) / 2 - 10, 16, bandW + 20, 20, BASE_URL + "/carrycare");
      }
    } catch (e) { console.warn("[PDF] Page CarryCare échouée (non bloquant):", e.message); }

    // 5. PAGE PUB 2 : Univers
    try {
      const imgRes = await fetch(BASE_URL + "/pdf-pub-univers.jpeg");
      if (imgRes.ok) {
        const imgBytes = await imgRes.arrayBuffer();
        const img = await pdfDoc.embedJpg(imgBytes);
        const page2 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        const dims = img.scaleToFit(PAGE_WIDTH - 20, PAGE_HEIGHT - 30);
        const xImg = (PAGE_WIDTH - dims.width) / 2;
        const yImg = PAGE_HEIGHT - dims.height - 10;
        page2.drawImage(img, { x: xImg, y: yImg, width: dims.width, height: dims.height });

        const zones = [
          [0.03, 0.17, 0.97, 0.55, BASE_URL + "/?go=carryshop"],
          [0.03, 0.58, 0.97, 0.96, BASE_URL + "/?go=carrycolor"],
        ];
        zones.forEach(([x1, y1, x2, y2, url]) => {
          addLink(page2,
            xImg + x1 * dims.width,
            yImg + dims.height - y2 * dims.height,
            (x2 - x1) * dims.width,
            (y2 - y1) * dims.height,
            url
          );
        });
      }
    } catch (e) { console.warn("[PDF] Page Univers échouée (non bloquant):", e.message); }

    // 6. PAGES LISTE DES LIVRES
    try {
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: allBooks } = await supabaseAdmin
        .from("books")
        .select("id, title, category, product_type")
        .eq("status", "actif")
        .neq("product_type", "article")
        .order("category", { ascending: true })
        .order("title", { ascending: true });

      const payBooks = (allBooks || []).filter(b =>
        b.id !== book_id && b.product_type !== "papier"
      );

      function safeText(s) {
        if (!s) return "";
        return String(s)
          .replace(/[\u2018-\u201F]/g, "'")
          .replace(/[\u2010-\u2015]/g, "-")
          .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
          .trim();
      }

      function slugify(s) {
        return (s || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 80);
      }

      const fontBd = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontIt = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const margin = Math.round(PAGE_WIDTH * 0.07);
      const lineH = 18, fs = 11;
      const titleSpace = 100, footerSpace = 50;
      const linesPerPage = Math.floor((PAGE_HEIGHT - titleSpace - footerSpace) / lineH);
      const totalPages = Math.max(1, Math.ceil(payBooks.length / linesPerPage));
      let bookIdx = 0;

      for (let p = 1; p <= totalPages; p++) {
        const pg = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

        const headerText = "Decouvrez nos autres livres";
        const headerW = fontBd.widthOfTextAtSize(headerText, 20);
        pg.drawText(headerText, {
          x: (PAGE_WIDTH - headerW) / 2, y: PAGE_HEIGHT - 50,
          size: 20, font: fontBd, color: grayDark,
        });

        const subText = p === 1 ? "Cliquez sur un titre pour le decouvrir" : "(suite)";
        const subW = fontIt.widthOfTextAtSize(subText, 11);
        pg.drawText(subText, {
          x: (PAGE_WIDTH - subW) / 2, y: PAGE_HEIGHT - 75,
          size: 11, font: fontIt, color: grayMid,
        });

        let yLine = PAGE_HEIGHT - titleSpace;
        let count = 0;

        while (bookIdx < payBooks.length && count < linesPerPage) {
          const book = payBooks[bookIdx];
          const title = safeText(book.title || "Livre");
          if (title) {
            const titleW = fontBd.widthOfTextAtSize(title, fs);
            pg.drawText(title, { x: margin, y: yLine, size: fs, font: fontBd, color: grayDark });

            const catText = book.category ? " - " + safeText(book.category) : "";
            let catW = 0;
            if (catText) {
              pg.drawText(catText, { x: margin + titleW, y: yLine, size: fs - 1, font: fontIt, color: grayMid });
              catW = fontIt.widthOfTextAtSize(catText, fs - 1);
            }

            const linkLabel = " - Telecharger ici";
            const linkW = fontBd.widthOfTextAtSize(linkLabel, fs);
            pg.drawText(linkLabel, { x: margin + titleW + catW, y: yLine, size: fs, font: fontBd, color: blueColor });
            addLink(pg, margin + titleW + catW, yLine - 3, linkW, fs + 6, BASE_URL + "/?book=" + slugify(book.title));
          }
          yLine -= lineH;
          count++;
          bookIdx++;
        }

        if (payBooks.length === 0) {
          const noText = "Decouvrez tous nos livres sur carrybooks.com";
          const noW = fontIt.widthOfTextAtSize(noText, 14);
          pg.drawText(noText, { x: (PAGE_WIDTH - noW) / 2, y: PAGE_HEIGHT / 2, size: 14, font: fontIt, color: grayMid });
        }

        if (totalPages > 1) {
          const pageInfo = "Page " + p + " / " + totalPages;
          const piW = fontIt.widthOfTextAtSize(pageInfo, 10);
          pg.drawText(pageInfo, { x: (PAGE_WIDTH - piW) / 2, y: 30, size: 10, font: fontIt, color: grayMid });
        }
      }
    } catch (e) { console.warn("[PDF] Pages livres échouées (non bloquant):", e.message); }

    // 7. Sauvegarder et retourner en base64
    const finalBytes = await pdfDoc.save();
    const base64 = Buffer.from(finalBytes).toString("base64");

    console.log("[GENERATE-PDF] ✅ PDF watermarqué :", book_title, "- Taille :", finalBytes.length, "octets");

    return res.status(200).json({ success: true, base64, size: finalBytes.length });

  } catch (err) {
    console.error("[GENERATE-PDF] Erreur:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
