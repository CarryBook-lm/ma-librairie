import { useState, useEffect } from "react";
import { Preferences } from "@capacitor/preferences";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: "carrybooks-auth",
      storage: {
        getItem: async (key) => {
          try {
            const { value } = await Preferences.get({ key });
            return value;
          } catch { return localStorage.getItem(key); }
        },
        setItem: async (key, value) => {
          try {
            await Preferences.set({ key, value });
            localStorage.setItem(key, value);
          } catch { localStorage.setItem(key, value); }
        },
        removeItem: async (key) => {
          try {
            await Preferences.remove({ key });
            localStorage.removeItem(key);
          } catch { localStorage.removeItem(key); }
        },
      },
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    }
  }
);

const CATEGORIES = {
  "Romans": ["Romance", "Drame", "Suspense", "Thriller", "Poesie", "Serie"],
  "Lifestyle": ["Amour et relation", "Santé & bien-être", "Beauté & Astuces"],
  "Développement personnel": ["Confiance en soi", "Motivation", "Finance personnelle", "Spiritualité", "Relations", "Productivité"],
  "Jeunesse": ["Amour et relation", "Contes", "Humour", "Histoires d'amour", "Education"],
  "Formation": [],
  "Business": ["Marketing & ventes", "Management & leadership", "E-commerce & stratégie digitale"],
  "Biographies": ["Essais & chroniques", "Histoire & politique", "Sciences & nature"],
  "Lyrics": ["Focus", "À la une"],
  "Livre Audio": ["Roman", "Conte", "Développement personnel", "Business"],
  "Livres Gratuits": [],
};

const G = {
  bg: "#f5f0e8", surface: "#ede7d9", surface2: "#e8e0ce", border: "#d8cdb8",
  gold: "#c9a84c", goldLight: "#e0be7a", goldDim: "rgba(201,168,76,0.15)",
  text: "#1a1208", textDim: "#7a6a50", textFaint: "#b0a090",
  green: "#4caf50", greenDim: "rgba(76,175,80,0.15)",
  navBg: "#f5f0e8", navSurface: "#ede7d9", navBorder: "#d8cdb8", navText: "#1a1208",
};

export default function App() {
  const [page, setPage] = useState("home");
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [reading, setReading] = useState(null);
  const [readingPage, setReadingPage] = useState(0);
  const [selectedSubCategory, setSelectedSubCategory] = useState("Tous");
  const [readerSize, setReaderSize] = useState(15);
  const [readerFont, setReaderFont] = useState("Georgia, serif");
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [readerDark, setReaderDark] = useState(false);
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
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [readerScrollMode, setReaderScrollMode] = useState(false);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [translateLang, setTranslateLang] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioRef] = useState(() => ({ current: null }));
  const [audioMode, setAudioMode] = useState(null); // 'mp3' only
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const featuredBooks = books.filter(b => b.featured);
    if (featuredBooks.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(i => (i + 1) % featuredBooks.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [books]);

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

  // Auth listener
  useEffect(() => {
    // Enregistrement du Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Traiter le hash de retour Google OAuth (mobile)
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          loadUserPurchases(session.user.id);
          window.history.replaceState(null, "", window.location.pathname);
        }
        setAuthChecked(true);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) loadUserPurchases(session.user.id);
        else setShowAuthModal(true); // Afficher modal si non connecté
        setAuthChecked(true);
      });
    }
    // Restaurer session depuis Preferences si disponible
    Preferences.get({ key: "sb-session" }).then(({ value }) => {
      if (value) {
        try {
          const saved = JSON.parse(value);
          supabase.auth.setSession(saved).then(({ data }) => {
            if (data?.session?.user) {
              setUser(data.session.user);
              loadUserPurchases(data.session.user.id);
            }
          }).catch(() => {});
        } catch(e) {}
      }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserPurchases(session.user.id);
        // Sauvegarder session dans Preferences
        Preferences.set({ key: "sb-session", value: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }) }).catch(() => {});
      }
      if (event === "SIGNED_OUT") {
        setPurchasedBooks([]);
        localStorage.removeItem("purchasedBooks");
        setShowAuthModal(false);
        Preferences.remove({ key: "sb-session" }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadUserPurchases(userId) {
    const { data } = await supabase.from("purchases").select("book_id").eq("user_id", userId);
    if (data) {
      const remoteIds = data.map(p => p.book_id);
      // Fusionner avec les achats locaux
      const local = JSON.parse(localStorage.getItem("purchasedBooks") || "[]");
      const merged = [...new Set([...remoteIds, ...local])];
      setPurchasedBooks(merged);
      localStorage.setItem("purchasedBooks", JSON.stringify(merged));
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://www.carrybooks.com" }
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setPurchasedBooks([]);
    localStorage.removeItem("purchasedBooks");
  }

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
    if (!excerpt) {
      const saved = localStorage.getItem("readingProgress_" + bookToRead.id);
      setReadingPage(saved ? parseInt(saved) : 0);
    } else {
      setReadingPage(0);
    }
    setPage("reader");
    setTranslatedContent(null);
    setTranslateLang(null);
    stopAudio();
  }

  function toggleFavorite(bookId) {
    setFavoriteBooks(prev => {
      const updated = prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId];
      localStorage.setItem("favoriteBooks", JSON.stringify(updated));
      return updated;
    });
  }

 async function handlePurchase() {
    setPaymentStep(2);
    try {
      // Formater le numéro
      let phone = phoneNumber.replace(/\s/g, "");
      if (phone.startsWith("0")) phone = "237" + phone.slice(1);
      if (!phone.startsWith("237")) phone = "237" + phone;

      // Appel via notre fonction serverless (évite CORS)
      const payRes = await fetch("/api/campay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect",
          amount: paymentBook.price,
          phone: phone,
          description: "Achat " + paymentBook.title + " sur CarryBooks",
          external_reference: "CB_" + paymentBook.id + "_" + (user ? user.id : "guest") + "_" + Date.now()
        })
      });
      const payData = await payRes.json();

      if (payData.reference) {
        // Vérifier le statut après 25 secondes
        setTimeout(async () => {
          try {
            const checkRes = await fetch("/api/campay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check", reference: payData.reference })
            });
            const checkData = await checkRes.json();
            if (checkData.status === "SUCCESSFUL") {
              setPaymentStep(3);
              const newP = [...purchasedBooks, paymentBook.id];
              setPurchasedBooks(newP);
              localStorage.setItem("purchasedBooks", JSON.stringify(newP));
              if (user) await supabase.from("purchases").insert([{ user_id: user.id, book_id: paymentBook.id }]);
              cacheBook(paymentBook);
            } else {
              setPaymentStep(1);
              alert("Paiement non confirmé. Vérifiez votre solde et réessayez.");
            }
          } catch(e) {
            setPaymentStep(1);
            alert("Erreur de vérification. Vérifiez votre solde et réessayez.");
          }
        }, 25000);
      } else {
        setPaymentStep(1);
        alert("Erreur: " + (payData.message || "Vérifiez votre numéro et réessayez."));
      }
    } catch(e) {
      setPaymentStep(1);
      alert("Erreur de connexion. Vérifiez votre connexion internet.");
    }
  }

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioPlaying(false);
    setAudioMode(null);
  }

  function playMp3(url) {
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setAudioPlaying(true);
    setAudioMode('mp3');
    audio.onended = () => { setAudioPlaying(false); setAudioMode(null); };
  }

  async function translateText(text, targetLang) {
    setTranslating(true);
    try {
      const chunks = text.match(/.{1,4000}/gs) || [text];
      const results = [];
      for (const chunk of chunks) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(url);
        const data = await res.json();
        const translated = data[0].map(s => s[0]).join("");
        results.push(translated);
      }
      setTranslatedContent(results.join(""));
      setTranslateLang(targetLang);
    } catch(e) {
      alert("Erreur de traduction. Vérifiez votre connexion.");
    }
    setTranslating(false);
  }

  function resetTranslation() {
    setTranslatedContent(null);
    setTranslateLang(null);
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
    let matchCat = selectedCategory === "Tous" ||
      b.category === selectedCategory ||
      b.category?.toLowerCase().startsWith(selectedCategory.toLowerCase().replace(/s$/, ""));
    if (selectedCategory === "Livres Gratuits") matchCat = b.price === 0;
    if (selectedCategory === "Livre Audio") matchCat = b.category === "Livre Audio" || !!b.audio_url;
    const matchSub = selectedSubCategory === "Tous" || b.subcategory === selectedSubCategory;
    return matchSearch && matchCat && matchSub;
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
    // Mode PDF
    if (reading.pdf_url && reading.pdf_url !== "pending") {
      const savedPdfPage = parseInt(localStorage.getItem("pdfProgress_" + reading.id) || "1");
      const maxPage = excerptMode ? (reading.extract_pages || 5) : 9999;
      const startPage = excerptMode ? 1 : savedPdfPage;
      // Use excerpt_pdf_url if in excerpt mode and available
      const activePdfUrl = excerptMode && reading.excerpt_pdf_url ? reading.excerpt_pdf_url : reading.pdf_url;
      const pdfSrc = activePdfUrl + "#page=" + startPage;
      return (
        <div style={{ minHeight: "100vh", background: "#1a1a1a", display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#111", borderBottom: "1px solid #333", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
            <button onClick={() => { setPage(selectedBook ? "detail" : "home"); setReading(null); }}
              style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14 }}>
              ← Retour
            </button>
            <span style={{ color: "#ccc", fontSize: 13, fontStyle: "italic", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {reading.title}{excerptMode ? " — Extrait" : ""}
            </span>
            {!excerptMode && (
              <input type="number" min="1" defaultValue={startPage}
                onChange={e => localStorage.setItem("pdfProgress_" + reading.id, e.target.value)}
                style={{ width: 48, background: "#222", border: "1px solid #444", color: "#ccc", borderRadius: 4, padding: "2px 6px", fontSize: 12 }} />
            )}
            {excerptMode && <span style={{ opacity: 0 }}>x</span>}
          </div>
          <div onContextMenu={e => e.preventDefault()} style={{ flex: 1, userSelect: "none", WebkitUserSelect: "none" }}>
            <iframe
              src={"https://docs.google.com/viewer?url=" + encodeURIComponent(activePdfUrl) + "&embedded=true"}
              style={{ width: "100%", height: "calc(100vh - 56px)", border: "none" }}
              title={reading.title}
            />
          </div>
          {excerptMode && (
            <div style={{ background: "#111", padding: "12px 16px", textAlign: "center" }}>
              <span style={{ color: "#aaa", fontSize: 12 }}>Extrait limité — Achetez pour lire la suite</span>
            </div>
          )}
        </div>
      );
    }

    const allPages = getPages(translatedContent || reading.content);
    const pages = excerptMode ? allPages.slice(0, 2) : allPages;
    const total = pages.length;

    // In scroll mode, show all paragraphs; in page mode show current page only
    const scrollAllParagraphs = readerScrollMode
      ? pages.flatMap(p => p.split(/\n\n+/).filter(x => x.trim()))
      : (pages[readingPage] ? pages[readingPage].split(/\n\n+/).filter(p => p.trim().length > 0) : []);

    const FONTS = [
      { label: "Georgia", value: "Georgia, serif" },
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Verdana", value: "Verdana, sans-serif" },
      { label: "Palatino", value: "Palatino, serif" },
    ];

    return (
      <div style={{ minHeight: "100vh", background: readerDark ? "#1a1a1a" : "#ffffff", display: "flex", flexDirection: "column", fontFamily: readerFont }}>
        {/* Header */}
        <div style={{ background: readerDark ? "#111" : "#fff", borderBottom: "1px solid " + (readerDark ? "#333" : "#ddd"), padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => { setPage(selectedBook ? "detail" : "home"); setReading(null); }}
            style={{ background: "none", border: "none", color: readerDark ? "#aaa" : "#888", cursor: "pointer", fontSize: 14 }}>
            ← Retour
          </button>
          <span style={{ color: readerDark ? "#ccc" : "#555", fontSize: 13, fontStyle: "italic", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reading.title}
          </span>
          <button onClick={() => setShowReaderSettings(s => !s)}
            style={{ background: "none", border: "1px solid " + (readerDark ? "#444" : "#ddd"), borderRadius: 6, color: readerDark ? "#ccc" : "#888", cursor: "pointer", fontSize: 13, padding: "4px 10px", fontWeight: "bold" }}>
            Aa
          </button>
          {reading.audio_url && (
          <button onClick={() => {
            if (audioPlaying) { stopAudio(); }
            else { playMp3(reading.audio_url); }
          }}
            style={{ background: audioPlaying ? G.gold : "none", border: "1px solid " + (audioPlaying ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, color: audioPlaying ? "#000" : (readerDark ? "#ccc" : "#888"), cursor: "pointer", fontSize: 16, padding: "4px 10px" }}>
            {audioPlaying ? "⏸" : "🔊"}
          </button>
          )}
        </div>

        {/* Panneau paramètres */}
        {showReaderSettings && (
          <div style={{ background: readerDark ? "#222" : "#fafafa", borderBottom: "1px solid " + (readerDark ? "#333" : "#e0e0e0"), padding: "14px 16px" }}>
            {/* Mode jour/nuit */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Mode</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setReaderDark(false)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (!readerDark ? G.gold : "#ddd"), borderRadius: 6, background: !readerDark ? "#fdf8ee" : "#fff", color: !readerDark ? G.gold : "#555", cursor: "pointer", fontSize: 13 }}>
                  ☀️ Jour
                </button>
                <button onClick={() => setReaderDark(true)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (readerDark ? G.gold : "#555"), borderRadius: 6, background: readerDark ? "#333" : "#222", color: readerDark ? G.gold : "#aaa", cursor: "pointer", fontSize: 13 }}>
                  🌙 Nuit
                </button>
              </div>
            </div>
            {/* Taille police */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Taille du texte</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <button onClick={() => setReaderSize(s => Math.max(12, s - 1))}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid " + (readerDark ? "#444" : "#ddd"), background: readerDark ? "#333" : "#fff", fontSize: 18, cursor: "pointer", color: readerDark ? "#ccc" : "#555" }}>−</button>
                <span style={{ fontSize: readerSize, fontFamily: readerFont, flex: 1, textAlign: "center", color: readerDark ? "#ccc" : "#333" }}>Aa ({readerSize}px)</span>
                <button onClick={() => setReaderSize(s => Math.min(24, s + 1))}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid " + (readerDark ? "#444" : "#ddd"), background: readerDark ? "#333" : "#fff", fontSize: 18, cursor: "pointer", color: readerDark ? "#ccc" : "#555" }}>+</button>
              </div>
            </div>
            {/* Police */}
            <div>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Police</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FONTS.map(f => (
                  <button key={f.value} onClick={() => setReaderFont(f.value)}
                    style={{ padding: "6px 12px", border: "1.5px solid " + (readerFont === f.value ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: readerFont === f.value ? (readerDark ? "#333" : "#fdf8ee") : (readerDark ? "#2a2a2a" : "#fff"), color: readerFont === f.value ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13, fontFamily: f.value }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Mode de lecture */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Mode de lecture</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setReaderScrollMode(false)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (!readerScrollMode ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: !readerScrollMode ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: !readerScrollMode ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  📄 Page à page
                </button>
                <button onClick={() => setReaderScrollMode(true)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (readerScrollMode ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: readerScrollMode ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: readerScrollMode ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  📜 Scroll
                </button>
              </div>
            </div>
            {/* Traduction */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Traduction</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => translating ? null : (translateLang === "fr" ? resetTranslation() : translateText(reading.content, "fr"))}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (translateLang === "fr" ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: translateLang === "fr" ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: translateLang === "fr" ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  🇫🇷 Français
                </button>
                <button onClick={() => translating ? null : (translateLang === "en" ? resetTranslation() : translateText(reading.content, "en"))}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (translateLang === "en" ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: translateLang === "en" ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: translateLang === "en" ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  🇬🇧 English
                </button>
                {translateLang && (
                  <button onClick={resetTranslation}
                    style={{ padding: "8px 12px", border: "1.5px solid " + (readerDark ? "#444" : "#ddd"), borderRadius: 6, background: "transparent", color: readerDark ? "#aaa" : "#555", cursor: "pointer", fontSize: 13 }}>
                    ✕ Original
                  </button>
                )}
              </div>
              {translating && <p style={{ color: G.gold, fontSize: 12, marginTop: 6, textAlign: "center" }}>Traduction en cours...</p>}
            </div>
          </div>
        )}

        {/* Contenu */}
        <div
          onContextMenu={e => e.preventDefault()}
          style={{ flex: 1, padding: "20px 12px 100px 12px", maxWidth: "100%", width: "100%", boxSizing: "border-box", overflowX: "hidden", userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none" }}>
          {scrollAllParagraphs.map(function(para, i) {
            return (
              <p key={i} style={{
                fontFamily: readerFont,
                fontSize: readerSize + "px",
                lineHeight: "1.9",
                color: readerDark ? "#e0e0e0" : "#1a1a1a",
                textAlign: "justify",
                margin: 0,
                marginBottom: "1em",
                textIndent: i === 0 ? "0" : "1.5em",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                userSelect: "none",
                WebkitUserSelect: "none"
              }} dangerouslySetInnerHTML={{ __html: para.trim() }} />
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

          <div style={{ textAlign: "center", color: readerDark ? "#555" : "#ccc", fontSize: 13, marginTop: 40, fontFamily: readerFont }}>
            — {readingPage + 1} —
          </div>
        </div>

        {/* Navigation - cachée en mode scroll */}
        {!readerScrollMode && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: readerDark ? "#111" : "#fff", borderTop: "1px solid " + (readerDark ? "#333" : "#e0e0e0"), padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <button onClick={() => { setReadingPage(function(p) { return Math.max(0, p - 1); }); window.scrollTo(0,0); }} disabled={readingPage === 0}
            style={{ width: 44, height: 44, borderRadius: "50%", background: readingPage === 0 ? (readerDark ? "#222" : "#f5f5f5") : (readerDark ? "#2a2a2a" : "#fdf8ee"), border: "1px solid " + (readingPage === 0 ? (readerDark ? "#333" : "#e0e0e0") : G.gold), color: readingPage === 0 ? (readerDark ? "#444" : "#ccc") : G.gold, fontSize: 22, cursor: readingPage === 0 ? "not-allowed" : "pointer" }}>
            ‹
          </button>
          <input type="range" min={0} max={total - 1} value={readingPage}
            onChange={function(e) { setReadingPage(Number(e.target.value)); window.scrollTo(0,0); }}
            style={{ flex: 1, accentColor: G.gold }} />
          <button onClick={() => { setReadingPage(function(p) { return Math.min(total - 1, p + 1); }); window.scrollTo(0,0); }} disabled={readingPage === total - 1}
            style={{ width: 44, height: 44, borderRadius: "50%", background: readingPage === total - 1 ? (readerDark ? "#222" : "#f5f5f5") : (readerDark ? "#2a2a2a" : "#fdf8ee"), border: "1px solid " + (readingPage === total - 1 ? (readerDark ? "#333" : "#e0e0e0") : G.gold), color: readingPage === total - 1 ? (readerDark ? "#444" : "#ccc") : G.gold, fontSize: 22, cursor: readingPage === total - 1 ? "not-allowed" : "pointer" }}>
            ›
          </button>
        </div>
        )}
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
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Résumé</div>
              <p style={{ color: G.text, lineHeight: 1.8, fontSize: 12, margin: 0, fontStyle: "italic", textAlign: "justify" }}>{book.summary}</p>
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

          {(owned || free) && (
            <button onClick={() => { cacheBook(book); alert("✅ Livre sauvegardé pour la lecture hors connexion !"); }}
              style={{ width: "100%", padding: 11, background: cachedBooks[book.id] ? G.surface2 : "transparent", border: "1px solid " + (cachedBooks[book.id] ? G.border : G.gold), borderRadius: 6, color: cachedBooks[book.id] ? G.textDim : G.gold, cursor: "pointer", fontSize: 13, marginTop: 8 }}>
              {cachedBooks[book.id] ? "✅ Disponible hors connexion" : "📥 Télécharger hors connexion"}
            </button>
          )}
        </div>

        {/* PAYMENT MODAL in detail page */}
        {showPayment && paymentBook && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
            <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid #e0e0e0" }}>
              {paymentStep === 1 && (
                <>
                  <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
                  <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16 }}>Acheter ce livre</h3>
                  <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>{paymentBook.title} — {paymentBook.price?.toLocaleString()} FCFA</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {[{ id: "orange", label: "Orange Money", logo: "data:image/png;base64,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", color: "#ff6600" }, { id: "mtn", label: "MTN MoMo", logo: "data:image/png;base64,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+4urmYpMGZmTFjDSaWgW7De91pXBMEdPyjL3DDEkcMdO9jGtTJGojY0REPp5USKtjsmSKv62/d/lNvpFEkiyJGxHrvcjUzX2kyRRyIiSRseibtZqKXrMWaNVlqiYV+aY1tr67NLb3tle99RVu6jXk4sqH/fcTe2q5Bta66m7+RdX/wDHP/pqae0cYMpcY6HJaSRGxV0NbK+knVNrHardi/yr095vlURU1VRMt2RxjjZG3VjY1idTUyQsKbiKNTpZ8KALPL2vDr6tG+VrZ3vn1K5mqXDmorXxM2hpaRvvbwsq+aDYrrBpcqae8pMlbBRSQyeE3pq6jU29OxE2lhTikcaSLIkbUeu92W3vOR8YkrvpubEzzYZZobYHLLdkLDq2KtKp3o+CYWlpZk37UABgFk0AARAAEQABEIfzHcCSH8x3ABUXmQADqZR8gACL03ZzG8CTgx7NRv227usnXZ2295yzZSCuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkDjrs7be8a7O23vFkXIHHXZ229412dtveLIuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkDjrs7be8a7O23vFkXIHHXZ229412dtveLIuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkQ/mO4Ea7O23vIe9mo77bd3WAEXmUADqZR8gACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAi//9k=", color: "#ffc000" }].map(m => (
                      <div key={m.id} onClick={() => setPaymentMethod(m.id)}
                        style={{ padding: "12px 16px", border: "2px solid " + (paymentMethod === m.id ? m.color : "#e0e0e0"), borderRadius: 8, cursor: "pointer", background: paymentMethod === m.id ? m.color + "22" : "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <img src={m.logo} alt={m.label} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} />
                        <span style={{ color: "#1a1a1a", fontSize: 15, fontWeight: paymentMethod === m.id ? "bold" : "normal" }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                  {paymentMethod && (
                    <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Numéro (ex: 237699000000)"
                      style={{ width: "100%", padding: "12px 14px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, color: "#1a1a1a", fontSize: 14, marginBottom: 16 }} />
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowPayment(false)} style={{ flex: 1, padding: 13, background: "none", border: "1px solid #ccc", borderRadius: 6, color: "#666", cursor: "pointer", fontSize: 13 }}>Annuler</button>
                    <button onClick={handlePurchase} disabled={!paymentMethod || !phoneNumber}
                      style={{ flex: 2, padding: 13, background: paymentMethod && phoneNumber ? G.gold : "#ccc", border: "none", borderRadius: 6, color: "#fff", fontWeight: "bold", cursor: paymentMethod && phoneNumber ? "pointer" : "not-allowed", fontSize: 13 }}>
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
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(245,240,232,0.97)", borderBottom: "1px solid " + G.navBorder, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div onClick={() => { setPage("home"); setShowMenu(false); }} style={{ cursor: "pointer" }}>
          <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 40, borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {!isOnline && <span style={{ fontSize: 10, background: "#3a2a00", color: G.gold, padding: "3px 8px", borderRadius: 10 }}>📴</span>}
          {user
            ? <img src={user.user_metadata?.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid " + G.gold, cursor: "pointer" }} onClick={() => setShowMenu(m => !m)} />
            : <button onClick={() => setShowAuthModal(true)} style={{ background: G.gold, border: "none", borderRadius: 6, color: "#000", fontSize: 12, fontWeight: "bold", padding: "6px 12px", cursor: "pointer" }}>Connexion</button>
          }
          {page === "home" && (
            <button onClick={() => setPage("catalog")} style={{ background: "none", border: "none", color: G.text, fontSize: 20, cursor: "pointer", padding: 4 }}>
              🔍
            </button>
          )}
          <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", color: "#1a1208", fontSize: 28, cursor: "pointer", padding: 4 }}>
            {showMenu ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* MENU */}
      {showMenu && (
        <div style={{ position: "fixed", top: 56, left: 0, right: 0, bottom: 0, zIndex: 99, background: "rgba(0,0,0,0.95)" }} onClick={() => setShowMenu(false)}>
          <div style={{ background: G.navSurface, borderBottom: "1px solid " + G.navBorder }} onClick={e => e.stopPropagation()}>
            {user && (
              <div style={{ padding: "16px 24px", borderBottom: "1px solid " + G.navBorder, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <img src={user.user_metadata?.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                <div>
                  <div style={{ fontSize: 14, color: G.navText, fontWeight: "bold" }}>{user.user_metadata?.full_name || user.email}</div>
                  <div style={{ fontSize: 11, color: G.textDim }}>{user.email}</div>
                </div>
              </div>
            )}
            {navItems.map(item => (
              <div key={item.id} onClick={() => { setPage(item.id); setShowMenu(false); }}
                style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: page === item.id ? G.gold : G.navText, borderLeft: "3px solid " + (page === item.id ? G.gold : "transparent"), background: page === item.id ? G.goldDim : "transparent", borderBottom: "1px solid " + G.navBorder }}>
                {item.label}
              </div>
            ))}
            {user
              ? <div onClick={() => { signOut(); setShowMenu(false); }} style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: "#e53935", borderBottom: "1px solid " + G.navBorder }}>🚪 Se déconnecter</div>
              : <div onClick={() => { signInWithGoogle(); setShowMenu(false); }} style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: G.gold, borderBottom: "1px solid " + G.navBorder }}>🔑 Se connecter avec Google</div>
            }
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && authChecked && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 340, textAlign: "center", border: "1px solid #e0d8c8" }}>
            <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 48, marginBottom: 20 }} />
            <h2 style={{ color: G.text, fontSize: 18, marginBottom: 8 }}>Bienvenue sur CarryBooks 📚</h2>
            <p style={{ color: G.textDim, fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>Connecte-toi en un clic avec Google pour :</p>
            <div style={{ textAlign: "left", marginBottom: 24, padding: "0 8px" }}>
              <div style={{ fontSize: 13, color: G.text, marginBottom: 6 }}>✅ Accéder à tes livres depuis n'importe quel appareil</div>
              <div style={{ fontSize: 13, color: G.text, marginBottom: 6 }}>✅ Ne jamais perdre tes achats</div>
              <div style={{ fontSize: 13, color: G.text }}>✅ Sans mot de passe</div>
            </div>
            <button onClick={signInWithGoogle}
              style={{ width: "100%", padding: "14px 0", background: "#fff", border: "2px solid " + G.gold, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "bold", color: "#333", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 18 }} />
              Continuer avec Google
            </button>
            <button onClick={() => setShowAuthModal(false)} style={{ background: "none", border: "none", color: G.textFaint, cursor: "pointer", fontSize: 12 }}>Continuer sans compte →</button>
          </div>
        </div>
      )}

      <div style={{ paddingTop: 56 }}>
        {/* HERO */}
        {/* SEARCH + CATEGORIES - caché sur home Netflix */}
        {(page === "catalog" || searchQuery || selectedCategory !== "Tous" || page !== "home") && (
        <div style={{ padding: "14px 16px 8px", background: G.bg, position: "sticky", top: 56, zIndex: 9, borderBottom: "1px solid " + G.border }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un livre ou auteur..."
            style={{ width: "100%", padding: "11px 14px", background: "#fff", border: "1px solid " + G.border, borderRadius: 8, color: G.text, fontSize: 14, fontFamily: "Georgia, serif", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            <button onClick={() => { setSelectedCategory("Tous"); setSelectedSubCategory("Tous"); }}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1px solid " + (selectedCategory === "Tous" ? G.gold : G.border), background: selectedCategory === "Tous" ? G.goldDim : "transparent", color: selectedCategory === "Tous" ? G.gold : G.textDim, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              Tous
            </button>
            {Object.keys(CATEGORIES).map(cat => (
              <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedSubCategory("Tous"); }}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1px solid " + (selectedCategory === cat ? G.gold : G.border), background: selectedCategory === cat ? G.goldDim : "transparent", color: selectedCategory === cat ? G.gold : G.textDim, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                {cat}
              </button>
            ))}
          </div>
          {selectedCategory !== "Tous" && CATEGORIES[selectedCategory] && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginTop: 6 }}>
              <button onClick={() => setSelectedSubCategory("Tous")}
                style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 20, border: "1px solid " + (selectedSubCategory === "Tous" ? G.goldLight : G.border), background: selectedSubCategory === "Tous" ? G.goldDim : "transparent", color: selectedSubCategory === "Tous" ? G.gold : G.textFaint, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                Tous
              </button>
              {CATEGORIES[selectedCategory].map(sub => (
                <button key={sub} onClick={() => setSelectedSubCategory(sub)}
                  style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 20, border: "1px solid " + (selectedSubCategory === sub ? G.goldLight : G.border), background: selectedSubCategory === sub ? G.goldDim : "transparent", color: selectedSubCategory === sub ? G.gold : G.textFaint, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* BOOKS GRID - Netflix style for home, grid for catalog */}
        {(page === "home" || page === "catalog") && (
          <div style={{ paddingBottom: 80 }}>
            {page === "home" && !searchQuery && selectedCategory === "Tous" ? (
              <>
                {/* HERO CAROUSEL */}
                {(() => {
                  const featuredBooks = books.filter(b => b.featured);
                  const heroBooks = featuredBooks.length > 0 ? featuredBooks : books.slice(0, 5);
                  if (heroBooks.length === 0) return null;
                  const featuredBook = heroBooks[heroIndex % heroBooks.length];
                  return (
                    <div style={{ position: "relative", width: "100%", height: 420, overflow: "hidden", marginBottom: 24 }}>
                      {heroBooks.map((book, idx) => (
                        <div key={book.id} onClick={() => openBook(book)}
                          style={{ position: "absolute", inset: 0, cursor: "pointer", opacity: idx === (heroIndex % heroBooks.length) ? 1 : 0, transition: "opacity 0.8s ease" }}>
                          {book.cover
                            ? <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", background: G.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>📖</div>}
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(245,240,232,0.7) 70%, " + G.bg + " 100%)" }} />
                        </div>
                      ))}
                      <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 2 }}>
                        <div style={{ fontSize: 10, color: G.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>★ À la une</div>
                        <div style={{ fontSize: 22, fontWeight: "bold", color: G.text, marginBottom: 4, lineHeight: 1.2 }}>{featuredBook.title}</div>
                        <div style={{ fontSize: 13, color: G.textDim, marginBottom: 12 }}>par {featuredBook.author}</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <button onClick={e => { e.stopPropagation(); openBook(featuredBook); }}
                            style={{ padding: "10px 20px", background: G.gold, border: "none", borderRadius: 4, color: "#000", fontSize: 12, fontWeight: "bold", cursor: "pointer", letterSpacing: 1 }}>
                            Découvrir
                          </button>
                          <button onClick={e => { e.stopPropagation(); toggleFavorite(featuredBook.id); }}
                            style={{ padding: "10px 16px", background: "rgba(255,255,255,0.7)", border: "1px solid " + G.border, borderRadius: 4, color: G.text, fontSize: 14, cursor: "pointer" }}>
                            {favoriteBooks.includes(featuredBook.id) ? "♥" : "♡"}
                          </button>
                        </div>
                        {heroBooks.length > 1 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                            {heroBooks.map((_, idx) => (
                              <div key={idx} onClick={e => { e.stopPropagation(); setHeroIndex(idx); }}
                                style={{ width: idx === (heroIndex % heroBooks.length) ? 20 : 6, height: 6, borderRadius: 3, background: idx === (heroIndex % heroBooks.length) ? G.gold : "rgba(201,168,76,0.4)", cursor: "pointer", transition: "all 0.3s" }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* NOUVEAUTÉS */}
                {books.slice(0, 10).length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: G.text, padding: "0 16px", marginBottom: 12 }}>Nouveautés</div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
                      {books.slice(0, 10).map(book => (
                        <div key={book.id} onClick={() => openBook(book)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                          <div style={{ width: 110, height: 155, background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                            {book.cover
                              ? <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>📖</div>}
                            {book.price === 0 && <div style={{ position: "absolute", top: 4, left: 4, background: G.green, color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 6 }}>GRATUIT</div>}
                          </div>
                          <div style={{ fontSize: 11, color: G.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</div>
                          <div style={{ fontSize: 9, color: G.textFaint, marginTop: 1 }}>{book.can_download ? "⬇️ Téléchargeable" : "📖 Liseuse"}</div>
                          <div style={{ fontSize: 10, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold", marginTop: 2 }}>{book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " F"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CARROUSELS PAR CATÉGORIE */}
                {Object.keys(CATEGORIES).map(cat => {
                  const catBooks = books.filter(b => b.category === cat || b.category?.toLowerCase().startsWith(cat.toLowerCase().replace(/s$/, "")));
                  if (catBooks.length === 0) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 28 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: G.text }}>{cat}</div>
                        <button onClick={() => { setSelectedCategory(cat); setPage("catalog"); }}
                          style={{ fontSize: 12, color: G.gold, background: "none", border: "none", cursor: "pointer" }}>Tout voir →</button>
                      </div>
                      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
                        {catBooks.map(book => (
                          <div key={book.id} onClick={() => openBook(book)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                            <div style={{ width: 110, height: 155, background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                              {book.cover
                                ? <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>📖</div>}
                              {book.price === 0 && <div style={{ position: "absolute", top: 4, left: 4, background: G.green, color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 6 }}>GRATUIT</div>}
                            </div>
                            <div style={{ fontSize: 11, color: G.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</div>
                            <div style={{ fontSize: 9, color: G.textFaint, marginTop: 1 }}>{book.can_download ? "⬇️ Téléchargeable" : "📖 Liseuse"}</div>
                            <div style={{ fontSize: 10, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold", marginTop: 2 }}>{book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " F"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* MES FAVORIS */}
                {favoriteBooks.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: G.text, padding: "0 16px", marginBottom: 12 }}>Mes favoris</div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
                      {books.filter(b => favoriteBooks.includes(b.id)).map(book => (
                        <div key={book.id} onClick={() => openBook(book)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                          <div style={{ width: 110, height: 155, background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                            {book.cover && <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            <div style={{ position: "absolute", top: 4, right: 4, color: G.gold, fontSize: 14 }}>♥</div>
                          </div>
                          <div style={{ fontSize: 11, color: G.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "20px 16px 80px" }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 16 }}>
                  {searchQuery ? "Résultats" : selectedCategory !== "Tous" ? selectedCategory : "Catalogue"}
                  {!loading && <span style={{ color: G.textFaint, marginLeft: 8, fontSize: 11, letterSpacing: 0 }}>({filteredBooks.length})</span>}
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: G.textDim }}>Chargement...</div>
                ) : filteredBooks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: G.textFaint }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                    <div style={{ color: G.textDim, fontSize: 15, fontStyle: "italic" }}>Projet en cours,<br />revenez dans quelques jours ✨</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {filteredBooks.map(book => (
                      <div key={book.id} onClick={() => openBook(book)} style={{ cursor: "pointer" }}>
                        <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                          {book.cover
                            ? <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: G.textFaint }}>📖</div>}
                          {book.price === 0 && <div style={{ position: "absolute", top: 8, left: 8, background: G.green, color: "#fff", fontSize: 9, padding: "2px 8px", borderRadius: 8, fontWeight: "bold", letterSpacing: 1 }}>GRATUIT</div>}
                        </div>
                        <div style={{ fontSize: 13, color: G.text, marginBottom: 3, lineHeight: 1.3 }}>{book.title}</div>
                        <div style={{ fontSize: 11, color: G.textDim, marginBottom: 4 }}>{book.can_download ? "⬇️ Téléchargeable" : "📖 Liseuse"}</div>
                        <div style={{ fontSize: 13, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>
                          {book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <button onClick={(e) => { e.stopPropagation(); startReading(book); }} style={{ width: "100%", padding: 8, background: G.goldDim, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 4, color: G.gold, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>📖 LIRE</button>
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
          <div style={{ background: G.navSurface, borderTop: "1px solid " + G.navBorder, padding: "32px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 64, borderRadius: 8 }} />
            <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.textDim, fontSize: 13, textDecoration: "none" }}>carrybooks.com@gmail.com</a>
            <div style={{ color: G.textDim, fontSize: 12 }}>© 2026 CarryBooks. Tous droits réservés.</div>
          </div>
        )}
      {/* PAYMENT MODAL */}
      {showPayment && paymentBook && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid #e0e0e0" }}>
            {paymentStep === 1 && (
              <>
                <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
                <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16 }}>Acheter ce livre</h3>
                <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>{paymentBook.title} — {paymentBook.price?.toLocaleString()} FCFA</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {[{ id: "orange", label: "Orange Money", logo: "data:image/png;base64,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", color: "#ff6600" }, { id: "mtn", label: "MTN MoMo", logo: "data:image/png;base64,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+4urmYpMGZmTFjDSaWgW7De91pXBMEdPyjL3DDEkcMdO9jGtTJGojY0REPp5USKtjsmSKv62/d/lNvpFEkiyJGxHrvcjUzX2kyRRyIiSRseibtZqKXrMWaNVlqiYV+aY1tr67NLb3tle99RVu6jXk4sqH/fcTe2q5Bta66m7+RdX/wDHP/pqae0cYMpcY6HJaSRGxV0NbK+knVNrHardi/yr095vlURU1VRMt2RxjjZG3VjY1idTUyQsKbiKNTpZ8KALPL2vDr6tG+VrZ3vn1K5mqXDmorXxM2hpaRvvbwsq+aDYrrBpcqae8pMlbBRSQyeE3pq6jU29OxE2lhTikcaSLIkbUeu92W3vOR8YkrvpubEzzYZZobYHLLdkLDq2KtKp3o+CYWlpZk37UABgFk0AARAAEQABEIfzHcCSH8x3ABUXmQADqZR8gACL03ZzG8CTgx7NRv227usnXZ2295yzZSCuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkDjrs7be8a7O23vFkXIHHXZ229412dtveLIuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkDjrs7be8a7O23vFkXIHHXZ229412dtveLIuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkQ/mO4Ea7O23vIe9mo77bd3WAEXmUADqZR8gACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAi//9k=", color: "#ffc000" }].map(m => (
                    <div key={m.id} onClick={() => setPaymentMethod(m.id)}
                      style={{ padding: "12px 16px", border: "2px solid " + (paymentMethod === m.id ? m.color : "#e0e0e0"), borderRadius: 8, cursor: "pointer", background: paymentMethod === m.id ? m.color + "22" : "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <img src={m.logo} alt={m.label} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} />
                      <span style={{ color: "#1a1a1a", fontSize: 15, fontWeight: paymentMethod === m.id ? "bold" : "normal" }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                {paymentMethod && (
                  <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="Numéro (ex: 237699000000)"
                    style={{ width: "100%", padding: "12px 14px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, color: "#1a1a1a", fontSize: 14, marginBottom: 16 }} />
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowPayment(false)} style={{ flex: 1, padding: 13, background: "none", border: "1px solid #ccc", borderRadius: 6, color: "#666", cursor: "pointer", fontSize: 13 }}>Annuler</button>
                  <button onClick={handlePurchase} disabled={!paymentMethod || !phoneNumber}
                    style={{ flex: 2, padding: 13, background: paymentMethod && phoneNumber ? G.gold : "#ccc", border: "none", borderRadius: 6, color: "#fff", fontWeight: "bold", cursor: paymentMethod && phoneNumber ? "pointer" : "not-allowed", fontSize: 13 }}>
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








