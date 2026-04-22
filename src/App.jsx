import { useState, useEffect } from "react";
import PaymentModal from "./PaymentModal.jsx";
import { getBooks } from "./supabase.js";

const CATEGORIES = ["Tous", "Business", "Finance", "Marketing", "Développement Personnel", "Psychologie", "Santé", "Roman", "Spiritualité", "Cuisine", "Education"];

/* ─── BOOK READER ────────────────────────────────────────────── */
function BookReader({ book, onBack }) {
  const PF = { fontFamily: "'Playfair Display',Georgia,serif" };
  const S = { fontFamily: "Lato,sans-serif" };

  // Parse content into pages (~1800 chars per page)
  const CHARS_PER_PAGE = 1800;
  const rawContent = book.content || "";
  // Normalize: replace single \n with space, keep \n\n as paragraph breaks
  const normalized = rawContent
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\n([^\n])/g, "$1 $2");

  const paragraphs = normalized.split("\n\n").filter(p => p.trim());

  // Group paragraphs into pages
  const pages = [];
  let currentPage = [];
  let currentLen = 0;

  paragraphs.forEach(para => {
    if (currentLen + para.length > CHARS_PER_PAGE && currentPage.length > 0) {
      pages.push([...currentPage]);
      currentPage = [para];
      currentLen = para.length;
    } else {
      currentPage.push(para);
      currentLen += para.length;
    }
  });
  if (currentPage.length > 0) pages.push(currentPage);

  // Extract chapters for table of contents
  const chapters = paragraphs
    .filter(p => p.toLowerCase().startsWith("chapitre"))
    .map((p, i) => ({ title: p.split("\n")[0], index: i }));

  const totalPages = Math.max(pages.length, 1);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showTOC, setShowTOC] = useState(false);
  const [animDir, setAnimDir] = useState(null); // "left" | "right"
  const [animating, setAnimating] = useState(false);

  const goTo = (idx, dir) => {
    if (idx < 0 || idx >= totalPages || animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrentPageIndex(idx);
      setAnimating(false);
      setAnimDir(null);
      window.scrollTo(0, 0);
    }, 300);
  };

  const progress = totalPages > 1 ? Math.round((currentPageIndex / (totalPages - 1)) * 100) : 100;

  const renderPara = (para, i) => {
    if (para === "---") return <div key={i} style={{ width: 40, height: 1, background: "#CCC", margin: "28px auto" }}></div>;
    const html = para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (para.toLowerCase().startsWith("chapitre")) {
      return <h2 key={i} style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: "36px 0 18px", lineHeight: 1.4, textAlign: "center", letterSpacing: 1 }} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return <p key={i} style={{ marginBottom: 18, textAlign: "justify", textAlignLast: "left", hyphens: "auto", WebkitHyphens: "auto", MozHyphens: "auto", textIndent: "2em", lineHeight: 1.95, color: "#1A1A1A", fontSize: 15, wordSpacing: "0.05em" }} dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div style={{ fontFamily: "Lato,sans-serif", background: "#F5F0E8", minHeight: "100vh", color: "#1A1A1A" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .page-content{animation:fadeIn 0.3s ease}
        .nav-btn{background:#fff;border:1px solid #DDD;color:#555;width:44px;height:44px;cursor:pointer;font-size:22px;transition:all .2s;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
        .nav-btn:hover:not(:disabled){border-color:#C9A96E;color:#C9A96E;background:#FFF8F0}
        .nav-btn:disabled{opacity:0.25;cursor:not-allowed}
        @media(max-width:768px){.reader-inner{padding:28px 18px 100px!important;font-size:15px!important}}
      `}</style>

      {/* TOP BAR */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E0D0", padding: "0 20px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontFamily: "Lato,sans-serif", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          ← Quitter
        </button>
        <div style={{ textAlign: "center", flex: 1, padding: "0 12px" }}>
          <p style={{ fontFamily: "Georgia,serif", fontSize: 13, fontWeight: 700, color: "#1A1A1A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.title}</p>
          <p style={{ fontFamily: "Lato,sans-serif", fontSize: 10, color: "#AAA", marginTop: 1 }}>Page {currentPageIndex + 1} sur {totalPages}</p>
        </div>
        <button onClick={() => setShowTOC(!showTOC)}
          style={{ background: showTOC ? "#FFF8F0" : "none", border: "1px solid #DDD", color: "#888", padding: "5px 10px", cursor: "pointer", fontFamily: "Lato,sans-serif", fontSize: 11, borderRadius: 4 }}>
          ☰ Chapitres
        </button>
      </div>

      {/* PROGRESS BAR */}
      <div style={{ height: 3, background: "#E8E0D0" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "#C9A96E", transition: "width 0.4s ease" }} />
      </div>

      {/* TABLE OF CONTENTS */}
      {showTOC && (
        <div style={{ background: "#fff", borderBottom: "1px solid #E8E0D0", padding: "18px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p style={{ fontFamily: "Lato,sans-serif", fontSize: 11, letterSpacing: 2, color: "#C9A96E", textTransform: "uppercase", marginBottom: 12 }}>Table des matières</p>
          {chapters.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {chapters.map((ch, i) => (
                <button key={i} onClick={() => setShowTOC(false)}
                  style={{ background: "none", border: "none", color: "#333", fontFamily: "Georgia,serif", fontSize: 14, textAlign: "left", cursor: "pointer", padding: "6px 0", borderBottom: "1px solid #F0EAE0" }}>
                  {ch.title}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: "Lato,sans-serif", fontSize: 13, color: "#AAA", fontStyle: "italic" }}>Aucun chapitre détecté</p>
          )}
        </div>
      )}

      {/* PAGE CONTENT — white paper style */}
      <div style={{ maxWidth: 660, margin: "32px auto 0", padding: "0 16px 120px" }}>
        <div style={{ background: "#fff", boxShadow: "0 2px 20px rgba(0,0,0,0.10)", minHeight: 500 }}>

          {/* First page title */}
          {currentPageIndex === 0 && (
            <div style={{ textAlign: "center", padding: "40px 40px 28px", borderBottom: "1px solid #F0EAE0" }}>
              <h1 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, fontStyle: "italic", color: "#1A1A1A", marginBottom: 8, lineHeight: 1.4 }}>{book.title}</h1>
              <p style={{ fontFamily: "Lato,sans-serif", fontSize: 13, color: "#888" }}>par {book.author}</p>
            </div>
          )}

          {/* Page text */}
          <div className="page-content reader-inner" lang="fr" style={{ padding: "36px 44px 40px", textAlign: "justify" }}>
            {!book.content ? (
              <p style={{ textAlign: "center", color: "#AAA", fontStyle: "italic", padding: "40px 0" }}>Le contenu de ce livre n'est pas encore disponible.</p>
            ) : (
              (pages[currentPageIndex] || []).map((para, i) => renderPara(para, i))
            )}
          </div>

          {/* Page number */}
          <div style={{ textAlign: "center", padding: "12px 0 20px", borderTop: "1px solid #F0EAE0" }}>
            <p style={{ fontFamily: "Georgia,serif", fontSize: 12, color: "#BBB", letterSpacing: 2 }}>— {currentPageIndex + 1} —</p>
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(245,240,232,0.97)", backdropFilter: "blur(8px)", borderTop: "1px solid #E8E0D0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, zIndex: 40 }}>
        <button className="nav-btn" onClick={() => goTo(currentPageIndex - 1, "right")} disabled={currentPageIndex === 0}>‹</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "Lato,sans-serif", fontSize: 11, color: "#AAA", flexShrink: 0 }}>1</span>
          <input type="range" min={0} max={totalPages - 1} value={currentPageIndex}
            onChange={e => goTo(parseInt(e.target.value), parseInt(e.target.value) > currentPageIndex ? "left" : "right")}
            style={{ flex: 1, accentColor: "#C9A96E", cursor: "pointer" }} />
          <span style={{ fontFamily: "Lato,sans-serif", fontSize: 11, color: "#AAA", flexShrink: 0 }}>{totalPages}</span>
        </div>
        <button className="nav-btn" onClick={() => goTo(currentPageIndex + 1, "left")} disabled={currentPageIndex >= totalPages - 1}>›</button>
      </div>
    </div>
  );
}

export default function BookPlatform() {
  const [view, setView] = useState("home");
  const [sel, setSel] = useState(null);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [purchased, setPurchased] = useState([]);
  const [payModal, setPayModal] = useState(false);
  const [search, setSearch] = useState("");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const PF = { fontFamily: "'Playfair Display',Georgia,serif" };
  const S = { fontFamily: "Lato,sans-serif" };

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    const data = await getBooks();
    setBooks(data);
    setLoading(false);
  };

  const filtered = books.filter(b => {
    const mc = activeCategory === "Tous" || b.category === activeCategory;
    const ms = b.title?.toLowerCase().includes(search.toLowerCase()) || b.author?.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const featured = books[0];
  const isFree = (book) => !book.price || book.price === 0;
  const hasAccess = (book) => isFree(book) || purchased.includes(book.id);
  const openRead = (book) => { setSel(book); setView("reader"); };
  const openPay = (book) => {
    if (isFree(book)) { setSel(book); setPurchased(p => [...p, book.id]); setView("reader"); return; }
    setSel(book); setPayModal(true);
  };
  const onPaySuccess = () => { setPurchased(p => [...p, sel.id]); setPayModal(false); setView("reader"); };

  return (
    <div style={{ ...S, background: "#0F0D0A", minHeight: "100vh", color: "#F5F0E8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Lato:wght@300;400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .btn-gold{background:linear-gradient(135deg,#C9A96E,#E8C98A);color:#0F0D0A;border:none;padding:12px 28px;font-family:Lato,sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .3s}
        .btn-gold:hover{opacity:.85;transform:translateY(-1px)}
        .btn-out{background:transparent;color:#C9A96E;border:1px solid #C9A96E;padding:10px 24px;font-family:Lato,sans-serif;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .3s}
        .btn-out:hover{background:rgba(201,169,110,.1)}
        .card{transition:transform .3s,box-shadow .3s;cursor:pointer}
        .card:hover{transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,.5)}
        input{outline:none;font-family:Lato,sans-serif}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0F0D0A}::-webkit-scrollbar-thumb{background:#3A3228}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* ── RESPONSIVE MOBILE ── */
        .hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;padding:80px 40px 60px;max-width:1200px;margin:0 auto}
        .book-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .catalog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
        .book-detail-grid{display:grid;grid-template-columns:300px 1fr;gap:60px}
        .featured-grid{display:grid;grid-template-columns:auto 1fr;gap:48px;align-items:center;max-width:1200px;margin:0 auto}
        .nav-links{display:flex;gap:32px}
        .page-pad{padding:50px 40px}
        .stats-row{display:flex;gap:32px;margin-top:44px}
        .lib-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}

        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr;gap:32px;padding:40px 20px 32px}
          .book-mini-grid{grid-template-columns:1fr 1fr;gap:10px}
          .catalog-grid{grid-template-columns:1fr 1fr;gap:16px}
          .book-detail-grid{grid-template-columns:1fr;gap:32px}
          .featured-grid{grid-template-columns:1fr;gap:24px}
          .nav-links{gap:16px}
          .page-pad{padding:28px 16px}
          .stats-row{gap:20px;margin-top:28px}
          .lib-grid{grid-template-columns:1fr;gap:16px}
          .btn-gold{padding:11px 18px;font-size:12px}
          .btn-out{padding:9px 16px;font-size:11px}
          .hero-title{font-size:36px!important}
          .featured-img{width:140px!important;height:190px!important}
          .hide-mobile{display:none!important}
        }
        @media(max-width:480px){
          .catalog-grid{grid-template-columns:1fr}
          .nav-links span:last-child{display:none}
        }
      `}</style>

      {payModal && sel && <PaymentModal book={sel} onClose={() => setPayModal(false)} onSuccess={onPaySuccess} />}

      {/* NAV */}
      <nav style={{ borderBottom: "1px solid #2A2420", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, background: "rgba(15,13,10,0.97)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#C9A96E,#E8C98A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#0F0D0A", fontFamily: "Georgia" }}>L</span>
          </div>
          <span style={{ ...PF, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>LIBRAIRIE<span style={{ color: "#C9A96E" }}>.</span></span>
        </div>
        <div className="nav-links" style={{ display: "flex" }}>
          {[["home","Accueil"],["catalog","Catalogue"],["library","Bibliothèque"]].map(([v,l]) => (
            <span key={v} onClick={() => setView(v)} style={{ cursor: "pointer", ...S, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: view === v ? "#C9A96E" : "#A89880", transition: "color .2s", padding: "0 8px" }}>{l}</span>
          ))}
        </div>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(201,169,110,.12)", border: "1px solid rgba(201,169,110,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#C9A96E" }}>L</span>
        </div>
      </nav>

      {/* LOADING */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 20 }}>
          <div style={{ width: 40, height: 40, border: "2px solid #2A2420", borderTop: "2px solid #C9A96E", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
          <p style={{ ...S, fontSize: 13, color: "#5A5040", letterSpacing: 2, textTransform: "uppercase" }}>Chargement des livres...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* HOME */}
          {view === "home" && (
            <div>
              <div className="hero-grid">
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,169,110,.1)", border: "1px solid rgba(201,169,110,.3)", padding: "6px 14px", marginBottom: 24 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A96E", display: "block" }}></span>
                    <span style={{ ...S, fontSize: 10, letterSpacing: 2, color: "#C9A96E", textTransform: "uppercase" }}>Plateforme de Lecture Premium</span>
                  </div>
                  <h1 className="hero-title" style={{ ...PF, fontSize: 52, fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                    Les livres qui<br /><em style={{ color: "#C9A96E" }}>transforment</em><br />des vies.
                  </h1>
                  <p style={{ ...S, fontSize: 15, color: "#A89880", lineHeight: 1.8, marginBottom: 28, maxWidth: 400 }}>
                    Accédez à des livres soigneusement sélectionnés. Payez uniquement ce que vous lisez.
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button className="btn-gold" onClick={() => setView("catalog")}>Explorer le catalogue</button>
                    <button className="btn-out" onClick={() => setView("library")}>Ma bibliothèque</button>
                  </div>
                  <div className="stats-row">
                    {[[books.length.toString(),"Livres"],[`${books.reduce((s,b)=>s+(b.readers||0),0).toLocaleString()}`,"Lecteurs"],["4.8★","Note moy."]].map(([n,l]) => (
                      <div key={l}>
                        <p style={{ ...PF, fontSize: 22, fontWeight: 700, color: "#C9A96E" }}>{n}</p>
                        <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 1, textTransform: "uppercase" }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="book-mini-grid hide-mobile">
                  {books.slice(0,4).map((book,i) => (
                    <div key={book.id} className="card" onClick={() => { setSel(book); setView("book"); }} style={{ transform: i%2===1?"translateY(20px)":"none" }}>
                      <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={book.title} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                      <div style={{ background: "#1A1713", padding: "12px 14px", borderTop: "2px solid #C9A96E" }}>
                        <p style={{ ...PF, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{book.title}</p>
                        <p style={{ ...S, fontSize: 11, color: "#A89880" }}>{book.price > 0 ? `${book.price?.toLocaleString()} FCFA` : "Gratuit"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment strip */}
              <div style={{ borderTop: "1px solid #1E1B16", borderBottom: "1px solid #1E1B16", padding: "14px 20px", background: "#0C0A08" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
                  {[["🟠","Orange Money","#FF7900"],["🟡","MTN MoMo","#FFCC00"],["💳","Visa","#C9A96E"],["🌐","PayPal","#009cde"],["🔒","SSL","#4E9E5F"]].map(([icon,label,color]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, opacity: 0.75 }}>
                      <span style={{ fontSize: 13 }}>{icon}</span>
                      <span style={{ ...S, fontSize: 11, color, fontWeight: 700 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Featured */}
              {featured && (
                <div style={{ background: "#161310", borderBottom: "1px solid #2A2420", padding: "40px 20px" }}>
                  <div className="featured-grid">
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", inset: -10, background: "linear-gradient(135deg,rgba(201,169,110,0.2),transparent)" }}></div>
                      <img className="featured-img" src={featured.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={featured.title} style={{ width: 200, height: 270, objectFit: "cover", position: "relative", zIndex: 1, display: "block" }} />
                    </div>
                    <div>
                      <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(201,169,110,.12)", border: "1px solid rgba(201,169,110,.3)", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#C9A96E", marginBottom: 14 }}>⭐ À la une</div>
                      <h2 style={{ ...PF, fontSize: 28, fontWeight: 900, marginBottom: 8, lineHeight: 1.2 }}>{featured.title}</h2>
                      <p style={{ ...S, color: "#A89880", marginBottom: 12, fontSize: 13 }}>par {featured.author} · {featured.category}</p>
                      <p style={{ ...S, fontSize: 14, color: "#C8BFA8", lineHeight: 1.7, maxWidth: 500, marginBottom: 20 }}>{(featured.summary||"").substring(0,120)}...</p>
                      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
                        {[["Note",`${featured.rating || 4.5}/5`],["Prix", isFree(featured) ? "Gratuit" : `${featured.price?.toLocaleString()} FCFA`]].map(([k,v]) => (
                          <div key={k}>
                            <p style={{ ...S, fontSize: 10, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{k}</p>
                            <p style={{ ...PF, fontSize: 18, color: isFree(featured) && k==="Prix" ? "#4E9E5F" : "#C9A96E" }}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn-gold" onClick={() => { setSel(featured); setView("book"); }}>Voir le livre</button>
                        {hasAccess(featured)
                          ? <button className="btn-out" onClick={() => { setSel(featured); setView("reader"); }}>Lire maintenant</button>
                          : <button className="btn-out" onClick={() => openPay(featured)}>Acheter</button>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATALOG */}
          {view === "catalog" && (
            <div className="page-pad" style={{ maxWidth: 1300, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Notre sélection</p>
                  <h1 style={{ ...PF, fontSize: 30, fontWeight: 900 }}>Catalogue</h1>
                </div>
                <input type="text" placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ maxWidth: 260, width: "100%", background: "#1A1713", border: "1px solid #3A3228", color: "#F5F0E8", padding: "9px 14px", fontSize: 13 }} />
              </div>

              {/* Categories */}
              <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setActiveCategory(c)}
                    style={{ padding: "6px 14px", ...S, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", background: activeCategory===c ? "linear-gradient(135deg,#C9A96E,#E8C98A)" : "transparent", color: activeCategory===c ? "#0F0D0A" : "#A89880", border: activeCategory===c ? "none" : "1px solid #3A3228", fontWeight: activeCategory===c ? 700 : 400 }}>
                    {c}
                  </button>
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <p style={{ ...PF, fontSize: 22, color: "#5A5040" }}>Aucun livre trouvé</p>
                </div>
              )}

              {/* VITRINE — couvertures format A5 comme Amazon */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 24 }}>
                {filtered.map(book => (
                  <div key={book.id} className="card" onClick={() => setSel(sel?.id === book.id ? null : book)}
                    style={{ cursor: "pointer" }}>

                    {/* Couverture pleine format A5 (ratio 0.7) */}
                    <div style={{ position: "relative", borderRadius: 3, overflow: "hidden", boxShadow: sel?.id === book.id ? "0 0 0 2px #C9A96E, 0 8px 32px rgba(0,0,0,0.6)" : "0 4px 16px rgba(0,0,0,0.5)", transition: "box-shadow 0.2s, transform 0.2s", transform: sel?.id === book.id ? "scale(1.02)" : "scale(1)" }}>
                      <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={book.title}
                        style={{ width: "100%", height: "auto", aspectRatio: "0.7", objectFit: "cover", display: "block" }} />

                      {/* Badge GRATUIT */}
                      {isFree(book) && (
                        <div style={{ position: "absolute", top: 10, left: 0, background: "#4E9E5F", padding: "4px 12px 4px 8px", clipPath: "polygon(0 0, 100% 0, 88% 100%, 0 100%)" }}>
                          <span style={{ fontFamily: "Lato,sans-serif", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1.5 }}>GRATUIT</span>
                        </div>
                      )}
                      {!isFree(book) && hasAccess(book) && (
                        <div style={{ position: "absolute", top: 10, right: 0, background: "#4E9E5F", padding: "4px 8px 4px 12px" }}>
                          <span style={{ fontFamily: "Lato,sans-serif", fontSize: 9, color: "#fff" }}>✓ Lu</span>
                        </div>
                      )}
                    </div>

                    {/* Titre + Prix sous la couverture */}
                    <div style={{ padding: "10px 4px 6px" }}>
                      <p style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 13, fontWeight: 700, color: "#F5F0E8", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</p>
                      <p style={{ fontFamily: "Lato,sans-serif", fontSize: 11, color: "#7A6850", marginBottom: 6 }}>{book.author}</p>
                      <p style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 14, fontWeight: 700, color: isFree(book) ? "#4E9E5F" : "#C9A96E" }}>
                        {isFree(book) ? "Gratuit" : `${book.price?.toLocaleString()} FCFA`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* PANNEAU DÉTAIL — s'ouvre au clic */}
              {sel && view === "catalog" && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1A1713", borderTop: "2px solid #C9A96E", padding: "20px 24px", zIndex: 100, boxShadow: "0 -8px 32px rgba(0,0,0,0.5)", maxHeight: "55vh", overflowY: "auto" }}>
                  <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gridTemplateColumns: "90px 1fr", gap: 18, alignItems: "start" }}>
                    <img src={sel.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={sel.title}
                      style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 2 }} />
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ display: "inline-block", padding: "2px 8px", ...S, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", background: "rgba(201,169,110,0.15)", color: "#C9A96E", marginBottom: 6 }}>{sel.category}</div>
                          <h2 style={{ ...PF, fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{sel.title}</h2>
                          <p style={{ ...S, fontSize: 12, color: "#A89880", marginBottom: 10 }}>par {sel.author}</p>
                        </div>
                        <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: "#5A5040", fontSize: 22, cursor: "pointer", flexShrink: 0, padding: "0 4px" }}>×</button>
                      </div>
                      <p style={{ ...S, fontSize: 13, color: "#C8BFA8", lineHeight: 1.6, marginBottom: 14 }}>{sel.summary || "Aucune description disponible."}</p>
                      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
                        <div>
                          <p style={{ ...S, fontSize: 9, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5 }}>Prix</p>
                          <p style={{ ...PF, fontSize: 18, color: isFree(sel) ? "#4E9E5F" : "#C9A96E", fontWeight: 700 }}>{isFree(sel) ? "Gratuit" : `${sel.price?.toLocaleString()} FCFA`}</p>
                        </div>
                        <div>
                          <p style={{ ...S, fontSize: 9, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5 }}>Note</p>
                          <p style={{ ...PF, fontSize: 18, color: "#C9A96E" }}>★ {sel.rating || 4.5}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {hasAccess(sel)
                          ? <button className="btn-gold" style={{ padding: "10px 20px" }} onClick={() => { setView("reader"); }}>Lire maintenant</button>
                          : <button className="btn-gold" style={{ padding: "10px 20px" }} onClick={() => openPay(sel)}>
                              {isFree(sel) ? "Lire gratuitement" : `Acheter — ${sel.price?.toLocaleString()} FCFA`}
                            </button>}
                        <button className="btn-out" style={{ padding: "10px 20px" }} onClick={() => setSel(null)}>Fermer</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOOK DETAIL */}
          {view === "book" && sel && (
            <div className="page-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
              <button style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", ...S, fontSize: 13, letterSpacing: 1, marginBottom: 28, display: "flex", alignItems: "center", gap: 8 }} onClick={() => setView("catalog")}>← Retour</button>
              <div className="book-detail-grid">
                <div>
                  <div style={{ position: "relative", maxWidth: 280 }}>
                    <div style={{ position: "absolute", inset: -10, background: "linear-gradient(135deg,rgba(201,169,110,0.13),transparent)" }}></div>
                    <img src={sel.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={sel.title} style={{ width: "100%", display: "block", position: "relative", zIndex: 1 }} />
                  </div>
                  <div style={{ marginTop: 18, maxWidth: 280 }}>
                    {hasAccess(sel)
                      ? <button className="btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={() => setView("reader")}>Lire maintenant</button>
                      : <button className="btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={() => openPay(sel)}>Acheter — {sel.price?.toLocaleString()} FCFA</button>}
                    <button className="btn-out" style={{ width: "100%" }} onClick={() => setView("catalog")}>Voir d'autres livres</button>
                  </div>
                  {!isFree(sel) && (
                    <div style={{ marginTop: 14, padding: "10px", background: "rgba(78,158,95,.06)", border: "1px solid rgba(78,158,95,.18)", textAlign: "center", maxWidth: 280 }}>
                      <p style={{ ...S, fontSize: 11, color: "#6AB87A", lineHeight: 1.7 }}>🔒 Orange Money · MTN · Visa · PayPal</p>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ display: "inline-block", padding: "4px 10px", background: "rgba(201,169,110,0.1)", color: "#C9A96E", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>{sel.category}</div>
                  <h1 style={{ ...PF, fontSize: 30, fontWeight: 900, lineHeight: 1.15, marginBottom: 8 }}>{sel.title}</h1>
                  <p style={{ ...S, fontSize: 14, color: "#A89880", marginBottom: 20 }}>par <span style={{ color: "#C9A96E" }}>{sel.author}</span></p>
                  <div style={{ display: "flex", gap: 24, marginBottom: 28, paddingBottom: 28, borderBottom: "1px solid #2A2420", flexWrap: "wrap" }}>
                    {[["Note",`${sel.rating || 4.5}/5`],["Lecteurs",(sel.readers||0).toLocaleString()],["Prix", isFree(sel) ? "Gratuit" : `${sel.price?.toLocaleString()} F`]].map(([k,v]) => (
                      <div key={k}>
                        <p style={{ ...S, fontSize: 10, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{k}</p>
                        <p style={{ ...PF, fontSize: 18, color: isFree(sel) && k==="Prix" ? "#4E9E5F" : "#C9A96E" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <h2 style={{ ...PF, fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Résumé</h2>
                  <p style={{ ...S, fontSize: 14, color: "#C8BFA8", lineHeight: 1.8 }}>{sel.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* READER */}
          {view === "reader" && sel && <BookReader book={sel} onBack={() => setView("book")} />}

          {/* LIBRARY */}
          {view === "library" && (
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "50px 40px" }}>
              <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 8 }}>Vos acquisitions</p>
              <h1 style={{ ...PF, fontSize: 42, fontWeight: 900, marginBottom: 40 }}>Ma Bibliothèque</h1>
              {purchased.length === 0
                ? <div style={{ textAlign: "center", padding: "80px 0" }}>
                    <p style={{ ...PF, fontSize: 22, color: "#A89880", marginBottom: 20 }}>Votre bibliothèque est vide</p>
                    <button className="btn-gold" onClick={() => setView("catalog")}>Explorer le catalogue</button>
                  </div>
                : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
                    {books.filter(b => purchased.includes(b.id)).map(book => (
                      <div key={book.id} style={{ background: "#1A1713", border: "1px solid #2A2420", display: "flex", gap: 18, padding: 18 }}>
                        <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={book.title} style={{ width: 76, height: 104, objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ ...PF, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{book.title}</p>
                          <p style={{ ...S, fontSize: 12, color: "#A89880", marginBottom: 10 }}>{book.author}</p>
                          <div style={{ height: 3, background: "#2A2420", marginBottom: 7 }}><div style={{ height: "100%", width: "8%", background: "linear-gradient(90deg,#C9A96E,#E8C98A)" }}></div></div>
                          <p style={{ ...S, fontSize: 11, color: "#5A5040", marginBottom: 12 }}>8% lu</p>
                          <button className="btn-gold" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => { setSel(book); setView("reader"); }}>Continuer</button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {view !== "reader" && (
            <footer style={{ borderTop: "1px solid #1E1B16", padding: "28px 40px", marginTop: 40 }}>
              <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ ...PF, fontSize: 16, fontWeight: 700 }}>LIBRAIRIE<span style={{ color: "#C9A96E" }}>.</span></span>
                <p style={{ ...S, fontSize: 11, color: "#5A5040" }}>🔒 Orange Money · MTN MoMo · Visa · Mastercard · PayPal</p>
                <p style={{ ...S, fontSize: 11, color: "#2A2420" }}>© 2025</p>
              </div>
            </footer>
          )}
        </>
      )}
    </div>
  );
}
