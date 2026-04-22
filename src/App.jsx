import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CATEGORIES = ["Tous", "Business", "Roman", "Développement personnel", "Religion", "Science", "Histoire", "Jeunesse", "Autre"];

export default function App() {
  const [page, setPage] = useState("home");
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [reading, setReading] = useState(null);
  const [readingPage, setReadingPage] = useState(0);
  const [purchasedBooks, setPurchasedBooks] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentBook, setPaymentBook] = useState(null);
  const [paymentStep, setPaymentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBooks(); }, []);

  async function fetchBooks() {
    setLoading(true);
    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("status", "actif")
      .order("created_at", { ascending: false });
    if (data) setBooks(data);
    setLoading(false);
  }

  const filteredBooks = books.filter(b => {
    const matchSearch = b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === "Tous" || b.category === selectedCategory;
    return matchSearch && matchCat;
  });

  function hasAccess(book) {
    return book.price === 0 || purchasedBooks.includes(book.id);
  }

  function openBook(book) {
    setSelectedBook(book);
    setPage("detail");
  }

  function startReading(book) {
    if (!hasAccess(book)) {
      setPaymentBook(book);
      setShowPayment(true);
      setPaymentStep(1);
      setPaymentMethod(null);
      setPhoneNumber("");
      return;
    }
    setReading(book);
    setReadingPage(0);
    setPage("reader");
  }

  function handlePurchase() {
    setPaymentStep(2);
    setTimeout(() => {
      setPaymentStep(3);
      setPurchasedBooks(prev => [...prev, paymentBook.id]);
    }, 2500);
  }

  // Split book content into pages
  function getPages(content) {
    if (!content) return ["Ce livre n'a pas encore de contenu."];
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    const pages = [];
    let current = "";
    for (const para of paragraphs) {
      if ((current + para).length > 1800 && current.length > 0) {
        pages.push(current.trim());
        current = para + "\n\n";
      } else {
        current += para + "\n\n";
      }
    }
    if (current.trim()) pages.push(current.trim());
    return pages.length > 0 ? pages : ["Ce livre n'a pas encore de contenu."];
  }

  const styles = {
    app: { minHeight: "100vh", background: "#0f0f0f", color: "#e8e0d0", fontFamily: "Georgia, serif" },
    nav: {
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(15,15,15,0.95)", borderBottom: "1px solid #2a2a2a",
      padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64
    },
    logo: { fontSize: 22, fontWeight: "bold", color: "#c9a84c", letterSpacing: 3, cursor: "pointer" },
    navLinks: { display: "flex", gap: 32, alignItems: "center" },
    navLink: (active) => ({
      cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase",
      color: active ? "#c9a84c" : "#aaa", borderBottom: active ? "1px solid #c9a84c" : "none", paddingBottom: 2
    }),
    hero: {
      paddingTop: 64, minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(180deg, #1a1410 0%, #0f0f0f 100%)", textAlign: "center", padding: "80px 32px 48px"
    },
    sectionTitle: { fontSize: 13, letterSpacing: 4, color: "#c9a84c", textTransform: "uppercase", marginBottom: 12 },
    h1: { fontSize: 42, fontWeight: "normal", color: "#e8e0d0", marginBottom: 16, lineHeight: 1.2 },
    subtitle: { fontSize: 16, color: "#888", maxWidth: 500, margin: "0 auto 32px" },
    btn: (variant = "primary") => ({
      padding: variant === "primary" ? "12px 32px" : "10px 24px",
      background: variant === "primary" ? "#c9a84c" : "transparent",
      border: variant === "primary" ? "none" : "1px solid #c9a84c",
      color: variant === "primary" ? "#000" : "#c9a84c",
      borderRadius: 4, cursor: "pointer", fontSize: 13, letterSpacing: 1,
      textTransform: "uppercase", fontWeight: "bold"
    }),
    searchBar: {
      display: "flex", gap: 12, alignItems: "center", padding: "24px 32px",
      borderBottom: "1px solid #1a1a1a", background: "#0f0f0f", flexWrap: "wrap"
    },
    searchInput: {
      flex: 1, minWidth: 200, padding: "10px 16px", background: "#1a1a1a",
      border: "1px solid #2a2a2a", borderRadius: 4, color: "#e8e0d0", fontSize: 14,
      fontFamily: "Georgia, serif"
    },
    catBtn: (active) => ({
      padding: "6px 14px", borderRadius: 20, border: "1px solid",
      borderColor: active ? "#c9a84c" : "#2a2a2a",
      background: active ? "#c9a84c22" : "transparent",
      color: active ? "#c9a84c" : "#888", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap"
    }),
    grid: {
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      gap: 24, padding: "32px"
    },
    bookCard: {
      cursor: "pointer", transition: "transform 0.2s"
    },
    coverWrap: {
      position: "relative", width: "100%", paddingBottom: "141%",
      background: "#1a1a1a", borderRadius: 6, overflow: "hidden", marginBottom: 10
    },
    coverImg: {
      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain"
    },
    bookTitle: { fontSize: 13, color: "#e8e0d0", marginBottom: 4, lineHeight: 1.3 },
    bookAuthor: { fontSize: 11, color: "#888", marginBottom: 6 },
    bookPrice: (free) => ({ fontSize: 13, color: free ? "#4caf50" : "#c9a84c", fontWeight: "bold" }),
    freeBadge: {
      position: "absolute", top: 8, left: 8, background: "#4caf50", color: "#fff",
      fontSize: 9, padding: "3px 8px", borderRadius: 10, fontWeight: "bold", letterSpacing: 1
    },
    emptyState: { textAlign: "center", padding: "80px 32px", color: "#555" },
    loadingState: { textAlign: "center", padding: "80px 32px", color: "#888" }
  };

  // READER PAGE
  if (page === "reader" && reading) {
    const pages = getPages(reading.content);
    const totalPages = pages.length;
    return (
      <div style={{ minHeight: "100vh", background: "#f5f0e8", display: "flex", flexDirection: "column" }}>
        {/* Reader nav */}
        <div style={{ background: "#1a1a1a", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => { setPage("detail"); setReading(null); }}
            style={{ background: "none", border: "none", color: "#c9a84c", cursor: "pointer", fontSize: 14 }}>
            ← Retour
          </button>
          <span style={{ color: "#e8e0d0", fontSize: 14 }}>{reading.title}</span>
          <span style={{ color: "#888", fontSize: 12 }}>Page {readingPage + 1} / {totalPages}</span>
        </div>
        {/* Page content */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
          <div style={{
            background: "#fff", maxWidth: 600, width: "100%", minHeight: 700,
            padding: "64px 56px", boxShadow: "0 4px 32px rgba(0,0,0,0.15)",
            borderRadius: 4, position: "relative"
          }}>
            <div style={{
              fontSize: 16, lineHeight: 1.9, color: "#1a1a1a", fontFamily: "Georgia, serif",
              textAlign: "justify", hyphens: "auto", whiteSpace: "pre-wrap"
            }}>
              {pages[readingPage]}
            </div>
            <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", fontSize: 12, color: "#999" }}>
              — {readingPage + 1} —
            </div>
          </div>
        </div>
        {/* Navigation */}
        <div style={{ background: "#1a1a1a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 32 }}>
          <button onClick={() => setReadingPage(p => Math.max(0, p - 1))} disabled={readingPage === 0}
            style={{ background: "#2a2a2a", border: "none", color: readingPage === 0 ? "#444" : "#c9a84c", width: 44, height: 44, borderRadius: "50%", cursor: readingPage === 0 ? "not-allowed" : "pointer", fontSize: 18 }}>
            ‹
          </button>
          <input type="range" min={0} max={totalPages - 1} value={readingPage}
            onChange={e => setReadingPage(Number(e.target.value))}
            style={{ width: 200, accentColor: "#c9a84c" }} />
          <button onClick={() => setReadingPage(p => Math.min(totalPages - 1, p + 1))} disabled={readingPage === totalPages - 1}
            style={{ background: "#2a2a2a", border: "none", color: readingPage === totalPages - 1 ? "#444" : "#c9a84c", width: 44, height: 44, borderRadius: "50%", cursor: readingPage === totalPages - 1 ? "not-allowed" : "pointer", fontSize: 18 }}>
            ›
          </button>
        </div>
      </div>
    );
  }

  // DETAIL PAGE
  if (page === "detail" && selectedBook) {
    const book = selectedBook;
    const free = book.price === 0;
    const owned = hasAccess(book);
    return (
      <div style={styles.app}>
        <nav style={styles.nav}>
          <div style={styles.logo} onClick={() => setPage("home")}>LIBRAIRIE</div>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "none", color: "#c9a84c", cursor: "pointer", fontSize: 14 }}>← Retour</button>
        </nav>
        <div style={{ paddingTop: 64, maxWidth: 900, margin: "0 auto", padding: "96px 32px 64px" }}>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div style={{ width: 240, flexShrink: 0 }}>
              {book.cover
                ? <img src={book.cover} alt={book.title} style={{ width: "100%", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
                : <div style={{ width: "100%", paddingBottom: "141%", background: "#1a1a1a", borderRadius: 8 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              {free && <div style={{ background: "#4caf5022", color: "#4caf50", fontSize: 11, padding: "4px 12px", borderRadius: 12, display: "inline-block", marginBottom: 12, letterSpacing: 1 }}>GRATUIT</div>}
              <h1 style={{ fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: "normal" }}>{book.title}</h1>
              <p style={{ color: "#888", marginBottom: 4 }}>par <span style={{ color: "#c9a84c" }}>{book.author}</span></p>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>{book.category}</p>
              <div style={{ fontSize: 28, color: free ? "#4caf50" : "#c9a84c", fontWeight: "bold", marginBottom: 24 }}>
                {free ? "Gratuit" : `${book.price?.toLocaleString()} FCFA`}
              </div>
              {/* Résumé */}
              {book.summary && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#c9a84c", textTransform: "uppercase", marginBottom: 12 }}>Résumé</div>
                  <p style={{ color: "#aaa", lineHeight: 1.9, fontSize: 15 }}>{book.summary}</p>
                </div>
              )}

              {/* Boutons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
                <button onClick={() => startReading(book)} style={{ padding: "12px 24px", background: "none", border: "1px solid #c9a84c", borderRadius: 4, color: "#c9a84c", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>
                  📄 Lire un extrait
                </button>
                <button style={{ padding: "12px 24px", background: "none", border: "1px solid #555", borderRadius: 4, color: "#888", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
                  ♡ Ajouter aux favoris
                </button>
                {owned
                  ? <button onClick={() => startReading(book)} style={{ padding: "12px 24px", background: "#c9a84c", border: "none", borderRadius: 4, color: "#000", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>📖 Lire maintenant</button>
                  : free
                    ? <button onClick={() => startReading(book)} style={{ padding: "12px 24px", background: "#c9a84c", border: "none", borderRadius: 4, color: "#000", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>📖 Lire gratuitement</button>
                    : <button onClick={() => { setPaymentBook(book); setShowPayment(true); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); }} style={{ padding: "12px 24px", background: "#c9a84c", border: "none", borderRadius: 4, color: "#000", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>💳 Acheter — {book.price?.toLocaleString()} FCFA</button>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // HOME / CATALOG
  return (
    <div style={styles.app}>
      {/* NAV */}
      <nav style={styles.nav}>
        <div style={styles.logo} onClick={() => setPage("home")}>LIBRAIRIE</div>
        <div style={styles.navLinks}>
          <span style={styles.navLink(page === "home")} onClick={() => setPage("home")}>Accueil</span>
          <span style={styles.navLink(page === "catalog")} onClick={() => setPage("catalog")}>Catalogue</span>
          <span style={styles.navLink(page === "library")} onClick={() => setPage("library")}>Ma bibliothèque</span>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>
        {/* HERO */}
        {page === "home" && (
          <div style={styles.hero}>
            <div>
              <div style={styles.sectionTitle}>Bienvenue</div>
              <h1 style={styles.h1}>Votre librairie<br />numérique</h1>
              <p style={styles.subtitle}>Découvrez nos livres, lisez les extraits et accédez à votre bibliothèque personnelle.</p>
              <button style={styles.btn("primary")} onClick={() => setPage("catalog")}>Parcourir le catalogue</button>
            </div>
          </div>
        )}

        {/* SEARCH + FILTERS */}
        <div style={styles.searchBar}>
          <input
            style={styles.searchInput}
            placeholder="Rechercher un livre ou un auteur..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} style={styles.catBtn(selectedCategory === cat)} onClick={() => setSelectedCategory(cat)}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION TITLE */}
        <div style={{ padding: "32px 32px 0" }}>
          <div style={styles.sectionTitle}>
            {page === "home" ? "Tous nos livres" : "Catalogue complet"}
          </div>
        </div>

        {/* BOOKS GRID */}
        {loading ? (
          <div style={styles.loadingState}>Chargement des livres...</div>
        ) : filteredBooks.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div>Aucun livre trouvé</div>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredBooks.map(book => (
              <div key={book.id} style={styles.bookCard} onClick={() => openBook(book)}>
                <div style={styles.coverWrap}>
                  {book.cover
                    ? <img src={book.cover} alt={book.title} style={styles.coverImg} />
                    : <div style={{ ...styles.coverImg, background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📖</div>
                  }
                  {book.price === 0 && <div style={styles.freeBadge}>GRATUIT</div>}
                </div>
                <div style={styles.bookTitle}>{book.title}</div>
                <div style={styles.bookAuthor}>{book.author}</div>
                <div style={styles.bookPrice(book.price === 0)}>
                  {book.price === 0 ? "Gratuit" : `${book.price?.toLocaleString()} FCFA`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MA BIBLIOTHÈQUE */}
        {page === "library" && (
          <div style={{ padding: "0 32px 64px" }}>
            {purchasedBooks.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                <div>Aucun livre acheté pour l'instant</div>
                <button style={{ ...styles.btn("secondary"), marginTop: 16 }} onClick={() => setPage("catalog")}>
                  Parcourir le catalogue
                </button>
              </div>
            ) : (
              <div style={styles.grid}>
                {books.filter(b => purchasedBooks.includes(b.id)).map(book => (
                  <div key={book.id} style={styles.bookCard} onClick={() => startReading(book)}>
                    <div style={styles.coverWrap}>
                      {book.cover ? <img src={book.cover} alt={book.title} style={styles.coverImg} /> : null}
                    </div>
                    <div style={styles.bookTitle}>{book.title}</div>
                    <div style={styles.bookAuthor}>{book.author}</div>
                    <div style={{ fontSize: 11, color: "#4caf50", marginTop: 4 }}>✓ Acheté</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PAYMENT MODAL */}
      {showPayment && paymentBook && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, width: "90%", maxWidth: 460, padding: 32 }}>
            {paymentStep === 1 && (
              <>
                <h2 style={{ color: "#c9a84c", marginBottom: 8 }}>Acheter ce livre</h2>
                <p style={{ color: "#888", marginBottom: 24 }}>{paymentBook.title} — {paymentBook.price?.toLocaleString()} FCFA</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {[{ id: "orange", label: "🟠 Orange Money", color: "#ff6600" },
                    { id: "mtn", label: "🟡 MTN MoMo", color: "#ffc000" }].map(m => (
                    <div key={m.id} onClick={() => setPaymentMethod(m.id)}
                      style={{ padding: 16, border: `2px solid ${paymentMethod === m.id ? m.color : "#2a2a2a"}`, borderRadius: 8, cursor: "pointer" }}>
                      <span style={{ color: "#e8e0d0" }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                {paymentMethod && (
                  <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="Numéro de téléphone (ex: 237699000000)"
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }} />
                )}
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setShowPayment(false)} style={{ flex: 1, padding: 12, background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: "#888", cursor: "pointer" }}>Annuler</button>
                  <button onClick={handlePurchase} disabled={!paymentMethod || !phoneNumber}
                    style={{ flex: 1, padding: 12, background: paymentMethod && phoneNumber ? "#c9a84c" : "#333", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: paymentMethod && phoneNumber ? "pointer" : "not-allowed" }}>
                    Payer
                  </button>
                </div>
              </>
            )}
            {paymentStep === 2 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                <p style={{ color: "#888" }}>Traitement du paiement en cours...</p>
              </div>
            )}
            {paymentStep === 3 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ color: "#c9a84c", marginBottom: 8 }}>Paiement réussi !</h3>
                <p style={{ color: "#888", marginBottom: 24 }}>Tu peux maintenant lire {paymentBook.title}</p>
                <button onClick={() => { setShowPayment(false); startReading(paymentBook); }}
                  style={styles.btn("primary")}>Lire maintenant</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
