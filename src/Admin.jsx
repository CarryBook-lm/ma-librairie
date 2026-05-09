import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CATEGORIES = {
  "Romans": ["Romance", "Drame", "Suspense", "Thriller", "Poesie", "Serie"],
  "Lifestyle": ["Amour et relation", "Santé & bien-être", "Beauté & Astuces", "Guide pratique"],
  "Développement personnel": ["Confiance en soi", "Motivation", "Finance personnelle", "Spiritualité", "Relations", "Productivité"],
  "Jeunesse": ["Amour et relation", "Contes", "Humour", "Histoires d'amour", "Education", "Guide pratique"],
  "Formation": [],
  "Business": ["Marketing & ventes", "Management & leadership", "E-commerce & stratégie digitale"],
  "Biographies": ["Essais & chroniques", "Histoire & politique", "Sciences & nature"],
  "Lyrics": ["Focus", "À la une"],
  "Livre Audio": ["Roman", "Conte", "Développement personnel", "Business", "Enfants", "Adultes"],
  "Livres Gratuits": [],
  "Podcast": ["Amour", "Argent", "Confiance en soi", "Spiritualité", "Motivation"],
};

const emptyForm = {
  title: "", author: "", price: "", original_price: "", cover: "", category: "Romans", subcategory: "", extract_pages: 5,
  summary: "", content: "", pdf_url: "", status: "actif", audio_url: "",
  can_read: true, can_download: false, featured: false, exclude_from_subscription: false
};

export default function Admin() {
  // ===== AUTH ADMIN : États (les hooks vont plus bas, avant les early returns) =====
  const [adminAuth, setAdminAuth] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Lecteurs en direct (présence + activité)
  const [onlineCount, setOnlineCount] = useState(0);
  const [recentReads, setRecentReads] = useState(0);
  const [topBooks, setTopBooks] = useState([]);
  const [view, setView] = useState("dashboard");
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [quizPayments, setQuizPayments] = useState([]);
  const [carrycarePayments, setCarrycarePayments] = useState([]);
  const [bookViews, setBookViews] = useState([]);
  // Paramètres parrainage
  const [referralSettings, setReferralSettings] = useState({
    reward_per_referral: 500,
    referred_discount_pct: 20,
    min_withdrawal: 5000,
    fraud_delay_days: 30,
    active: true
  });
  const [refSettingsForm, setRefSettingsForm] = useState({
    reward_per_referral: "500",
    referred_discount_pct: "20",
    min_withdrawal: "5000",
    fraud_delay_days: "30",
    active: true
  });
  const [refSettingsSaving, setRefSettingsSaving] = useState(false);
  const [refSettingsMessage, setRefSettingsMessage] = useState({ type: "", text: "" });
  const [referralCodes, setReferralCodes] = useState([]);
  const [allReferrals, setAllReferrals] = useState([]);
  const [referralWithdrawals, setReferralWithdrawals] = useState([]);
  const [subSettings, setSubSettings] = useState({ monthly_price: 2000, annual_price: 20000, books_per_month: 3 });
  const [quizPrice, setQuizPrice] = useState(500);
  const [quizPriceSaving, setQuizPriceSaving] = useState(false);
  const [carrycarePrice, setCarrycarePrice] = useState(500);
  const [carrycarePriceSaving, setCarrycarePriceSaving] = useState(false);
  // États pour le changement de mot de passe admin
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMessage, setPwdMessage] = useState({ type: "", text: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  // États pour la modération des avis
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsFilter, setReviewsFilter] = useState("pending"); // pending | approved | all
  const [promoCodes, setPromoCodes] = useState([]);
  const [newPromo, setNewPromo] = useState({ code: "", discount_pct: 20, expires_at: "", uses_max: "" });
  const [stats, setStats] = useState({ totalRevenue: 0, totalPurchases: 0, totalUsers: 0, topBooks: [] });
  const [subSettingsSaving, setSubSettingsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("info");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef(null);

  // ===== AUTH ADMIN : useEffect (DOIT être AVANT tout early return) =====
  useEffect(() => {
    checkAdminAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminAccess();
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { fetchBooks(); fetchUsers(); fetchSubscribers(); fetchSubSettings(); fetchPromoCodes(); fetchStats(); fetchQuizPayments(); fetchCarrycarePayments(); fetchBookViews(); fetchReferralData(); fetchReferralSettings(); fetchPresence(); }, []);

  // Auto-refresh des données de présence toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPresence();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ===== AUTH ADMIN : Fonctions + early returns (APRÈS tous les hooks) =====
  async function checkAdminAccess() {
    setAuthChecking(true);
    setAuthError("");
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      setCurrentUser(null);
      setAdminAuth(false);
      setAuthError("Vous devez être connecté à CarryBooks pour accéder à l'admin");
      setAuthChecking(false);
      return;
    }
    setCurrentUser(user);
    const { data: isAdminResult, error: rpcErr } = await supabase.rpc('is_admin');
    if (rpcErr) {
      console.error("Erreur vérification admin:", rpcErr);
      setAdminAuth(false);
      setAuthError("Erreur lors de la vérification des droits");
      setAuthChecking(false);
      return;
    }
    if (!isAdminResult) {
      setAdminAuth(false);
      setAuthError("Accès refusé. Ce compte n'a pas les droits administrateur.");
      setAuthChecking(false);
      return;
    }
    setAdminAuth(true);
    setAuthChecking(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAdminAuth(false);
    setCurrentUser(null);
    window.location.href = "/";
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: 32, width: "100%", maxWidth: 320, textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #2a2a2a", borderTop: "3px solid #c9a84c", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.9s linear infinite" }} />
          <p style={{ color: "#888", fontSize: 13 }}>Verification des droits...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (!adminAuth) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: 32, width: "100%", maxWidth: 360, textAlign: "center" }}>
          <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 48, marginBottom: 20 }} />
          <h2 style={{ color: "#c9a84c", fontSize: 18, marginBottom: 8 }}>Administration</h2>
          <p style={{ color: "#f44336", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{authError}</p>
          {currentUser && (
            <p style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>
              Connecte en tant que :<br /><span style={{ color: "#c9a84c" }}>{currentUser.email}</span>
            </p>
          )}
          {currentUser ? (
            <button onClick={handleSignOut}
              style={{ width: "100%", padding: 13, background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 14, marginBottom: 8 }}>
              Se deconnecter
            </button>
          ) : (
            <a href="/" style={{ display: "block", width: "100%", padding: 13, background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 14, textDecoration: "none", boxSizing: "border-box" }}>
              Aller a la connexion
            </a>
          )}
        </div>
      </div>
    );
  }

  async function fetchReferralData() {
    try {
      const { data: codes } = await supabase.from("referral_codes").select("*").order("total_earned", { ascending: false });
      if (codes) setReferralCodes(codes);
      const { data: refs } = await supabase.from("referrals").select("*").order("created_at", { ascending: false });
      if (refs) setAllReferrals(refs);
      const { data: wds } = await supabase.from("referral_withdrawals").select("*").order("created_at", { ascending: false });
      if (wds) setReferralWithdrawals(wds);
    } catch (e) { console.error("Erreur fetch referrals:", e); }
  }

  async function fetchQuizPayments() {
    try {
      const { data } = await supabase.from("quiz_payments").select("*").order("created_at", { ascending: false });
      if (data) setQuizPayments(data);
    } catch (e) { console.error("Erreur fetch quiz_payments:", e); }
  }

  async function fetchCarrycarePayments() {
    try {
      const { data } = await supabase.from("carrycare_results").select("amount, created_at, quiz_type, user_id").order("created_at", { ascending: false });
      if (data) setCarrycarePayments(data);
    } catch (e) { console.error("Erreur fetch carrycare:", e); }
  }

  async function fetchBookViews() {
    try {
      const { data } = await supabase.from("book_views").select("book_id, user_id, created_at").order("created_at", { ascending: false });
      if (data) setBookViews(data);
    } catch (e) { console.error("Erreur fetch book_views:", e); }
  }

  async function fetchPresence() {
    try {
      // 1) Lecteurs en ligne (ping < 90 secondes = considéré en ligne)
      const cutoff = new Date(Date.now() - 90 * 1000).toISOString();
      const { data: presenceData, error: presErr } = await supabase
        .from("presence")
        .select("user_id, current_book_id, last_seen, page")
        .gte("last_seen", cutoff);

      if (!presErr && presenceData) {
        setOnlineCount(presenceData.length);

        // Calcul du Top livres en cours de lecture (uniquement ceux qui sont sur un livre)
        const bookCounts = {};
        presenceData.forEach(p => {
          if (p.current_book_id) {
            bookCounts[p.current_book_id] = (bookCounts[p.current_book_id] || 0) + 1;
          }
        });
        // Trier et prendre top 5
        const sortedBooks = Object.entries(bookCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Récupérer les titres des livres
        if (sortedBooks.length > 0) {
          const bookIds = sortedBooks.map(([id]) => id);
          const { data: booksData } = await supabase
            .from("books")
            .select("id, title, cover")
            .in("id", bookIds);

          const topList = sortedBooks.map(([id, count]) => {
            const bk = (booksData || []).find(b => String(b.id) === String(id));
            return {
              id,
              count,
              title: bk?.title || "Livre inconnu",
              cover: bk?.cover
            };
          });
          setTopBooks(topList);
        } else {
          setTopBooks([]);
        }
      }

      // 2) Lectures dans les 10 dernières minutes (depuis book_views)
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recentData, error: recentErr } = await supabase
        .from("book_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", tenMinAgo);

      if (!recentErr) {
        // Quand on utilise head:true, le count est dans la réponse
        // Le client renvoie { count } directement
        const { count } = await supabase
          .from("book_views")
          .select("id", { count: "exact", head: true })
          .gte("created_at", tenMinAgo);
        setRecentReads(count || 0);
      }
    } catch (e) {
      console.error("Erreur fetch presence:", e);
    }
  }

  async function fetchReferralSettings() {
    try {
      const { data } = await supabase.from("referral_settings").select("*").order("id", { ascending: true }).limit(1);
      if (data && data.length > 0) {
        setReferralSettings(data[0]);
        setRefSettingsForm({
          reward_per_referral: String(data[0].reward_per_referral || 500),
          referred_discount_pct: String(data[0].referred_discount_pct || 20),
          min_withdrawal: String(data[0].min_withdrawal || 5000),
          fraud_delay_days: String(data[0].fraud_delay_days || 30),
          active: data[0].active !== false
        });
      }
    } catch (e) { console.error("Erreur fetch referral_settings:", e); }
  }

  async function saveReferralSettings() {
    if (!referralSettings || !referralSettings.id) {
      setRefSettingsMessage({ type: "error", text: "Erreur : paramètres non chargés" });
      return;
    }
    const reward = parseInt(refSettingsForm.reward_per_referral);
    const discount = parseInt(refSettingsForm.referred_discount_pct);
    const minWd = parseInt(refSettingsForm.min_withdrawal);
    const delay = parseInt(refSettingsForm.fraud_delay_days);
    if (!reward || reward < 0) { setRefSettingsMessage({ type: "error", text: "Récompense invalide" }); return; }
    if (!discount || discount < 0 || discount > 100) { setRefSettingsMessage({ type: "error", text: "Réduction entre 0 et 100%" }); return; }
    if (!minWd || minWd < 100) { setRefSettingsMessage({ type: "error", text: "Minimum retrait au moins 100 F" }); return; }
    if (delay < 0) { setRefSettingsMessage({ type: "error", text: "Délai ne peut pas être négatif" }); return; }
    setRefSettingsSaving(true);
    const { error } = await supabase.from("referral_settings").update({
      reward_per_referral: reward,
      referred_discount_pct: discount,
      min_withdrawal: minWd,
      fraud_delay_days: delay,
      active: refSettingsForm.active,
      updated_at: new Date().toISOString()
    }).eq("id", referralSettings.id);
    setRefSettingsSaving(false);
    if (error) {
      setRefSettingsMessage({ type: "error", text: "Erreur : " + error.message });
    } else {
      setRefSettingsMessage({ type: "success", text: "✅ Paramètres enregistrés !" });
      fetchReferralSettings();
      setTimeout(() => setRefSettingsMessage({ type: "", text: "" }), 3000);
    }
  }

  async function fetchSubscribers() {
    const { data } = await supabase.from("subscriptions").select("*").order("started_at", { ascending: false });
    if (data) setSubscribers(data);
  }

  async function fetchPromoCodes() {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    if (data) setPromoCodes(data);
  }

  async function loadPendingReviews(filter = "pending") {
    setReviewsLoading(true);
    let query = supabase
      .from("book_reviews")
      .select("id, book_id, user_id, rating, comment, approved, created_at")
      .not("comment", "is", null)
      .order("created_at", { ascending: false });

    if (filter === "pending") {
      query = query.eq("approved", false);
    } else if (filter === "approved") {
      query = query.eq("approved", true);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      // Récupérer les titres des livres
      const bookIds = [...new Set(data.map(r => r.book_id))];
      const { data: booksData } = await supabase.from("books").select("id, title").in("id", bookIds);
      const titlesMap = {};
      if (booksData) booksData.forEach(b => { titlesMap[b.id] = b.title; });
      const enriched = data
        .filter(r => r.comment && r.comment.trim().length > 0)
        .map(r => ({ ...r, book_title: titlesMap[r.book_id] }));
      setPendingReviews(enriched);
    } else {
      setPendingReviews([]);
    }
    setReviewsLoading(false);
  }

  async function fetchStats() {
    const { data: purchases } = await supabase.from("purchases").select("amount, book_id, created_at");
    const { data: users } = await supabase.from("purchases").select("user_id");
    if (purchases) {
      const total = purchases.reduce((s, p) => s + (p.amount || 0), 0);
      const uniqueUsers = users ? new Set(users.map(u => u.user_id)).size : 0;
      const bookCount = {};
      purchases.forEach(p => { bookCount[p.book_id] = (bookCount[p.book_id] || 0) + 1; });
      const topBooks = Object.entries(bookCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id, count]) => ({ id: parseInt(id), count }));
      setStats({ totalRevenue: total, totalPurchases: purchases.length, totalUsers: uniqueUsers, topBooks });
    }
  }

  async function createPromo() {
    if (!newPromo.code.trim()) return alert("Entre un code promo");
    const code = newPromo.code.trim().toUpperCase();
    const { error } = await supabase.from("promo_codes").insert([{
      code, discount_pct: newPromo.discount_pct, active: true,
      expires_at: newPromo.expires_at || null,
      uses_max: newPromo.uses_max ? parseInt(newPromo.uses_max) : null,
      uses_count: 0
    }]);
    if (error) { alert("Erreur: " + error.message); return; }
    setNewPromo({ code: "", discount_pct: 20, expires_at: "", uses_max: "" });
    fetchPromoCodes();
  }

  async function togglePromo(id, active) {
    await supabase.from("promo_codes").update({ active: !active }).eq("id", id);
    fetchPromoCodes();
  }

  async function deletePromo(id) {
    if (!confirm("Supprimer ce code ?")) return;
    await supabase.from("promo_codes").delete().eq("id", id);
    fetchPromoCodes();
  }

  async function fetchSubSettings() {
    const { data } = await supabase.from("sub_settings").select("*").limit(1);
    if (data && data.length > 0) {
      setSubSettings(data[0]);
      if (data[0].quiz_price) setQuizPrice(data[0].quiz_price);
      if (data[0].carrycare_price) setCarrycarePrice(data[0].carrycare_price);
    }
  }


  async function saveQuizPrice() {
    setQuizPriceSaving(true);
    const { data: existing } = await supabase.from("sub_settings").select("id").limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("sub_settings").update({ quiz_price: quizPrice }).eq("id", existing[0].id);
    } else {
      await supabase.from("sub_settings").insert([{ quiz_price: quizPrice }]);
    }
    setQuizPriceSaving(false);
    alert("Prix quiz sauvegardé !");
  }

  async function saveCarrycarePrice() {
    setCarrycarePriceSaving(true);
    const { data: existing } = await supabase.from("sub_settings").select("id").limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("sub_settings").update({ carrycare_price: carrycarePrice }).eq("id", existing[0].id);
    } else {
      await supabase.from("sub_settings").insert([{ carrycare_price: carrycarePrice }]);
    }
    setCarrycarePriceSaving(false);
    alert("Prix CarryCare sauvegardé !");
  }

  async function saveSubSettings() {
    setSubSettingsSaving(true);
    const { data: existing } = await supabase.from("sub_settings").select("id").limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("sub_settings").update({ ...subSettings, quiz_price: quizPrice }).eq("id", existing[0].id);
    } else {
      await supabase.from("sub_settings").insert([{ ...subSettings, quiz_price: quizPrice }]);
    }
    setSubSettingsSaving(false);
    alert("Paramètres sauvegardés !");
  }

  async function fetchBooks() {
    const { data } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (data) setBooks(data);
  }

  async function fetchUsers() {
    const { data, error } = await supabase
      .from("purchases")
      .select("user_id, book_id, created_at, amount, type")
      .order("created_at", { ascending: false });
    if (error) { console.error("Purchases error:", error); }
    if (data) setUsers(data);
    else setUsers([]);
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const apiKey = import.meta.env.VITE_IMGBB_KEY;
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setForm(f => ({ ...f, cover: data.data.url }));
      } else {
        setUploadError("Échec de l'upload. Vérifiez votre clé imgbb.");
      }
    } catch {
      setUploadError("Erreur réseau lors de l'upload.");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!form.title || !form.author || form.price === "") return;
    setSaving(true);
    const payload = {
      ...form,
      price: parseInt(form.price) || 0,
      original_price: form.original_price && form.original_price !== "" ? parseInt(form.original_price) : null
    };
    if (editingBook) {
      await supabase.from("books").update(payload).eq("id", editingBook.id);
    } else {
      await supabase.from("books").insert([payload]);
    }
    setSaving(false);
    setShowForm(false);
    setEditingBook(null);
    setForm(emptyForm);
    setActiveTab("info");
    fetchBooks();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ce livre ?")) return;
    await supabase.from("books").delete().eq("id", id);
    fetchBooks();
  }

  async function toggleStatus(book) {
    const newStatus = book.status === "actif" ? "inactif" : "actif";
    await supabase.from("books").update({ status: newStatus }).eq("id", book.id);
    fetchBooks();
  }

  function openEdit(book) {
    setEditingBook(book);
    setForm({
      ...book,
      price: String(book.price),
      original_price: book.original_price ? String(book.original_price) : ""
    });
    setShowForm(true);
    setActiveTab("info");
  }

  function openAdd() {
    setEditingBook(null);
    setForm(emptyForm);
    setShowForm(true);
    setActiveTab("info");
  }

  // Calcul des stats par type d'achat
  // Filtrage des purchases : seulement celles avec un livre existant
  const validPurchases = users.filter(u => books.find(b => b.id === u.book_id));
  // Ventes réelles : type "sale" OU pas de type défini ET prix > 0 (rétrocompatibilité)
  const realSales = validPurchases.filter(u => {
    if (u.type === "sale") return true;
    if (u.type === "subscription" || u.type === "free") return false;
    // Anciennes données sans type : si le livre est gratuit -> pas une vente
    const book = books.find(b => b.id === u.book_id);
    return book && book.price > 0;
  });
  // Déblocages par abonnement
  const subscriptionUnlocks = validPurchases.filter(u => u.type === "subscription");
  // Livres gratuits débloqués
  const freeUnlocks = validPurchases.filter(u => {
    if (u.type === "free") return true;
    if (u.type === "sale" || u.type === "subscription") return false;
    const book = books.find(b => b.id === u.book_id);
    return book && book.price === 0;
  });

  // Revenus = uniquement les ventes RÉELLES
  const totalRevenue = realSales.reduce((s, purchase) => {
    if (purchase.amount !== null && purchase.amount !== undefined) {
      return s + purchase.amount;
    }
    // Fallback : utiliser le prix actuel du livre (pour anciennes ventes)
    const book = books.find(b => b.id === purchase.book_id);
    return s + (book ? (book.price || 0) : 0);
  }, 0);

  // CA du jour : on filtre les ventes d'aujourd'hui uniquement
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Début de la journée
  const todaySales = realSales.filter(p => {
    if (!p.created_at) return false;
    const saleDate = new Date(p.created_at);
    return saleDate >= today;
  });
  const todayRevenue = todaySales.reduce((s, purchase) => {
    if (purchase.amount !== null && purchase.amount !== undefined) {
      return s + purchase.amount;
    }
    const book = books.find(b => b.id === purchase.book_id);
    return s + (book ? (book.price || 0) : 0);
  }, 0);

  // ========== REVENUS PAR SOURCE ==========
  // 📚 Revenus livres (ventes réelles uniquement)
  const revenueBooks = totalRevenue;

  // ⭐ Revenus abonnements
  const revenueSubscriptions = subscribers.reduce((s, sub) => s + (sub.price || 0), 0);

  // 🎯 Revenus Carry'Quiz
  const revenueQuiz = quizPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // 💜 Revenus CarryCare (uniquement amounts > 0)
  const revenueCarryCare = carrycarePayments.reduce((s, p) => s + (p.amount || 0), 0);

  // 💰 TOTAL CA
  const grandTotalRevenue = revenueBooks + revenueSubscriptions + revenueQuiz + revenueCarryCare;

  // 📅 CA AUJOURD'HUI (toutes sources)
  const todayBooksRevenue = todayRevenue;
  const todayBooksCount = todaySales.length;
  const todaySubsRevenue = subscribers.filter(s => {
    if (!s.started_at) return false;
    return new Date(s.started_at) >= today;
  }).reduce((s, sub) => s + (sub.price || 0), 0);
  const todaySubsCount = subscribers.filter(s => {
    if (!s.started_at) return false;
    return new Date(s.started_at) >= today;
  }).length;
  const todayQuizRevenue = quizPayments.filter(p => {
    if (!p.created_at) return false;
    return new Date(p.created_at) >= today;
  }).reduce((s, p) => s + (p.amount || 0), 0);
  const todayQuizCount = quizPayments.filter(p => {
    if (!p.created_at) return false;
    return new Date(p.created_at) >= today;
  }).length;
  const todayCarryCareRevenue = carrycarePayments.filter(p => {
    if (!p.created_at) return false;
    return new Date(p.created_at) >= today;
  }).reduce((s, p) => s + (p.amount || 0), 0);
  const todayCarryCareCount = carrycarePayments.filter(p => {
    if (!p.created_at) return false;
    return new Date(p.created_at) >= today && (p.amount || 0) > 0;
  }).length;
  const grandTodayRevenue = todayBooksRevenue + todaySubsRevenue + todayQuizRevenue + todayCarryCareRevenue;

  // 📖 Total lectures
  const totalBookViews = bookViews.length;

  const activeBooks = books.filter(b => b.status === "actif").length;
  const totalSales = realSales.length;
  const totalSubscriptionUnlocks = subscriptionUnlocks.length;
  const totalFreeUnlocks = freeUnlocks.length;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#e8e0d0", fontFamily: "Georgia, serif" }}>

      {/* TOP NAV MOBILE */}
      <div style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a", padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#c9a84c", letterSpacing: 2 }}>CARRYBOOKS</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => window.open("/", "_blank")}
            style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
            🌐 Site
          </button>
          <button onClick={() => { handleSignOut(); }}
            style={{ background: "none", border: "1px solid #f44336", borderRadius: 6, color: "#f44336", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
            🔒 Déco
          </button>
          <button onClick={() => setShowMenu(m => !m)}
            style={{ background: "none", border: "none", color: "#c9a84c", fontSize: 22, cursor: "pointer", padding: 4 }}>
            {showMenu ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* MENU DROPDOWN MOBILE */}
      {showMenu && (
        <div style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a", zIndex: 40 }}>
          {[
            { id: "dashboard", label: "Tableau de bord", icon: "📊" },
            { id: "books", label: "Livres", icon: "📚" },
            { id: "users", label: "Utilisateurs", icon: "👥" },
            { id: "subscription", label: "Abonnements", icon: "⭐" },
            { id: "promos", label: "Codes Promo", icon: "🎟️" },
            { id: "referrals", label: "Parrainages", icon: "🎁" },
            { id: "referral_settings", label: "Paramètres parrainage", icon: "⚙️" },
            { id: "reviews", label: "Modération avis", icon: "💬" },
            { id: "stats", label: "Statistiques", icon: "📈" },
            { id: "security", label: "Sécurité", icon: "🔐" },
          ].map(item => (
            <div key={item.id} onClick={() => { 
              setView(item.id); 
              setShowMenu(false);
              if (item.id === "reviews") loadPendingReviews(reviewsFilter);
            }}
              style={{ padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                background: view === item.id ? "#2a2a2a" : "transparent",
                color: view === item.id ? "#c9a84c" : "#aaa",
                borderLeft: "3px solid " + (view === item.id ? "#c9a84c" : "transparent"),
                borderBottom: "1px solid #2a2a2a" }}>
              <span>{item.icon}</span><span style={{ fontSize: 14 }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ padding: "20px 16px 80px" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <h1 style={{ fontSize: 20, color: "#c9a84c", marginBottom: 20 }}>Tableau de bord</h1>

            {/* SECTION CA TOTAL */}
            <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #1f1810 100%)", border: "1.5px solid #c9a84c", borderRadius: 10, padding: 20, marginBottom: 12, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#c9a84c", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>💰 Chiffre d'affaires total</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#c9a84c", marginBottom: 4 }}>{grandTotalRevenue.toLocaleString()} F</div>
              <div style={{ fontSize: 11, color: "#888" }}>Toutes sources confondues</div>
            </div>

            {/* SECTION CA DU JOUR */}
            <div style={{ background: "linear-gradient(135deg, #0d2a1a 0%, #103a25 100%)", border: "1.5px solid #4caf50", borderRadius: 10, padding: 18, marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#4caf50", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>📅 Aujourd'hui</div>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#4caf50", marginBottom: 4 }}>{grandTodayRevenue.toLocaleString()} F</div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {grandTodayRevenue === 0 ? "Pas de revenus aujourd'hui" : "Revenus du jour"}
              </div>
            </div>

            {/* SECTION DÉTAIL PAR SOURCE */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>Détail par source</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* 📚 LIVRES */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📚</span>
                    <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>Livres</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#c9a84c" }}>{revenueBooks.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{totalSales} vente{totalSales > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{todayBooksRevenue.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{todayBooksCount} vente{todayBooksCount > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>

                {/* ⭐ ABONNEMENTS */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>⭐</span>
                    <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>Abonnements</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#c9a84c" }}>{revenueSubscriptions.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{subscribers.length} abo{subscribers.length > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{todaySubsRevenue.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{todaySubsCount} abo{todaySubsCount > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>

                {/* 🎯 CARRY'QUIZ */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🎯</span>
                    <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>Carry'Quiz</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#c9a84c" }}>{revenueQuiz.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{quizPayments.length} achat{quizPayments.length > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{todayQuizRevenue.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{todayQuizCount} achat{todayQuizCount > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>

                {/* 💜 CARRYCARE */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💜</span>
                    <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>CarryCare</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#c9a84c" }}>{revenueCarryCare.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{carrycarePayments.filter(p => (p.amount || 0) > 0).length} achat{carrycarePayments.filter(p => (p.amount || 0) > 0).length > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{todayCarryCareRevenue.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{todayCarryCareCount} achat{todayCarryCareCount > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LECTEURS EN DIRECT */}
            <div style={{ background: "linear-gradient(135deg, #0d2818 0%, #1a3a1a 100%)", border: "1px solid #2a4a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, background: "#4caf50", borderRadius: "50%", animation: "pulse 2s ease-in-out infinite" }} />
                <h3 style={{ color: "#4caf50", fontSize: 13, margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>Lecteurs en direct</h3>
              </div>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#4caf50" }}>{onlineCount}</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2, letterSpacing: 1, textTransform: "uppercase" }}>En ligne maintenant</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#9d7fff" }}>{recentReads}</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2, letterSpacing: 1, textTransform: "uppercase" }}>Lectures (10 min)</div>
                </div>
              </div>

              {topBooks.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Livres en cours de lecture</div>
                  {topBooks.map((book, idx) => (
                    <div key={book.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: idx < topBooks.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      {book.cover
                        ? <img src={book.cover} alt="" style={{ width: 28, height: 38, objectFit: "cover", borderRadius: 3 }} />
                        : <div style={{ width: 28, height: 38, background: "#2a2a2a", borderRadius: 3 }} />}
                      <div style={{ flex: 1, fontSize: 12, color: "#e8e0d0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.title}</div>
                      <div style={{ fontSize: 11, color: "#4caf50", fontWeight: "bold", padding: "3px 8px", background: "rgba(76,175,80,0.15)", borderRadius: 10 }}>{book.count} 👁️</div>
                    </div>
                  ))}
                </div>
              )}
              {topBooks.length === 0 && onlineCount > 0 && (
                <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 8 }}>Personne ne lit en ce moment, mais {onlineCount} {onlineCount > 1 ? "personnes sont" : "personne est"} sur le site</div>
              )}
              {onlineCount === 0 && (
                <div style={{ fontSize: 11, color: "#666", textAlign: "center", padding: 8 }}>Aucun lecteur en ligne actuellement</div>
              )}
            </div>

            {/* STATS DÉTAILLÉES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📖</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#9d7fff" }}>{totalBookViews}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Lectures totales</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>🎁</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#4caf50" }}>{totalFreeUnlocks}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Livres gratuits</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📚</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#c9a84c" }}>{activeBooks}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Livres actifs</div>
              </div>
            </div>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
              <h3 style={{ color: "#c9a84c", marginBottom: 14, fontSize: 14 }}>Derniers livres ajoutés</h3>
              {books.slice(0, 5).map(book => (
                <div key={book.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #2a2a2a" }}>
                  {book.cover
                    ? <img src={book.cover} alt="" style={{ width: 36, height: 50, objectFit: "cover" }} />
                    : <div style={{ width: 36, height: 50, background: "#2a2a2a" }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#e8e0d0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.title}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{book.author}</div>
                  </div>
                  <div style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: book.status === "actif" ? "#1a3a1a" : "#3a1a1a", color: book.status === "actif" ? "#4caf50" : "#f44336", flexShrink: 0 }}>{book.status}</div>
                </div>
              ))}
              {books.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: 20 }}>Aucun livre</div>}
            </div>
          </div>
        )}

        {/* BOOKS */}
        {view === "books" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, color: "#c9a84c" }}>Livres ({books.length})</h1>
              <button onClick={openAdd}
                style={{ background: "#c9a84c", color: "#000", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>
                + AJOUTER
              </button>
            </div>

            {/* Liste cards sur mobile */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {books.map(book => (
                <div key={book.id} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {book.cover
                    ? <img src={book.cover} alt="" style={{ width: 50, height: 70, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 50, height: 70, background: "#2a2a2a", flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "#e8e0d0", marginBottom: 2, fontWeight: "bold" }}>{book.title}</div>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{book.author}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#c9a84c" }}>{book.price === 0 ? "Gratuit" : `${book.price?.toLocaleString()} F`}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{book.category}{book.subcategory ? " › " + book.subcategory : ""}</span>
                      <span style={{ fontSize: 11, color: book.content ? "#4caf50" : "#888" }}>{book.content ? "✓ Contenu" : "✗ Sans contenu"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
                    <button onClick={() => toggleStatus(book)}
                      style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: book.status === "actif" ? "#1a3a1a" : "#3a1a1a", color: book.status === "actif" ? "#4caf50" : "#f44336" }}>
                      {book.status}
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(book)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✏️</button>
                      <button onClick={() => handleDelete(book.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
              {books.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                  <div>Aucun livre ajouté</div>
                </div>
              )}
            </div>
          </div>
        )}
        {view === "users" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, color: "#c9a84c" }}>Utilisateurs connectés</h1>
              <button onClick={fetchUsers} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>🔄 Actualiser</button>
            </div>
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#c9a84c" }}>{[...new Set(users.map(u => u.user_id))].length}</div>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Acheteurs</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#c9a84c" }}>{users.length}</div>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Achats total</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...new Set(users.map(u => u.user_id))].map(userId => {
                const userPurchases = users.filter(u => u.user_id === userId);
                const lastPurchase = userPurchases.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                const userRevenue = userPurchases.reduce((s, p) => {
                  const book = books.find(b => b.id === p.book_id);
                  return s + (book ? (book.price || 0) : 0);
                }, 0);
                return (
                  <div key={userId} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>ID : {userId.substring(0, 16)}...</div>
                        <div style={{ fontSize: 12, color: "#aaa" }}>Dernier achat : {new Date(lastPurchase.created_at).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ background: "#2a2a2a", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#c9a84c", marginBottom: 4 }}>
                          {userPurchases.length} livre{userPurchases.length > 1 ? "s" : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "#4caf50" }}>{userRevenue.toLocaleString()} F</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {userPurchases.map((p, i) => {
                        const book = books.find(b => b.id === p.book_id);
                        return book ? (
                          <span key={i} style={{ background: "#2a2a2a", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#aaa" }}>
                            {book.title}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              })}
              {users.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <div>Aucun achat enregistré</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABONNEMENTS */}
        {view === "subscription" && (
          <div>
            <h1 style={{ fontSize: 20, color: "#c9a84c", marginBottom: 20 }}>⭐ Abonnements</h1>

            {/* Paramètres */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#c9a84c", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Paramètres</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Prix mensuel (FCFA)</label>
                  <input type="number" value={subSettings.monthly_price} onChange={e => setSubSettings(s => ({ ...s, monthly_price: parseInt(e.target.value) || 0 }))}
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Livres par mois</label>
                  <input type="number" value={subSettings.books_per_month} onChange={e => setSubSettings(s => ({ ...s, books_per_month: parseInt(e.target.value) || 1 }))}
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14 }} />
                </div>

                {/* Quiz Price */}
                <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#c9a84c", marginBottom: 12 }}>🎯 Prix des Quiz (FCFA)</div>
                  <input type="number" value={quizPrice} onChange={e => setQuizPrice(parseInt(e.target.value) || 0)}
                    style={{ width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box", marginBottom: 10 }} />
                  <button onClick={saveQuizPrice} disabled={quizPriceSaving}
                    style={{ padding: "10px 20px", background: quizPriceSaving ? "#333" : "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer" }}>
                    {quizPriceSaving ? "Sauvegarde..." : "💾 Sauvegarder le prix quiz"}
                  </button>
                </div>

                {/* CarryCare Price */}
                <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#e91e63", marginBottom: 12 }}>🌸 Prix CarryCare (FCFA)</div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Prix unique pour les 4 quiz beauté (Faciale, Corporelle, Capillaire, Garde la Ligne)</div>
                  <input type="number" value={carrycarePrice} onChange={e => setCarrycarePrice(parseInt(e.target.value) || 0)}
                    style={{ width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box", marginBottom: 10 }} />
                  <button onClick={saveCarrycarePrice} disabled={carrycarePriceSaving}
                    style={{ padding: "10px 20px", background: carrycarePriceSaving ? "#333" : "#e91e63", border: "none", borderRadius: 6, color: "#fff", fontWeight: "bold", cursor: "pointer" }}>
                    {carrycarePriceSaving ? "Sauvegarde..." : "💾 Sauvegarder le prix CarryCare"}
                  </button>
                </div>

                <button onClick={saveSubSettings} disabled={subSettingsSaving}
                  style={{ padding: "12px 0", background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>
                  {subSettingsSaving ? "Sauvegarde..." : "💾 Sauvegarder"}
                </button>
              </div>
            </div>

            {/* Abonnés actifs */}
            <div style={{ fontSize: 13, color: "#c9a84c", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              Abonnés ({subscribers.filter(s => s.status === "actif").length} actifs)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {subscribers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
                  <div>Aucun abonnement enregistré</div>
                </div>
              ) : subscribers.map(sub => (
                <div key={sub.id} style={{ background: "#1a1a1a", border: "1px solid " + (sub.status === "actif" ? "#c9a84c44" : "#2a2a2a"), borderRadius: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>ID : {sub.user_id?.substring(0, 16)}...</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>Plan : {sub.plan} — {sub.price?.toLocaleString()} F</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>Expire : {new Date(sub.expires_at).toLocaleDateString("fr-FR")}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>Livres : {sub.books_used || 0}/{sub.books_per_month}</div>
                    </div>
                    <div style={{ background: sub.status === "actif" ? "#1a3a1a" : "#3a1a1a", color: sub.status === "actif" ? "#4caf50" : "#f44336", fontSize: 11, padding: "4px 10px", borderRadius: 12 }}>
                      {sub.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CODES PROMO */}
        {view === "promos" && (
          <div>
            <h1 style={{ fontSize: 20, color: "#c9a84c", marginBottom: 20 }}>🎟️ Codes Promo</h1>

            {/* Création nouveau code */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#c9a84c", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Créer un code</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Code (ex: BIENVENUE20)</label>
                  <input value={newPromo.code} onChange={e => setNewPromo(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="BIENVENUE20"
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Réduction (%)</label>
                  <input type="number" min="1" max="100" value={newPromo.discount_pct} onChange={e => setNewPromo(p => ({ ...p, discount_pct: parseInt(e.target.value) || 0 }))}
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Date d'expiration (optionnel)</label>
                  <input type="date" value={newPromo.expires_at} onChange={e => setNewPromo(p => ({ ...p, expires_at: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Utilisations max (optionnel)</label>
                  <input type="number" min="1" value={newPromo.uses_max} onChange={e => setNewPromo(p => ({ ...p, uses_max: e.target.value }))}
                    placeholder="Illimité si vide"
                    style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <button onClick={createPromo} style={{ padding: 12, background: "#c9a84c", color: "#000", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>
                  + Créer le code
                </button>
              </div>
            </div>

            {/* Liste codes */}
            <div style={{ fontSize: 13, color: "#c9a84c", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Codes existants ({promoCodes.length})</div>
            {promoCodes.length === 0 ? (
              <div style={{ color: "#888", textAlign: "center", padding: 30, fontSize: 13 }}>Aucun code créé pour l'instant</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {promoCodes.map(p => (
                  <div key={p.id} style={{ background: "#1a1a1a", border: "1px solid " + (p.active ? "#c9a84c" : "#2a2a2a"), borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 16, color: p.active ? "#c9a84c" : "#666", fontWeight: "bold", letterSpacing: 1 }}>{p.code}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>-{p.discount_pct}% • {p.uses_count || 0}{p.uses_max ? "/" + p.uses_max : ""} utilisations</div>
                        {p.expires_at && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Expire le {new Date(p.expires_at).toLocaleDateString("fr-FR")}</div>}
                      </div>
                      <div style={{ fontSize: 10, padding: "4px 8px", borderRadius: 4, background: p.active ? "#c9a84c22" : "#2a2a2a", color: p.active ? "#c9a84c" : "#888" }}>{p.active ? "ACTIF" : "INACTIF"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => togglePromo(p.id, p.active)} style={{ flex: 1, padding: 8, background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, cursor: "pointer" }}>
                        {p.active ? "Désactiver" : "Activer"}
                      </button>
                      <button onClick={() => deletePromo(p.id)} style={{ flex: 1, padding: 8, background: "transparent", border: "1px solid #c62828", borderRadius: 6, color: "#c62828", fontSize: 12, cursor: "pointer" }}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATISTIQUES */}
        {view === "stats" && (
          <div>
            <h1 style={{ fontSize: 20, color: "#c9a84c", marginBottom: 20 }}>📈 Statistiques</h1>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>💰 Revenus totaux</div>
                <div style={{ fontSize: 22, color: "#c9a84c", fontWeight: "bold", marginTop: 6 }}>{(stats.totalRevenue || 0).toLocaleString()} F</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>🛒 Total ventes</div>
                <div style={{ fontSize: 22, color: "#c9a84c", fontWeight: "bold", marginTop: 6 }}>{stats.totalPurchases || 0}</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>👥 Clients uniques</div>
                <div style={{ fontSize: 22, color: "#c9a84c", fontWeight: "bold", marginTop: 6 }}>{stats.totalUsers || 0}</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>📊 Panier moyen</div>
                <div style={{ fontSize: 22, color: "#c9a84c", fontWeight: "bold", marginTop: 6 }}>{stats.totalPurchases ? Math.round((stats.totalRevenue || 0) / stats.totalPurchases).toLocaleString() : 0} F</div>
              </div>
            </div>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#c9a84c", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>🏆 Top 5 livres vendus</div>
              {(!stats.topBooks || stats.topBooks.length === 0) ? (
                <div style={{ color: "#888", textAlign: "center", padding: 16, fontSize: 13 }}>Aucune vente pour l'instant</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.topBooks.map((b, i) => {
                    const book = books.find(bk => bk.id === b.id);
                    return (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "#111", borderRadius: 6 }}>
                        <div style={{ fontSize: 16, color: "#c9a84c", fontWeight: "bold", minWidth: 22 }}>#{i + 1}</div>
                        <div style={{ flex: 1, fontSize: 13, color: "#e8e0d0" }}>{book ? book.title : "Livre supprimé (#" + b.id + ")"}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{b.count} ventes</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={() => { fetchStats(); }} style={{ width: "100%", padding: 12, background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: "#c9a84c", fontSize: 13, cursor: "pointer" }}>
              🔄 Rafraîchir les statistiques
            </button>
          </div>
        )}

        {/* PARRAINAGES */}
        {view === "referrals" && (
          <div>
            <h2 style={{ color: "#c9a84c", fontSize: 18, marginBottom: 20 }}>🎁 Parrainages</h2>

            {/* STATS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Parrains</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#c9a84c" }}>{referralCodes.length}</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Filleuls</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#c9a84c" }}>{allReferrals.length}</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Total dû</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#f0a020" }}>{referralCodes.reduce((s, c) => s + (c.available_amount || 0) + (c.pending_amount || 0), 0).toLocaleString()} F</div>
              </div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Déjà versé</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#4caf50" }}>{referralCodes.reduce((s, c) => s + (c.total_paid || 0), 0).toLocaleString()} F</div>
              </div>
            </div>

            {/* DEMANDES DE RETRAIT */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#c9a84c", fontWeight: "bold", marginBottom: 12 }}>💸 Demandes de retrait</div>
              {referralWithdrawals.length === 0 ? (
                <div style={{ color: "#666", textAlign: "center", padding: 16, fontSize: 12 }}>Aucune demande</div>
              ) : (
                referralWithdrawals.slice(0, 20).map(wd => (
                  <div key={wd.id} style={{ padding: "10px 0", borderBottom: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>{wd.amount.toLocaleString()} F → {wd.phone_number}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>
                        {new Date(wd.created_at).toLocaleString("fr-FR")} - 
                        {wd.status === "paid" ? " ✅ Versé" : 
                         wd.status === "processing" ? " ⏳ En cours" : 
                         wd.status === "failed" ? " ❌ Échec" : " ⏳ En attente"}
                      </div>
                      {wd.error_message && <div style={{ fontSize: 10, color: "#ff6b6b" }}>Erreur : {wd.error_message}</div>}
                      {wd.campay_reference && <div style={{ fontSize: 9, color: "#666" }}>Ref CamPay : {wd.campay_reference}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TOP PARRAINS */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, color: "#c9a84c", fontWeight: "bold", marginBottom: 12 }}>🏆 Top Parrains</div>
              {referralCodes.length === 0 ? (
                <div style={{ color: "#666", textAlign: "center", padding: 16, fontSize: 12 }}>Aucun parrain encore</div>
              ) : (
                referralCodes.slice(0, 10).map((c, i) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2a2a2a" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#e8e0d0" }}>#{i+1} {c.code}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>Total gagné : {(c.total_earned || 0).toLocaleString()} F</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: "bold" }}>{(c.available_amount || 0).toLocaleString()} F</div>
                      <div style={{ fontSize: 9, color: "#666" }}>disponible</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PARAMÈTRES PARRAINAGE */}
        {view === "referral_settings" && (
          <div style={{ paddingBottom: 80 }}>
            <h1 style={{ fontSize: 18, color: "#c9a84c", marginBottom: 8, textAlign: "center" }}>⚙️ Paramètres parrainage</h1>
            <p style={{ color: "#888", fontSize: 12, textAlign: "center", marginBottom: 24 }}>Configure les règles de ton programme de parrainage</p>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, marginBottom: 16 }}>
              {/* Statut programme */}
              <div style={{ marginBottom: 20, padding: 14, background: refSettingsForm.active ? "#0d2a1a" : "#2a1a0d", border: "1px solid " + (refSettingsForm.active ? "#4caf50" : "#f5a623"), borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={refSettingsForm.active}
                    onChange={e => setRefSettingsForm(f => ({ ...f, active: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: refSettingsForm.active ? "#4caf50" : "#f5a623", fontWeight: "bold" }}>
                      {refSettingsForm.active ? "✅ Programme ACTIF" : "⏸️ Programme désactivé"}
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                      {refSettingsForm.active ? "Les utilisateurs peuvent parrainer" : "Aucun parrainage ne sera pris en compte"}
                    </div>
                  </div>
                </label>
              </div>

              {/* Récompense parrain */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  💰 Récompense PARRAIN par filleul
                </label>
                <input
                  type="number"
                  value={refSettingsForm.reward_per_referral}
                  onChange={e => setRefSettingsForm(f => ({ ...f, reward_per_referral: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 16, boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  💡 Montant en FCFA que reçoit le parrain quand son filleul achète (ex: 500)
                </div>
              </div>

              {/* Réduction filleul */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  🎁 Réduction FILLEUL (1er achat)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={refSettingsForm.referred_discount_pct}
                    onChange={e => setRefSettingsForm(f => ({ ...f, referred_discount_pct: e.target.value }))}
                    min="0" max="100"
                    style={{ width: "100%", padding: "12px 38px 12px 14px", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 16, boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: "bold" }}>%</span>
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  💡 Pourcentage de réduction sur le 1er achat du filleul (ex: 20)
                </div>
              </div>

              {/* Minimum retrait */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  💸 Montant minimum pour RETIRER
                </label>
                <input
                  type="number"
                  value={refSettingsForm.min_withdrawal}
                  onChange={e => setRefSettingsForm(f => ({ ...f, min_withdrawal: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 16, boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  💡 Le parrain doit accumuler ce montant avant de pouvoir retirer (ex: 5000)
                </div>
              </div>

              {/* Délai anti-fraude */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  ⏳ Délai anti-fraude (jours)
                </label>
                <input
                  type="number"
                  value={refSettingsForm.fraud_delay_days}
                  onChange={e => setRefSettingsForm(f => ({ ...f, fraud_delay_days: e.target.value }))}
                  min="0"
                  style={{ width: "100%", padding: "12px 14px", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 16, boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  💡 Nombre de jours avant que les gains soient disponibles pour retrait (ex: 30)
                </div>
              </div>

              {/* Aperçu */}
              <div style={{ background: "#0d1f2a", border: "1px solid #1976d2", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#64b5f6", marginBottom: 8, fontWeight: "bold" }}>📊 Aperçu du programme actuel :</div>
                <div style={{ fontSize: 12, color: "#e8e0d0", lineHeight: 1.7 }}>
                  💰 Le parrain gagne <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{(parseInt(refSettingsForm.reward_per_referral) || 0).toLocaleString()} F</span> par filleul qui achète
                  <br />
                  🎁 Le filleul reçoit <span style={{ color: "#c9a84c", fontWeight: "bold" }}>-{refSettingsForm.referred_discount_pct || 0}%</span> sur son 1er achat
                  <br />
                  💸 Retrait possible à partir de <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{(parseInt(refSettingsForm.min_withdrawal) || 0).toLocaleString()} F</span>
                  <br />
                  ⏳ Délai d'attente : <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{refSettingsForm.fraud_delay_days || 0} jours</span>
                </div>
              </div>

              {refSettingsMessage.text && (
                <div style={{ padding: 12, marginBottom: 12, background: refSettingsMessage.type === "error" ? "#2a0d0d" : "#0d2a1a", border: "1px solid " + (refSettingsMessage.type === "error" ? "#dc3545" : "#4caf50"), borderRadius: 6, color: refSettingsMessage.type === "error" ? "#f44336" : "#4caf50", fontSize: 12, textAlign: "center", fontWeight: "bold" }}>
                  {refSettingsMessage.text}
                </div>
              )}

              <button
                onClick={saveReferralSettings}
                disabled={refSettingsSaving}
                style={{
                  width: "100%", padding: 14, background: refSettingsSaving ? "#666" : "#c9a84c", color: "#1a1a1a",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: "bold", cursor: refSettingsSaving ? "not-allowed" : "pointer",
                  letterSpacing: 1
                }}
              >
                {refSettingsSaving ? "⏳ Enregistrement..." : "💾 Enregistrer les paramètres"}
              </button>
            </div>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: "#c9a84c", fontWeight: "bold", marginBottom: 8 }}>💡 Conseils stratégiques</div>
              <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>
                <div style={{ marginBottom: 6 }}>📈 <strong style={{ color: "#e8e0d0" }}>Récompense parrain</strong> : Plus elle est élevée, plus les parrains sont motivés. Standard : 500-1000 F.</div>
                <div style={{ marginBottom: 6 }}>🎯 <strong style={{ color: "#e8e0d0" }}>Réduction filleul</strong> : 20% est le standard de l'industrie. Tu peux monter à 30% pour booster.</div>
                <div style={{ marginBottom: 6 }}>💸 <strong style={{ color: "#e8e0d0" }}>Minimum retrait</strong> : 5000 F évite les petits versements. Bon équilibre.</div>
                <div>⏳ <strong style={{ color: "#e8e0d0" }}>Délai anti-fraude</strong> : 30 jours = sécurité maximale. Tu peux réduire à 7-14 jours pour plus de motivation.</div>
              </div>
            </div>
          </div>
        )}

        {/* MODÉRATION AVIS */}
        {view === "reviews" && (
          <div>
            <h2 style={{ color: "#c9a84c", fontSize: 18, marginBottom: 20 }}>💬 Modération des avis</h2>

            {/* Filtres */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { id: "pending", label: "⏳ En attente", color: "#f5a623" },
                { id: "approved", label: "✅ Approuvés", color: "#4CAF50" },
                { id: "all", label: "📋 Tous", color: "#888" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setReviewsFilter(f.id); loadPendingReviews(f.id); }}
                  style={{
                    padding: "8px 14px",
                    background: reviewsFilter === f.id ? f.color : "transparent",
                    border: "1px solid " + (reviewsFilter === f.id ? f.color : "#2a2a2a"),
                    borderRadius: 6,
                    color: reviewsFilter === f.id ? "#000" : "#aaa",
                    fontSize: 12, fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => loadPendingReviews(reviewsFilter)}
                style={{ padding: "8px 14px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: "#c9a84c", fontSize: 12, cursor: "pointer" }}
              >
                🔄 Rafraîchir
              </button>
            </div>

            {reviewsLoading ? (
              <p style={{ color: "#888", textAlign: "center", padding: 30 }}>⏳ Chargement...</p>
            ) : pendingReviews.length === 0 ? (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 30, textAlign: "center" }}>
                <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
                  {reviewsFilter === "pending" ? "✨ Aucun avis en attente de modération !" : "Aucun avis dans cette catégorie."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingReviews.map(review => {
                  const date = review.created_at ? new Date(review.created_at).toLocaleString("fr-FR") : "";
                  const userInitial = review.user_id ? review.user_id.substring(0, 2).toUpperCase() : "??";
                  return (
                    <div key={review.id} style={{
                      background: "#1a1a1a",
                      border: "1px solid " + (review.approved ? "#4CAF50" : "#f5a623"),
                      borderRadius: 10, padding: 16
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "#c9a84c", color: "#000",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: "bold"
                          }}>{userInitial}</div>
                          <div>
                            <div style={{ fontSize: 12, color: "#e8e0d0" }}>📕 {review.book_title || "Livre #" + review.book_id}</div>
                            <div style={{ fontSize: 10, color: "#888" }}>{date}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 1 }}>
                          {[1,2,3,4,5].map(s => (
                            <span key={s} style={{ fontSize: 14, color: s <= review.rating ? "#f5c518" : "#444" }}>★</span>
                          ))}
                        </div>
                      </div>
                      <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px 0", fontStyle: "italic", padding: 12, background: "#111", borderRadius: 6 }}>
                        « {review.comment} »
                      </p>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {!review.approved && (
                          <button
                            onClick={async () => {
                              await supabase.from("book_reviews").update({ approved: true }).eq("id", review.id);
                              loadPendingReviews(reviewsFilter);
                            }}
                            style={{ padding: "8px 16px", background: "#4CAF50", border: "none", borderRadius: 6, color: "#000", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
                          >
                            ✅ Approuver
                          </button>
                        )}
                        {review.approved && (
                          <button
                            onClick={async () => {
                              await supabase.from("book_reviews").update({ approved: false }).eq("id", review.id);
                              loadPendingReviews(reviewsFilter);
                            }}
                            style={{ padding: "8px 16px", background: "transparent", border: "1px solid #f5a623", borderRadius: 6, color: "#f5a623", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
                          >
                            ⏸️ Désapprouver
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("Supprimer définitivement cet avis ?")) return;
                            await supabase.from("book_reviews").delete().eq("id", review.id);
                            loadPendingReviews(reviewsFilter);
                          }}
                          style={{ padding: "8px 16px", background: "transparent", border: "1px solid #f44336", borderRadius: 6, color: "#f44336", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECURITY - CHANGEMENT MOT DE PASSE */}
        {view === "security" && (
          <div>
            <h2 style={{ color: "#c9a84c", fontSize: 18, marginBottom: 20 }}>🔐 Sécurité</h2>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <h3 style={{ color: "#c9a84c", fontSize: 15, marginBottom: 8 }}>Changer le mot de passe admin</h3>
              <p style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>
                Le mot de passe admin protège l'accès à cette interface. Choisis un mot de passe fort.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Mot de passe actuel</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Ton mot de passe actuel"
                  style={{ width: "100%", padding: "12px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  style={{ width: "100%", padding: "12px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ color: "#aaa", fontSize: 12, display: "block", marginBottom: 6 }}>Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Retape le nouveau mot de passe"
                  style={{ width: "100%", padding: "12px 14px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>

              {pwdMessage.text && (
                <div style={{
                  padding: 12, marginBottom: 14, borderRadius: 6, fontSize: 13,
                  background: pwdMessage.type === "success" ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
                  color: pwdMessage.type === "success" ? "#4CAF50" : "#f44336",
                  border: "1px solid " + (pwdMessage.type === "success" ? "#4CAF50" : "#f44336")
                }}>
                  {pwdMessage.text}
                </div>
              )}

              <button
                onClick={() => {
                  setPwdMessage({
                    type: "error",
                    text: "ℹ️ Cette fonctionnalité est désactivée. L'authentification admin se fait désormais via votre compte Supabase Auth (carrybooks.com@gmail.com). Pour changer le mot de passe de votre compte admin, utilisez la page « Mot de passe oublié » sur la page de connexion du site."
                  });
                }}
                disabled={pwdSaving}
                style={{
                  width: "100%", padding: 13,
                  background: pwdSaving ? "#555" : "#c9a84c",
                  border: "none", borderRadius: 6,
                  color: "#000", fontWeight: "bold",
                  cursor: pwdSaving ? "not-allowed" : "pointer",
                  fontSize: 14
                }}
              >
                {pwdSaving ? "⏳ Sauvegarde..." : "🔐 Changer le mot de passe"}
              </button>
            </div>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20 }}>
              <h3 style={{ color: "#c9a84c", fontSize: 15, marginBottom: 8 }}>💡 Conseils de sécurité</h3>
              <ul style={{ color: "#aaa", fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                <li>Utilise un mot de passe d'au moins <strong style={{ color: "#e8e0d0" }}>12 caractères</strong></li>
                <li>Mélange majuscules, minuscules, chiffres et symboles</li>
                <li>Ne le partage <strong style={{ color: "#e8e0d0" }}>jamais</strong> par email, SMS ou WhatsApp</li>
                <li>Note-le dans un endroit sûr (gestionnaire de mots de passe, papier dans un coffre)</li>
                <li>Change-le régulièrement (tous les 3 à 6 mois)</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto", padding: "24px 20px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#c9a84c", fontSize: 17 }}>{editingBook ? "Modifier le livre" : "Ajouter un livre"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #2a2a2a" }}>
              {[{ id: "info", label: "📋 Infos" }, { id: "content", label: "📝 Contenu" }].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13,
                    color: activeTab === tab.id ? "#c9a84c" : "#888",
                    borderBottom: activeTab === tab.id ? "2px solid #c9a84c" : "2px solid transparent" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>TITRE *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Titre du livre" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>AUTEUR *</label>
                  <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                    placeholder="Nom et prénom" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>PRIX ACTUEL (FCFA) *</label>
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: 2500 (0 pour gratuit)" type="number" style={inputStyle} />
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                    💰 C'est le prix que paie le client
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>PRIX D'AVANT — PROMO (FCFA)</label>
                  <input value={form.original_price || ""} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))}
                    placeholder="Laisser vide si pas de promo" type="number" style={inputStyle} />
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                    🔥 Mets l'ancien prix ici → Le badge "PROMO" et le prix barré apparaîtront automatiquement sur le site
                  </div>
                  {/* Aperçu du calcul */}
                  {form.original_price && parseInt(form.original_price) > parseInt(form.price || 0) && parseInt(form.price || 0) > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "#1f1810", border: "1px solid #c9a84c", borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: "bold" }}>
                        🔥 Aperçu : -{Math.round((1 - parseInt(form.price) / parseInt(form.original_price)) * 100)}%
                      </div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                        <span style={{ textDecoration: "line-through" }}>{parseInt(form.original_price).toLocaleString()} F</span>
                        {" → "}
                        <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{parseInt(form.price).toLocaleString()} F</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* COUVERTURE */}
                <div>
                  <label style={labelStyle}>COUVERTURE</label>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: "none" }} />
                  <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={uploading}
                    style={{ width: "100%", padding: "12px", borderRadius: 6, border: "2px dashed #c9a84c",
                      background: uploading ? "#1e1e1e" : "transparent", color: uploading ? "#888" : "#c9a84c",
                      cursor: uploading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: "bold",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                    {uploading ? "⏳ Upload en cours..." : "📁 Uploader depuis mon PC"}
                  </button>
                  {uploadError && <div style={{ color: "#f44336", fontSize: 12, marginBottom: 8 }}>{uploadError}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
                    <span style={{ fontSize: 11, color: "#555" }}>OU COLLER UNE URL</span>
                    <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
                  </div>
                  <input value={form.cover} onChange={e => setForm(f => ({ ...f, cover: e.target.value }))}
                    placeholder="https://i.ibb.co/.../image.jpg" style={inputStyle} />
                  {form.cover && (
                    <div style={{ marginTop: 10, textAlign: "center" }}>
                      <img src={form.cover} alt="Aperçu" style={{ maxHeight: 140, border: "1px solid #2a2a2a" }}
                        onError={e => { e.target.style.display = "none"; }} />
                    </div>
                  )}
                </div>

                {/* Catégorie */}
                <div>
                  <label style={labelStyle}>CATÉGORIE</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: "" }))} style={inputStyle}>
                    {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {form.category && CATEGORIES[form.category] && (
                    <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                      <option value="">-- Sous-catégorie (optionnel) --</option>
                      {CATEGORIES[form.category].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}

                </div>

                {/* Résumé */}
                <div>
                  <label style={labelStyle}>RÉSUMÉ</label>
                  <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="Décris ton livre en 2-3 phrases..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              </div>
            )}

            {activeTab === "content" && (
              <div>
                <label style={labelStyle}>CONTENU DU LIVRE</label>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                  Choisis entre uploader un PDF ou coller le texte.
                </p>

                {/* Toggle PDF / Texte */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setForm(f => ({ ...f, pdf_url: "" }))}
                    style={{ flex: 1, padding: "10px 0", border: "2px solid " + (!form.pdf_url ? "#c9a84c" : "#2a2a2a"), borderRadius: 6, background: !form.pdf_url ? "#c9a84c22" : "transparent", color: !form.pdf_url ? "#c9a84c" : "#888", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}>
                    📝 Texte
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, pdf_url: f.pdf_url || "pending" }))}
                    style={{ flex: 1, padding: "10px 0", border: "2px solid " + (form.pdf_url ? "#c9a84c" : "#2a2a2a"), borderRadius: 6, background: form.pdf_url ? "#c9a84c22" : "transparent", color: form.pdf_url ? "#c9a84c" : "#888", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}>
                    📄 PDF
                  </button>
                </div>

                {/* Upload PDF */}
                {form.pdf_url !== "" && (
                  <div style={{ marginBottom: 16 }}>
                    <input type="file" accept=".pdf" id="pdfFileInput" style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const fileName = `${Date.now()}_${file.name.replace(/\s/g, "_")}`;
                          const { error } = await supabase.storage.from("books-pdf").upload(fileName, file, { contentType: "application/pdf" });
                          if (error) throw error;
                          const { data: urlData } = supabase.storage.from("books-pdf").getPublicUrl(fileName);
                          setForm(f => ({ ...f, pdf_url: urlData.publicUrl }));
                        } catch (err) {
                          alert("Erreur upload : " + err.message);
                        }
                        setUploading(false);
                        e.target.value = "";
                      }} />
                    <button onClick={() => document.getElementById("pdfFileInput").click()} disabled={uploading}
                      style={{ width: "100%", padding: "12px", borderRadius: 6, border: "2px dashed #c9a84c", background: uploading ? "#1e1e1e" : "transparent", color: uploading ? "#888" : "#c9a84c", cursor: uploading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: "bold", marginBottom: 10 }}>
                      {uploading ? "⏳ Upload en cours..." : "📄 Uploader le PDF"}
                    </button>
                    {form.pdf_url && form.pdf_url !== "pending" && (
                      <div style={{ fontSize: 12, color: "#4caf50", padding: "8px 12px", background: "#1a3a1a", borderRadius: 6, marginBottom: 12 }}>
                        ✅ PDF uploadé
                      </div>
                    )}

                    {/* Options extrait PDF */}
                    {form.pdf_url && form.pdf_url !== "pending" && (
                      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Options d'extrait PDF</label>
                        
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 4 }}>📄 Extrait automatique (nombre de pages) :</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="number" min="1" max="50" value={form.extract_pages} onChange={e => setForm(f => ({ ...f, extract_pages: parseInt(e.target.value) || 5 }))}
                              style={{ ...inputStyle, width: 70 }} />
                            <span style={{ color: "#888", fontSize: 12 }}>pages</span>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 6 }}>📤 OU uploader un PDF d'extrait séparé :</label>
                          {form.excerpt_pdf_url ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#4caf50", fontSize: 12 }}>✅ Extrait PDF uploadé</span>
                              <button onClick={() => setForm(f => ({ ...f, excerpt_pdf_url: "" }))}
                                style={{ background: "none", border: "1px solid #555", color: "#aaa", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>
                                Supprimer
                              </button>
                            </div>
                          ) : (
                            <label style={{ display: "block", padding: "8px 12px", border: "1px dashed #555", borderRadius: 6, cursor: "pointer", color: "#888", fontSize: 12, textAlign: "center" }}>
                              📁 Choisir un fichier PDF extrait
                              <input type="file" accept=".pdf" style={{ display: "none" }} onChange={async e => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const fileName = Date.now() + "_excerpt_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                                const { error } = await supabase.storage.from("books-pdf").upload(fileName, file, { contentType: "application/pdf" });
                                if (!error) {
                                  const { data: urlData } = supabase.storage.from("books-pdf").getPublicUrl(fileName);
                                  setForm(f => ({ ...f, excerpt_pdf_url: urlData.publicUrl }));
                                }
                              }} />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Zone texte - seulement si mode texte */}
                {!form.pdf_url && (<>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                  Colle le texte de ton livre ici. Sépare les chapitres avec une ligne vide.
                </p>
                {/* Barre de formatage */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "G", tag: "strong", title: "Gras", style: { fontWeight: "bold" } },
                    { label: "I", tag: "em", title: "Italique", style: { fontStyle: "italic" } },
                    { label: "S", tag: "u", title: "Souligné", style: { textDecoration: "underline" } },
                  ].map(({ label, tag, title, style: btnStyle }) => (
                    <button key={tag} title={title} onMouseDown={e => {
                      e.preventDefault();
                      const ta = document.getElementById("contentTextarea");
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const selected = form.content.substring(start, end);
                      if (!selected) return;
                      const before = form.content.substring(0, start);
                      const after = form.content.substring(end);
                      const newContent = before + `<${tag}>${selected}</${tag}>` + after;
                      setForm(f => ({ ...f, content: newContent }));
                      setTimeout(() => {
                        ta.focus();
                        ta.setSelectionRange(start, end + tag.length * 2 + 5);
                      }, 0);
                    }}
                      style={{ ...btnStyle, padding: "6px 14px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>
                      {label}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: "#555", alignSelf: "center", marginLeft: 4 }}>Sélectionne du texte puis clique</span>
                </div>
                <button onClick={() => {
                  let txt = form.content;
                  txt = txt.split("\r\n").join("\n");
                  txt = txt.split("\r").join("\n");
                  const lines = txt.split("\n");
                  const result = [];
                  let current = [];
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();
                    if (/^\s*\d+\s*$/.test(line)) { if (current.length > 0) { result.push(current.join(" ")); current = []; } continue; }
                    if (trimmed === "") { if (current.length > 0) { result.push(current.join(" ")); current = []; } continue; }
                    const isNew = line.startsWith(" ") || trimmed.startsWith("—") || /^[-–—]\s/.test(trimmed);
                    if (isNew && current.length > 0) { result.push(current.join(" ")); current = [trimmed]; }
                    else if (isNew) { current = [trimmed]; }
                    else { current.length === 0 ? current = [trimmed] : current.push(trimmed); }
                  }
                  if (current.length > 0) result.push(current.join(" "));
                  setForm(f => ({ ...f, content: result.filter(p => p.trim()).join("\n\n") }));
                }} style={{ marginBottom: 10, padding: "10px 16px", background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 13, width: "100%" }}>
                  🧹 Nettoyer le texte PDF
                </button>
                <textarea id="contentTextarea" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="CHAPITRE 1&#10;&#10;Le texte de ton livre commence ici..." rows={14}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7 }} />
                <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                  {form.content ? `${form.content.length} caractères · ~${Math.ceil(form.content.length / 1800)} pages` : "Aucun contenu"}
                </div>
                </>)}
              </div>
            )}

              {/* Section Audio */}
              <div style={{ marginTop: 20, padding: "16px", background: "#111", borderRadius: 8, border: "1px solid #2a2a2a" }}>
                <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>🎧 Livre Audio (MP3)</label>
                {form.audio_url ? (
                  <div>
                    <audio controls src={form.audio_url} style={{ width: "100%", marginBottom: 8 }} />
                    <button onClick={() => setForm(f => ({ ...f, audio_url: "" }))}
                      style={{ padding: "6px 14px", background: "none", border: "1px solid #f44336", borderRadius: 6, color: "#f44336", cursor: "pointer", fontSize: 12 }}>
                      🗑 Supprimer l'audio
                    </button>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 8 }}>Uploade un fichier MP3 :</label>
                    <input type="file" accept="audio/mp3,audio/mpeg" onChange={async e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const fileName = "audio_" + Date.now() + "_" + file.name.replace(/\s/g, "_");
                      const { error } = await supabase.storage.from("books-pdf").upload(fileName, file, { contentType: "audio/mpeg" });
                      if (!error) {
                        const { data: urlData } = supabase.storage.from("books-pdf").getPublicUrl(fileName);
                        setForm(f => ({ ...f, audio_url: urlData.publicUrl }));
                      } else {
                        alert("Erreur upload audio : " + error.message);
                      }
                    }}
                      style={{ color: "#aaa", fontSize: 13 }} />
                    <p style={{ fontSize: 11, color: "#555", marginTop: 6 }}>Si aucun MP3, la synthèse vocale sera utilisée automatiquement.</p>
                  </div>
                )}
              </div>

              {/* Options lecture / téléchargement */}
              <div style={{ marginTop: 20, padding: "16px", background: "#111", borderRadius: 8, border: "1px solid #2a2a2a" }}>
                <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>📖 Options d'accès</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.featured === true} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: "#c9a84c" }} />
                    <div>
                      <div style={{ color: "#e8e0d0", fontSize: 14 }}>⭐ Mettre à la une (Hero)</div>
                      <div style={{ color: "#555", fontSize: 11 }}>Ce livre apparaîtra dans le carrousel hero de l'accueil</div>
                    </div>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.exclude_from_subscription === true} onChange={e => setForm(f => ({ ...f, exclude_from_subscription: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: "#c9a84c" }} />
                    <div>
                      <div style={{ color: "#e8e0d0", fontSize: 14 }}>🚫 Exclure de l'abonnement mensuel</div>
                      <div style={{ color: "#555", fontSize: 11 }}>Les abonnés devront acheter ce livre individuellement (idéal pour les exclusivités)</div>
                    </div>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.can_read !== false} onChange={e => setForm(f => ({ ...f, can_read: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: "#c9a84c" }} />
                    <div>
                      <div style={{ color: "#e8e0d0", fontSize: 14 }}>📖 Permettre la lecture (Liseuse)</div>
                      <div style={{ color: "#555", fontSize: 11 }}>Le lecteur peut lire dans la liseuse en ligne</div>
                    </div>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.can_download === true} onChange={e => setForm(f => ({ ...f, can_download: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: "#c9a84c" }} />
                    <div>
                      <div style={{ color: "#e8e0d0", fontSize: 14 }}>⬇️ Permettre le téléchargement (PDF)</div>
                      <div style={{ color: "#555", fontSize: 11 }}>Le lecteur peut télécharger le PDF sur son appareil</div>
                    </div>
                  </label>
                </div>
              </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: "12px 0", background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: "#888", cursor: "pointer", fontSize: 14 }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: "12px 0", background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                {saving ? "Enregistrement..." : editingBook ? "Mettre à jour" : "Ajouter le livre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a",
  borderRadius: 6, color: "#e8e0d0", fontSize: 14, boxSizing: "border-box",
  fontFamily: "Georgia, serif"
};

const labelStyle = {
  display: "block", fontSize: 11, color: "#888", marginBottom: 6,
  letterSpacing: 1, textTransform: "uppercase"
};


