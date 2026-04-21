import { useState, useEffect } from "react";
import PaymentModal from "./PaymentModal.jsx";
import { getBooks } from "./supabase.js";

const CATEGORIES = ["Tous", "Business", "Finance", "Marketing", "Développement Personnel", "Psychologie", "Santé", "Roman", "Spiritualité", "Cuisine", "Education"];

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
  const isOwned = (book) => purchased.includes(book.id) || isFree(book);
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
      `}</style>

      {payModal && sel && <PaymentModal book={sel} onClose={() => setPayModal(false)} onSuccess={onPaySuccess} />}

      {/* NAV */}
      <nav style={{ borderBottom: "1px solid #2A2420", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, background: "rgba(15,13,10,0.97)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#C9A96E,#E8C98A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#0F0D0A", fontFamily: "Georgia" }}>L</span>
          </div>
          <span style={{ ...PF, fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>LIBRAIRIE<span style={{ color: "#C9A96E" }}>.</span></span>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {[["home","Accueil"],["catalog","Catalogue"],["library","Ma Bibliothèque"]].map(([v,l]) => (
            <span key={v} onClick={() => setView(v)} style={{ cursor: "pointer", ...S, fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: view === v ? "#C9A96E" : "#A89880", transition: "color .2s" }}>{l}</span>
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,169,110,.12)", border: "1px solid rgba(201,169,110,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, color: "#C9A96E" }}>L</span>
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
              <div style={{ padding: "80px 40px 60px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,169,110,.1)", border: "1px solid rgba(201,169,110,.3)", padding: "6px 16px", marginBottom: 28 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A96E", display: "block" }}></span>
                    <span style={{ ...S, fontSize: 11, letterSpacing: 2, color: "#C9A96E", textTransform: "uppercase" }}>Plateforme de Lecture Premium</span>
                  </div>
                  <h1 style={{ ...PF, fontSize: 52, fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
                    Les livres qui<br /><em style={{ color: "#C9A96E" }}>transforment</em><br />des vies.
                  </h1>
                  <p style={{ ...S, fontSize: 15, color: "#A89880", lineHeight: 1.8, marginBottom: 36, maxWidth: 400 }}>
                    Accédez à des livres soigneusement sélectionnés. Payez uniquement ce que vous lisez.
                  </p>
                  <div style={{ display: "flex", gap: 14 }}>
                    <button className="btn-gold" onClick={() => setView("catalog")}>Explorer le catalogue</button>
                    <button className="btn-out" onClick={() => setView("library")}>Ma bibliothèque</button>
                  </div>
                  <div style={{ display: "flex", gap: 32, marginTop: 44 }}>
                    {[[books.length.toString(),"Livres"],[`${books.reduce((s,b)=>s+(b.readers||0),0).toLocaleString()}`,"Lecteurs"],["4.8★","Note moy."]].map(([n,l]) => (
                      <div key={l}>
                        <p style={{ ...PF, fontSize: 24, fontWeight: 700, color: "#C9A96E" }}>{n}</p>
                        <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 1, textTransform: "uppercase" }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {books.slice(0,4).map((book,i) => (
                    <div key={book.id} className="card" onClick={() => { setSel(book); setView("book"); }} style={{ transform: i%2===1?"translateY(20px)":"none" }}>
                      <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={book.title} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                      <div style={{ background: "#1A1713", padding: "12px 14px", borderTop: "2px solid #C9A96E" }}>
                        <p style={{ ...PF, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{book.title}</p>
                        <p style={{ ...S, fontSize: 11, color: "#A89880" }}>{book.price?.toLocaleString()} FCFA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment strip */}
              <div style={{ borderTop: "1px solid #1E1B16", borderBottom: "1px solid #1E1B16", padding: "18px 40px", background: "#0C0A08" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 36, flexWrap: "wrap" }}>
                  <p style={{ ...S, fontSize: 10, letterSpacing: 2.5, color: "#3A3228", textTransform: "uppercase" }}>Paiements acceptés</p>
                  {[["🟠","Orange Money","#FF7900"],["🟡","MTN MoMo","#FFCC00"],["💳","Visa / Mastercard","#C9A96E"],["🌐","PayPal","#009cde"],["🔒","SSL 256-bit","#4E9E5F"]].map(([icon,label,color]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.75 }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span style={{ ...S, fontSize: 12, color, fontWeight: 700 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Featured */}
              {featured && (
                <div style={{ background: "#161310", borderBottom: "1px solid #2A2420", padding: "60px 40px" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "auto 1fr", gap: 48, alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", inset: -10, background: "linear-gradient(135deg,rgba(201,169,110,0.2),transparent)" }}></div>
                      <img src={featured.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={featured.title} style={{ width: 220, height: 300, objectFit: "cover", position: "relative", zIndex: 1, display: "block" }} />
                    </div>
                    <div>
                      <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(201,169,110,.12)", border: "1px solid rgba(201,169,110,.3)", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#C9A96E", marginBottom: 16 }}>⭐ À la une</div>
                      <h2 style={{ ...PF, fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{featured.title}</h2>
                      <p style={{ ...S, color: "#A89880", marginBottom: 16, fontSize: 14 }}>par {featured.author} · {featured.category}</p>
                      <p style={{ ...S, fontSize: 15, color: "#C8BFA8", lineHeight: 1.75, maxWidth: 500, marginBottom: 28 }}>{featured.summary}</p>
                      <div style={{ display: "flex", gap: 28, marginBottom: 28 }}>
                        {[["Note",`${featured.rating || 4.5}/5`],["Lecteurs",(featured.readers||0).toLocaleString()],["Prix",`${featured.price?.toLocaleString()} FCFA`]].map(([k,v]) => (
                          <div key={k}>
                            <p style={{ ...S, fontSize: 10, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{k}</p>
                            <p style={{ ...PF, fontSize: 20, color: "#C9A96E" }}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button className="btn-gold" onClick={() => { setSel(featured); setView("book"); }}>Voir le livre</button>
                        {!purchased.includes(featured.id) && <button className="btn-out" onClick={() => openPay(featured)}>Acheter maintenant</button>}
                        {purchased.includes(featured.id) && <button className="btn-out" onClick={() => { setSel(featured); setView("reader"); }}>Lire maintenant</button>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATALOG */}
          {view === "catalog" && (
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "50px 40px" }}>
              <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 8 }}>Notre sélection</p>
              <h1 style={{ ...PF, fontSize: 42, fontWeight: 900, marginBottom: 28 }}>Catalogue</h1>
              <input type="text" placeholder="Rechercher un livre ou un auteur..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: 400, width: "100%", background: "#1A1713", border: "1px solid #3A3228", color: "#F5F0E8", padding: "10px 16px", fontSize: 14, marginBottom: 32, display: "block" }} />
              <div style={{ display: "flex", gap: 10, marginBottom: 40, flexWrap: "wrap" }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setActiveCategory(c)}
                    style={{ padding: "8px 18px", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", background: activeCategory===c ? "linear-gradient(135deg,#C9A96E,#E8C98A)" : "transparent", color: activeCategory===c ? "#0F0D0A" : "#A89880", border: activeCategory===c ? "none" : "1px solid #3A3228", fontWeight: activeCategory===c ? 700 : 400 }}>
                    {c}
                  </button>
                ))}
              </div>
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <p style={{ ...PF, fontSize: 22, color: "#5A5040" }}>Aucun livre trouvé</p>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
                {filtered.map(book => (
                  <div key={book.id} className="card" style={{ background: "#1A1713", border: `1px solid ${isFree(book) ? "rgba(78,158,95,0.3)" : "#2A2420"}` }}>
                    <div style={{ position: "relative" }} onClick={() => { setSel(book); setView("book"); }}>
                      <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={book.title} style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
                      {isFree(book) && <div style={{ position: "absolute", top: 10, left: 10, background: "#4E9E5F", padding: "4px 10px" }}><span style={{ ...S, fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>GRATUIT</span></div>}
                      {!isFree(book) && hasAccess(book) && <div style={{ position: "absolute", top: 10, right: 10, background: "#4E9E5F", padding: "3px 8px" }}><span style={{ ...S, fontSize: 10, color: "#fff" }}>Acheté</span></div>}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: isFree(book) ? "linear-gradient(90deg,#4E9E5F,transparent)" : "linear-gradient(90deg,#C9A96E,transparent)" }}></div>
                    </div>
                    <div style={{ padding: 18 }}>
                      <div style={{ display: "inline-block", padding: "3px 9px", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", background: "rgba(201,169,110,0.1)", color: "#C9A96E", marginBottom: 10 }}>{book.category}</div>
                      <h3 style={{ ...PF, fontSize: 16, fontWeight: 700, marginBottom: 5, lineHeight: 1.3, cursor: "pointer" }} onClick={() => { setSel(book); setView("book"); }}>{book.title}</h3>
                      <p style={{ ...S, fontSize: 12, color: "#A89880", marginBottom: 8 }}>{book.author}</p>
                      <p style={{ ...S, fontSize: 13, color: "#7A6850", lineHeight: 1.6, marginBottom: 14 }}>{(book.summary||"").substring(0,85)}...</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        {isFree(book)
                          ? <span style={{ ...S, fontSize: 16, fontWeight: 700, color: "#4E9E5F" }}>Gratuit</span>
                          : <span style={{ ...PF, fontSize: 18, fontWeight: 700, color: "#C9A96E" }}>{book.price?.toLocaleString()} FCFA</span>}
                        <span style={{ ...S, fontSize: 12, color: "#A89880" }}>★ {book.rating || 4.5}</span>
                      </div>
                      {hasAccess(book)
                        ? <button className="btn-gold" style={{ width: "100%", padding: "10px" }} onClick={() => { setSel(book); setView("reader"); }}>Lire maintenant</button>
                        : <button className="btn-gold" style={{ width: "100%", padding: "10px" }} onClick={() => openPay(book)}>Acheter</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOOK DETAIL */}
          {view === "book" && sel && (
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "50px 40px" }}>
              <button style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", ...S, fontSize: 13, letterSpacing: 1, marginBottom: 40, display: "flex", alignItems: "center", gap: 8 }} onClick={() => setView("catalog")}>← Retour au catalogue</button>
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 60 }}>
                <div>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", inset: -12, background: "linear-gradient(135deg,rgba(201,169,110,0.13),transparent)" }}></div>
                    <img src={sel.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"} alt={sel.title} style={{ width: "100%", display: "block", position: "relative", zIndex: 1 }} />
                  </div>
                  <div style={{ marginTop: 22 }}>
                    {hasAccess(sel)
                      ? <button className="btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={() => setView("reader")}>Lire maintenant</button>
                      : <button className="btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={() => openPay(sel)}>Acheter — {sel.price?.toLocaleString()} FCFA</button>}
                    {isFree(sel) && !hasAccess(sel) && (
                      <button className="btn-gold" style={{ width: "100%", marginBottom: 10, background: "linear-gradient(135deg,#4E9E5F,#6AB87A)" }} onClick={() => openRead(sel)}>Lire gratuitement</button>
                    )}
                    <button className="btn-out" style={{ width: "100%" }} onClick={() => setView("catalog")}>Voir d'autres livres</button>
                  </div>
                  <div style={{ marginTop: 16, padding: "12px", background: "rgba(78,158,95,.06)", border: "1px solid rgba(78,158,95,.18)", textAlign: "center" }}>
                    <p style={{ ...S, fontSize: 11, color: "#6AB87A", lineHeight: 1.7 }}>🔒 Paiement sécurisé<br />Orange Money · MTN · Visa · PayPal</p>
                  </div>
                </div>
                <div>
                  <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(201,169,110,0.1)", color: "#C9A96E", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>{sel.category}</div>
                  <h1 style={{ ...PF, fontSize: 38, fontWeight: 900, lineHeight: 1.15, marginBottom: 10 }}>{sel.title}</h1>
                  <p style={{ ...S, fontSize: 15, color: "#A89880", marginBottom: 28 }}>par <span style={{ color: "#C9A96E" }}>{sel.author}</span></p>
                  <div style={{ display: "flex", gap: 32, marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid #2A2420" }}>
                    {[["Note",`${sel.rating || 4.5}/5`],["Lecteurs",(sel.readers||0).toLocaleString()],["Pages",sel.pages||"—"]].map(([k,v]) => (
                      <div key={k}>
                        <p style={{ ...S, fontSize: 10, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{k}</p>
                        <p style={{ ...PF, fontSize: 22, color: "#C9A96E" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <h2 style={{ ...PF, fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Résumé</h2>
                  <p style={{ ...S, fontSize: 15, color: "#C8BFA8", lineHeight: 1.8 }}>{sel.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* READER */}
          {view === "reader" && sel && (
            <div>
              <div style={{ background: "#161310", borderBottom: "1px solid #2A2420", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", ...S, fontSize: 12, letterSpacing: 1 }} onClick={() => setView("book")}>← Retour</button>
                <div style={{ textAlign: "center" }}>
                  <p style={{ ...PF, fontSize: 14, fontWeight: 700 }}>{sel.title}</p>
                  <p style={{ ...S, fontSize: 11, color: "#5A5040" }}>par {sel.author}</p>
                </div>
                <div style={{ ...S, fontSize: 11, color: "#5A5040" }}>En lecture</div>
              </div>
              <div style={{ height: 3, background: "#1A1713" }}><div style={{ height: "100%", width: "8%", background: "linear-gradient(90deg,#C9A96E,#E8C98A)" }}></div></div>
              <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 40px 100px", fontFamily: "Georgia,serif", lineHeight: 1.9, fontSize: 17, color: "#E8DFD0" }}>
                <div style={{ textAlign: "center", marginBottom: 60 }}>
                  <p style={{ ...S, fontSize: 11, color: "#C9A96E", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>Lecture</p>
                  <h1 style={{ ...PF, fontSize: 32, fontWeight: 900, fontStyle: "italic" }}>{sel.title}</h1>
                  <p style={{ ...S, fontSize: 13, color: "#5A5040", marginTop: 8 }}>par {sel.author}</p>
                  <div style={{ width: 60, height: 1, background: "#C9A96E", margin: "22px auto" }}></div>
                </div>
                {sel.content ? (
                  sel.content.split("\n\n").map((para, i) => {
                    if (para === "---") return <div key={i} style={{ width: 60, height: 1, background: "#2A2420", margin: "36px auto" }}></div>;
                    const html = para.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#C9A96E">$1</strong>');
                    if (para.startsWith("Chapitre")) return <h2 key={i} style={{ ...PF, fontSize: 26, fontWeight: 700, margin: "48px 0 20px", color: "#C9A96E" }} dangerouslySetInnerHTML={{ __html: html }} />;
                    return <p key={i} style={{ marginBottom: 24 }} dangerouslySetInnerHTML={{ __html: html }} />;
                  })
                ) : (
                  <p style={{ textAlign: "center", color: "#5A5040", fontStyle: "italic" }}>Le contenu de ce livre n'est pas encore disponible.</p>
                )}
              </div>
            </div>
          )}

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
