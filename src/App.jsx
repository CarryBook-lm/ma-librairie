import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CATEGORIES = ["Tous", "Romans", "Histoires", "Lyrics", "Amour", "Humour", "Autres"];

const G = {
  bg: "#f5f0e8", surface: "#ede7d9", surface2: "#e8e0ce", border: "#d8cdb8",
  gold: "#c9a84c", goldLight: "#e0be7a", goldDim: "rgba(201,168,76,0.15)",
  text: "#1a1208", textDim: "#7a6a50", textFaint: "#b0a090",
  green: "#4caf50", greenDim: "rgba(76,175,80,0.15)",
  navBg: "#0a0a0a", navSurface: "#141414", navBorder: "#262626", navText: "#f0ece4",
};

export default function App() {
  const [page, setPage] = useState("home");
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [reading, setReading] = useState(null);
  const [readingPage, setReadingPage] = useState(0);
  const [excerptMode, setExcerptMode] = useState(false);
  const [purchasedBooks, setPurchasedBooks] = useState([]);
  const [favoriteBooks, setFavoriteBooks] = useState([]);
  const [cachedBooks, setCachedBooks] = useState({});
  const [showPayment, setShowPayment] = useState(false);
  const [paymentBook, setPaymentBook] = useState(null);
  const [paymentStep, setPaymentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    fetchBooks();
    const p = localStorage.getItem("purchasedBooks");
    if (p) setPurchasedBooks(JSON.parse(p));
    const f = localStorage.getItem("favoriteBooks");
    if (f) setFavoriteBooks(JSON.parse(f));
    const c = localStorage.getItem("cachedBooks");
    if (c) setCachedBooks(JSON.parse(c));
  }, []);

  async function fetchBooks() {
    setLoading(true);
    const { data } = await supabase.from("books").select("*").eq("status", "actif").order("created_at", { ascending: false });
    if (data) setBooks(data);
    setLoading(false);
  }

  function hasAccess(book) { return book.price === 0 || purchasedBooks.includes(book.id); }

  function cacheBook(book) {
    const newCache = { ...cachedBooks, [book.id]: book };
    setCachedBooks(newCache);
    localStorage.setItem("cachedBooks", JSON.stringify(newCache));
  }

  function openBook(book) {
    setSelectedBook(book);
    setPage("detail");
    setShowMenu(false);
    if (book.price === 0) cacheBook(book);
  }

  function startReading(book, excerpt = false) {
    const bookToRead = (!isOnline && cachedBooks[book.id]) ? cachedBooks[book.id] : book;
    if (!excerpt && !hasAccess(bookToRead)) {
      setPaymentBook(book);
      setShowPayment(true);
      setPaymentStep(1);
      setPaymentMethod(null);
      setPhoneNumber("");
      return;
    }
    setExcerptMode(excerpt);
    setReading(bookToRead);
    setReadingPage(0);
    setPage("reader");
  }

  function toggleFavorite(bookId) {
    setFavoriteBooks(prev => {
      const updated = prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId];
      localStorage.setItem("favoriteBooks", JSON.stringify(updated));
      return updated;
    });
  }

 async function handlePurchase() {
  if (paymentMethod === "monetbil") {
    const key = import.meta.env.VITE_MONETBIL_KEY;
    const url = "https://fr.monetbil.com/widget/v2.1/" + key + "?amount=" + paymentBook.price + "&phone=" + phoneNumber + "&currency=XAF&item_ref=CB_" + paymentBook.id + "&return_url=https://www.carrybooks.com";
    window.open(url, "_blank");
    setPaymentStep(3);
    const newP = [...purchasedBooks, paymentBook.id];
    setPurchasedBooks(newP);
    localStorage.setItem("purchasedBooks", JSON.stringify(newP));
    cacheBook(paymentBook);
    return;
  }
   setPaymentStep(2);
    setTimeout(() => {
      setPaymentStep(3);
      const newP = [...purchasedBooks, paymentBook.id];
      setPurchasedBooks(newP);
      localStorage.setItem("purchasedBooks", JSON.stringify(newP));
      cacheBook(paymentBook);
    }, 2500);
  }

  function getPages(content) {
    if (!content) return ["Ce livre n'a pas encore de contenu."];
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    const pages = [];
    let current = "";
    for (const para of paragraphs) {
      if ((current + para).length > 1600 && current.length > 0) {
        pages.push(current.trim());
        current = para + "\n\n";
      } else {
        current += para + "\n\n";
      }
    }
    if (current.trim()) pages.push(current.trim());
    return pages.length > 0 ? pages : ["Ce livre n'a pas encore de contenu."];
  }

  const filteredBooks = books.filter(b => {
    const matchSearch = b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const normalize = s => (s || "").toLowerCase().replace(/s$/, "").trim();
    const matchCat = selectedCategory === "Tous" || normalize(b.category) === normalize(selectedCategory);
    return matchSearch && matchCat;
  });

  const navItems = [
    { id: "home", label: "Accueil" },
    { id: "catalog", label: "Catalogue" },
    { id: "library", label: "Ma bibliothèque" },
    { id: "favorites", label: `Favoris${favoriteBooks.length > 0 ? " (" + favoriteBooks.length + ")" : ""}` },
    { id: "contact", label: "Contact" },
  ];

  // READER
  if (page === "reader" && reading) {
    const allPages = getPages(reading.content);
    const pages = excerptMode ? allPages.slice(0, 2) : allPages;
    const total = pages.length;
    const paragraphs = pages[readingPage]
      ? pages[readingPage].split(/\n\n+/).filter(function(p) { return p.trim().length > 0; })
      : [];

    return (
      <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column", fontFamily: "Georgia, serif" }}>
        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #ddd", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => { setPage(selectedBook ? "detail" : "home"); setReading(null); }}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>
            ← Retour
          </button>
          <span style={{ color: "#555", fontSize: 13, fontStyle: "italic", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reading.title}
          </span>
          <span style={{ opacity: 0 }}>x</span>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, padding: "20px 12px 100px 12px", maxWidth: "100%", width: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
          {paragraphs.map(function(para, i) {
            return (
              <p key={i} style={{
                fontFamily: "Georgia, serif",
                fontSize: "15px",
                lineHeight: "1.9",
                color: "#1a1a1a",
                textAlign: "justify",
                margin: 0,
                marginBottom: "1em",
                textIndent: i === 0 ? "0" : "1.5em",
                wordBreak: "break-word",
                overflowWrap: "break-word"
              }}>
                {para.trim()}
              </p>
            );
          })}

          {excerptMode && readingPage === total - 1 && (
            <div style={{ marginTop: 48, padding: 24, background: "#fdf8ee", border: "1px solid #e8d5a3", borderRadius: 8, textAlign: "center" }}>
              <div style={{ color: G.gold, fontSize: 15, marginBottom: 8, fontStyle: "italic" }}>— Fin de l'extrait —</div>
              <div style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>Achetez le livre pour lire la suite</div>
              <button onClick={() => { setPage("detail"); setReading(null); }}
                style={{ padding: "11px 28px", background: G.gold, border: "none", borderRadius: 4, color: "#000", fontSize: 13, fontWeight: "bold", cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                Acheter ce livre
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", color: "#ccc", fontSize: 13, marginTop: 40, fontFamily: "Georgia, serif" }}>
            — {readingPage + 1} —
          </div>
        </div>

        {/* Navigation */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <button onClick={() => { setReadingPage(function(p) { return Math.max(0, p - 1); }); window.scrollTo(0,0); }} disabled={readingPage === 0}
            style={{ width: 44, height: 44, borderRadius: "50%", background: readingPage === 0 ? "#f5f5f5" : "#fdf8ee", border: "1px solid " + (readingPage === 0 ? "#e0e0e0" : G.gold), color: readingPage === 0 ? "#ccc" : G.gold, fontSize: 22, cursor: readingPage === 0 ? "not-allowed" : "pointer" }}>
            ‹
          </button>
          <input type="range" min={0} max={total - 1} value={readingPage}
            onChange={function(e) { setReadingPage(Number(e.target.value)); window.scrollTo(0,0); }}
            style={{ flex: 1, accentColor: G.gold }} />
          <button onClick={() => { setReadingPage(function(p) { return Math.min(total - 1, p + 1); }); window.scrollTo(0,0); }} disabled={readingPage === total - 1}
            style={{ width: 44, height: 44, borderRadius: "50%", background: readingPage === total - 1 ? "#f5f5f5" : "#fdf8ee", border: "1px solid " + (readingPage === total - 1 ? "#e0e0e0" : G.gold), color: readingPage === total - 1 ? "#ccc" : G.gold, fontSize: 22, cursor: readingPage === total - 1 ? "not-allowed" : "pointer" }}>
            ›
          </button>
        </div>
      </div>
    );
  }

    // DETAIL
  if (page === "detail" && selectedBook) {
    const book = selectedBook;
    const free = book.price === 0;
    const owned = hasAccess(book);
    const isFav = favoriteBooks.includes(book.id);
    return (
      <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "Georgia, serif" }}>
        <div style={{ background: G.surface, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #262626", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "none", color: G.gold, cursor: "pointer", fontSize: 13 }}>← Retour</button>
          <button onClick={() => toggleFavorite(book.id)} style={{ background: "none", border: "none", color: isFav ? G.gold : G.textDim, fontSize: 22, cursor: "pointer" }}>{isFav ? "♥" : "♡"}</button>
        </div>
        <div style={{ padding: "24px 16px 40px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            {book.cover
              ? <img src={book.cover} alt={book.title} style={{ width: 160, borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }} />
              : <div style={{ width: 160, height: 226, background: G.surface2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📖</div>}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
            {free && <span style={{ background: G.greenDim, color: G.green, fontSize: 10, padding: "3px 10px", borderRadius: 10, letterSpacing: 1 }}>GRATUIT</span>}
            {book.category && <span style={{ background: G.goldDim, color: G.gold, fontSize: 10, padding: "3px 10px", borderRadius: 10, letterSpacing: 1 }}>{book.category}</span>}
          </div>
          <h1 style={{ fontSize: 22, color: G.text, textAlign: "center", marginBottom: 6, lineHeight: 1.3, fontWeight: "bold" }}>{book.title}</h1>
          <p style={{ color: G.textDim, textAlign: "center", fontSize: 13, marginBottom: 16 }}>par <span style={{ color: G.gold }}>{book.author}</span></p>
          <div style={{ textAlign: "center", fontSize: 22, color: free ? G.green : G.gold, fontWeight: "bold", marginBottom: 20 }}>
            {free ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}
          </div>
          {book.summary && (
            <div style={{ background: G.surface, border: "1px solid #262626", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Résumé</div>
              <p style={{ color: "#bbb", lineHeight: 1.8, fontSize: 13, margin: 0 }}>{book.summary}</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button onClick={() => startReading(book, true)}
              style={{ flex: 1, padding: "12px 8px", background: "none", border: "1.5px solid " + G.gold, borderRadius: 6, color: G.gold, cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>
              📄 Extrait
            </button>
            <button onClick={() => toggleFavorite(book.id)}
              style={{ flex: 1, padding: "12px 8px", background: isFav ? G.goldDim : "none", border: "1.5px solid " + (isFav ? G.gold : G.border), borderRadius: 6, color: isFav ? G.gold : G.textDim, cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              {isFav ? "♥ Favoris" : "♡ Favoris"}
            </button>
          </div>
          <button
            onClick={() => {
              if (owned || free) { startReading(book); }
              else { setPaymentBook(book); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); setShowPayment(true); }
            }}
            style={{ width: "100%", padding: 15, background: G.gold, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold" }}>
            {owned || free ? "📖 Lire maintenant" : "💳 Acheter — " + book.price?.toLocaleString() + " FCFA"}
          </button>
        </div>

        {/* PAYMENT MODAL in detail page */}
        {showPayment && paymentBook && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
            <div style={{ background: G.navSurface, borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid " + G.navBorder }}>
              {paymentStep === 1 && (
                <>
                  <div style={{ width: 40, height: 4, background: G.navBorder, borderRadius: 2, margin: "0 auto 20px" }} />
                  <h3 style={{ color: G.navText, marginBottom: 4, fontSize: 16 }}>Acheter ce livre</h3>
                  <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>{paymentBook.title} — {paymentBook.price?.toLocaleString()} FCFA</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {[{ id: "orange", label: "🟠 Orange Money", color: "#ff6600" }, { id: "mtn", label: "🟡 MTN MoMo", color: "#ffc000" }].map(m => (
                      <div key={m.id} onClick={() => setPaymentMethod(m.id)}
                        style={{ padding: "14px 16px", border: "2px solid " + (paymentMethod === m.id ? m.color : G.navBorder), borderRadius: 8, cursor: "pointer", background: paymentMethod === m.id ? m.color + "11" : "transparent" }}>
                        <span style={{ color: G.navText, fontSize: 14 }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                  {paymentMethod && (
                    <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Numéro (ex: 237699000000)"
                      style={{ width: "100%", padding: "12px 14px", background: "#0a0a0a", border: "1px solid " + G.navBorder, borderRadius: 8, color: G.navText, fontSize: 14, marginBottom: 16 }} />
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowPayment(false)} style={{ flex: 1, padding: 13, background: "none", border: "1px solid " + G.navBorder, borderRadius: 6, color: "#888", cursor: "pointer", fontSize: 13 }}>Annuler</button>
                    <button onClick={handlePurchase} disabled={!paymentMethod || !phoneNumber}
                      style={{ flex: 2, padding: 13, background: paymentMethod && phoneNumber ? G.gold : "#333", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: paymentMethod && phoneNumber ? "pointer" : "not-allowed", fontSize: 13 }}>
                      Payer
                    </button>
                  </div>
                </>
              )}
              {paymentStep === 2 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                  <p style={{ color: "#888" }}>Traitement en cours...</p>
                </div>
              )}
              {paymentStep === 3 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <h3 style={{ color: G.gold, marginBottom: 8 }}>Paiement réussi !</h3>
                  <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Tu peux lire {paymentBook.title}</p>
                  <button onClick={() => { setShowPayment(false); startReading(paymentBook); }}
                    style={{ padding: "13px 32px", background: G.gold, border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                    📖 Lire maintenant
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // HOME / CATALOG / LIBRARY / FAVORITES
  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "Georgia, serif" }}>
      <style>{`* { box-sizing: border-box; } input, select { outline: none; } ::-webkit-scrollbar { display: none; }`}</style>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(10,10,10,0.97)", borderBottom: "1px solid " + G.navBorder, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div onClick={() => { setPage("home"); setShowMenu(false); }} style={{ cursor: "pointer" }}>
          <img src="https://i.ibb.co/Myq691Tp/LOGO-CARRYBOOKSgrr-Photoroom.png" alt="CarryBooks" style={{ height: 40, borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isOnline && <span style={{ fontSize: 10, background: "#3a2a00", color: G.gold, padding: "3px 8px", borderRadius: 10 }}>📴</span>}
          <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", color: G.gold, fontSize: 22, cursor: "pointer", padding: 4 }}>
            {showMenu ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* MENU */}
      {showMenu && (
        <div style={{ position: "fixed", top: 56, left: 0, right: 0, bottom: 0, zIndex: 99, background: "rgba(0,0,0,0.95)" }} onClick={() => setShowMenu(false)}>
          <div style={{ background: G.navSurface, borderBottom: "1px solid " + G.navBorder }} onClick={e => e.stopPropagation()}>
            {navItems.map(item => (
              <div key={item.id} onClick={() => { setPage(item.id); setShowMenu(false); }}
                style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: page === item.id ? G.gold : G.navText, borderLeft: "3px solid " + (page === item.id ? G.gold : "transparent"), background: page === item.id ? G.goldDim : "transparent", borderBottom: "1px solid " + G.navBorder }}>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ paddingTop: 56 }}>
        {/* HERO */}
        {page === "home" && (
          <div style={{ textAlign: "center" }}>
            {/* Hero avec image de fond — titre + description seulement */}
            <div style={{ position: "relative", overflow: "hidden" }}>
              <img src="https://i.ibb.co/Lh6krZ12/Whats-App-Image-2026-04-22-at-16-04-50.jpg"
                alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 100%)" }} />
              <div style={{ position: "relative", zIndex: 2, padding: "40px 16px 32px" }}>
                <div style={{ fontSize: 10, letterSpacing: 4, color: G.gold, textTransform: "uppercase", marginBottom: 12 }}>Bienvenue</div>
                <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 16, lineHeight: 1.3, fontWeight: "bold", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Votre librairie<br />numérique</h1>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 1.7, maxWidth: 320, margin: "0 auto" }}>
                  Découvrez, lisez et achetez des livres depuis votre téléphone.
                </p>
              </div>
            </div>
            {/* Bouton sur fond noir en dessous */}
            <div style={{ padding: "24px 16px", background: G.bg }}>
              <button onClick={() => setPage("catalog")}
                style={{ padding: "12px 28px", background: G.gold, border: "none", borderRadius: 4, color: "#000", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold", cursor: "pointer" }}>
                Explorer le catalogue
              </button>
            </div>
          </div>
        )}

        {/* SEARCH + CATEGORIES */}
        <div style={{ padding: "14px 16px 8px", background: G.bg, position: "sticky", top: 56, zIndex: 9, borderBottom: "1px solid " + G.border }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un livre ou auteur..."
            style={{ width: "100%", padding: "11px 14px", background: "#fff", border: "1px solid " + G.border, borderRadius: 8, color: G.text, fontSize: 14, fontFamily: "Georgia, serif", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1px solid " + (selectedCategory === cat ? G.gold : G.border), background: selectedCategory === cat ? G.goldDim : "transparent", color: selectedCategory === cat ? G.gold : G.textDim, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* BOOKS GRID */}
        {(page === "home" || page === "catalog") && (
          <div style={{ padding: "20px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 16 }}>
              {page === "home" ? "Tous nos livres" : "Catalogue"}
              {!loading && <span style={{ color: G.textFaint, marginLeft: 8, fontSize: 11, letterSpacing: 0 }}>({filteredBooks.length})</span>}
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: G.textDim }}>Chargement...</div>
            ) : filteredBooks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: G.textFaint }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                <div>Aucun livre trouvé</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {filteredBooks.map(book => (
                  <div key={book.id} onClick={() => openBook(book)} style={{ cursor: "pointer" }}>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 0, overflow: "hidden", marginBottom: 8 }}>
                      {book.cover
                        ? <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                        : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: G.textFaint }}>📖</div>}
                      {book.price === 0 && <div style={{ position: "absolute", top: 8, left: 8, background: G.green, color: "#fff", fontSize: 9, padding: "2px 8px", borderRadius: 8, fontWeight: "bold", letterSpacing: 1 }}>GRATUIT</div>}
                    </div>
                    <div style={{ fontSize: 13, color: G.text, marginBottom: 3, lineHeight: 1.3 }}>{book.title}</div>
                    <div style={{ fontSize: 11, color: G.textDim, marginBottom: 4 }}>{book.author}</div>
                    <div style={{ fontSize: 13, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>
                      {book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BIBLIOTHEQUE */}
        {page === "library" && (
          <div style={{ padding: "20px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 4 }}>Ma bibliothèque</div>
            <p style={{ color: G.textFaint, fontSize: 12, marginBottom: 20 }}>{purchasedBooks.length === 0 ? "Aucun livre acheté" : purchasedBooks.length + " livre" + (purchasedBooks.length > 1 ? "s" : "")}</p>
            {purchasedBooks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "1px dashed " + G.border, borderRadius: 8 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
                <div style={{ color: G.textDim, marginBottom: 8 }}>Votre bibliothèque est vide</div>
                <button onClick={() => setPage("home")} style={{ padding: "10px 20px", background: "none", border: "1px solid " + G.gold, borderRadius: 4, color: G.gold, fontSize: 12, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase", marginTop: 12 }}>Parcourir</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {books.filter(b => purchasedBooks.includes(b.id)).map(book => (
                  <div key={book.id} style={{ cursor: "pointer" }} onClick={() => startReading(book)}>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 0, overflow: "hidden", marginBottom: 8 }}>
                      {book.cover && <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.8))", padding: "12px 8px 8px", textAlign: "center" }}>
                        <span style={{ fontSize: 9, color: G.green, letterSpacing: 1 }}>✓ ACHETÉ</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: G.text, marginBottom: 2, lineHeight: 1.3 }}>{book.title}</div>
                    <div style={{ fontSize: 10, color: G.textDim, marginBottom: 6 }}>{book.author}</div>
                    <button style={{ width: "100%", padding: 8, background: G.goldDim, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 4, color: G.gold, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>📖 LIRE</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAVORIS */}
        {page === "favorites" && (
          <div style={{ padding: "20px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 4 }}>Favoris</div>
            <p style={{ color: G.textFaint, fontSize: 12, marginBottom: 20 }}>{favoriteBooks.length === 0 ? "Aucun favori" : favoriteBooks.length + " livre" + (favoriteBooks.length > 1 ? "s" : "")}</p>
            {favoriteBooks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "1px dashed " + G.border, borderRadius: 8 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>♡</div>
                <div style={{ color: G.textDim }}>Aucun livre dans vos favoris</div>
                <button onClick={() => setPage("home")} style={{ padding: "10px 20px", background: "none", border: "1px solid " + G.gold, borderRadius: 4, color: G.gold, fontSize: 12, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase", marginTop: 16 }}>Parcourir</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {books.filter(b => favoriteBooks.includes(b.id)).map(book => (
                  <div key={book.id} style={{ cursor: "pointer" }} onClick={() => openBook(book)}>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 0, overflow: "hidden", marginBottom: 8 }}>
                      {book.cover && <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
                      <div style={{ position: "absolute", top: 8, right: 8, color: G.gold, fontSize: 16 }}>♥</div>
                    </div>
                    <div style={{ fontSize: 12, color: G.text, marginBottom: 2, lineHeight: 1.3 }}>{book.title}</div>
                    <div style={{ fontSize: 10, color: G.textDim, marginBottom: 4 }}>{book.author}</div>
                    <div style={{ fontSize: 12, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>{book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

        {/* CONTACT */}
        {page === "contact" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>Contact</div>
            <div style={{ background: G.surface, border: "1px solid #262626", borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>EMAIL</div>
              <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.text, fontSize: 15, textDecoration: "none" }}>carrybooks.com@gmail.com</a>
            </div>
            <div style={{ background: G.surface, border: "1px solid #262626", borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>À PROPOS</div>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                CarryBooks est votre librairie numérique. Achetez et lisez vos livres préférés directement depuis votre téléphone, où que vous soyez au Cameroun et dans le monde.
              </p>
            </div>
            <div style={{ background: G.surface, border: "1px solid #262626", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>SUPPORT</div>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                Pour toute question ou problème, écrivez-nous à <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.gold }}>carrybooks.com@gmail.com</a>. Nous répondons sous 24h.
              </p>
            </div>
          </div>
        )}

        {/* FOOTER */}
        {page !== "reader" && (
          <div style={{ background: G.navSurface, borderTop: "1px solid " + G.navBorder, padding: "20px 16px", textAlign: "center" }}>
            <img src="https://i.ibb.co/Myq691Tp/LOGO-CARRYBOOKSgrr-Photoroom.png" alt="CarryBooks" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />
            <a href="mailto:carrybooks.com@gmail.com" style={{ color: "#888", fontSize: 12, textDecoration: "none" }}>carrybooks.com@gmail.com</a>
            <div style={{ color: "#444", fontSize: 11, marginTop: 8 }}>© 2026 CarryBooks. Tous droits réservés.</div>
          </div>
        )}
      {/* PAYMENT MODAL */}
      {showPayment && paymentBook && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: G.navSurface, borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid " + G.navBorder }}>
            {paymentStep === 1 && (
              <>
                <div style={{ width: 40, height: 4, background: G.navBorder, borderRadius: 2, margin: "0 auto 20px" }} />
                <h3 style={{ color: G.navText, marginBottom: 4, fontSize: 16 }}>Acheter ce livre</h3>
                <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>{paymentBook.title} — {paymentBook.price?.toLocaleString()} FCFA</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {[{ id: "orange", label: "🟠 Orange Money", color: "#ff6600" }, { id: "mtn", label: "🟡 MTN MoMo", color: "#ffc000" }].map(m => (
                    <div key={m.id} onClick={() => setPaymentMethod(m.id)}
                      style={{ padding: "14px 16px", border: "2px solid " + (paymentMethod === m.id ? m.color : G.navBorder), borderRadius: 8, cursor: "pointer", background: paymentMethod === m.id ? m.color + "11" : "transparent" }}>
                      <span style={{ color: G.navText, fontSize: 14 }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                {paymentMethod && (
                  <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="Numéro (ex: 237699000000)"
                    style={{ width: "100%", padding: "12px 14px", background: "#0a0a0a", border: "1px solid " + G.navBorder, borderRadius: 8, color: G.navText, fontSize: 14, marginBottom: 16 }} />
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowPayment(false)} style={{ flex: 1, padding: 13, background: "none", border: "1px solid " + G.navBorder, borderRadius: 6, color: "#888", cursor: "pointer", fontSize: 13 }}>Annuler</button>
                  <button onClick={handlePurchase} disabled={!paymentMethod || !phoneNumber}
                    style={{ flex: 2, padding: 13, background: paymentMethod && phoneNumber ? G.gold : "#333", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: paymentMethod && phoneNumber ? "pointer" : "not-allowed", fontSize: 13 }}>
                    Payer
                  </button>
                </div>
              </>
            )}
            {paymentStep === 2 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                <p style={{ color: "#888" }}>Traitement en cours...</p>
              </div>
            )}
            {paymentStep === 3 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h3 style={{ color: G.gold, marginBottom: 8 }}>Paiement réussi !</h3>
                <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Tu peux lire {paymentBook.title}</p>
                <button onClick={() => { setShowPayment(false); startReading(paymentBook); }}
                  style={{ padding: "13px 32px", background: G.gold, border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                  📖 Lire maintenant
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


