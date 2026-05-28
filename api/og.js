// =============================================================
// 🎨 OG IMAGE GENERATOR - CarryBooks
// Génère une image promo 1200x630 pour Facebook/WhatsApp
// Format Amazon/Audible : couverture à gauche, infos à droite
// =============================================================

import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

// Variante : supprime apostrophes/quotes avant de slugifier
function slugifyAlt(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

function truncate(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.substring(0, max).trim() + "...";
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug") || "";
    const type = url.searchParams.get("type") || "book";

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    let book = null;
    if (supabaseUrl && supabaseKey && slug) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: books } = await supabase
        .from("books")
        .select("title, author, cover, summary, price, original_price, category, product_type")
        .eq("status", "actif")
        .limit(5000);

      if (books && books.length > 0) {
        book = books.find((b) => slugify(b.title) === slug || slugifyAlt(b.title) === slug);
      }
    }

    // Fallback si livre non trouvé
    const title = book?.title || "CarryBooks";
    const author = book?.author || "Landrine Maff";
    const cover = book?.cover || "https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg";
    const summary = book?.summary
      ? truncate(book.summary.replace(/\n/g, " ").replace(/\s+/g, " "), 180)
      : "Découvrez ce contenu sur CarryBooks, ta librairie numérique camerounaise.";
    const price = book?.price ? parseInt(book.price).toLocaleString() : null;
    const originalPrice = book?.original_price ? parseInt(book.original_price).toLocaleString() : null;
    const isPromo = price && originalPrice && parseInt(book.original_price) > parseInt(book.price);
    const promoPct = isPromo
      ? Math.round(
          ((parseInt(book.original_price) - parseInt(book.price)) /
            parseInt(book.original_price)) *
            100
        )
      : 0;
    const isPhysical = book?.product_type === "article" || book?.product_type === "papier";

    return new ImageResponse(
      {
        type: "div",
        props: {
          style: {
            width: "1200px",
            height: "960px",
            display: "flex",
            background: "linear-gradient(135deg, #f5ecd9 0%, #ebd9b0 100%)",
            padding: "50px",
            fontFamily: "Georgia, serif",
          },
          children: [
            // === COUVERTURE À GAUCHE ===
            {
              type: "div",
              props: {
                style: {
                  width: "460px",
                  height: "690px",
                  display: "flex",
                  flexShrink: 0,
                  marginRight: "40px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                },
                children: [
                  {
                    type: "img",
                    props: {
                      src: cover,
                      style: {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      },
                    },
                  },
                ],
              },
            },

            // === BLOC TEXTE À DROITE ===
            {
              type: "div",
              props: {
                style: {
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingRight: "20px",
                },
                children: [
                  // Logo + nom CarryBooks
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "24px",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: {
                              fontSize: "26px",
                              fontWeight: 700,
                              color: "#1a1a1a",
                              letterSpacing: "0.5px",
                            },
                            children: "Carry",
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: {
                              fontSize: "26px",
                              fontWeight: 700,
                              color: "#c9a84c",
                              letterSpacing: "0.5px",
                            },
                            children: "Books",
                          },
                        },
                      ],
                    },
                  },

                  // Catégorie
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "16px",
                        color: "#7a6b4a",
                        letterSpacing: "3px",
                        textTransform: "uppercase",
                        marginBottom: "12px",
                      },
                      children: book?.category || "Livre Numérique",
                    },
                  },

                  // Titre
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: title.length > 40 ? "40px" : "48px",
                        fontWeight: 700,
                        color: "#1a1a1a",
                        lineHeight: 1.1,
                        marginBottom: "12px",
                        display: "flex",
                      },
                      children: truncate(title, 60),
                    },
                  },

                  // Auteur
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "22px",
                        color: "#7a6b4a",
                        fontStyle: "italic",
                        marginBottom: "20px",
                      },
                      children: "par " + author,
                    },
                  },

                  // Résumé
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "18px",
                        color: "#3a3a3a",
                        lineHeight: 1.4,
                        marginBottom: "24px",
                        display: "flex",
                      },
                      children: summary,
                    },
                  },

                  // Prix (au-dessus du CTA)
                  ...(price
                    ? [
                        {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              alignItems: "baseline",
                              gap: "16px",
                              marginTop: "auto",
                              marginBottom: "14px",
                            },
                            children: [
                              ...(isPromo
                                ? [
                                    {
                                      type: "div",
                                      props: {
                                        style: {
                                          fontSize: "20px",
                                          color: "#999",
                                          textDecoration: "line-through",
                                        },
                                        children: originalPrice + " FCFA",
                                      },
                                    },
                                  ]
                                : []),
                              {
                                type: "div",
                                props: {
                                  style: {
                                    fontSize: "38px",
                                    fontWeight: 700,
                                    color: "#1a1a1a",
                                    lineHeight: 1,
                                  },
                                  children: price + " FCFA",
                                },
                              },
                              ...(isPromo
                                ? [
                                    {
                                      type: "div",
                                      props: {
                                        style: {
                                          fontSize: "16px",
                                          color: "#fff",
                                          background: "#dc3545",
                                          padding: "6px 12px",
                                          borderRadius: "4px",
                                          fontWeight: 700,
                                        },
                                        children: "🔥 -" + promoPct + "%",
                                      },
                                    },
                                  ]
                                : []),
                            ],
                          },
                        },
                      ]
                    : []),

                  // CTA Button "CLIQUEZ ICI ⬇️ / POUR PROFITER DE L'OFFRE"
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#c9a84c",
                        color: "#1a1a1a",
                        padding: "20px 40px",
                        borderRadius: "12px",
                        boxShadow: "0 6px 20px rgba(201,168,76,0.5)",
                        textAlign: "center",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: {
                              fontSize: "26px",
                              fontWeight: 700,
                              letterSpacing: "1px",
                              lineHeight: 1.1,
                              display: "flex",
                            },
                            children: "👉 CLIQUEZ ICI 👈",
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: {
                              fontSize: "22px",
                              fontWeight: 700,
                              letterSpacing: "0.5px",
                              marginTop: "6px",
                              display: "flex",
                            },
                            children: isPromo
                              ? "Pour profiter de l'offre"
                              : "Pour découvrir ce livre",
                          },
                        },
                      ],
                    },
                  },

                  // URL en bas
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "14px",
                        color: "#7a6b4a",
                        letterSpacing: "1px",
                        marginTop: "14px",
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                      },
                      children: "www.carrybooks.com",
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 960,
        headers: {
          "Cache-Control": "public, immutable, no-transform, max-age=86400, s-maxage=86400",
        },
      }
    );
  } catch (e) {
    console.error("[OG] Erreur:", e);
    // Fallback : image avec juste le logo
    return new ImageResponse(
      {
        type: "div",
        props: {
          style: {
            width: "1200px",
            height: "960px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #f5ecd9 0%, #ebd9b0 100%)",
            fontFamily: "Georgia, serif",
          },
          children: [
            {
              type: "div",
              props: {
                style: {
                  fontSize: "72px",
                  fontWeight: 700,
                  color: "#c9a84c",
                },
                children: "CarryBooks",
              },
            },
          ],
        },
      },
      { width: 1200, height: 960 }
    );
  }
}
