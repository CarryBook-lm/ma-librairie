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
  "Livre Audio": ["Roman", "Conte", "Développement personnel", "Business", "Enfants", "Adultes"],
  "Livres Gratuits": [],
  "Podcast": ["Amour", "Argent", "Confiance en soi", "Spiritualité", "Motivation"],
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
  const [subscription, setSubscription] = useState(null);
  const [subSettings, setSubSettings] = useState({ monthly_price: 2000, annual_price: 20000, books_per_month: 3 });
  const [showSubModal, setShowSubModal] = useState(false);
  const [subPlan, setSubPlan] = useState("mensuel");
  const [subPaymentStep, setSubPaymentStep] = useState(1);
  const [subPhone, setSubPhone] = useState("");
  const [subPaymentMethod, setSubPaymentMethod] = useState(null);

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
    // Charger les paramètres d'abonnement au démarrage
    supabase.from("sub_settings").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) setSubSettings(data[0]);
    });
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
      const local = JSON.parse(localStorage.getItem("purchasedBooks") || "[]");
      const merged = [...new Set([...remoteIds, ...local])];
      setPurchasedBooks(merged);
      localStorage.setItem("purchasedBooks", JSON.stringify(merged));
    }
    // Charger abonnement actif
    const now = new Date().toISOString();
    const { data: sub } = await supabase.from("subscriptions")
      .select("*").eq("user_id", userId).eq("status", "actif")
      .gte("expires_at", now).order("created_at", { ascending: false }).limit(1);
    if (sub && sub.length > 0) setSubscription(sub[0]);
    else setSubscription(null);
    // Charger paramètres abonnement
    const { data: settings } = await supabase.from("sub_settings").select("*").limit(1);
    if (settings && settings.length > 0) setSubSettings(settings[0]);
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

  function shareBook(book) {
    const url = window.location.origin + "/?book=" + book.id;
    const text = "📚 Découvrez \"" + book.title + "\" par " + book.author + " sur CarryBooks !";
    if (navigator.share) {
      navigator.share({ title: book.title, text, url }).catch(() => {});
    } else {
      // Fallback: copier le lien
      navigator.clipboard?.writeText(url).then(() => alert("Lien copié ! Partagez-le où vous voulez.")).catch(() => {
        // Fallback: WhatsApp
        window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank");
      });
    }
  }

  function hasAccess(book) {
    if (book.price === 0) return true;
    if (purchasedBooks.includes(book.id)) return true;
    if (subscription && subscription.status === "actif") return true;
    return false;
  }

  function booksLeftThisMonth() {
    if (!subscription) return 0;
    return Math.max(0, (subscription.books_per_month || subSettings.books_per_month) - (subscription.books_used || 0));
  }

  async function handleSubscribe() {
    if (!subPaymentMethod || !subPhone) return;
    setSubPaymentStep(2);
    try {
      let phone = subPhone.replace(/\s/g, "").replace(/^\+/, "");
      if (phone.startsWith("0")) phone = "237" + phone.slice(1);
      if (!phone.startsWith("237")) phone = "237" + phone;
      const price = subSettings.monthly_price;
      const payRes = await fetch("/api/campay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect",
          amount: price,
          phone,
          description: "Abonnement CarryBooks " + subPlan,
          external_reference: "SUB_" + subPlan + "_" + (user ? user.id : "guest") + "_" + Date.now()
        })
      });
      const payData = await payRes.json();
      if (payData.reference) {
        setTimeout(async () => {
          try {
            const checkRes = await fetch("/api/campay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check", reference: payData.reference })
            });
            const checkData = await checkRes.json();
            if (checkData.status === "SUCCESSFUL") {
              const now = new Date();
              const expires = new Date(now);
              if (subPlan === "mensuel") expires.setMonth(expires.getMonth() + 1);
              else expires.setFullYear(expires.getFullYear() + 1);
              if (user) {
                const { data: newSub } = await supabase.from("subscriptions").insert([{
                  user_id: user.id,
                  plan: subPlan,
                  books_per_month: subSettings.books_per_month,
                  books_used: 0,
                  price,
                  started_at: now.toISOString(),
                  expires_at: expires.toISOString(),
                  status: "actif"
                }]).select().single();
                if (newSub) setSubscription(newSub);
              }
              setSubPaymentStep(3);
            } else {
              setSubPaymentStep(1);
              alert("Paiement non confirmé. Réessayez.");
            }
          } catch(e) { setSubPaymentStep(1); alert("Erreur de vérification."); }
        }, 25000);
      } else {
        setSubPaymentStep(1);
        alert("Erreur: " + (payData.message || "Réessayez."));
      }
    } catch(e) { setSubPaymentStep(1); alert("Erreur de connexion."); }
  }

  function cacheBook(book) {
    const newCache = { ...cachedBooks, [book.id]: book };
    setCachedBooks(newCache);
    localStorage.setItem("cachedBooks", JSON.stringify(newCache));
  }

  function shareBook(book) {
    const url = window.location.origin + "/?book=" + book.id;
    const text = "📚 Découvre « " + book.title + " » de " + book.author + " sur CarryBooks !\n" + url;
    if (navigator.share) {
      navigator.share({ title: book.title, text: "Découvre ce livre sur CarryBooks !", url });
    } else {
      const waUrl = "https://wa.me/?text=" + encodeURIComponent(text);
      window.open(waUrl, "_blank");
    }
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
    { id: "subscription", label: "Abonnement" },
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
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={() => shareBook(book)} style={{ background: "none", border: "none", color: G.textDim, fontSize: 20, cursor: "pointer" }}>🔗</button>
            <button onClick={() => toggleFavorite(book.id)} style={{ background: "none", border: "none", color: isFav ? G.gold : G.textDim, fontSize: 22, cursor: "pointer" }}>{isFav ? "♥" : "♡"}</button>
          </div>
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
            <button onClick={() => shareBook(book)}
              style={{ flex: 1, padding: "12px 8px", background: "none", border: "1.5px solid " + G.border, borderRadius: 6, color: G.textDim, cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              🔗 Partager
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
                    {[{ id: "orange", label: "Orange Money", logo: "https://logo.clearbit.com/orange.com", color: "#ff6600" }, { id: "mtn", label: "MTN MoMo", logo: "https://logo.clearbit.com/mtn.com", color: "#ffc000" }].map(m => (
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
                      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
                        <button onClick={e => { e.stopPropagation(); shareBook(featuredBook); }}
                          style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                          🔗
                        </button>
                      </div>
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
                          <button onClick={e => { e.stopPropagation(); shareBook(featuredBook); }}
                            style={{ padding: "10px 16px", background: "rgba(255,255,255,0.7)", border: "1px solid " + G.border, borderRadius: 4, color: G.text, fontSize: 14, cursor: "pointer" }}>
                            🔗
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

        {/* ABONNEMENT */}
        {page === "subscription" && (
          <div style={{ padding: "24px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 4 }}>Abonnement</div>
            <p style={{ color: G.textDim, fontSize: 13, marginBottom: 24 }}>Accédez à {subSettings.books_per_month} livres par mois pour un tarif fixe.</p>

            {/* Abonnement actif */}
            {subscription && (
              <div style={{ background: G.goldDim, border: "2px solid " + G.gold, borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>✅ Abonnement actif</div>
                <div style={{ fontSize: 15, color: G.text, fontWeight: "bold", marginBottom: 4 }}>Plan {subscription.plan}</div>
                <div style={{ fontSize: 13, color: G.textDim, marginBottom: 4 }}>Expire le {new Date(subscription.expires_at).toLocaleDateString("fr-FR")}</div>
                <div style={{ fontSize: 13, color: G.text }}>📚 {booksLeftThisMonth()} livre{booksLeftThisMonth() > 1 ? "s" : ""} restant{booksLeftThisMonth() > 1 ? "s" : ""} ce mois</div>
              </div>
            )}

            {/* Offre Mensuel uniquement */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ border: "2px solid " + G.gold, borderRadius: 12, padding: 20, background: G.goldDim }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: G.text, marginBottom: 4 }}>Abonnement Mensuel</div>
                    <div style={{ fontSize: 13, color: G.textDim }}>{subSettings.books_per_month} livres par mois</div>
                    <div style={{ fontSize: 11, color: G.textFaint, marginTop: 4 }}>Sans engagement — résiliable à tout moment</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: "bold", color: G.gold }}>{subSettings.monthly_price?.toLocaleString()} F</div>
                    <div style={{ fontSize: 11, color: G.textDim }}>/ mois</div>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => { if (!user) { setShowAuthModal(true); return; } setShowSubModal(true); setSubPaymentStep(1); setSubPaymentMethod(null); setSubPhone(""); }}
              style={{ width: "100%", padding: 15, background: G.gold, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold" }}>
              {subscription ? "Renouveler l'abonnement" : "S'abonner maintenant"}
            </button>

            <div style={{ marginTop: 24, padding: 16, background: G.surface, borderRadius: 8, border: "1px solid " + G.border }}>
              <div style={{ fontSize: 13, color: G.text, fontWeight: "bold", marginBottom: 12 }}>✅ Ce que comprend l'abonnement :</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 8 }}>📚 {subSettings.books_per_month} livres de ton choix chaque mois</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 8 }}>📱 Lecture sur tous tes appareils</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 8 }}>🔄 Accès immédiat après paiement</div>
              <div style={{ fontSize: 13, color: G.textDim }}>💳 Tu peux aussi acheter des livres hors quota</div>
            </div>
          </div>
        )}

        {/* CONTACT */}
        {page === "contact" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>Contact</div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>EMAIL</div>
              <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.text, fontSize: 15, textDecoration: "none" }}>carrybooks.com@gmail.com</a>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>WHATSAPP</div>
              <a href="https://chat.whatsapp.com/CarryBooks" target="_blank" rel="noreferrer" style={{ color: G.gold, fontSize: 14 }}>Rejoindre le groupe WhatsApp</a>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>SUPPORT</div>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                Pour toute question ou problème, écrivez-nous à <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.gold }}>carrybooks.com@gmail.com</a>. Nous répondons sous 24h.
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        {page === "faq" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>FAQ</div>
            {[
              { q: "Comment acheter un livre ?", r: "Clique sur le livre de ton choix, puis sur le bouton Acheter. Paye avec MTN MoMo ou Orange Money. Le livre est disponible immédiatement après paiement." },
              { q: "Qu'est-ce que l'abonnement ?", r: "L'abonnement mensuel te donne accès à un certain nombre de livres par mois pour un prix fixe. Tu peux aussi acheter des livres en dehors de ton quota." },
              { q: "Puis-je lire hors connexion ?", r: "Oui ! Après avoir acheté un livre, clique sur 'Télécharger hors connexion' sur la page du livre pour le sauvegarder sur ton appareil." },
              { q: "Mes achats sont-ils sauvegardés ?", r: "Oui, en te connectant avec Google, tous tes achats sont synchronisés et accessibles depuis n'importe quel appareil." },
              { q: "Comment contacter le support ?", r: "Écris-nous à carrybooks.com@gmail.com. Nous répondons sous 24h." },
            ].map((item, i) => (
              <div key={i} style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: "bold", color: G.text, marginBottom: 8 }}>❓ {item.q}</div>
                <p style={{ color: G.textDim, fontSize: 13, lineHeight: 1.7, margin: 0 }}>{item.r}</p>
              </div>
            ))}
          </div>
        )}

        {/* À PROPOS */}
        {page === "about" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>À propos de nous</div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 60, borderRadius: 8, marginBottom: 12 }} />
              <p style={{ color: G.gold, fontSize: 13, fontStyle: "italic", letterSpacing: 1 }}>Lis. Apprends. Évolue.</p>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.9, margin: 0 }}>
                CarryBooks est la première librairie numérique africaine pensée pour les lecteurs camerounais et africains. Notre mission est de rendre la lecture accessible à tous, partout en Afrique, depuis son téléphone.
              </p>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>NOTRE VISION</div>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.9, margin: 0 }}>
                Faire de l'Afrique un continent de lecteurs numériques, en proposant des œuvres africaines et internationales accessibles via Mobile Money.
              </p>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>CARRYBOOKS EN CHIFFRES</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 8 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: G.gold }}>{books.length}+</div>
                  <div style={{ fontSize: 11, color: G.textFaint }}>Livres disponibles</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: G.gold }}>🌍</div>
                  <div style={{ fontSize: 11, color: G.textFaint }}>Afrique & Monde</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        {page !== "reader" && (
          <div style={{ background: G.navSurface, borderTop: "1px solid " + G.navBorder, padding: "28px 16px 40px" }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 40, borderRadius: 6 }} />
            </div>
            {/* Liens */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 24px", marginBottom: 20 }}>
              <button onClick={() => setPage("faq")} style={{ background: "none", border: "none", color: G.textDim, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>FAQ</button>
              <button onClick={() => setPage("about")} style={{ background: "none", border: "none", color: G.textDim, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>À propos de nous</button>
              <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.textDim, fontSize: 13, textDecoration: "underline" }}>Nous contacter</a>
            </div>
            {/* Réseaux sociaux */}
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 20 }}>
              <a href="https://www.facebook.com/CarryBooks" target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>📘</span>
                <span style={{ fontSize: 10, color: G.textFaint }}>Facebook</span>
              </a>
              <a href="https://chat.whatsapp.com/CarryBooks" target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>💬</span>
                <span style={{ fontSize: 10, color: G.textFaint }}>WhatsApp</span>
              </a>
              <a href="https://www.tiktok.com/@CarryBooks" target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>🎵</span>
                <span style={{ fontSize: 10, color: G.textFaint }}>TikTok</span>
              </a>
            </div>
            <div style={{ color: G.textFaint, fontSize: 11, textAlign: "center" }}>© 2026 CarryBooks. Tous droits réservés.</div>
          </div>
        )}
      {/* SUBSCRIPTION PAYMENT MODAL */}
      {showSubModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid #e0e0e0" }}>
            {subPaymentStep === 1 && (
              <>
                <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
                <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16 }}>Abonnement {subPlan}</h3>
                <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>{subPlan === "mensuel" ? subSettings.monthly_price?.toLocaleString() : subSettings.annual_price?.toLocaleString()} FCFA / {subPlan === "mensuel" ? "mois" : "an"}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {[{ id: "orange", label: "Orange Money", logo: "https://logo.clearbit.com/orange.com", color: "#ff6600" }, { id: "mtn", label: "MTN MoMo", logo: "https://logo.clearbit.com/mtn.com", color: "#ffc000" }].map(m => (
                    <div key={m.id} onClick={() => setSubPaymentMethod(m.id)}
                      style={{ padding: "12px 16px", border: "2px solid " + (subPaymentMethod === m.id ? m.color : "#e0e0e0"), borderRadius: 8, cursor: "pointer", background: subPaymentMethod === m.id ? m.color + "22" : "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <img src={m.logo} alt={m.label} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} />
                      <span style={{ color: "#1a1a1a", fontSize: 15, fontWeight: subPaymentMethod === m.id ? "bold" : "normal" }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                {subPaymentMethod && (
                  <input value={subPhone} onChange={e => setSubPhone(e.target.value)}
                    placeholder="Numéro (ex: 237699000000)"
                    style={{ width: "100%", padding: "12px 14px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, color: "#1a1a1a", fontSize: 14, marginBottom: 16 }} />
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowSubModal(false)} style={{ flex: 1, padding: 13, background: "none", border: "1px solid #ccc", borderRadius: 6, color: "#666", cursor: "pointer", fontSize: 13 }}>Annuler</button>
                  <button onClick={handleSubscribe} disabled={!subPaymentMethod || !subPhone}
                    style={{ flex: 2, padding: 13, background: subPaymentMethod && subPhone ? G.gold : "#ccc", border: "none", borderRadius: 6, color: "#fff", fontWeight: "bold", cursor: subPaymentMethod && subPhone ? "pointer" : "not-allowed", fontSize: 13 }}>
                    Payer
                  </button>
                </div>
              </>
            )}
            {subPaymentStep === 2 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                <p style={{ color: "#888" }}>Traitement en cours...</p>
              </div>
            )}
            {subPaymentStep === 3 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h3 style={{ color: G.gold, marginBottom: 8 }}>Abonnement activé !</h3>
                <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Profite de tes {subSettings.books_per_month} livres ce mois 🎉</p>
                <button onClick={() => { setShowSubModal(false); setPage("home"); }}
                  style={{ padding: "13px 32px", background: G.gold, border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                  📚 Explorer les livres
                </button>
              </div>
            )}
          </div>
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
                  {[{ id: "orange", label: "Orange Money", logo: "https://logo.clearbit.com/orange.com", color: "#ff6600" }, { id: "mtn", label: "MTN MoMo", logo: "https://logo.clearbit.com/mtn.com", color: "#ffc000" }].map(m => (
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






