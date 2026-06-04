import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// CATEGORIES est maintenant chargé dynamiquement depuis Supabase
// Voir state CATEGORIES dans le composant Admin
// Fallback minimal si Supabase n'a pas encore répondu
const CATEGORIES_FALLBACK = {
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
  summary: "", content: "", pdf_url: "", status: "actif", audio_url: "", excerpt_pdf_url: "",
  can_read: true, can_download: false, featured: false, exclude_from_subscription: false,
  product_type: "numerique", stock: -1, images: [], audio_access_mode: "sale",
  paper_pages: "", paper_description: "", paper_stock: -1, paper_price: "",
  allow_oversell: false
};

// ════════════════════════════════════════════════════════════════
// MODULE COMPTABILITÉ / RENTABILITÉ
// ════════════════════════════════════════════════════════════════
function ComptabiliteView() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [guestPurchases, setGuestPurchases] = useState([]);
  const [cartOrders, setCartOrders] = useState([]);
  const [carrycare, setCarrycare] = useState([]);
  const [quizPays, setQuizPays] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Saisie des charges pour une date (par défaut aujourd'hui)
  const todayStr = new Date().toLocaleDateString("fr-CA"); // YYYY-MM-DD local
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [adSpendInput, setAdSpendInput] = useState("");
  const [otherInput, setOtherInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [p, g, c, cc, qp, wd, ex] = await Promise.all([
        supabase.from("purchases").select("amount, created_at"),
        supabase.from("guest_purchases").select("amount, created_at"),
        supabase.from("cart_orders").select("total, created_at, payment_status").eq("payment_status", "paid"),
        supabase.from("carrycare_results").select("amount, created_at"),
        supabase.from("quiz_payments").select("amount, created_at"),
        supabase.from("referral_withdrawals").select("amount, created_at, status").eq("status", "approved"),
        supabase.from("daily_expenses").select("expense_date, ad_spend, other_charges"),
      ]);
      setPurchases(p.data || []);
      setGuestPurchases(g.data || []);
      setCartOrders(c.data || []);
      setCarrycare(cc.data || []);
      setQuizPays(qp.data || []);
      setWithdrawals(wd.data || []);
      setExpenses(ex.data || []);
    } catch (e) {
      console.error("Erreur chargement comptabilité:", e);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Quand on change de date sélectionnée (ou que les charges se rechargent),
  // pré-remplir les champs avec la valeur déjà enregistrée pour cette date
  useEffect(() => {
    const row = expenses.find(e => e.expense_date === selectedDate);
    setAdSpendInput(row ? String(row.ad_spend ?? "") : "");
    setOtherInput(row ? String(row.other_charges ?? "") : "");
  }, [selectedDate, expenses]);

  async function saveCharges() {
    setSaving(true);
    setSavedMsg("");
    try {
      const { error } = await supabase.from("daily_expenses").upsert(
        {
          expense_date: selectedDate,
          ad_spend: Number(adSpendInput) || 0,
          other_charges: Number(otherInput) || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "expense_date" }
      );
      if (error) {
        setSavedMsg("❌ Erreur : " + error.message);
      } else {
        setSavedMsg("✅ Charges enregistrées pour le " + selectedDate);
        await loadAll();
      }
    } catch (e) {
      setSavedMsg("❌ Erreur : " + (e.message || e));
    }
    setSaving(false);
  }

  // ── Helpers de période ──
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = (() => { const x = startOfDay(now); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; })(); // lundi
  const monthStart = (() => { const x = startOfDay(now); x.setDate(1); return x; })();
  const yearStart = (() => { const x = startOfDay(now); x.setMonth(0, 1); return x; })();
  const selStart = startOfDay(new Date(selectedDate + "T00:00:00"));
  const selEnd = new Date(selStart); selEnd.setDate(selEnd.getDate() + 1);

  const inRange = (iso, start, end) => { const t = new Date(iso); return t >= start && t < end; };
  const sumAmt = (arr, field, start, end) =>
    arr.filter(r => inRange(r.created_at, start, end)).reduce((s, r) => s + (Number(r[field]) || 0), 0);

  const expInRange = (start, end) =>
    expenses
      .filter(e => { const d = new Date(e.expense_date + "T00:00:00"); return d >= start && d < end; })
      .reduce((s, e) => s + (Number(e.ad_spend) || 0) + (Number(e.other_charges) || 0), 0);

  // Calcul complet pour une période [start, end[
  function compute(start, end) {
    const ventes = sumAmt(purchases, "amount", start, end)
      + sumAmt(guestPurchases, "amount", start, end)
      + sumAmt(cartOrders, "total", start, end);
    const quiz = sumAmt(carrycare, "amount", start, end) + sumAmt(quizPays, "amount", start, end);
    const revenus = ventes + quiz;
    const parrains = sumAmt(withdrawals, "amount", start, end);
    const charges = expInRange(start, end);
    const fraisCampay = Math.round(revenus * 0.02);
    const benefice = revenus - charges - parrains - fraisCampay;
    return { ventes, quiz, revenus, parrains, charges, benefice, fraisCampay };
  }

  const sel = compute(selStart, selEnd);
  const hier = compute(yesterdayStart, todayStart);
  const semaine = compute(weekStart, tomorrowStart);
  const mois = compute(monthStart, tomorrowStart);
  const annee = compute(yearStart, tomorrowStart);

  const fmt = (n) => (Math.round(n)).toLocaleString("fr-FR") + " F";
  const GOLD = "#c9a84c";

  const box = (label, value, color, emoji) => (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, flex: "1 1 160px", minWidth: 150 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{emoji} {label}</div>
      <div style={{ fontSize: 22, fontWeight: "bold", color: color || "#fff" }}>{value}</div>
    </div>
  );

  const beneficeCard = (titre, data) => (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, flex: "1 1 200px", minWidth: 180 }}>
      <div style={{ fontSize: 13, color: GOLD, fontWeight: "bold", marginBottom: 10 }}>{titre}</div>
      <div style={{ fontSize: 26, fontWeight: "bold", color: data.benefice >= 0 ? "#4CAF50" : "#e74c3c", marginBottom: 10 }}>
        {fmt(data.benefice)}
      </div>
      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.7 }}>
        Revenus : {fmt(data.revenus)}<br />
        Charges : {fmt(data.charges)}<br />
        Parrains : {fmt(data.parrains)}<br />
        Frais CamPay (2%) : {fmt(data.fraisCampay)}
      </div>
    </div>
  );

  if (loading) {
    return <div style={{ padding: 24, color: "#888", textAlign: "center" }}>Chargement de la comptabilité…</div>;
  }

  return (
    <div style={{ padding: "8px 4px 60px" }}>
      <h2 style={{ color: GOLD, fontSize: 20, marginBottom: 4 }}>💰 Comptabilité</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Saisis tes charges du jour. Les ventes, quiz et gains des parrains se calculent automatiquement.
      </p>

      {/* SAISIE DES CHARGES */}
      <div style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: GOLD, fontWeight: "bold", marginBottom: 12 }}>Charges de la journée</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Date</label>
            <input type="date" value={selectedDate} max={todayStr}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0d0d0d", color: "#fff", fontSize: 14 }} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Montant publicitaire (F)</label>
            <input type="number" value={adSpendInput} placeholder="0"
              onChange={e => setAdSpendInput(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0d0d0d", color: "#fff", fontSize: 14 }} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Autres charges (F)</label>
            <input type="number" value={otherInput} placeholder="0"
              onChange={e => setOtherInput(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0d0d0d", color: "#fff", fontSize: 14 }} />
          </div>
        </div>
        <button onClick={saveCharges} disabled={saving}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: GOLD, color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>
          {saving ? "Enregistrement…" : "💾 Enregistrer les charges"}
        </button>
        {savedMsg && <div style={{ marginTop: 10, fontSize: 13, color: savedMsg.startsWith("✅") ? "#4CAF50" : "#e74c3c" }}>{savedMsg}</div>}
      </div>

      {/* RÉSUMÉ DE LA DATE SÉLECTIONNÉE (4 cases) */}
      <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>
        Résumé du <strong style={{ color: "#fff" }}>{selectedDate === todayStr ? "jour (aujourd'hui)" : selectedDate}</strong>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        {box("Charges (pub + autres)", fmt(sel.charges), "#e67e22", "💸")}
        {box("Ventes + Quiz", fmt(sel.revenus), "#fff", "🛒")}
        {box("Gains des parrains", fmt(sel.parrains), "#9b59b6", "🎁")}
        {box("Bénéfice", fmt(sel.benefice), sel.benefice >= 0 ? "#4CAF50" : "#e74c3c", "📈")}
      </div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 28 }}>
        Détail ventes/quiz du jour : ventes {fmt(sel.ventes)} · quiz {fmt(sel.quiz)}
      </div>

      {/* BÉNÉFICES PAR PÉRIODE */}
      <div style={{ fontSize: 15, color: GOLD, fontWeight: "bold", marginBottom: 12 }}>Bénéfices</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {beneficeCard("Hier", hier)}
        {beneficeCard("Cette semaine", semaine)}
        {beneficeCard("Ce mois", mois)}
        {beneficeCard("Cette année", annee)}
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={loadAll}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#aaa", cursor: "pointer", fontSize: 13 }}>
          🔄 Actualiser
        </button>
      </div>
    </div>
  );
}

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
  // Sous-vue de l'onglet Produits : null=accueil cartes, "digital"|"physical"|"article"|"audio"
  const [productSubView, setProductSubView] = useState(null);
  // Sous-onglet à l'intérieur d'une sous-vue : "list"|"shipping"|"orders"
  const [productSubTab, setProductSubTab] = useState("list");
  // 🆕 Filtre stock : "all" | "outOfStock" | "inStock"
  const [stockFilter, setStockFilter] = useState("all");
  // 🆕 Recherche dans la liste admin
  const [productSearch, setProductSearch] = useState("");
  // Affiche ou cache le s�lecteur de type de produit dans le formulaire
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({ total_users: 0, new_today: 0, new_this_week: 0, new_this_month: 0 });
  const [subscribers, setSubscribers] = useState([]);
  const [quizPayments, setQuizPayments] = useState([]);
  const [carrycarePayments, setCarrycarePayments] = useState([]);
  // 🛍️ Produits physiques : CarryShop et CarryColor (tables séparées)
  const [carryshopOrders, setCarryshopOrders] = useState([]);
  const [carrycolorOrders, setCarrycolorOrders] = useState([]);
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
    reward_pct_digital: "20",
    reward_pct_physical: "10",
    referred_discount_pct: "10",
    min_withdrawal: "10000",
    fraud_delay_days: "30",
    active: true
  });
  const [refSettingsSaving, setRefSettingsSaving] = useState(false);
  const [refSettingsMessage, setRefSettingsMessage] = useState({ type: "", text: "" });
  const [referralCodes, setReferralCodes] = useState([]);
  const [allReferrals, setAllReferrals] = useState([]);
  const [referralWithdrawals, setReferralWithdrawals] = useState([]);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState(null); // 🔒 retrait en cours de versement (bloque le bouton)
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

  // ===== GESTION DES CATÉGORIES (chargées depuis Supabase) =====
  const [CATEGORIES, setCATEGORIES] = useState(CATEGORIES_FALLBACK);
  const [categoriesRaw, setCategoriesRaw] = useState([]); // [{id, name, display_order}]
  const [subcategoriesRaw, setSubcategoriesRaw] = useState([]); // [{id, category_id, name, display_order}]
  const [catLoading, setCatLoading] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catMessage, setCatMessage] = useState({ type: "", text: "" });
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [newSubName, setNewSubName] = useState({}); // { categoryId: "nom de la nouvelle sous-cat" }
  const [editingSubId, setEditingSubId] = useState(null);
  const [editingSubName, setEditingSubName] = useState("");

  // ===== GESTION DU MODULE POD (Print On Demand) =====
  const [shippingZones, setShippingZones] = useState([]);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneMessage, setZoneMessage] = useState({ type: "", text: "" });
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editingZone, setEditingZone] = useState({});
  const [newZone, setNewZone] = useState({
    city: "", delivery_fee: 0, delivery_method: "agence",
    delivery_days_min: 1, delivery_days_max: 3, instructions: "", active: true
  });
  // Livres papier
  const [paperBooks, setPaperBooks] = useState([]); // sous-ensemble de books filtré
  const [paperSaving, setPaperSaving] = useState(false);
  const [paperMessage, setPaperMessage] = useState({ type: "", text: "" });
  const [editingPaperId, setEditingPaperId] = useState(null);
  const [editingPaper, setEditingPaper] = useState({});

  // ===== AUTH ADMIN : useEffect (DOIT être AVANT tout early return) =====
  useEffect(() => {
    checkAdminAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminAccess();
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { fetchBooks(); fetchUsers(); fetchUserStats(); fetchSubscribers(); fetchSubSettings(); fetchPromoCodes(); fetchStats(); fetchQuizPayments(); fetchCarrycarePayments(); fetchCarryshopOrders(); fetchCarrycolorOrders(); fetchBookViews(); fetchReferralData(); fetchReferralSettings(); fetchPresence(); fetchCategories(); fetchShippingZones(); }, []);

  // Auto-refresh des données de présence toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPresence();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // 🔄 Auto-refresh du dashboard toutes les 30 secondes quand on est dessus
  useEffect(() => {
    if (view !== "dashboard") return;
    // Refresh immédiat au chargement / changement d'onglet vers dashboard
    fetchStats();
    fetchSubscribers();
    fetchQuizPayments();
    fetchCarrycarePayments();
    fetchCarryshopOrders();
    fetchCarrycolorOrders();
    fetchUserStats();
    // Puis refresh périodique
    const interval = setInterval(() => {
      fetchStats();
      fetchSubscribers();
      fetchQuizPayments();
      fetchCarrycarePayments();
      fetchCarryshopOrders();
      fetchCarrycolorOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, [view]);

  // ===== GESTION DES CATÉGORIES : Fonctions =====
  async function fetchCategories() {
    setCatLoading(true);
    try {
      const { data: cats, error: e1 } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (e1) throw e1;
      const { data: subs, error: e2 } = await supabase
        .from('subcategories')
        .select('*')
        .order('display_order', { ascending: true });
      if (e2) throw e2;
      setCategoriesRaw(cats || []);
      setSubcategoriesRaw(subs || []);
      // Reconstruction de l'objet CATEGORIES { "Nom cat": ["sous1", "sous2", ...] }
      const obj = {};
      (cats || []).forEach(c => {
        obj[c.name] = (subs || [])
          .filter(s => s.category_id === c.id)
          .map(s => s.name);
      });
      if (Object.keys(obj).length > 0) {
        setCATEGORIES(obj);
      }
    } catch (err) {
      console.error('Erreur fetchCategories:', err);
      setCatMessage({ type: 'error', text: 'Erreur de chargement des catégories' });
    }
    setCatLoading(false);
  }

  async function addCategory() {
    if (!newCatName.trim()) {
      setCatMessage({ type: 'error', text: 'Le nom est requis' });
      return;
    }
    setCatSaving(true);
    setCatMessage({ type: '', text: '' });
    const maxOrder = categoriesRaw.length > 0
      ? Math.max(...categoriesRaw.map(c => c.display_order))
      : 0;
    const { error } = await supabase
      .from('categories')
      .insert({ name: newCatName.trim(), display_order: maxOrder + 1 });
    setCatSaving(false);
    if (error) {
      setCatMessage({ type: 'error', text: error.message.includes('duplicate') ? 'Cette catégorie existe déjà' : error.message });
      return;
    }
    setNewCatName('');
    setCatMessage({ type: 'success', text: 'Catégorie ajoutée ✅' });
    await fetchCategories();
  }

  async function updateCategoryName(id, newName) {
    if (!newName.trim()) {
      setCatMessage({ type: 'error', text: 'Le nom ne peut pas être vide' });
      return;
    }
    setCatSaving(true);
    setCatMessage({ type: '', text: '' });
    // Ancien nom pour mettre à jour les livres
    const oldCat = categoriesRaw.find(c => c.id === id);
    const oldName = oldCat ? oldCat.name : null;
    const { error } = await supabase
      .from('categories')
      .update({ name: newName.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setCatSaving(false);
      setCatMessage({ type: 'error', text: error.message.includes('duplicate') ? 'Ce nom existe déjà' : error.message });
      return;
    }
    // Met à jour les livres qui utilisent cette catégorie
    if (oldName && oldName !== newName.trim()) {
      await supabase.from('books').update({ category: newName.trim() }).eq('category', oldName);
    }
    setCatSaving(false);
    setEditingCatId(null);
    setEditingCatName('');
    setCatMessage({ type: 'success', text: 'Catégorie renommée ✅' });
    await fetchCategories();
  }

  async function deleteCategory(id, name) {
    // Vérifier si des livres utilisent cette catégorie
    const { count, error: countErr } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('category', name);
    if (countErr) {
      setCatMessage({ type: 'error', text: countErr.message });
      return;
    }
    let confirmMsg = `Supprimer la catégorie "${name}" ?`;
    if (count > 0) {
      confirmMsg = `⚠️ ATTENTION : ${count} livre(s) utilisent cette catégorie.\n\nSi tu supprimes "${name}", ces livres n'auront plus de catégorie.\n\nContinuer quand même ?`;
    }
    if (!window.confirm(confirmMsg)) return;
    setCatSaving(true);
    setCatMessage({ type: '', text: '' });
    const { error } = await supabase.from('categories').delete().eq('id', id);
    setCatSaving(false);
    if (error) {
      setCatMessage({ type: 'error', text: error.message });
      return;
    }
    setCatMessage({ type: 'success', text: `Catégorie "${name}" supprimée ✅` });
    await fetchCategories();
  }

  async function moveCategory(id, direction) {
    const idx = categoriesRaw.findIndex(c => c.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= categoriesRaw.length) return;
    const current = categoriesRaw[idx];
    const target = categoriesRaw[targetIdx];
    setCatSaving(true);
    await supabase.from('categories').update({ display_order: target.display_order }).eq('id', current.id);
    await supabase.from('categories').update({ display_order: current.display_order }).eq('id', target.id);
    setCatSaving(false);
    await fetchCategories();
  }

  async function addSubcategory(categoryId) {
    const name = (newSubName[categoryId] || '').trim();
    if (!name) {
      setCatMessage({ type: 'error', text: 'Le nom de la sous-catégorie est requis' });
      return;
    }
    setCatSaving(true);
    setCatMessage({ type: '', text: '' });
    const subsOfCat = subcategoriesRaw.filter(s => s.category_id === categoryId);
    const maxOrder = subsOfCat.length > 0
      ? Math.max(...subsOfCat.map(s => s.display_order))
      : 0;
    const { error } = await supabase
      .from('subcategories')
      .insert({ category_id: categoryId, name, display_order: maxOrder + 1 });
    setCatSaving(false);
    if (error) {
      setCatMessage({ type: 'error', text: error.message.includes('duplicate') ? 'Cette sous-catégorie existe déjà' : error.message });
      return;
    }
    setNewSubName(s => ({ ...s, [categoryId]: '' }));
    setCatMessage({ type: 'success', text: 'Sous-catégorie ajoutée ✅' });
    await fetchCategories();
  }

  async function updateSubcategoryName(id, newName) {
    if (!newName.trim()) {
      setCatMessage({ type: 'error', text: 'Le nom ne peut pas être vide' });
      return;
    }
    setCatSaving(true);
    setCatMessage({ type: '', text: '' });
    const oldSub = subcategoriesRaw.find(s => s.id === id);
    const oldName = oldSub ? oldSub.name : null;
    const { error } = await supabase
      .from('subcategories')
      .update({ name: newName.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setCatSaving(false);
      setCatMessage({ type: 'error', text: error.message.includes('duplicate') ? 'Ce nom existe déjà dans cette catégorie' : error.message });
      return;
    }
    // Met à jour les livres
    if (oldName && oldName !== newName.trim()) {
      await supabase.from('books').update({ subcategory: newName.trim() }).eq('subcategory', oldName);
    }
    setCatSaving(false);
    setEditingSubId(null);
    setEditingSubName('');
    setCatMessage({ type: 'success', text: 'Sous-catégorie renommée ✅' });
    await fetchCategories();
  }

  async function deleteSubcategory(id, name) {
    const { count, error: countErr } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('subcategory', name);
    if (countErr) {
      setCatMessage({ type: 'error', text: countErr.message });
      return;
    }
    let confirmMsg = `Supprimer la sous-catégorie "${name}" ?`;
    if (count > 0) {
      confirmMsg = `⚠️ ATTENTION : ${count} livre(s) utilisent cette sous-catégorie.\n\nContinuer quand même ?`;
    }
    if (!window.confirm(confirmMsg)) return;
    setCatSaving(true);
    setCatMessage({ type: '', text: '' });
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    setCatSaving(false);
    if (error) {
      setCatMessage({ type: 'error', text: error.message });
      return;
    }
    setCatMessage({ type: 'success', text: `Sous-catégorie "${name}" supprimée ✅` });
    await fetchCategories();
  }

  // ===== GESTION POD : Zones de livraison =====
  async function fetchShippingZones() {
    setZoneLoading(true);
    try {
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setShippingZones(data || []);
    } catch (err) {
      console.error('Erreur fetchShippingZones:', err);
      setZoneMessage({ type: 'error', text: 'Erreur de chargement' });
    }
    setZoneLoading(false);
  }

  async function addShippingZone() {
    if (!newZone.city.trim()) {
      setZoneMessage({ type: 'error', text: 'Le nom de la ville est requis' });
      return;
    }
    setZoneSaving(true);
    setZoneMessage({ type: '', text: '' });
    const maxOrder = shippingZones.length > 0
      ? Math.max(...shippingZones.map(z => z.display_order))
      : 0;
    const { error } = await supabase
      .from('shipping_zones')
      .insert({
        ...newZone,
        city: newZone.city.trim(),
        delivery_fee: parseInt(newZone.delivery_fee) || 0,
        delivery_days_min: parseInt(newZone.delivery_days_min) || 1,
        delivery_days_max: parseInt(newZone.delivery_days_max) || 3,
        display_order: maxOrder + 1
      });
    setZoneSaving(false);
    if (error) {
      setZoneMessage({ type: 'error', text: error.message.includes('duplicate') ? 'Cette ville existe déjà' : error.message });
      return;
    }
    setNewZone({ city: "", delivery_fee: 0, delivery_method: "agence", delivery_days_min: 1, delivery_days_max: 3, instructions: "", active: true });
    setZoneMessage({ type: 'success', text: 'Zone ajoutée ✅' });
    await fetchShippingZones();
  }

  async function updateShippingZone(id) {
    setZoneSaving(true);
    setZoneMessage({ type: '', text: '' });
    const { error } = await supabase
      .from('shipping_zones')
      .update({
        city: editingZone.city.trim(),
        delivery_fee: parseInt(editingZone.delivery_fee) || 0,
        delivery_method: editingZone.delivery_method,
        delivery_days_min: parseInt(editingZone.delivery_days_min) || 1,
        delivery_days_max: parseInt(editingZone.delivery_days_max) || 3,
        instructions: editingZone.instructions || '',
        active: editingZone.active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    setZoneSaving(false);
    if (error) {
      setZoneMessage({ type: 'error', text: error.message });
      return;
    }
    setEditingZoneId(null);
    setEditingZone({});
    setZoneMessage({ type: 'success', text: 'Zone mise à jour ✅' });
    await fetchShippingZones();
  }

  async function deleteShippingZone(id, city) {
    if (!window.confirm(`Supprimer la zone "${city}" ? Les commandes existantes garderont leurs informations.`)) return;
    setZoneSaving(true);
    const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
    setZoneSaving(false);
    if (error) {
      setZoneMessage({ type: 'error', text: error.message });
      return;
    }
    setZoneMessage({ type: 'success', text: `Zone "${city}" supprimée ✅` });
    await fetchShippingZones();
  }

  async function toggleZoneActive(id, currentActive) {
    setZoneSaving(true);
    const { error } = await supabase
      .from('shipping_zones')
      .update({ active: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    setZoneSaving(false);
    if (!error) await fetchShippingZones();
  }

  // ===== GESTION POD : Livres papier =====
  async function togglePaperVersion(bookId, currentValue) {
    setPaperSaving(true);
    const { error } = await supabase
      .from('books')
      .update({ has_paper_version: !currentValue })
      .eq('id', bookId);
    setPaperSaving(false);
    if (error) {
      setPaperMessage({ type: 'error', text: error.message });
      return;
    }
    await fetchBooks();
  }

  async function savePaperConfig(bookId) {
    setPaperSaving(true);
    setPaperMessage({ type: '', text: '' });
    const { error } = await supabase
      .from('books')
      .update({
        has_paper_version: true,
        paper_price: parseInt(editingPaper.paper_price) || 0,
        paper_stock: editingPaper.paper_stock === '' ? -1 : parseInt(editingPaper.paper_stock),
        paper_pages: parseInt(editingPaper.paper_pages) || null,
        paper_description: editingPaper.paper_description || null,
      })
      .eq('id', bookId);
    setPaperSaving(false);
    if (error) {
      setPaperMessage({ type: 'error', text: error.message });
      return;
    }
    setEditingPaperId(null);
    setEditingPaper({});
    setPaperMessage({ type: 'success', text: 'Configuration papier enregistrée ✅' });
    await fetchBooks();
  }

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

  // 🛍️ Commandes CarryShop (produits physiques, table dédiée)
  async function fetchCarryshopOrders() {
    try {
      const { data, error } = await supabase
        .from("carryshop_orders")
        .select("id, total, customer_phone, created_at, payment_status")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("CarryShop table absente ou erreur (cartes affichées à 0) :", error.message);
        setCarryshopOrders([]);
        return;
      }
      if (data) setCarryshopOrders(data);
    } catch (e) { console.error("Erreur fetch carryshop_orders:", e); setCarryshopOrders([]); }
  }

  // 💄 Commandes CarryColor (produits physiques, table dédiée)
  async function fetchCarrycolorOrders() {
    try {
      const { data, error } = await supabase
        .from("carrycolor_orders")
        .select("id, total, customer_phone, created_at, payment_status")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("CarryColor table absente ou erreur (cartes affichées à 0) :", error.message);
        setCarrycolorOrders([]);
        return;
      }
      if (data) setCarrycolorOrders(data);
    } catch (e) { console.error("Erreur fetch carrycolor_orders:", e); setCarrycolorOrders([]); }
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
          reward_pct_digital: String(data[0].reward_pct_digital ?? 20),
          reward_pct_physical: String(data[0].reward_pct_physical ?? 10),
          referred_discount_pct: String(data[0].referred_discount_pct ?? 10),
          min_withdrawal: String(data[0].min_withdrawal ?? 10000),
          fraud_delay_days: String(data[0].fraud_delay_days ?? 30),
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
    const pctDigital = parseFloat(refSettingsForm.reward_pct_digital);
    const pctPhysical = parseFloat(refSettingsForm.reward_pct_physical);
    const discount = parseFloat(refSettingsForm.referred_discount_pct);
    const minWd = parseInt(refSettingsForm.min_withdrawal);
    const delay = parseInt(refSettingsForm.fraud_delay_days);
    if (isNaN(pctDigital) || pctDigital < 0 || pctDigital > 100) { setRefSettingsMessage({ type: "error", text: "Commission digital entre 0 et 100%" }); return; }
    if (isNaN(pctPhysical) || pctPhysical < 0 || pctPhysical > 100) { setRefSettingsMessage({ type: "error", text: "Commission physique entre 0 et 100%" }); return; }
    if (isNaN(discount) || discount < 0 || discount > 100) { setRefSettingsMessage({ type: "error", text: "Réduction entre 0 et 100%" }); return; }
    if (!minWd || minWd < 100) { setRefSettingsMessage({ type: "error", text: "Minimum retrait au moins 100 F" }); return; }
    if (delay < 0) { setRefSettingsMessage({ type: "error", text: "Délai ne peut pas être négatif" }); return; }
    setRefSettingsSaving(true);
    const { error } = await supabase.from("referral_settings").update({
      reward_pct_digital: pctDigital,
      reward_pct_physical: pctPhysical,
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
    // Ventes des utilisateurs connectés
    const { data: purchases } = await supabase.from("purchases").select("amount, book_id, created_at");
    const { data: users } = await supabase.from("purchases").select("user_id");

    // 🎯 Ventes invités (sans compte)
    const { data: guestPurchases } = await supabase.from("guest_purchases").select("amount, book_id, phone, created_at");

    // 🛒 Ventes panier (commandes pay�es)
    const { data: cartOrders } = await supabase
      .from("cart_orders")
      .select("id, total, customer_phone, created_at")
      .eq("payment_status", "paid");

    // 🛒 Items des commandes panier (pour Top livres)
    const { data: cartItems } = await supabase
      .from("cart_order_items")
      .select("book_id, quantity, order_id");

    if (purchases) {
      // Combiner les revenus des 3 sources
      const totalPurchases = purchases.reduce((s, p) => s + (p.amount || 0), 0);
      const totalGuests = guestPurchases ? guestPurchases.reduce((s, p) => s + (p.amount || 0), 0) : 0;
      const totalCart = cartOrders ? cartOrders.reduce((s, o) => s + (o.total || 0), 0) : 0;
      const total = totalPurchases + totalGuests + totalCart;

      const uniqueUsers = users ? new Set(users.map(u => u.user_id)).size : 0;
      const uniqueGuests = guestPurchases ? new Set(guestPurchases.map(g => g.phone)).size : 0;
      const uniqueCartCustomers = cartOrders ? new Set(cartOrders.map(o => o.customer_phone)).size : 0;

      const bookCount = {};
      purchases.forEach(p => { bookCount[p.book_id] = (bookCount[p.book_id] || 0) + 1; });
      if (guestPurchases) {
        guestPurchases.forEach(g => { bookCount[g.book_id] = (bookCount[g.book_id] || 0) + 1; });
      }
      // Ajouter les items des commandes panier au top
      if (cartItems) {
        cartItems.forEach(i => { bookCount[i.book_id] = (bookCount[i.book_id] || 0) + (i.quantity || 1); });
      }
      const topBooks = Object.entries(bookCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id, count]) => ({ id: parseInt(id), count }));

      // Nombre total de transactions (commandes pay�es)
      const cartItemsCount = cartItems ? cartItems.reduce((s, i) => s + (i.quantity || 1), 0) : 0;
      const totalCount = purchases.length + (guestPurchases ? guestPurchases.length : 0) + cartItemsCount;

      setStats({
        totalRevenue: total,
        totalPurchases: totalCount,
        totalUsers: uniqueUsers + uniqueGuests + uniqueCartCustomers,
        topBooks,
        guestRevenue: totalGuests,
        guestCount: guestPurchases ? guestPurchases.length : 0,
        cartRevenue: totalCart,
        cartOrdersCount: cartOrders ? cartOrders.length : 0
      });
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

  // 🔄 Activer/Désactiver un compte parrain
  async function toggleReferrerActive(c) {
    const isActive = c.active !== false;
    const action = isActive ? "désactiver" : "activer";
    if (!window.confirm(`Voulez-vous vraiment ${action} le code parrainage "${c.code}" ?\n\n${isActive ? "Une fois désactivé, ce parrain ne pourra plus toucher de commissions sur les nouveaux achats." : "Le parrain pourra à nouveau toucher des commissions."}`)) return;
    try {
      const { error } = await supabase.from("referral_codes").update({ active: !isActive }).eq("id", c.id);
      if (error) throw new Error(error.message);
      alert(isActive ? "🚫 Code parrainage désactivé." : "✅ Code parrainage réactivé.");
      fetchReferralData();
    } catch (e) {
      console.error("toggleReferrerActive:", e);
      alert("❌ Erreur : " + e.message);
    }
  }

  // 🟢 APPROUVER une demande de retrait : déclenche le versement CamPay
  // 🔒 IDEMPOTENT : un seul clic peut déclencher un paiement, même en cas de double-clic rapide.
  async function approveWithdrawal(wd) {
    // 🔒 GARDE SYNCHRONE : si un versement est déjà en cours, on ignore tout clic supplémentaire.
    // (Le bouton est aussi désactivé visuellement, mais cette garde protège même en cas de clic ultra-rapide.)
    if (processingWithdrawalId) return;
    if (!window.confirm(`Approuver le versement de ${wd.amount.toLocaleString()} F vers ${wd.phone_number} ?`)) return;

    // 🔒 On marque CE retrait comme "en cours" → le bouton se grise immédiatement, double-clic impossible.
    setProcessingWithdrawalId(wd.id);
    try {

    // 🔒 VERROU ATOMIQUE : on passe pending -> processing UNIQUEMENT si la ligne est encore pending,
    // et on VÉRIFIE qu'une ligne a bien été capturée grâce à .select().
    // C'est ce contrôle du nombre de lignes qui empêche le double paiement :
    // le 2ᵉ clic ne capture aucune ligne (déjà processing) et s'arrête AVANT d'appeler CamPay.
    let claimed;
    try {
      const { data, error: lockErr } = await supabase
        .from("referral_withdrawals")
        .update({ status: "processing" })
        .eq("id", wd.id)
        .eq("status", "pending")   // condition atomique
        .select();                 // ⚠️ INDISPENSABLE : permet de savoir si une ligne a été capturée
      if (lockErr) {
        alert("❌ Erreur de verrouillage : " + lockErr.message);
        return;
      }
      claimed = data;
    } catch (e) {
      console.error("approveWithdrawal (verrou):", e);
      alert("❌ Erreur de verrouillage : " + e.message);
      return;
    }

    // 🚫 Aucune ligne capturée = la demande n'est plus "pending" (déjà cliquée / en cours / traitée).
    // On refuse le clic SANS jamais appeler CamPay.
    if (!claimed || claimed.length === 0) {
      alert("⚠️ Cette demande a déjà été traitée ou est en cours de versement. Aucun paiement effectué.");
      fetchReferralData();
      return;
    }

    // À partir d'ici, NOUS détenons le verrou. La ligne est en "processing", le bouton disparaît.
    fetchReferralData();

    try {
      // 1️⃣ LANCER le versement CamPay
      const payRes = await fetch("/api/campay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          amount: wd.amount,
          phone: wd.phone_number,
          description: "Récompense parrainage CarryBooks",
          external_reference: "WD_" + wd.id + "_" + Date.now()
        })
      });
      const payData = await payRes.json();

      // ❌ Pas de référence = CamPay a REFUSÉ la demande (rien n'est parti).
      // On affiche la réponse EXACTE de CamPay (c'est ce qui nous dit pourquoi) et on remet en "pending".
      if (!payData.reference) {
        const detail = payData.message || payData.detail || payData.error || JSON.stringify(payData);
        await supabase.from("referral_withdrawals")
          .update({ status: "pending", error_message: String(detail).slice(0, 480) })
          .eq("id", wd.id)
          .eq("status", "processing");
        alert(
          "❌ CamPay a REFUSÉ la demande de versement (aucun argent envoyé).\n\n" +
          "Réponse de CamPay :\n" + JSON.stringify(payData, null, 2) + "\n\n" +
          "La demande est remise en attente."
        );
        fetchReferralData();
        return;
      }

      // 2️⃣ Référence reçue = CamPay a ACCEPTÉ le versement. L'argent part vers le téléphone.
      // On marque TOUT DE SUITE comme "approved" (versement déclenché) et on incrémente total_paid.
      // (CamPay confirme le SUCCESSFUL quelques minutes plus tard ; inutile de faire attendre l'admin.)
      await supabase.from("referral_withdrawals").update({
        status: "approved",
        campay_reference: payData.reference,
        completed_at: new Date().toISOString()
      }).eq("id", wd.id);

      const { data: rc } = await supabase.from("referral_codes").select("total_paid").eq("user_id", wd.user_id).single();
      await supabase.from("referral_codes").update({
        total_paid: (rc?.total_paid || 0) + wd.amount
      }).eq("user_id", wd.user_id);

      alert(
        "✅ Versement de " + wd.amount.toLocaleString() + " F déclenché vers " + wd.phone_number + " !\n\n" +
        "L'argent est en route (référence CamPay : " + payData.reference + ").\n" +
        "Il arrive généralement en quelques minutes."
      );
      fetchReferralData();
    } catch (e) {
      // ⚠️ CAS AMBIGU (timeout / coupure réseau pendant l'appel withdraw lui-même).
      // On NE remet PAS en "pending" (risque de double paiement). On laisse en "processing".
      console.error("approveWithdrawal (CamPay):", e);
      alert(
        "⚠️ Connexion interrompue pendant l'appel à CamPay.\n\n" +
        "La demande reste en \"⏳ En cours\" par sécurité (bouton désactivé).\n" +
        "Vérifie dans CamPay si le versement de " + wd.amount.toLocaleString() + " F est parti :\n" +
        "• S'il EST parti → ne touche à rien.\n" +
        "• S'il N'EST PAS parti → rejette la demande pour recréditer le parrain, puis recommence."
      );
      fetchReferralData();
    }
    } finally {
      // ✅ Quoi qu'il arrive (succès, échec, refus, erreur), on réactive le bouton.
      setProcessingWithdrawalId(null);
    }
  }

  // 🚫 REJETER une demande de retrait : remettre l'argent dans le solde du parrain
  async function rejectWithdrawal(wd) {
    const reason = window.prompt("Motif du rejet (visible par le parrain) :");
    if (reason === null) return; // Annulé
    if (!reason.trim()) { alert("Le motif est obligatoire"); return; }
    try {
      // Remettre l'argent dans available_amount
      const { data: rc } = await supabase.from("referral_codes").select("available_amount").eq("user_id", wd.user_id).single();
      await supabase.from("referral_codes").update({
        available_amount: (rc?.available_amount || 0) + wd.amount
      }).eq("user_id", wd.user_id);
      // Marquer la demande comme rejected
      await supabase.from("referral_withdrawals").update({
        status: "rejected",
        error_message: reason.trim()
      }).eq("id", wd.id);
      alert("🚫 Demande rejetée. L'argent a été remis dans le solde du parrain.");
      fetchReferralData();
    } catch (e) {
      console.error("rejectWithdrawal:", e);
      alert("❌ Erreur : " + e.message);
    }
  }

  async function fetchUserStats() {
    try {
      const { data, error } = await supabase.rpc("get_user_stats");
      if (error) { console.error("UserStats error:", error); return; }
      if (data && data.length > 0) {
        setUserStats({
          total_users: Number(data[0].total_users) || 0,
          new_today: Number(data[0].new_today) || 0,
          new_this_week: Number(data[0].new_this_week) || 0,
          new_this_month: Number(data[0].new_this_month) || 0,
        });
      }
    } catch (e) {
      console.error("fetchUserStats exception:", e);
    }
  }

  async function fetchUsers() {
    const { data, error } = await supabase
      .from("purchases")
      .select("user_id, book_id, created_at, amount, type")
      .order("created_at", { ascending: false });
    if (error) { console.error("Purchases error:", error); }

    // 🎯 Ajouter les achats invités
    const { data: guestData, error: guestError } = await supabase
      .from("guest_purchases")
      .select("phone, book_id, created_at, amount, type, recovered_by_user_id")
      .order("created_at", { ascending: false });
    if (guestError) { console.error("Guest purchases error:", guestError); }

    // Combiner les 2 (marquer les invités avec phone au lieu de user_id)
    const combined = [
      ...(data || []),
      ...((guestData || []).map(g => ({
        user_id: "📱 " + g.phone + (g.recovered_by_user_id ? " (récupéré)" : " (invité)"),
        book_id: g.book_id,
        created_at: g.created_at,
        amount: g.amount,
        type: "sale"
      })))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setUsers(combined);
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
    if (!form.title || !form.author) return;
    setSaving(true);

    // Helper pour convertir une valeur en INTEGER ou -1 par défaut (pour stocks)
    const toStockInt = (val) => {
      if (val === undefined || val === null || val === "") return -1;
      const n = parseInt(val);
      return isNaN(n) ? -1 : n;
    };
    const toPriceInt = (val) => {
      if (val === undefined || val === null || val === "") return 0;
      const n = parseInt(val);
      return isNaN(n) ? 0 : n;
    };
    // Helper : convertit en INT ou retourne null si vide
    const toIntOrNull = (val) => {
      if (val === undefined || val === null || val === "") return null;
      const n = parseInt(val);
      return isNaN(n) ? null : n;
    };

    // Construction du payload : on nettoie TOUS les champs INTEGER pour éviter les ""
    const priceInt = toPriceInt(form.price);
    const payload = {
      ...form,
      // Champs INTEGER : on les nettoie tous, JAMAIS de string vide vers Supabase
      price: priceInt,
      original_price: toIntOrNull(form.original_price),
      paper_price: toIntOrNull(form.paper_price),
      paper_stock: toStockInt(form.paper_stock),
      paper_pages: toIntOrNull(form.paper_pages),
      stock: toStockInt(form.stock),
      extract_pages: toIntOrNull(form.extract_pages) || 5,
    };

    // Mapping spécial selon le type de produit
    if (form.product_type === "papier") {
      // Le prix saisi dans le champ "PRIX" est stock� dans form.paper_price (via onChange custom)
      // ET aussi dans form.price (en backup). On prend le max des deux pour �tre s�rs.
      const paperPriceFromForm = toIntOrNull(form.paper_price);
      const priceFromForm = toIntOrNull(form.price);
      const finalPaperPrice = paperPriceFromForm || priceFromForm || 0;
      payload.paper_price = finalPaperPrice;
      payload.price = 0;
      payload.has_paper_version = true;
      payload.paper_description = form.paper_description || null;
      payload.allow_oversell = !!form.allow_oversell;
      console.log("📦 [PAPIER] Prix final envoy� en BDD :", { paper_price: finalPaperPrice, price: 0, from_form: { price: form.price, paper_price: form.paper_price } });
    } else if (form.product_type === "mixte") {
      payload.has_paper_version = true;
      payload.paper_price = toIntOrNull(form.paper_price) || priceInt;
      payload.paper_description = form.paper_description || null;
      payload.allow_oversell = !!form.allow_oversell;
    } else if (form.product_type === "article") {
      payload.has_paper_version = false;
      payload.paper_price = 0;
      payload.allow_oversell = !!form.allow_oversell;
    } else if (form.product_type === "audio") {
      payload.has_paper_version = false;
      payload.paper_price = 0;
      payload.allow_oversell = false;
    } else {
      // numerique
      payload.has_paper_version = false;
      payload.paper_price = 0;
      payload.allow_oversell = false;
    }

    // 🐛 Debug : afficher le payload envoyé
    console.log("📤 Payload envoyé à Supabase :", payload);

    let result;
    if (editingBook) {
      result = await supabase.from("books").update(payload).eq("id", editingBook.id).select();
    } else {
      result = await supabase.from("books").insert([payload]).select();
    }

    // 🐛 Debug : afficher le résultat
    if (result.error) {
      console.error("❌ Erreur Supabase :", result.error);
      alert("Erreur lors de la sauvegarde : " + result.error.message);
    } else {
      console.log("✅ Réponse Supabase :", result.data);
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
      price: book.price === null || book.price === undefined ? "" : String(book.price),
      original_price: book.original_price ? String(book.original_price) : "",
      product_type: book.product_type || "numerique",
      stock: book.stock !== undefined ? book.stock : -1,
      images: book.images || [],
      audio_access_mode: book.audio_access_mode || "sale",
      paper_pages: book.paper_pages || "",
      paper_description: book.paper_description || "",
      paper_stock: book.paper_stock !== undefined && book.paper_stock !== null ? book.paper_stock : -1,
      paper_price: book.paper_price ? String(book.paper_price) : "",
      allow_oversell: !!book.allow_oversell
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

  // 🛍️ Revenus CarryShop (produits physiques)
  const revenueCarryShop = carryshopOrders.reduce((s, o) => s + (o.total || 0), 0);

  // 💄 Revenus CarryColor (produits physiques)
  const revenueCarryColor = carrycolorOrders.reduce((s, o) => s + (o.total || 0), 0);

  // 💰 TOTAL CA
  const grandTotalRevenue = revenueBooks + revenueSubscriptions + revenueQuiz + revenueCarryCare + revenueCarryShop + revenueCarryColor;

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
  // 🛍️ CarryShop aujourd'hui
  const todayCarryShopRevenue = carryshopOrders.filter(o => {
    if (!o.created_at) return false;
    return new Date(o.created_at) >= today;
  }).reduce((s, o) => s + (o.total || 0), 0);
  const todayCarryShopCount = carryshopOrders.filter(o => {
    if (!o.created_at) return false;
    return new Date(o.created_at) >= today;
  }).length;
  // 💄 CarryColor aujourd'hui
  const todayCarryColorRevenue = carrycolorOrders.filter(o => {
    if (!o.created_at) return false;
    return new Date(o.created_at) >= today;
  }).reduce((s, o) => s + (o.total || 0), 0);
  const todayCarryColorCount = carrycolorOrders.filter(o => {
    if (!o.created_at) return false;
    return new Date(o.created_at) >= today;
  }).length;
  const grandTodayRevenue = todayBooksRevenue + todaySubsRevenue + todayQuizRevenue + todayCarryCareRevenue + todayCarryShopRevenue + todayCarryColorRevenue;

  // ========== 📊 STATS HIER / 7 JOURS / 30 JOURS ==========
  // Bornes temporelles
  const yesterdayStart = new Date(today);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(today); // exclusif (= début d'aujourd'hui)
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(today);
  monthStart.setDate(monthStart.getDate() - 30);

  // Helper : calcule revenu + count d'un dataset entre deux dates
  function rangeRevenue(items, startDate, endDate, amountKey = "amount", dateKey = "created_at") {
    const filtered = items.filter(it => {
      const d = it[dateKey];
      if (!d) return false;
      const dt = new Date(d);
      if (endDate) return dt >= startDate && dt < endDate;
      return dt >= startDate;
    });
    const revenue = filtered.reduce((s, it) => s + (it[amountKey] || 0), 0);
    return { revenue, count: filtered.length };
  }

  // 🟡 HIER (entre yesterdayStart et yesterdayEnd)
  const yBooks = rangeRevenue(realSales, yesterdayStart, yesterdayEnd, "amount", "created_at");
  const ySubs = rangeRevenue(subscribers, yesterdayStart, yesterdayEnd, "price", "started_at");
  const yQuiz = rangeRevenue(quizPayments, yesterdayStart, yesterdayEnd);
  const yCare = rangeRevenue(carrycarePayments.filter(p => (p.amount || 0) > 0), yesterdayStart, yesterdayEnd);
  const yShop = rangeRevenue(carryshopOrders, yesterdayStart, yesterdayEnd, "total");
  const yColor = rangeRevenue(carrycolorOrders, yesterdayStart, yesterdayEnd, "total");
  const yesterdayTotal = yBooks.revenue + ySubs.revenue + yQuiz.revenue + yCare.revenue + yShop.revenue + yColor.revenue;
  const yesterdayCount = yBooks.count + ySubs.count + yQuiz.count + yCare.count + yShop.count + yColor.count;

  // 🟢 7 DERNIERS JOURS (du weekStart à maintenant)
  const wBooks = rangeRevenue(realSales, weekStart, null, "amount", "created_at");
  const wSubs = rangeRevenue(subscribers, weekStart, null, "price", "started_at");
  const wQuiz = rangeRevenue(quizPayments, weekStart, null);
  const wCare = rangeRevenue(carrycarePayments.filter(p => (p.amount || 0) > 0), weekStart, null);
  const wShop = rangeRevenue(carryshopOrders, weekStart, null, "total");
  const wColor = rangeRevenue(carrycolorOrders, weekStart, null, "total");
  const weekTotal = wBooks.revenue + wSubs.revenue + wQuiz.revenue + wCare.revenue + wShop.revenue + wColor.revenue;
  const weekCount = wBooks.count + wSubs.count + wQuiz.count + wCare.count + wShop.count + wColor.count;

  // 🔵 30 DERNIERS JOURS
  const mBooks = rangeRevenue(realSales, monthStart, null, "amount", "created_at");
  const mSubs = rangeRevenue(subscribers, monthStart, null, "price", "started_at");
  const mQuiz = rangeRevenue(quizPayments, monthStart, null);
  const mCare = rangeRevenue(carrycarePayments.filter(p => (p.amount || 0) > 0), monthStart, null);
  const mShop = rangeRevenue(carryshopOrders, monthStart, null, "total");
  const mColor = rangeRevenue(carrycolorOrders, monthStart, null, "total");
  const monthTotal = mBooks.revenue + mSubs.revenue + mQuiz.revenue + mCare.revenue + mShop.revenue + mColor.revenue;
  const monthCount = mBooks.count + mSubs.count + mQuiz.count + mCare.count + mShop.count + mColor.count;

  // 📖 Total lectures
  const totalBookViews = bookViews.length;

  const activeBooks = books.filter(b => b.status === "actif").length;
  const totalSales = realSales.length;
  const totalSubscriptionUnlocks = subscriptionUnlocks.length;
  const totalFreeUnlocks = freeUnlocks.length;

  // 🃏 Helper : rend une carte de source de revenus avec breakdown Total / Aujourd'hui / Hier / 7j / 30j
  function renderSourceCard(d) {
    const u = d.unit;
    const plural = (n) => n > 1 ? u + "s" : u;
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{d.icon}</span>
          <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>{d.name}</span>
          {d.subLabel && <span style={{ fontSize: 10, color: "#666", marginLeft: "auto" }}>{d.subLabel}</span>}
        </div>
        {/* Ligne 1 : Total + Aujourd'hui */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #2a2a2a" }}>
          <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: d.color }}>{d.total.toLocaleString()} F</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{d.cntTotal} {plural(d.cntTotal)}</div>
          </div>
          <div style={{ padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{d.today.toLocaleString()} F</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{d.cntToday} {plural(d.cntToday)}</div>
          </div>
        </div>
        {/* Ligne 2 : Hier / 7j / 30j */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#141414" }}>
          <div style={{ padding: "8px 4px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#9d7fff", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Hier</div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#9d7fff" }}>{d.yesterday.toLocaleString()} F</div>
            <div style={{ fontSize: 9, color: "#555" }}>{d.cntYesterday}</div>
          </div>
          <div style={{ padding: "8px 4px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>7 jours</div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#aaa" }}>{d.w7.toLocaleString()} F</div>
            <div style={{ fontSize: 9, color: "#555" }}>{d.cnt7}</div>
          </div>
          <div style={{ padding: "8px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>30 jours</div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#aaa" }}>{d.m30.toLocaleString()} F</div>
            <div style={{ fontSize: 9, color: "#555" }}>{d.cnt30}</div>
          </div>
        </div>
      </div>
    );
  }

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
            { id: "books", label: "Produits", icon: "📚" },
            { id: "categories", label: "Catégories", icon: "🗂️" },
            { id: "users", label: "Utilisateurs", icon: "👥" },
            { id: "subscription", label: "Abonnements", icon: "⭐" },
            { id: "promos", label: "Codes Promo", icon: "🎟️" },
            { id: "referrals", label: "Parrainages", icon: "🎁" },
            { id: "referral_settings", label: "Paramètres parrainage", icon: "⚙️" },
            { id: "comptabilite", label: "Comptabilité", icon: "💰" },
            { id: "reviews", label: "Modération avis", icon: "💬" },
            { id: "stats", label: "Statistiques", icon: "📈" },
            { id: "pwa_stats", label: "Stats PWA", icon: "📱" },
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

            {/* SECTION DÉTAIL PAR SOURCE — PRODUITS NUMÉRIQUES */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>📱 Produits numériques</div>
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

            {/* SECTION DÉTAIL PAR SOURCE — PRODUITS PHYSIQUES (CarryShop + CarryColor) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>📦 Produits physiques</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* 🛍️ CARRYSHOP */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🛍️</span>
                    <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>CarryShop</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#c9a84c" }}>{revenueCarryShop.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{carryshopOrders.length} commande{carryshopOrders.length > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{todayCarryShopRevenue.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{todayCarryShopCount} commande{todayCarryShopCount > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>

                {/* 💄 CARRYCOLOR */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💄</span>
                    <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: "bold" }}>CarryColor</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "12px", borderRight: "1px solid #2a2a2a", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#c9a84c" }}>{revenueCarryColor.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{carrycolorOrders.length} commande{carrycolorOrders.length > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Aujourd'hui</div>
                      <div style={{ fontSize: 16, fontWeight: "bold", color: "#4caf50" }}>{todayCarryColorRevenue.toLocaleString()} F</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{todayCarryColorCount} commande{todayCarryColorCount > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 📊 SECTION HIER / 7 JOURS / 30 JOURS (toutes sources confondues) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>📊 Périodes (toutes sources)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {/* HIER */}
                <div style={{ background: "linear-gradient(135deg, #2a2418 0%, #1f1a10 100%)", border: "1px solid #c9a84c44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>🟡 Hier</div>
                  <div style={{ fontSize: 15, fontWeight: "bold", color: "#c9a84c", lineHeight: 1.1 }}>{yesterdayTotal.toLocaleString()} F</div>
                  <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>{yesterdayCount} transaction{yesterdayCount > 1 ? "s" : ""}</div>
                </div>
                {/* 7 JOURS */}
                <div style={{ background: "linear-gradient(135deg, #102818 0%, #0a1f12 100%)", border: "1px solid #4caf5044", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#4caf50", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>🟢 7 jours</div>
                  <div style={{ fontSize: 15, fontWeight: "bold", color: "#4caf50", lineHeight: 1.1 }}>{weekTotal.toLocaleString()} F</div>
                  <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>{weekCount} transaction{weekCount > 1 ? "s" : ""}</div>
                </div>
                {/* 30 JOURS */}
                <div style={{ background: "linear-gradient(135deg, #101e2a 0%, #0a151f 100%)", border: "1px solid #4a9eff44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#4a9eff", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>🔵 30 jours</div>
                  <div style={{ fontSize: 15, fontWeight: "bold", color: "#4a9eff", lineHeight: 1.1 }}>{monthTotal.toLocaleString()} F</div>
                  <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>{monthCount} transaction{monthCount > 1 ? "s" : ""}</div>
                </div>
              </div>

              {/* Détail par source dans chaque période */}
              <div style={{ marginTop: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 6, fontSize: 10, color: "#888", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #2a2a2a", letterSpacing: 1, textTransform: "uppercase" }}>
                  <div>Source</div>
                  <div style={{ textAlign: "right", color: "#c9a84c" }}>Hier</div>
                  <div style={{ textAlign: "right", color: "#4caf50" }}>7 j</div>
                  <div style={{ textAlign: "right", color: "#4a9eff" }}>30 j</div>
                </div>
                {[
                  { label: "📚 Livres", y: yBooks, w: wBooks, m: mBooks },
                  { label: "⭐ Abonnements", y: ySubs, w: wSubs, m: mSubs },
                  { label: "🎯 Quiz", y: yQuiz, w: wQuiz, m: mQuiz },
                  { label: "💜 CarryCare", y: yCare, w: wCare, m: mCare },
                  { label: "🛍️ CarryShop", y: yShop, w: wShop, m: mShop },
                  { label: "💄 CarryColor", y: yColor, w: wColor, m: mColor },
                ].map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 6, fontSize: 11, padding: "6px 0", borderBottom: i < 5 ? "1px solid #1f1f1f" : "none" }}>
                    <div style={{ color: "#e8e0d0" }}>{row.label}</div>
                    <div style={{ textAlign: "right", color: row.y.revenue > 0 ? "#c9a84c" : "#555" }}>{row.y.revenue.toLocaleString()}</div>
                    <div style={{ textAlign: "right", color: row.w.revenue > 0 ? "#4caf50" : "#555" }}>{row.w.revenue.toLocaleString()}</div>
                    <div style={{ textAlign: "right", color: row.m.revenue > 0 ? "#4a9eff" : "#555" }}>{row.m.revenue.toLocaleString()}</div>
                  </div>
                ))}
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

        {/* BOOKS / PRODUITS */}
        {view === "books" && productSubView === null && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, color: "#c9a84c", marginBottom: 6 }}>📚 Produits</h1>
              <p style={{ color: "#888", fontSize: 13 }}>Choisis le type de produit que tu veux gérer</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {/* CARTE 1 : LIVRES NUMÉRIQUES */}
              <div
                onClick={() => { setProductSubView("digital"); setProductSubTab("list"); }}
                style={{
                  background: "#1a1a1a",
                  border: "2px solid #2a2a2a",
                  borderRadius: 12,
                  padding: 20,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a84c"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📖</div>
                <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>Livres Numériques</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>PDF, Liseuse, Mixte</div>
                <div style={{ display: "inline-block", padding: "4px 10px", background: "#c9a84c22", border: "1px solid #c9a84c", borderRadius: 20, fontSize: 12, color: "#c9a84c", fontWeight: "bold" }}>
                  {books.filter(b => b.product_type !== 'papier' && b.product_type !== 'article' && b.product_type !== 'audio').length} produits
                </div>
              </div>

              {/* CARTE 2 : LIVRES PHYSIQUES */}
              <div
                onClick={() => { setProductSubView("physical"); setProductSubTab("list"); }}
                style={{
                  background: "#1a1a1a",
                  border: "2px solid #2a2a2a",
                  borderRadius: 12,
                  padding: 20,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a84c"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>Livres Physiques</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Livres papier</div>
                <div style={{ display: "inline-block", padding: "4px 10px", background: "#c9a84c22", border: "1px solid #c9a84c", borderRadius: 20, fontSize: 12, color: "#c9a84c", fontWeight: "bold" }}>
                  {books.filter(b => b.product_type === 'papier').length} produits
                </div>
              </div>

              {/* CARTE 3 : ARTICLES DIVERS */}
              <div
                onClick={() => { setProductSubView("article"); setProductSubTab("list"); }}
                style={{
                  background: "#1a1a1a",
                  border: "2px solid #2a2a2a",
                  borderRadius: 12,
                  padding: 20,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a84c"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎨</div>
                <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>Articles Divers</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Feutres, pinceaux, etc.</div>
                <div style={{ display: "inline-block", padding: "4px 10px", background: "#c9a84c22", border: "1px solid #c9a84c", borderRadius: 20, fontSize: 12, color: "#c9a84c", fontWeight: "bold" }}>
                  {books.filter(b => b.product_type === 'article').length} produits
                </div>
              </div>

              {/* CARTE 4 : LIVRES AUDIO & PODCASTS */}
              <div
                onClick={() => { setProductSubView("audio"); setProductSubTab("list"); }}
                style={{
                  background: "#1a1a1a",
                  border: "2px solid #2a2a2a",
                  borderRadius: 12,
                  padding: 20,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a84c"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎧</div>
                <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>Livres Audio & Podcasts</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>MP3, MP4, vidéo</div>
                <div style={{ display: "inline-block", padding: "4px 10px", background: "#c9a84c22", border: "1px solid #c9a84c", borderRadius: 20, fontSize: 12, color: "#c9a84c", fontWeight: "bold" }}>
                  {books.filter(b => b.product_type === 'audio').length} produits
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOOKS / PRODUITS — SOUS-VUE (liste filtrée par type) */}
        {view === "books" && productSubView !== null && (
          <div>
            {/* Header avec bouton retour */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => { setProductSubView(null); setProductSubTab("list"); }}
                style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, padding: "8px 14px", color: "#c9a84c", cursor: "pointer", fontSize: 12, marginBottom: 12 }}
              >
                ← Retour aux produits
              </button>
              <h1 style={{ fontSize: 22, color: "#c9a84c", margin: 0 }}>
                {productSubView === "digital" && "📖 Livres Numériques"}
                {productSubView === "physical" && "📦 Livres Physiques"}
                {productSubView === "article" && "🎨 Articles Divers"}
                {productSubView === "audio" && "🎧 Livres Audio & Podcasts"}
              </h1>
            </div>

            {/* SOUS-VUE : Audio/Podcasts (similaire aux autres) */}
            {productSubView === "audio" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, color: "#aaa", margin: 0 }}>
                    {books.filter(b => b.product_type === 'audio').length} produit{books.filter(b => b.product_type === 'audio').length > 1 ? "s" : ""}
                  </h2>
                  <button
                    onClick={() => {
                      setEditingBook(null);
                      setForm({ ...emptyForm, product_type: "audio" });
                      setShowForm(true);
                      setActiveTab("info");
                    }}
                    style={{ background: "#c9a84c", color: "#000", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}
                  >
                    + AJOUTER
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {books.filter(b => b.product_type === 'audio').length === 0 ? (
                    <div style={{ background: "#1a1a1a", border: "1px dashed #2a2a2a", borderRadius: 10, padding: 32, textAlign: "center", color: "#666" }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🎧</div>
                      <div style={{ fontSize: 13, marginBottom: 12 }}>Aucun livre audio ou podcast</div>
                      <div style={{ fontSize: 11, color: "#555" }}>Clique sur "+ AJOUTER" pour créer ton premier audio/podcast</div>
                    </div>
                  ) : (
                    books.filter(b => b.product_type === 'audio').map(book => (
                      <div key={book.id} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                        {book.cover
                          ? <img src={book.cover} alt={book.title} style={{ width: 60, height: 84, objectFit: "cover", borderRadius: 4 }} />
                          : <div style={{ width: 60, height: 84, background: "#2a2a2a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🎧</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#fff", fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>{book.title}</div>
                          <div style={{ color: "#888", fontSize: 12 }}>{book.author} • {book.audio_access_mode === "free" ? "🆓 Gratuit" : book.audio_access_mode === "subscription" ? "⭐ Abonnement" : "💰 " + (book.price || 0) + " F"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => openEdit(book)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✏️</button>
                          <button onClick={() => handleDelete(book.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>🗑️</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* SOUS-VUE : Digital/Physical/Article — onglets + liste */}
            {productSubView !== "audio" && (
              <>
                {/* Onglets internes (pour Physical et Article qui ont plusieurs sections) */}
                {(productSubView === "physical" || productSubView === "article") && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #2a2a2a" }}>
                    <button
                      onClick={() => setProductSubTab("list")}
                      style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: "2px solid " + (productSubTab === "list" ? "#c9a84c" : "transparent"), color: productSubTab === "list" ? "#c9a84c" : "#888", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
                    >
                      📋 Liste
                    </button>
                    <button
                      onClick={() => setProductSubTab("shipping")}
                      style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: "2px solid " + (productSubTab === "shipping" ? "#c9a84c" : "transparent"), color: productSubTab === "shipping" ? "#c9a84c" : "#888", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
                    >
                      🚚 Zones de livraison
                    </button>
                  </div>
                )}

                {/* ONGLET LIST : la liste des produits filtrée */}
                {productSubTab === "list" && (
                  <div>
                    {/* 🆕 Filtres stock + recherche */}
                    {(() => {
                      const baseList = books.filter(b => {
                        if (productSubView === "digital") return b.product_type !== 'papier' && b.product_type !== 'article' && b.product_type !== 'audio';
                        if (productSubView === "physical") return b.product_type === 'papier';
                        if (productSubView === "article") return b.product_type === 'article';
                        return false;
                      });
                      // Compteur rupture
                      const isOut = b => {
                        const isArt = b.product_type === 'article';
                        const isPaper = b.product_type === 'papier';
                        if (!isArt && !isPaper) return false;
                        const s = isArt ? b.stock : b.paper_stock;
                        if (s === null || s === undefined || s === -1) return false;
                        return s === 0 && !b.allow_oversell;
                      };
                      const outCount = baseList.filter(isOut).length;
                      const isPhysical = productSubView === "article" || productSubView === "physical";
                      return (
                        <>
                          {/* Barre recherche */}
                          <div style={{ marginBottom: 12 }}>
                            <input
                              type="text"
                              value={productSearch}
                              onChange={e => setProductSearch(e.target.value)}
                              placeholder="🔍 Rechercher un produit (titre, auteur, catégorie...)"
                              style={{ width: "100%", padding: "10px 14px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#fff", fontSize: 13, boxSizing: "border-box" }}
                            />
                          </div>

                          {/* Filtres stock (uniquement pour articles et physical) */}
                          {isPhysical && (
                            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                              <button onClick={() => setStockFilter("all")}
                                style={{ padding: "6px 14px", border: "1px solid " + (stockFilter === "all" ? "#c9a84c" : "#2a2a2a"), background: stockFilter === "all" ? "rgba(201,168,76,0.15)" : "transparent", color: stockFilter === "all" ? "#c9a84c" : "#aaa", borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                Tous ({baseList.length})
                              </button>
                              <button onClick={() => setStockFilter("inStock")}
                                style={{ padding: "6px 14px", border: "1px solid " + (stockFilter === "inStock" ? "#4caf50" : "#2a2a2a"), background: stockFilter === "inStock" ? "rgba(76,175,80,0.15)" : "transparent", color: stockFilter === "inStock" ? "#4caf50" : "#aaa", borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                ✓ En stock ({baseList.length - outCount})
                              </button>
                              <button onClick={() => setStockFilter("outOfStock")}
                                style={{ padding: "6px 14px", border: "1px solid " + (stockFilter === "outOfStock" ? "#f44336" : "#2a2a2a"), background: stockFilter === "outOfStock" ? "rgba(244,67,54,0.15)" : "transparent", color: stockFilter === "outOfStock" ? "#f44336" : "#aaa", borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                🚫 Rupture ({outCount})
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h2 style={{ fontSize: 15, color: "#aaa", margin: 0 }}>
                        {(() => {
                          const isOut = b => {
                            const isArt = b.product_type === 'article';
                            const isPaper = b.product_type === 'papier';
                            if (!isArt && !isPaper) return false;
                            const s = isArt ? b.stock : b.paper_stock;
                            if (s === null || s === undefined || s === -1) return false;
                            return s === 0 && !b.allow_oversell;
                          };
                          const q = productSearch.toLowerCase().trim();
                          const filtered = books.filter(b => {
                            if (productSubView === "digital") { if (b.product_type === 'papier' || b.product_type === 'article' || b.product_type === 'audio') return false; }
                            else if (productSubView === "physical") { if (b.product_type !== 'papier') return false; }
                            else if (productSubView === "article") { if (b.product_type !== 'article') return false; }
                            else return false;
                            if (stockFilter === "outOfStock" && !isOut(b)) return false;
                            if (stockFilter === "inStock" && isOut(b)) return false;
                            if (q && !(b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q) || b.subcategory?.toLowerCase().includes(q))) return false;
                            return true;
                          });
                          return filtered.length + " produit" + (filtered.length > 1 ? "s" : "") + (productSearch || stockFilter !== "all" ? " (filtré)" : "");
                        })()}
                      </h2>
                      <button
                        onClick={() => {
                          // Pré-sélectionner le type selon la sous-vue
                          let presetType = "numerique";
                          if (productSubView === "physical") presetType = "papier";
                          if (productSubView === "article") presetType = "article";
                          setEditingBook(null);
                          setForm({ ...emptyForm, product_type: presetType });
                          setShowForm(true);
                          setActiveTab("info");
                        }}
                        style={{ background: "#c9a84c", color: "#000", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}
                      >
                        + AJOUTER
                      </button>
                    </div>

                    {/* Liste des produits filtrée selon la sous-vue + recherche + stock */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {(() => {
                        const isOut = b => {
                          const isArt = b.product_type === 'article';
                          const isPaper = b.product_type === 'papier';
                          if (!isArt && !isPaper) return false;
                          const s = isArt ? b.stock : b.paper_stock;
                          if (s === null || s === undefined || s === -1) return false;
                          return s === 0 && !b.allow_oversell;
                        };
                        const q = productSearch.toLowerCase().trim();
                        const filtered = books.filter(b => {
                          if (productSubView === "digital") { if (b.product_type === 'papier' || b.product_type === 'article' || b.product_type === 'audio') return false; }
                          else if (productSubView === "physical") { if (b.product_type !== 'papier') return false; }
                          else if (productSubView === "article") { if (b.product_type !== 'article') return false; }
                          else return false;
                          if (stockFilter === "outOfStock" && !isOut(b)) return false;
                          if (stockFilter === "inStock" && isOut(b)) return false;
                          if (q && !(b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q) || b.subcategory?.toLowerCase().includes(q))) return false;
                          return true;
                        });
                        return filtered.length === 0 ? (
                        <div style={{ background: "#1a1a1a", border: "1px dashed #2a2a2a", borderRadius: 10, padding: 32, textAlign: "center", color: "#666" }}>
                          <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                          <div style={{ fontSize: 13, marginBottom: 12 }}>
                            {productSearch || stockFilter !== "all" ? "Aucun produit ne correspond aux filtres" : "Aucun produit dans cette catégorie"}
                          </div>
                          {(productSearch || stockFilter !== "all") && (
                            <button onClick={() => { setProductSearch(""); setStockFilter("all"); }} style={{ background: "#2a2a2a", color: "#c9a84c", border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                              Réinitialiser les filtres
                            </button>
                          )}
                        </div>
                      ) : (
                        filtered.map(book => {
                          const ruptured = isOut(book);
                          return (
                <div key={book.id} style={{ background: "#1a1a1a", border: "1px solid " + (ruptured ? "#7a1a1a" : "#2a2a2a"), borderRadius: 8, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {book.cover
                    ? <img src={book.cover} alt="" style={{ width: 50, height: 70, objectFit: "cover", flexShrink: 0, filter: ruptured ? "grayscale(60%) brightness(0.7)" : "none" }} />
                    : <div style={{ width: 50, height: 70, background: "#2a2a2a", flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "#e8e0d0", marginBottom: 2, fontWeight: "bold" }}>{book.title}</div>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{book.author}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#c9a84c" }}>{book.price === 0 ? "Gratuit" : `${book.price?.toLocaleString()} F`}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{book.category}{book.subcategory ? " › " + book.subcategory : ""}</span>
                      {(book.product_type === 'article' || book.product_type === 'papier') && (
                        <span style={{ fontSize: 11, color: ruptured ? "#f44336" : "#4caf50", fontWeight: 600 }}>
                          📦 Stock : {book.product_type === 'article' ? (book.stock ?? 0) : (book.paper_stock ?? 0)}
                        </span>
                      )}
                      {ruptured && (
                        <span style={{ fontSize: 10, background: "#7a1a1a", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: "bold", letterSpacing: 0.5 }}>
                          🚫 RUPTURE
                        </span>
                      )}
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
                          );
                        })
                      );
                      })()}
                    </div>
                  </div>
                )}

                {/* ONGLET SHIPPING : Zones de livraison (g�r� plus bas, voir bloc shipping_zones) */}
              </>
            )}
          </div>
        )}
        {view === "categories" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h1 style={{ fontSize: 20, color: "#c9a84c" }}>🗂️ Gestion des catégories</h1>
              <button onClick={fetchCategories} disabled={catLoading} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
                {catLoading ? "⏳ Chargement..." : "🔄 Actualiser"}
              </button>
            </div>

            <p style={{ color: "#888", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              Ajoute, renomme, supprime ou réorganise tes catégories. Les modifications s'appliquent immédiatement à toute l'app.
              <br/>⚠️ Si tu renommes une catégorie, tous les livres associés seront automatiquement mis à jour.
            </p>

            {/* MESSAGE */}
            {catMessage.text && (
              <div style={{
                padding: "10px 14px", borderRadius: 6, marginBottom: 16,
                background: catMessage.type === "success" ? "#1a3a1a" : "#3a1a1a",
                color: catMessage.type === "success" ? "#4ade80" : "#f87171",
                border: "1px solid " + (catMessage.type === "success" ? "#22c55e" : "#ef4444"),
                fontSize: 13
              }}>
                {catMessage.text}
              </div>
            )}

            {/* FORMULAIRE D'AJOUT DE CATÉGORIE */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <h3 style={{ color: "#c9a84c", fontSize: 14, marginBottom: 10 }}>➕ Nouvelle catégorie</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
                  placeholder="Ex: Spiritualité, Cuisine, Sport..."
                  style={{
                    flex: 1, minWidth: 200, padding: "10px 12px",
                    background: "#0a0a0a", border: "1px solid #2a2a2a",
                    borderRadius: 6, color: "#fff", fontSize: 14
                  }}
                />
                <button
                  onClick={addCategory}
                  disabled={catSaving || !newCatName.trim()}
                  style={{
                    padding: "10px 20px",
                    background: catSaving || !newCatName.trim() ? "#333" : "#c9a84c",
                    color: catSaving || !newCatName.trim() ? "#666" : "#000",
                    border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600,
                    cursor: catSaving || !newCatName.trim() ? "not-allowed" : "pointer"
                  }}
                >
                  {catSaving ? "⏳" : "Ajouter"}
                </button>
              </div>
            </div>

            {/* LISTE DES CATÉGORIES */}
            {catLoading && categoriesRaw.length === 0 ? (
              <div style={{ color: "#888", textAlign: "center", padding: 40 }}>⏳ Chargement...</div>
            ) : categoriesRaw.length === 0 ? (
              <div style={{ color: "#888", textAlign: "center", padding: 40 }}>Aucune catégorie. Ajoute-en une ci-dessus.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {categoriesRaw.map((cat, idx) => {
                  const subs = subcategoriesRaw.filter(s => s.category_id === cat.id);
                  return (
                    <div key={cat.id} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
                      {/* En-tête catégorie */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {/* Boutons d'ordre */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <button
                            onClick={() => moveCategory(cat.id, 'up')}
                            disabled={idx === 0 || catSaving}
                            title="Monter"
                            style={{
                              width: 24, height: 18, padding: 0,
                              background: idx === 0 ? "#1a1a1a" : "#2a2a2a",
                              border: "1px solid #333", borderRadius: 4,
                              color: idx === 0 ? "#444" : "#c9a84c",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              fontSize: 10
                            }}
                          >▲</button>
                          <button
                            onClick={() => moveCategory(cat.id, 'down')}
                            disabled={idx === categoriesRaw.length - 1 || catSaving}
                            title="Descendre"
                            style={{
                              width: 24, height: 18, padding: 0,
                              background: idx === categoriesRaw.length - 1 ? "#1a1a1a" : "#2a2a2a",
                              border: "1px solid #333", borderRadius: 4,
                              color: idx === categoriesRaw.length - 1 ? "#444" : "#c9a84c",
                              cursor: idx === categoriesRaw.length - 1 ? "not-allowed" : "pointer",
                              fontSize: 10
                            }}
                          >▼</button>
                        </div>

                        {/* Nom ou édition */}
                        {editingCatId === cat.id ? (
                          <>
                            <input
                              type="text"
                              value={editingCatName}
                              onChange={e => setEditingCatName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') updateCategoryName(cat.id, editingCatName);
                                if (e.key === 'Escape') { setEditingCatId(null); setEditingCatName(''); }
                              }}
                              autoFocus
                              style={{
                                flex: 1, minWidth: 150, padding: "6px 10px",
                                background: "#0a0a0a", border: "1px solid #c9a84c",
                                borderRadius: 6, color: "#fff", fontSize: 15, fontWeight: 600
                              }}
                            />
                            <button
                              onClick={() => updateCategoryName(cat.id, editingCatName)}
                              disabled={catSaving}
                              style={{ padding: "6px 12px", background: "#22c55e", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            >✓ OK</button>
                            <button
                              onClick={() => { setEditingCatId(null); setEditingCatName(''); }}
                              style={{ padding: "6px 12px", background: "#444", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                            >✗</button>
                          </>
                        ) : (
                          <>
                            <h2 style={{ flex: 1, color: "#c9a84c", fontSize: 16, fontWeight: 600, margin: 0 }}>
                              {cat.name}
                              <span style={{ color: "#666", fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                                ({subs.length} sous-cat.)
                              </span>
                            </h2>
                            <button
                              onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                              style={{ padding: "6px 10px", background: "#2a2a2a", color: "#c9a84c", border: "1px solid #c9a84c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                            >✏️ Renommer</button>
                            <button
                              onClick={() => deleteCategory(cat.id, cat.name)}
                              disabled={catSaving}
                              style={{ padding: "6px 10px", background: "#3a1a1a", color: "#f87171", border: "1px solid #ef4444", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                            >🗑️ Supprimer</button>
                          </>
                        )}
                      </div>

                      {/* Sous-catégories */}
                      <div style={{ marginLeft: 32, marginTop: 8 }}>
                        {subs.length === 0 && (
                          <div style={{ color: "#666", fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>
                            Aucune sous-catégorie
                          </div>
                        )}
                        {subs.map(sub => (
                          <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", flexWrap: "wrap" }}>
                            <span style={{ color: "#666", fontSize: 12 }}>└─</span>
                            {editingSubId === sub.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editingSubName}
                                  onChange={e => setEditingSubName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') updateSubcategoryName(sub.id, editingSubName);
                                    if (e.key === 'Escape') { setEditingSubId(null); setEditingSubName(''); }
                                  }}
                                  autoFocus
                                  style={{
                                    flex: 1, minWidth: 120, padding: "4px 8px",
                                    background: "#0a0a0a", border: "1px solid #c9a84c",
                                    borderRadius: 4, color: "#fff", fontSize: 13
                                  }}
                                />
                                <button
                                  onClick={() => updateSubcategoryName(sub.id, editingSubName)}
                                  disabled={catSaving}
                                  style={{ padding: "4px 8px", background: "#22c55e", color: "#000", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                                >✓</button>
                                <button
                                  onClick={() => { setEditingSubId(null); setEditingSubName(''); }}
                                  style={{ padding: "4px 8px", background: "#444", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                                >✗</button>
                              </>
                            ) : (
                              <>
                                <span style={{ flex: 1, color: "#ddd", fontSize: 13 }}>{sub.name}</span>
                                <button
                                  onClick={() => { setEditingSubId(sub.id); setEditingSubName(sub.name); }}
                                  style={{ padding: "3px 8px", background: "transparent", color: "#888", border: "1px solid #333", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                                >✏️</button>
                                <button
                                  onClick={() => deleteSubcategory(sub.id, sub.name)}
                                  disabled={catSaving}
                                  style={{ padding: "3px 8px", background: "transparent", color: "#f87171", border: "1px solid #553333", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                                >🗑️</button>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Ajout sous-catégorie */}
                        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                          <input
                            type="text"
                            value={newSubName[cat.id] || ''}
                            onChange={e => setNewSubName(s => ({ ...s, [cat.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addSubcategory(cat.id); }}
                            placeholder="+ Nouvelle sous-catégorie..."
                            style={{
                              flex: 1, minWidth: 150, padding: "6px 10px",
                              background: "#0a0a0a", border: "1px solid #2a2a2a",
                              borderRadius: 4, color: "#fff", fontSize: 12
                            }}
                          />
                          <button
                            onClick={() => addSubcategory(cat.id)}
                            disabled={catSaving || !(newSubName[cat.id] || '').trim()}
                            style={{
                              padding: "6px 14px",
                              background: catSaving || !(newSubName[cat.id] || '').trim() ? "#333" : "#c9a84c",
                              color: catSaving || !(newSubName[cat.id] || '').trim() ? "#666" : "#000",
                              border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600,
                              cursor: catSaving || !(newSubName[cat.id] || '').trim() ? "not-allowed" : "pointer"
                            }}
                          >
                            ➕ Ajouter
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "paper_books" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h1 style={{ fontSize: 20, color: "#c9a84c" }}>📦 Livres papier (POD)</h1>
              <button onClick={fetchBooks} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>🔄 Actualiser</button>
            </div>

            <p style={{ color: "#888", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              Active le format papier pour les livres que tu veux vendre imprimés.<br/>
              💡 Le prix papier peut être différent du prix PDF. Stock illimité = impression à la demande.
            </p>

            {paperMessage.text && (
              <div style={{
                padding: "10px 14px", borderRadius: 6, marginBottom: 16,
                background: paperMessage.type === "success" ? "#1a3a1a" : "#3a1a1a",
                color: paperMessage.type === "success" ? "#4ade80" : "#f87171",
                border: "1px solid " + (paperMessage.type === "success" ? "#22c55e" : "#ef4444"),
                fontSize: 13
              }}>
                {paperMessage.text}
              </div>
            )}

            {books.length === 0 ? (
              <div style={{ color: "#888", textAlign: "center", padding: 40 }}>Aucun livre.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {books.map(book => (
                  <div key={book.id} style={{
                    background: "#1a1a1a",
                    border: "1px solid " + (book.has_paper_version ? "#c9a84c" : "#2a2a2a"),
                    borderRadius: 8,
                    padding: 14
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      {book.cover && (
                        <img src={book.cover} alt="" style={{ width: 50, height: 70, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{book.title}</div>
                        <div style={{ color: "#888", fontSize: 12 }}>{book.author} • PDF: {book.price} F</div>
                        {book.has_paper_version && (
                          <div style={{ color: "#c9a84c", fontSize: 12, marginTop: 4 }}>
                            📦 Papier: {book.paper_price || '?'} F
                            {book.paper_stock === -1 ? ' • Stock illimité' :
                             book.paper_stock === 0 ? ' • RUPTURE' :
                             ` • ${book.paper_stock} en stock`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: book.has_paper_version ? "#c9a84c" : "#888", fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={book.has_paper_version || false}
                            onChange={() => togglePaperVersion(book.id, book.has_paper_version)}
                            disabled={paperSaving}
                            style={{ width: 18, height: 18, cursor: "pointer" }}
                          />
                          Papier
                        </label>
                        {book.has_paper_version && (
                          <button
                            onClick={() => {
                              setEditingPaperId(book.id);
                              setEditingPaper({
                                paper_price: book.paper_price || book.price || 0,
                                paper_stock: book.paper_stock === null ? -1 : book.paper_stock,
                                paper_pages: book.paper_pages || '',
                                paper_description: book.paper_description || ''
                              });
                            }}
                            style={{ padding: "6px 10px", background: "#2a2a2a", color: "#c9a84c", border: "1px solid #c9a84c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                          >⚙️ Configurer</button>
                        )}
                      </div>
                    </div>

                    {/* Bloc de configuration */}
                    {editingPaperId === book.id && (
                      <div style={{ marginTop: 14, padding: 14, background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 6 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Prix papier (FCFA)</label>
                            <input
                              type="number"
                              value={editingPaper.paper_price}
                              onChange={e => setEditingPaper(p => ({ ...p, paper_price: e.target.value }))}
                              style={{ width: "100%", padding: "8px 10px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Stock (-1 = illimité)</label>
                            <input
                              type="number"
                              value={editingPaper.paper_stock}
                              onChange={e => setEditingPaper(p => ({ ...p, paper_stock: e.target.value }))}
                              style={{ width: "100%", padding: "8px 10px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Pages</label>
                            <input
                              type="number"
                              value={editingPaper.paper_pages}
                              onChange={e => setEditingPaper(p => ({ ...p, paper_pages: e.target.value }))}
                              style={{ width: "100%", padding: "8px 10px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                            />
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Description spécifique au format papier (optionnel)</label>
                          <textarea
                            value={editingPaper.paper_description}
                            onChange={e => setEditingPaper(p => ({ ...p, paper_description: e.target.value }))}
                            placeholder="Ex: Couverture souple, format A5, papier 80g..."
                            rows={2}
                            style={{ width: "100%", padding: "8px 10px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13, resize: "vertical" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => savePaperConfig(book.id)}
                            disabled={paperSaving}
                            style={{ padding: "8px 16px", background: "#22c55e", color: "#000", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                          >{paperSaving ? "⏳" : "✓ Enregistrer"}</button>
                          <button
                            onClick={() => { setEditingPaperId(null); setEditingPaper({}); }}
                            style={{ padding: "8px 16px", background: "#444", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
                          >Annuler</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(view === "shipping_zones" || (view === "books" && productSubTab === "shipping" && productSubView !== null && productSubView !== "audio" && productSubView !== "digital")) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h1 style={{ fontSize: 20, color: "#c9a84c" }}>🚚 Zones de livraison</h1>
              <button onClick={fetchShippingZones} disabled={zoneLoading} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
                {zoneLoading ? "⏳ Chargement..." : "🔄 Actualiser"}
              </button>
            </div>

            <p style={{ color: "#888", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              Configure les villes où tu livres et les frais associés. <br/>
              💡 <b>Domicile</b> : livraison à l'adresse de la cliente. <b>Agence</b> : la cliente retire à une agence de voyage.
            </p>

            {zoneMessage.text && (
              <div style={{
                padding: "10px 14px", borderRadius: 6, marginBottom: 16,
                background: zoneMessage.type === "success" ? "#1a3a1a" : "#3a1a1a",
                color: zoneMessage.type === "success" ? "#4ade80" : "#f87171",
                border: "1px solid " + (zoneMessage.type === "success" ? "#22c55e" : "#ef4444"),
                fontSize: 13
              }}>
                {zoneMessage.text}
              </div>
            )}

            {/* Formulaire d'ajout */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <h3 style={{ color: "#c9a84c", fontSize: 14, marginBottom: 12 }}>➕ Nouvelle zone</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Ville *</label>
                  <input
                    type="text"
                    value={newZone.city}
                    onChange={e => setNewZone(z => ({ ...z, city: e.target.value }))}
                    placeholder="Ex: Dschang"
                    style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Frais (FCFA) *</label>
                  <input
                    type="number"
                    value={newZone.delivery_fee}
                    onChange={e => setNewZone(z => ({ ...z, delivery_fee: e.target.value }))}
                    placeholder="2500"
                    style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Mode *</label>
                  <select
                    value={newZone.delivery_method}
                    onChange={e => setNewZone(z => ({ ...z, delivery_method: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                  >
                    <option value="domicile">Domicile</option>
                    <option value="agence">Agence</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Délai min (jours)</label>
                  <input
                    type="number"
                    value={newZone.delivery_days_min}
                    onChange={e => setNewZone(z => ({ ...z, delivery_days_min: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Délai max (jours)</label>
                  <input
                    type="number"
                    value={newZone.delivery_days_max}
                    onChange={e => setNewZone(z => ({ ...z, delivery_days_max: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Instructions pour la cliente</label>
                <input
                  type="text"
                  value={newZone.instructions}
                  onChange={e => setNewZone(z => ({ ...z, instructions: e.target.value }))}
                  placeholder="Ex: Retrait à l'agence de voyage de votre choix"
                  style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", fontSize: 13 }}
                />
              </div>
              <button
                onClick={addShippingZone}
                disabled={zoneSaving || !newZone.city.trim()}
                style={{
                  padding: "8px 18px",
                  background: zoneSaving || !newZone.city.trim() ? "#333" : "#c9a84c",
                  color: zoneSaving || !newZone.city.trim() ? "#666" : "#000",
                  border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: zoneSaving || !newZone.city.trim() ? "not-allowed" : "pointer"
                }}
              >
                {zoneSaving ? "⏳" : "➕ Ajouter cette zone"}
              </button>
            </div>

            {/* Liste des zones */}
            {shippingZones.length === 0 ? (
              <div style={{ color: "#888", textAlign: "center", padding: 40 }}>Aucune zone. Ajoute-en une ci-dessus.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {shippingZones.map(zone => (
                  <div key={zone.id} style={{
                    background: "#1a1a1a",
                    border: "1px solid " + (zone.active ? "#2a2a2a" : "#553333"),
                    borderRadius: 8,
                    padding: 14,
                    opacity: zone.active ? 1 : 0.5
                  }}>
                    {editingZoneId === zone.id ? (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Ville</label>
                            <input type="text" value={editingZone.city} onChange={e => setEditingZone(z => ({ ...z, city: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #c9a84c", borderRadius: 4, color: "#fff", fontSize: 13 }}/>
                          </div>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Frais</label>
                            <input type="number" value={editingZone.delivery_fee} onChange={e => setEditingZone(z => ({ ...z, delivery_fee: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #c9a84c", borderRadius: 4, color: "#fff", fontSize: 13 }}/>
                          </div>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Mode</label>
                            <select value={editingZone.delivery_method} onChange={e => setEditingZone(z => ({ ...z, delivery_method: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #c9a84c", borderRadius: 4, color: "#fff", fontSize: 13 }}>
                              <option value="domicile">Domicile</option>
                              <option value="agence">Agence</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Délai min</label>
                            <input type="number" value={editingZone.delivery_days_min} onChange={e => setEditingZone(z => ({ ...z, delivery_days_min: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #c9a84c", borderRadius: 4, color: "#fff", fontSize: 13 }}/>
                          </div>
                          <div>
                            <label style={{ display: "block", color: "#888", fontSize: 11, marginBottom: 4 }}>Délai max</label>
                            <input type="number" value={editingZone.delivery_days_max} onChange={e => setEditingZone(z => ({ ...z, delivery_days_max: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #c9a84c", borderRadius: 4, color: "#fff", fontSize: 13 }}/>
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <input type="text" value={editingZone.instructions || ''} onChange={e => setEditingZone(z => ({ ...z, instructions: e.target.value }))} placeholder="Instructions" style={{ width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #c9a84c", borderRadius: 4, color: "#fff", fontSize: 13 }}/>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => updateShippingZone(zone.id)} disabled={zoneSaving} style={{ padding: "8px 16px", background: "#22c55e", color: "#000", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{zoneSaving ? "⏳" : "✓ Enregistrer"}</button>
                          <button onClick={() => { setEditingZoneId(null); setEditingZone({}); }} style={{ padding: "8px 16px", background: "#444", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>
                            {zone.city}
                            {!zone.active && <span style={{ color: "#f87171", fontSize: 11, marginLeft: 8 }}>(désactivée)</span>}
                          </div>
                          <div style={{ color: "#c9a84c", fontSize: 13, marginTop: 4 }}>
                            {zone.delivery_fee.toLocaleString()} FCFA •
                            {zone.delivery_method === 'domicile' ? ' 🏠 Domicile' : ' 🏢 Agence'} •
                            {' ' + zone.delivery_days_min}-{zone.delivery_days_max} jours
                          </div>
                          {zone.instructions && (
                            <div style={{ color: "#888", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{zone.instructions}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => toggleZoneActive(zone.id, zone.active)} disabled={zoneSaving} style={{ padding: "6px 10px", background: zone.active ? "#1a3a1a" : "#3a3a1a", color: zone.active ? "#4ade80" : "#fbbf24", border: "1px solid " + (zone.active ? "#22c55e" : "#fbbf24"), borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                            {zone.active ? "✓ Active" : "○ Inactive"}
                          </button>
                          <button onClick={() => {
                            setEditingZoneId(zone.id);
                            setEditingZone({ ...zone });
                          }} style={{ padding: "6px 10px", background: "#2a2a2a", color: "#c9a84c", border: "1px solid #c9a84c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✏️ Modifier</button>
                          <button onClick={() => deleteShippingZone(zone.id, zone.city)} disabled={zoneSaving} style={{ padding: "6px 10px", background: "#3a1a1a", color: "#f87171", border: "1px solid #ef4444", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "users" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, color: "#c9a84c" }}>Utilisateurs</h1>
              <button onClick={() => { fetchUsers(); fetchUserStats(); }} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>🔄 Actualiser</button>
            </div>

            {/* 👥 STATS COMPTES UTILISATEURS */}
            <div style={{ background: "linear-gradient(135deg, #2a1f0a 0%, #1a1208 100%)", border: "1px solid #c9a84c", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#c9a84c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: "bold" }}>👥 Comptes utilisateurs CarryBooks</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: "bold", color: "#c9a84c", lineHeight: 1 }}>{userStats.total_users}</div>
                  <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>Total comptes</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: "bold", color: "#4caf50", lineHeight: 1 }}>+{userStats.new_today}</div>
                  <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>Aujourd'hui</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#fff", lineHeight: 1 }}>+{userStats.new_this_week}</div>
                  <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>7 derniers jours</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#fff", lineHeight: 1 }}>+{userStats.new_this_month}</div>
                  <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>30 derniers jours</div>
                </div>
              </div>
            </div>

            {/* 🛒 STATS ACHETEURS */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: "bold" }}>🛒 Acheteurs</div>
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
              {/* Carte sp�cifique aux ventes panier (produits physiques) */}
              <div style={{ background: "#1a1a1a", border: "1px solid #c9a84c", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase" }}>🛒 Commandes panier</div>
                <div style={{ fontSize: 22, color: "#c9a84c", fontWeight: "bold", marginTop: 6 }}>{stats.cartOrdersCount || 0}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{(stats.cartRevenue || 0).toLocaleString()} F</div>
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
                  <div key={wd.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a2a2a" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: "#e8e0d0", fontWeight: "bold" }}>{wd.amount.toLocaleString()} F → {wd.phone_number}</div>
                        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                          {new Date(wd.created_at).toLocaleString("fr-FR")} · {wd.operator}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4, color:
                          (wd.status === "approved" || wd.status === "paid" || wd.status === "completed") ? "#4caf50" :
                          wd.status === "processing" ? "#f0a020" :
                          wd.status === "failed" ? "#ff6b6b" :
                          wd.status === "rejected" ? "#888" : "#c9a84c"
                        }}>
                          {(wd.status === "approved" || wd.status === "paid" || wd.status === "completed") ? "✅ Versé" :
                           wd.status === "processing" ? "⏳ En cours chez CamPay" :
                           wd.status === "failed" ? "❌ Échec" :
                           wd.status === "rejected" ? "🚫 Rejeté" : "⏳ En attente de validation"}
                        </div>
                        {wd.error_message && <div style={{ fontSize: 10, color: "#ff6b6b", marginTop: 4 }}>Motif : {wd.error_message}</div>}
                        {wd.campay_reference && <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>Ref CamPay : {wd.campay_reference}</div>}
                      </div>
                    </div>
                    {/* BOUTONS ACTIONS : visibles uniquement si pending */}
                    {wd.status === "pending" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => approveWithdrawal(wd)}
                          disabled={processingWithdrawalId === wd.id}
                          style={{ flex: 1, background: processingWithdrawalId === wd.id ? "#3a3a3a" : "#4caf50", border: "none", borderRadius: 6, padding: "10px", color: processingWithdrawalId === wd.id ? "#999" : "#fff", fontSize: 12, fontWeight: "bold", cursor: processingWithdrawalId === wd.id ? "not-allowed" : "pointer" }}>
                          {processingWithdrawalId === wd.id ? "⏳ Versement en cours…" : "✅ Approuver et verser"}
                        </button>
                        <button
                          onClick={() => rejectWithdrawal(wd)}
                          disabled={processingWithdrawalId === wd.id}
                          style={{ flex: 1, background: "transparent", border: "1px solid #ff6b6b", borderRadius: 6, padding: "10px", color: "#ff6b6b", fontSize: 12, fontWeight: "bold", cursor: processingWithdrawalId === wd.id ? "not-allowed" : "pointer", opacity: processingWithdrawalId === wd.id ? 0.4 : 1 }}>
                          🚫 Rejeter
                        </button>
                      </div>
                    )}
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
                referralCodes.slice(0, 50).map((c, i) => {
                  const isActive = c.active !== false; // Par défaut TRUE si non défini
                  return (
                    <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #2a2a2a" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: isActive ? "#e8e0d0" : "#888", textDecoration: isActive ? "none" : "line-through" }}>
                            #{i+1} {c.code}
                            {isActive
                              ? <span style={{ color: "#4caf50", fontSize: 10, marginLeft: 6, fontWeight: "bold" }}>✅ ACTIF</span>
                              : <span style={{ color: "#ff6b6b", fontSize: 10, marginLeft: 6, fontWeight: "bold" }}>🚫 DÉSACTIVÉ</span>
                            }
                          </div>
                          <div style={{ fontSize: 10, color: "#888" }}>Total gagné : {(c.total_earned || 0).toLocaleString()} F</div>
                        </div>
                        <div style={{ textAlign: "right", marginRight: 10 }}>
                          <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: "bold" }}>{(c.available_amount || 0).toLocaleString()} F</div>
                          <div style={{ fontSize: 9, color: "#666" }}>disponible</div>
                        </div>
                        <button
                          onClick={() => toggleReferrerActive(c)}
                          style={{
                            background: isActive ? "transparent" : "#4caf50",
                            border: "1px solid " + (isActive ? "#ff6b6b" : "#4caf50"),
                            borderRadius: 6,
                            padding: "6px 12px",
                            color: isActive ? "#ff6b6b" : "#fff",
                            fontSize: 11,
                            fontWeight: "bold",
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {isActive ? "🚫 Désactiver" : "✅ Activer"}
                        </button>
                      </div>
                    </div>
                  );
                })
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

              {/* Récompense parrain — Livres numériques */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  📚 Commission PARRAIN — Livres numériques
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={refSettingsForm.reward_pct_digital}
                    onChange={e => setRefSettingsForm(f => ({ ...f, reward_pct_digital: e.target.value }))}
                    min="0" max="100" step="0.5"
                    style={{ width: "100%", padding: "12px 38px 12px 14px", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 16, boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: "bold" }}>%</span>
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  💡 % du prix payé que reçoit le parrain quand un filleul achète un livre numérique (ex: 20)
                </div>
              </div>

              {/* Récompense parrain — Articles physiques */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#c9a84c", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  📦 Commission PARRAIN — Articles physiques / Livres papier
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={refSettingsForm.reward_pct_physical}
                    onChange={e => setRefSettingsForm(f => ({ ...f, reward_pct_physical: e.target.value }))}
                    min="0" max="100" step="0.5"
                    style={{ width: "100%", padding: "12px 38px 12px 14px", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e8e0d0", fontSize: 16, boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: "bold" }}>%</span>
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  💡 % du prix payé pour les articles physiques (montres, parfums, livres papier) — généralement plus bas que digital (ex: 10)
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
                  💡 Pourcentage de réduction sur le 1er achat du filleul (ex: 20). Mets <strong style={{ color: "#c9a84c" }}>0</strong> pour désactiver la réduction filleul.
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
                  📚 Sur livre numérique : parrain gagne <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{refSettingsForm.reward_pct_digital || 0}%</span> du prix payé
                  <br />
                  📦 Sur article physique : parrain gagne <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{refSettingsForm.reward_pct_physical || 0}%</span> du prix payé
                  <br />
                  🎁 Le filleul reçoit <span style={{ color: "#c9a84c", fontWeight: "bold" }}>-{refSettingsForm.referred_discount_pct || 0}%</span> sur son 1er achat
                  <br />
                  💸 Retrait possible à partir de <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{(parseInt(refSettingsForm.min_withdrawal) || 0).toLocaleString()} F</span>
                  <br />
                  ⏳ Délai d'attente : <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{refSettingsForm.fraud_delay_days || 0} jours</span>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1976d2", fontSize: 11, color: "#aaa" }}>
                  <strong style={{ color: "#64b5f6" }}>Exemple :</strong> Sur un livre numérique à 1000 F → le filleul paye {Math.round(1000 * (1 - (parseFloat(refSettingsForm.referred_discount_pct) || 0) / 100))} F · le parrain gagne {Math.round(1000 * (1 - (parseFloat(refSettingsForm.referred_discount_pct) || 0) / 100) * (parseFloat(refSettingsForm.reward_pct_digital) || 0) / 100)} F
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
                <div style={{ marginBottom: 6 }}>📚 <strong style={{ color: "#e8e0d0" }}>Commission digital</strong> : Tu peux te permettre 20-30% sur les livres numériques (marge ~100%, pas de coût de production).</div>
                <div style={{ marginBottom: 6 }}>📦 <strong style={{ color: "#e8e0d0" }}>Commission physique</strong> : Reste prudente, 5-15% max. Tes marges sur les articles physiques sont plus serrées.</div>
                <div style={{ marginBottom: 6 }}>🎯 <strong style={{ color: "#e8e0d0" }}>Réduction filleul</strong> : 10-20% est standard. Plus c'est élevé, plus ça incite à l'achat.</div>
                <div style={{ marginBottom: 6 }}>💸 <strong style={{ color: "#e8e0d0" }}>Minimum retrait</strong> : 10 000 F évite les petits versements et réduit les frais Mobile Money.</div>
                <div>⏳ <strong style={{ color: "#e8e0d0" }}>Délai anti-fraude</strong> : 30 jours = sécurité maximale (annulation/remboursement). Tu peux réduire si tu fais confiance à ta communauté.</div>
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

        {/* STATS PWA - INSTALLATIONS MOBILE */}
        {view === "pwa_stats" && <PwaStatsView />}

        {view === "comptabilite" && <ComptabiliteView />}

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
              <h2 style={{ color: "#c9a84c", fontSize: 17 }}>{editingBook ? "Modifier" : "Ajouter"}</h2>
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
                {/* ============ INDICATEUR DE TYPE (compact, cliquable pour changer) ============ */}
                {(() => {
                  const types = {
                    numerique: { icon: "📖", label: "Numérique", desc: "Livre PDF/Liseuse" },
                    papier: { icon: "📦", label: "Papier uniquement", desc: "Livre physique seul" },
                    mixte: { icon: "📚", label: "Numérique + Papier", desc: "Les deux versions" },
                    article: { icon: "🎨", label: "Article divers", desc: "Feutre, pinceau, etc." },
                    audio: { icon: "🎧", label: "Audio / Podcast", desc: "MP3, MP4, vidéo" }
                  };
                  const currentType = types[form.product_type] || types.numerique;
                  return (
                    <div style={{ background: "#1a1a1a", padding: 12, borderRadius: 10, border: "1px solid #c9a84c44" }}>
                      <div
                        onClick={() => setShowTypeSelector(s => !s)}
                        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                      >
                        <div style={{ fontSize: 24 }}>{currentType.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Type de produit</div>
                          <div style={{ color: "#c9a84c", fontSize: 14, fontWeight: "bold" }}>{currentType.label}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>{showTypeSelector ? "▲ Replier" : "▼ Changer"}</div>
                      </div>

                      {/* Sélecteur déplié (caché par défaut) */}
                      {showTypeSelector && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2a2a2a" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                            {Object.entries(types).map(([id, t]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => { setForm(f => ({ ...f, product_type: id })); setShowTypeSelector(false); }}
                                style={{
                                  padding: "10px 8px",
                                  background: form.product_type === id ? "#c9a84c22" : "#0a0a0a",
                                  border: "2px solid " + (form.product_type === id ? "#c9a84c" : "#2a2a2a"),
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  textAlign: "left"
                                }}
                              >
                                <div style={{ fontSize: 16, marginBottom: 3 }}>{t.icon}</div>
                                <div style={{ color: form.product_type === id ? "#c9a84c" : "#fff", fontSize: 11, fontWeight: "bold" }}>{t.label}</div>
                                <div style={{ color: "#888", fontSize: 9, marginTop: 2 }}>{t.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message d'aide selon le type */}
                      <div style={{ fontSize: 11, color: "#888", marginTop: 10, padding: 8, background: "#0a0a0a", borderRadius: 6 }}>
                        {form.product_type === "numerique" && "📖 Livre numérique seul : remplis prix + contenu (PDF ou texte)"}
                        {form.product_type === "papier" && "📦 Livre papier uniquement : remplis prix papier + stock + extrait PDF"}
                        {form.product_type === "mixte" && "📚 Version numérique + papier : remplis tout"}
                        {form.product_type === "article" && "🎨 Article divers : remplis prix + stock + photos (pas de contenu/extrait)"}
                        {form.product_type === "audio" && "🎧 Audio/Podcast : upload MP3 ou MP4 + couverture + choisis le mode d'accès (gratuit, vente, abonnement)"}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label style={labelStyle}>TITRE *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={form.product_type === "article" ? "Nom de l'article (ex: Boîte de 12 feutres)" : "Titre du livre"} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{form.product_type === "article" ? "MARQUE / FABRICANT" : "AUTEUR *"}</label>
                  <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                    placeholder={form.product_type === "article" ? "Ex: Bic, Crayola..." : "Nom et prénom"} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{form.product_type === "papier" || form.product_type === "article" || form.product_type === "audio" ? "PRIX (FCFA) *" : "PRIX ACTUEL (FCFA)"}</label>
                  <input 
                    value={form.product_type === "papier" ? (form.paper_price || "") : form.price} 
                    onChange={e => {
                      if (form.product_type === "papier") {
                        // Pour livre papier : le prix saisi va directement dans paper_price
                        setForm(f => ({ ...f, paper_price: e.target.value, price: e.target.value }));
                      } else {
                        setForm(f => ({ ...f, price: e.target.value }));
                      }
                    }}
                    placeholder="Ex: 2500" type="number" style={inputStyle} />
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                    {form.product_type === "numerique" && "💰 Prix de la version numérique"}
                    {form.product_type === "papier" && "📦 Prix de vente du livre papier"}
                    {form.product_type === "mixte" && "💰 Prix de la version numérique (le prix papier sera défini ci-dessous)"}
                    {form.product_type === "article" && "💰 Prix de vente unitaire"}
                    {form.product_type === "audio" && "💰 Prix de vente de l'audio/podcast"}
                  </div>
                </div>
                {/* PROMO : seulement pour numerique, mixte, papier (pas article ni audio) */}
                {form.product_type !== "article" && form.product_type !== "audio" && (
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
                )}

                {/* STOCK : visible uniquement pour les articles */}
                {form.product_type === "article" && (
                  <div>
                    <label style={labelStyle}>📦 STOCK DISPONIBLE *</label>
                    <input 
                      value={form.stock === -1 ? "" : form.stock} 
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "") {
                          setForm(f => ({ ...f, stock: -1 }));
                        } else {
                          setForm(f => ({ ...f, stock: parseInt(val) || 0 }));
                        }
                      }}
                      placeholder="Ex: 25 (laisse vide = stock illimité)" 
                      type="number" 
                      min="0" 
                      style={inputStyle} 
                    />
                    <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                      📦 Nombre de pièces disponibles à la vente<br/>
                      💡 Laisse vide si tu ne veux pas gérer le stock (stock illimité)<br/>
                      ⚠️ Mets 0 pour marquer comme "Rupture de stock"
                    </div>

                    {/* Autoriser la commande en rupture */}
                    <div style={{ marginTop: 12, padding: 10, background: "#0a0a0a", borderRadius: 6, border: "1px solid #2a2a2a" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!form.allow_oversell}
                          onChange={e => setForm(f => ({ ...f, allow_oversell: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: "#c9a84c", marginTop: 2 }}
                        />
                        <div>
                          <div style={{ color: "#e8e0d0", fontSize: 13, fontWeight: "bold" }}>♻️ Autoriser la commande en rupture de stock</div>
                          <div style={{ color: "#888", fontSize: 11, marginTop: 3 }}>
                            Si coché : la cliente peut commander même si stock = 0 (réapprovisionnement à venir)<br/>
                            Si décoché : bouton "Acheter" désactivé quand stock = 0
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* DÉTAILS PAPIER : pour livres papier et mixte */}
                {(form.product_type === "papier" || form.product_type === "mixte") && (
                  <div style={{ background: "#1a1a1a", padding: 14, borderRadius: 10, border: "1px solid #c9a84c44" }}>
                    <label style={{ ...labelStyle, color: "#c9a84c", fontSize: 12, marginBottom: 12, display: "block" }}>📦 DÉTAILS DU LIVRE PAPIER</label>

                    {/* Prix papier (seulement pour mixte, car papier utilise déjà le champ Prix au-dessus) */}
                    {form.product_type === "mixte" && (
                      <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>PRIX PAPIER (FCFA) *</label>
                        <input 
                          value={form.paper_price || ""} 
                          onChange={e => setForm(f => ({ ...f, paper_price: e.target.value }))}
                          placeholder="Ex: 5000" 
                          type="number" 
                          style={inputStyle} 
                        />
                        <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                          📦 Prix de la version papier (différent du prix numérique au-dessus)
                        </div>
                      </div>
                    )}

                    {/* Nombre de pages */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>📄 NOMBRE DE PAGES</label>
                      <input 
                        value={form.paper_pages || ""} 
                        onChange={e => setForm(f => ({ ...f, paper_pages: e.target.value }))}
                        placeholder="Ex: 120" 
                        type="number" 
                        min="1"
                        style={inputStyle} 
                      />
                    </div>

                    {/* Description physique (style papier, format, etc.) */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>📝 DESCRIPTION PHYSIQUE</label>
                      <textarea 
                        value={form.paper_description || ""} 
                        onChange={e => setForm(f => ({ ...f, paper_description: e.target.value }))}
                        placeholder="Ex: Couverture souple 160g, format A5, papier 80g blanc..." 
                        rows={3}
                        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} 
                      />
                      <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                        💡 Décris le format, la couverture, le papier (sera affiché à la cliente)
                      </div>
                    </div>

                    {/* Stock papier */}
                    <div>
                      <label style={labelStyle}>📦 STOCK PAPIER DISPONIBLE</label>
                      <input 
                        value={form.paper_stock === -1 || form.paper_stock === undefined ? "" : form.paper_stock} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === "") {
                            setForm(f => ({ ...f, paper_stock: -1 }));
                          } else {
                            setForm(f => ({ ...f, paper_stock: parseInt(val) || 0 }));
                          }
                        }}
                        placeholder="Ex: 50 (laisse vide = stock illimité)" 
                        type="number" 
                        min="0" 
                        style={inputStyle} 
                      />
                      <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                        📦 Nombre d'exemplaires disponibles<br/>
                        💡 Laisse vide si stock illimité (impression à la demande)<br/>
                        ⚠️ Mets 0 pour marquer comme "Rupture de stock"
                      </div>
                    </div>

                    {/* Autoriser la commande en rupture */}
                    <div style={{ marginTop: 12, padding: 10, background: "#0a0a0a", borderRadius: 6, border: "1px solid #2a2a2a" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!form.allow_oversell}
                          onChange={e => setForm(f => ({ ...f, allow_oversell: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: "#c9a84c", marginTop: 2 }}
                        />
                        <div>
                          <div style={{ color: "#e8e0d0", fontSize: 13, fontWeight: "bold" }}>♻️ Autoriser la commande en rupture de stock</div>
                          <div style={{ color: "#888", fontSize: 11, marginTop: 3 }}>
                            Si coché : la cliente peut commander même si stock = 0 (livraison à réapprovisionnement / impression à la demande)<br/>
                            Si décoché : bouton "Acheter" désactivé quand stock = 0
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

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
                {/* Bandeau d'info selon le type de produit */}
                {form.product_type === "article" && (
                  <div style={{ background: "#1a1a1a", border: "1px solid #c9a84c", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: "#c9a84c", fontWeight: "bold", marginBottom: 6 }}>🎨 Article divers</div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>
                      Cet onglet n'est pas utilisé pour les articles divers.<br/>
                      Pas besoin d'extrait PDF ou de contenu numérique.<br/>
                      Configure le <b style={{ color: "#c9a84c" }}>stock</b> et les <b style={{ color: "#c9a84c" }}>photos</b> dans l'onglet Infos.
                    </div>
                  </div>
                )}

                {form.product_type === "papier" && (
                  <div style={{ background: "#1a1a1a", border: "1px solid #c9a84c", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: "#c9a84c", fontWeight: "bold", marginBottom: 6 }}>📦 Livre papier uniquement</div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>
                      <b style={{ color: "#c9a84c" }}>Extrait PDF obligatoire</b> ci-dessous.<br/>
                      Pas besoin de remplir Contenu complet (PDF/Texte).<br/>
                      Le prix papier se configure dans la section "📦 Livres papier" de l'admin.
                    </div>
                  </div>
                )}

                {(form.product_type === "numerique" || form.product_type === "mixte") && (
                  <>
                    <label style={labelStyle}>CONTENU DU LIVRE</label>
                    <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                      Choisis entre uploader un PDF ou coller le texte.
                    </p>
                  </>
                )}

                {form.product_type === "audio" && (
                  <div style={{ background: "#1a1a1a", border: "1px solid #c9a84c", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: "#c9a84c", fontWeight: "bold", marginBottom: 6 }}>🎧 Audio / Podcast</div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>
                      Upload ton fichier <b style={{ color: "#c9a84c" }}>MP3 ou MP4</b> ci-dessous.<br/>
                      Configure ensuite le <b style={{ color: "#c9a84c" }}>mode d'accès</b> (gratuit, vente, abonnement).
                    </div>
                  </div>
                )}

                {/* ============ AUDIO / VID�O UPLOAD (uniquement pour type audio) ============ */}
                {form.product_type === "audio" && (
                  <>
                  {/* MODE D'ACC�S */}
                  <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 14, marginBottom: 16, border: "1px solid #2a2a2a" }}>
                    <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>
                      🎯 Mode d'accès *
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {[
                        { id: "free", icon: "🆓", label: "Gratuit", desc: "Podcast public" },
                        { id: "sale", icon: "💰", label: "Vente", desc: "Achat à l'unité" },
                        { id: "subscription", icon: "⭐", label: "Abonnement", desc: "Réservé abonnés" }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, audio_access_mode: m.id }))}
                          style={{
                            padding: "10px 8px",
                            background: form.audio_access_mode === m.id ? "#c9a84c22" : "#0a0a0a",
                            border: "2px solid " + (form.audio_access_mode === m.id ? "#c9a84c" : "#2a2a2a"),
                            borderRadius: 8,
                            cursor: "pointer",
                            textAlign: "center"
                          }}
                        >
                          <div style={{ fontSize: 18, marginBottom: 3 }}>{m.icon}</div>
                          <div style={{ color: form.audio_access_mode === m.id ? "#c9a84c" : "#fff", fontSize: 11, fontWeight: "bold" }}>{m.label}</div>
                          <div style={{ color: "#888", fontSize: 9, marginTop: 2 }}>{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UPLOAD FICHIER AUDIO/VID�O */}
                  <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 14, marginBottom: 16, border: "1px solid #2a2a2a" }}>
                    <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>
                      🎵 Fichier audio / vidéo *
                    </label>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                      💡 Formats acceptés : MP3, MP4, M4A, WAV<br/>
                      📦 Taille max recommandée : 100 MB
                    </div>
                    {form.audio_url ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: "#4caf50", fontSize: 12 }}>✅ Fichier uploadé</span>
                        <a href={form.audio_url} target="_blank" rel="noreferrer" style={{ color: "#c9a84c", fontSize: 11, textDecoration: "underline" }}>Écouter / Voir</a>
                        <button onClick={() => setForm(f => ({ ...f, audio_url: "" }))}
                          style={{ background: "none", border: "1px solid #555", color: "#aaa", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      <>
                        <input type="file" accept="audio/*,video/mp4,video/*" id="audioFileInput" style={{ display: "none" }} onChange={async e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const fileName = Date.now() + "_audio_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                          const { error } = await supabase.storage.from("books-pdf").upload(fileName, file, { contentType: file.type });
                          if (!error) {
                            const { data: urlData } = supabase.storage.from("books-pdf").getPublicUrl(fileName);
                            setForm(f => ({ ...f, audio_url: urlData.publicUrl }));
                          } else {
                            alert("Erreur upload : " + error.message);
                          }
                          e.target.value = "";
                        }} />
                        <button
                          type="button"
                          onClick={() => document.getElementById("audioFileInput").click()}
                          style={{ width: "100%", padding: "12px 12px", border: "2px dashed #c9a84c66", borderRadius: 6, cursor: "pointer", color: "#c9a84c", fontSize: 13, textAlign: "center", background: "#0a0a0a", fontWeight: "bold" }}
                        >
                          🎵 Choisir un fichier audio / vidéo
                        </button>
                      </>
                    )}
                    <input value={form.audio_url || ""} onChange={e => setForm(f => ({ ...f, audio_url: e.target.value }))}
                      placeholder="OU coller une URL externe (YouTube, Vimeo, etc.)"
                      style={{ ...inputStyle, marginTop: 10, fontSize: 12 }} />
                  </div>
                  </>
                )}

                {/* ============ EXTRAIT PDF (cach� pour articles ET audio) ============ */}
                {form.product_type !== "article" && form.product_type !== "audio" && (
                <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 14, marginBottom: 16, border: "1px solid #2a2a2a" }}>
                  <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>
                    📄 Extrait PDF (aperçu gratuit)
                  </label>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                    💡 Quelques pages que les clients peuvent consulter gratuitement avant d'acheter.<br/>
                    📦 <b style={{ color: "#c9a84c" }}>Obligatoire pour les livres papier uniquement</b>
                  </div>
                  {form.excerpt_pdf_url ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#4caf50", fontSize: 12 }}>✅ Extrait PDF uploadé</span>
                      <button onClick={() => setForm(f => ({ ...f, excerpt_pdf_url: "" }))}
                        style={{ background: "none", border: "1px solid #555", color: "#aaa", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>
                        Supprimer
                      </button>
                    </div>
                  ) : (
                    <>
                      <input type="file" accept=".pdf" id="excerptPdfFileInput" style={{ display: "none" }} onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const fileName = Date.now() + "_excerpt_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                        const { error } = await supabase.storage.from("books-pdf").upload(fileName, file, { contentType: "application/pdf" });
                        if (!error) {
                          const { data: urlData } = supabase.storage.from("books-pdf").getPublicUrl(fileName);
                          setForm(f => ({ ...f, excerpt_pdf_url: urlData.publicUrl }));
                        } else {
                          alert("Erreur upload : " + error.message);
                        }
                        e.target.value = "";
                      }} />
                      <button
                        type="button"
                        onClick={() => document.getElementById("excerptPdfFileInput").click()}
                        style={{ width: "100%", padding: "10px 12px", border: "2px dashed #c9a84c66", borderRadius: 6, cursor: "pointer", color: "#c9a84c", fontSize: 12, textAlign: "center", background: "#0a0a0a", fontWeight: "bold" }}
                      >
                        📁 Choisir un fichier PDF extrait
                      </button>
                    </>
                  )}
                </div>
                )}

                {/* Contenu complet PDF/Texte : seulement pour numerique et mixte */}
                {(form.product_type === "numerique" || form.product_type === "mixte") && (
                <>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                  ⬇️ <b>Contenu complet</b> (optionnel — laisse vide si le livre est uniquement disponible en papier)
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
                </>
                )}

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
                        <label style={{ fontSize: 11, color: "#c9a84c", display: "block", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Extrait automatique du PDF</label>

                        <div style={{ marginBottom: 4 }}>
                          <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 4 }}>📄 Nombre de pages à offrir gratuitement :</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="number" min="1" max="50" value={form.extract_pages} onChange={e => setForm(f => ({ ...f, extract_pages: parseInt(e.target.value) || 5 }))}
                              style={{ ...inputStyle, width: 70 }} />
                            <span style={{ color: "#888", fontSize: 12 }}>pages</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                            💡 Ces pages seront extraites automatiquement du PDF principal (si pas d'extrait PDF séparé)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Zone texte - seulement pour livres numériques et mixtes (sans pdf_url) */}
                {!form.pdf_url && (form.product_type === "numerique" || form.product_type === "mixte") && (<>
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

              {/* Section Audio (ancien - synthèse vocale fallback) : seulement pour livres numeriques et mixtes */}
              {(form.product_type === "numerique" || form.product_type === "mixte") && (
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
              )}

              {/* Options lecture / téléchargement : seulement pour livres numériques et mixtes (PAS papier, PAS article, PAS audio) */}
              {(form.product_type === "numerique" || form.product_type === "mixte") && (
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
              )}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: "12px 0", background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: "#888", cursor: "pointer", fontSize: 14 }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: "12px 0", background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                {saving ? "Enregistrement..." : editingBook ? "Mettre à jour" : "Ajouter"}
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

// ============================================
// COMPOSANT : Vue Statistiques PWA (Admin)
// ============================================
function PwaStatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      const { count: totalInstalls } = await supabase
        .from("pwa_installs").select("*", { count: "exact", head: true });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { count: installsToday } = await supabase
        .from("pwa_installs").select("*", { count: "exact", head: true })
        .gte("installed_at", today.toISOString());

      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: installsThisWeek } = await supabase
        .from("pwa_installs").select("*", { count: "exact", head: true })
        .gte("installed_at", weekAgo.toISOString());

      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
      const { count: installsThisMonth } = await supabase
        .from("pwa_installs").select("*", { count: "exact", head: true })
        .gte("installed_at", monthAgo.toISOString());

      const { count: activeUsers } = await supabase
        .from("pwa_installs").select("*", { count: "exact", head: true })
        .gte("last_seen_at", monthAgo.toISOString());

      const estimatedUninstalls = (totalInstalls || 0) - (activeUsers || 0);

      const { count: launchesToday } = await supabase
        .from("pwa_launches").select("*", { count: "exact", head: true })
        .gte("launched_at", today.toISOString());

      const { count: launchesThisWeek } = await supabase
        .from("pwa_launches").select("*", { count: "exact", head: true })
        .gte("launched_at", weekAgo.toISOString());

      const { count: totalLaunches } = await supabase
        .from("pwa_launches").select("*", { count: "exact", head: true });

      const { data: platformsData } = await supabase
        .from("pwa_installs").select("platform");
      const platformCounts = (platformsData || []).reduce((acc, row) => {
        const p = row.platform || "other";
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});

      const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { data: oldInstalls } = await supabase
        .from("pwa_installs").select("device_id, last_seen_at")
        .gte("installed_at", twoWeeksAgo.toISOString())
        .lte("installed_at", oneWeekAgo.toISOString());

      let retention7d = 0;
      if (oldInstalls && oldInstalls.length > 0) {
        const stillActive = oldInstalls.filter(i => new Date(i.last_seen_at) > oneWeekAgo).length;
        retention7d = Math.round((stillActive / oldInstalls.length) * 100);
      }

      setStats({
        totalInstalls: totalInstalls || 0,
        installsToday: installsToday || 0,
        installsThisWeek: installsThisWeek || 0,
        installsThisMonth: installsThisMonth || 0,
        activeUsers: activeUsers || 0,
        estimatedUninstalls: Math.max(0, estimatedUninstalls),
        launchesToday: launchesToday || 0,
        launchesThisWeek: launchesThisWeek || 0,
        totalLaunches: totalLaunches || 0,
        platformCounts,
        retention7d,
      });
    } catch (err) {
      console.error("[PWA Stats] Erreur:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ color: "#888", padding: 40, textAlign: "center" }}>⏳ Chargement des stats PWA...</div>;
  }

  if (!stats) return <div style={{ color: "#888", padding: 40 }}>Erreur de chargement.</div>;

  const totalPlatforms = Object.values(stats.platformCounts).reduce((a, b) => a + b, 0);
  const platformLabels = { android: "🤖 Android", ios: "🍎 iPhone", desktop: "💻 Desktop", other: "❓ Autre" };
  const card = { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16 };

  return (
    <div>
      <h2 style={{ color: "#c9a84c", fontSize: 18, marginBottom: 8 }}>📱 Statistiques PWA</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>
        Suivi des installations de l'application mobile CarryBooks
      </p>

      <div style={{
        background: "linear-gradient(135deg, #c9a84c 0%, #8b6914 100%)",
        color: "#000", borderRadius: 12, padding: 24, marginBottom: 16,
        boxShadow: "0 4px 12px rgba(201,168,76,0.2)"
      }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>
          📲 TOTAL INSTALLATIONS
        </div>
        <div style={{ fontSize: 48, fontWeight: "bold", lineHeight: 1 }}>{stats.totalInstalls}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 10 }}>
          {stats.installsToday > 0
            ? `+${stats.installsToday} aujourd'hui · +${stats.installsThisWeek} cette semaine`
            : `+${stats.installsThisWeek} cette semaine`}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12, marginBottom: 16
      }}>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>🆕 AUJOURD'HUI</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#c9a84c" }}>{stats.installsToday}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>📅 7 JOURS</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#e8e0d0" }}>{stats.installsThisWeek}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>🗓️ 30 JOURS</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#e8e0d0" }}>{stats.installsThisMonth}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>✅ ACTIFS (30J)</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#22c55e" }}>{stats.activeUsers}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>❌ DÉSINSTALL.</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#ef4444" }}>{stats.estimatedUninstalls}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>🚀 OUVERTURES (24H)</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#e8e0d0" }}>{stats.launchesToday}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>🚀 OUVERTURES (7J)</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#e8e0d0" }}>{stats.launchesThisWeek}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, letterSpacing: 1 }}>🚀 TOTAL OUVERTURES</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#c9a84c" }}>{stats.totalLaunches}</div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 10, letterSpacing: 1 }}>📊 RÉTENTION 7 JOURS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            fontSize: 32, fontWeight: "bold",
            color: stats.retention7d >= 70 ? "#22c55e" : stats.retention7d >= 40 ? "#f59e0b" : "#ef4444",
            minWidth: 80
          }}>
            {stats.retention7d}%
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: "#0a0a0a", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${stats.retention7d}%`, height: "100%",
                background: stats.retention7d >= 70 ? "#22c55e" : stats.retention7d >= 40 ? "#f59e0b" : "#ef4444",
                transition: "width 0.5s"
              }} />
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
              {stats.retention7d >= 70 ? "Excellent ! Tes utilisateurs reviennent." : stats.retention7d >= 40 ? "Correct, peut être amélioré" : "À améliorer — pas assez de retours"}
            </div>
          </div>
        </div>
      </div>

      {totalPlatforms > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12, letterSpacing: 1 }}>📱 RÉPARTITION PAR APPAREIL</div>
          {Object.entries(stats.platformCounts).sort((a, b) => b[1] - a[1]).map(([p, count]) => {
            const pct = Math.round((count / totalPlatforms) * 100);
            return (
              <div key={p} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "#e8e0d0" }}>{platformLabels[p] || p}</span>
                  <span style={{ color: "#888" }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: "#0a0a0a", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: "#c9a84c", transition: "width 0.5s"
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        background: "rgba(201,168,76,0.08)",
        border: "1px solid rgba(201,168,76,0.2)",
        borderRadius: 8, padding: 14, marginTop: 16
      }}>
        <div style={{ fontSize: 12, color: "#c9a84c", marginBottom: 6, fontWeight: 600 }}>💡 Note</div>
        <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.5 }}>
          Le tracking compte les installations depuis sa mise en place. Les anciens utilisateurs qui ont l'app installée sont récupérés automatiquement dès leur prochaine ouverture (backfill).
        </div>
      </div>

      <div style={{ textAlign: "center", color: "#666", fontSize: 11, marginTop: 20 }}>
        🔄 Mise à jour automatique toutes les 30 secondes
      </div>
    </div>
  );
}


