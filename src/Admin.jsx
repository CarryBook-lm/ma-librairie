import { useState } from "react";

const INIT_BOOKS = [
  { id: 1, title: "L'Art de la Discipline", author: "Marcus Aurelius", category: "Développement Personnel", price: 2500, cover: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80", sales: 142, status: "actif", summary: "Un guide intemporel pour maîtriser son esprit.", content: "Chapitre 1 : Les Fondations\n\nToute grande réussite commence dans le silence d'une décision..." },
  { id: 2, title: "Entrepreneur d'Afrique", author: "Kofi Mensah", category: "Business", price: 3000, cover: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", sales: 98, status: "actif", summary: "Comment construire une entreprise prospère en Afrique.", content: "" },
  { id: 3, title: "Finances Sans Tabou", author: "Aïsha Diallo", category: "Finance", price: 2000, cover: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80", sales: 210, status: "actif", summary: "Comprendre et gérer son argent en Afrique francophone.", content: "" },
  { id: 4, title: "Le Code de la Résilience", author: "Dr. Serge Mballa", category: "Psychologie", price: 2800, cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80", sales: 67, status: "actif", summary: "Comment les personnes qui réussissent pensent différemment.", content: "" },
  { id: 5, title: "Marketing Digital Douala", author: "Jean-Paul Fotso", category: "Marketing", price: 3500, cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80", sales: 340, status: "actif", summary: "Vendre sur Facebook, Instagram et WhatsApp.", content: "" },
  { id: 6, title: "Santé & Vitalité Naturelle", author: "Dr. Amina Touré", category: "Santé", price: 1500, cover: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80", sales: 98, status: "actif", summary: "Récupérer une santé optimale avec des habitudes simples.", content: "" },
];

const INIT_ORDERS = [
  { id: "CMD-001", user: "Marie Nguema", email: "marie@gmail.com", book: "Marketing Digital Douala", amount: 3500, method: "Orange Money", date: "21/04/2025", status: "payé" },
  { id: "CMD-002", user: "Paul Biya Jr", email: "paul@gmail.com", book: "Finances Sans Tabou", amount: 2000, method: "MTN MoMo", date: "21/04/2025", status: "payé" },
  { id: "CMD-003", user: "Carine Eto'o", email: "carine@gmail.com", book: "L'Art de la Discipline", amount: 2500, method: "Visa", date: "20/04/2025", status: "payé" },
  { id: "CMD-004", user: "Alain Fomba", email: "alain@gmail.com", book: "Entrepreneur d'Afrique", amount: 3000, method: "PayPal", date: "20/04/2025", status: "en attente" },
  { id: "CMD-005", user: "Sandrine Mbo", email: "sandrine@gmail.com", book: "Le Code de la Résilience", amount: 2800, method: "Orange Money", date: "19/04/2025", status: "payé" },
  { id: "CMD-006", user: "Eric Tamba", email: "eric@gmail.com", book: "Santé & Vitalité Naturelle", amount: 1500, method: "MTN MoMo", date: "19/04/2025", status: "remboursé" },
];

const INIT_USERS = [
  { id: 1, name: "Marie Nguema", email: "marie@gmail.com", joined: "15/03/2025", books: 3, spent: 8500, status: "actif" },
  { id: 2, name: "Paul Biya Jr", email: "paul@gmail.com", joined: "02/04/2025", books: 1, spent: 2000, status: "actif" },
  { id: 3, name: "Carine Eto'o", email: "carine@gmail.com", joined: "10/04/2025", books: 2, spent: 5300, status: "actif" },
  { id: 4, name: "Alain Fomba", email: "alain@gmail.com", joined: "18/04/2025", books: 1, spent: 3000, status: "inactif" },
  { id: 5, name: "Sandrine Mbo", email: "sandrine@gmail.com", joined: "01/04/2025", books: 4, spent: 10800, status: "actif" },
];

const CATEGORIES = ["Développement Personnel", "Business", "Finance", "Marketing", "Psychologie", "Santé", "Roman", "Spiritualité", "Cuisine", "Education"];
const EMPTY_BOOK = { title: "", author: "", category: "Business", price: "", cover: "", summary: "", content: "", status: "actif" };

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: "#161310", border: "1px solid #2A2420", borderLeft: `3px solid ${color}`, padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontFamily: "Lato,sans-serif", fontSize: 11, letterSpacing: 2, color: "#5A5040", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>
          <p style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 28, fontWeight: 700, color: "#F5F0E8" }}>{value}</p>
          {sub && <p style={{ fontFamily: "Lato,sans-serif", fontSize: 12, color: color, marginTop: 6 }}>{sub}</p>}
        </div>
        <span style={{ fontSize: 24, opacity: 0.6 }}>{icon}</span>
      </div>
    </div>
  );
}

function Badge({ status }) {
  const map = { "payé": ["#4E9E5F","rgba(78,158,95,0.12)"], "en attente": ["#C9A96E","rgba(201,169,110,0.12)"], "remboursé": ["#C44B4B","rgba(196,75,75,0.12)"], "actif": ["#4E9E5F","rgba(78,158,95,0.12)"], "inactif": ["#5A5040","rgba(90,80,64,0.12)"] };
  const [color, bg] = map[status] || ["#A89880","rgba(168,152,128,0.1)"];
  return <span style={{ fontFamily: "Lato,sans-serif", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color, background: bg, padding: "3px 10px", border: `1px solid ${color}33` }}>{status}</span>;
}

export default function Admin() {
  const [page, setPage] = useState("dashboard");
  const [books, setBooks] = useState(INIT_BOOKS);
  const [orders] = useState(INIT_ORDERS);
  const [users] = useState(INIT_USERS);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchOrders, setSearchOrders] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [activeTab, setActiveTab] = useState("infos"); // "infos" | "contenu"

  const PF = { fontFamily: "'Playfair Display',Georgia,serif" };
  const S = { fontFamily: "Lato,sans-serif" };

  const showToast = (msg, color = "#4E9E5F") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };
  const totalRevenue = orders.filter(o => o.status === "payé").reduce((s, o) => s + o.amount, 0);
  const totalSales = orders.filter(o => o.status === "payé").length;

  const openAdd = () => { setEditBook(null); setBookForm(EMPTY_BOOK); setActiveTab("infos"); setShowBookModal(true); };
  const openEdit = (book) => { setEditBook(book); setBookForm({ ...book }); setActiveTab("infos"); setShowBookModal(true); };

  const saveBook = () => {
    if (!bookForm.title || !bookForm.author || !bookForm.price) { showToast("Remplis titre, auteur et prix", "#C44B4B"); return; }
    if (editBook) {
      setBooks(b => b.map(bk => bk.id === editBook.id ? { ...bk, ...bookForm, price: parseInt(bookForm.price) } : bk));
      showToast("Livre modifié ✓");
    } else {
      setBooks(b => [...b, { ...bookForm, id: Date.now(), price: parseInt(bookForm.price), sales: 0 }]);
      showToast("Livre ajouté ✓");
    }
    setShowBookModal(false);
  };

  const deleteBook = (id) => { setBooks(b => b.filter(bk => bk.id !== id)); setDeleteConfirm(null); showToast("Livre supprimé", "#C44B4B"); };
  const toggleStatus = (id) => setBooks(b => b.map(bk => bk.id === id ? { ...bk, status: bk.status === "actif" ? "inactif" : "actif" } : bk));

  const navItems = [
    { id: "dashboard", label: "Tableau de bord", icon: "📊" },
    { id: "books", label: "Livres", icon: "📚" },
    { id: "orders", label: "Commandes", icon: "🧾" },
    { id: "users", label: "Utilisateurs", icon: "👥" },
  ];

  const inputStyle = { background: "#0F0D0A", border: "1px solid #3A3228", color: "#F5F0E8", padding: "11px 14px", ...S, fontSize: 14, width: "100%", outline: "none" };
  const labelStyle = { ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7, display: "block" };

  return (
    <div style={{ ...S, background: "#0F0D0A", minHeight: "100vh", color: "#F5F0E8", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@300;400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{outline:none;font-family:Lato,sans-serif}
        .row:hover{background:rgba(255,255,255,0.02)!important}
        .nav-item{transition:all .2s;cursor:pointer}
        .nav-item:hover{background:rgba(201,169,110,0.06)!important}
        .btn{cursor:pointer;transition:all .2s}
        .btn:hover{opacity:.85}
        textarea{resize:vertical}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0F0D0A}::-webkit-scrollbar-thumb{background:#2A2420}
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#1A1713", border: `1px solid ${toast.color}44`, padding: "12px 20px", zIndex: 500, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: toast.color, fontSize: 16 }}>●</span>
          <span style={{ ...S, fontSize: 13 }}>{toast.msg}</span>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1A1713", border: "1px solid #3A3228", padding: "36px", maxWidth: 380, width: "90%", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>🗑️</p>
            <p style={{ ...PF, fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Supprimer ce livre ?</p>
            <p style={{ ...S, fontSize: 13, color: "#A89880", marginBottom: 28 }}>Cette action est irréversible.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "11px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>Annuler</button>
              <button className="btn" onClick={() => deleteBook(deleteConfirm)} style={{ flex: 1, padding: "11px", background: "#C44B4B", border: "none", color: "#fff", ...S, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK MODAL */}
      {showBookModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#1A1713", border: "1px solid #3A3228", width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }}>

            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ ...PF, fontSize: 18, fontWeight: 700 }}>{editBook ? "Modifier le livre" : "Ajouter un livre"}</p>
              <button onClick={() => setShowBookModal(false)} style={{ background: "none", border: "1px solid #3A3228", color: "#A89880", width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #2A2420" }}>
              {[["infos", "📋 Informations"], ["contenu", "📝 Contenu du livre"]].map(([id, label]) => (
                <button key={id} onClick={() => setActiveTab(id)} className="btn"
                  style={{ flex: 1, padding: "13px", background: activeTab === id ? "rgba(201,169,110,0.08)" : "transparent", border: "none", borderBottom: activeTab === id ? "2px solid #C9A96E" : "2px solid transparent", color: activeTab === id ? "#C9A96E" : "#5A5040", ...S, fontSize: 13, fontWeight: activeTab === id ? 700 : 400, cursor: "pointer", letterSpacing: 1 }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding: "24px" }}>

              {/* TAB 1 — Informations */}
              {activeTab === "infos" && (
                <div>
                  {[
                    { key: "title", label: "Titre *", placeholder: "Titre du livre", type: "text" },
                    { key: "author", label: "Auteur *", placeholder: "Nom et prénom de l'auteur", type: "text" },
                    { key: "price", label: "Prix (FCFA) *", placeholder: "Ex: 2500", type: "number" },
                    { key: "cover", label: "URL de la couverture", placeholder: "https://i.ibb.co/.../image.jpg", type: "text" },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder} value={bookForm[f.key] || ""}
                        onChange={e => setBookForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={inputStyle} />
                    </div>
                  ))}

                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Catégorie</label>
                    <select value={bookForm.category} onChange={e => setBookForm(p => ({ ...p, category: e.target.value }))}
                      style={{ ...inputStyle }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Résumé (description courte)</label>
                    <textarea placeholder="Décris ton livre en 2-3 phrases pour attirer les lecteurs..." value={bookForm.summary || ""}
                      onChange={e => setBookForm(p => ({ ...p, summary: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 90, padding: "11px 14px" }} />
                  </div>

                  {bookForm.cover && (
                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>Aperçu couverture</label>
                      <img src={bookForm.cover} alt="aperçu" style={{ width: 80, height: 110, objectFit: "cover", border: "1px solid #3A3228" }} onError={e => e.target.style.display = "none"} />
                    </div>
                  )}

                  <button className="btn" onClick={() => setActiveTab("contenu")}
                    style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid #C9A96E", color: "#C9A96E", ...S, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                    Suivant — Ajouter le contenu →
                  </button>
                </div>
              )}

              {/* TAB 2 — Contenu */}
              {activeTab === "contenu" && (
                <div>
                  <div style={{ padding: "14px 16px", background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.2)", marginBottom: 20 }}>
                    <p style={{ ...S, fontSize: 12, color: "#C9A96E", lineHeight: 1.6, fontWeight: 700, marginBottom: 6 }}>💡 Comment formater ton contenu :</p>
                    <p style={{ ...S, fontSize: 12, color: "#A89880", lineHeight: 1.7 }}>
                      • Écris <strong style={{ color: "#F5F0E8" }}>Chapitre 1 : Titre</strong> pour créer un chapitre<br />
                      • Laisse une ligne vide entre les paragraphes<br />
                      • Utilise <strong style={{ color: "#F5F0E8" }}>**texte**</strong> pour mettre en gras<br />
                      • Colle directement le texte de ton livre ici
                    </p>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Contenu complet du livre</label>
                    <textarea
                      placeholder={`Chapitre 1 : Introduction\n\nTapez ou collez le contenu de votre livre ici...\n\nChaque paragraphe séparé par une ligne vide sera affiché correctement dans le lecteur.\n\nChaque paragraphe séparé par une ligne vide sera affiché correctement dans le lecteur.\n\nChaque paragraphe séparé par une ligne vide sera affiché correctement dans le lecteur.\n\n**Texte en gras** pour mettre en valeur des points importants.\n\nChapitre 2 : Développement\n\nContinuez ici...`}
                      value={bookForm.content || ""}
                      onChange={e => setBookForm(p => ({ ...p, content: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 320, padding: "14px", lineHeight: 1.7, fontSize: 13 }}
                    />
                    <p style={{ ...S, fontSize: 11, color: "#5A5040", marginTop: 6 }}>
                      {(bookForm.content || "").length} caractères · ~{Math.ceil((bookForm.content || "").length / 1500)} pages
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn" onClick={() => setActiveTab("infos")}
                      style={{ padding: "12px 20px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
                      ← Retour
                    </button>
                    <button className="btn" onClick={saveBook}
                      style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                      {editBook ? "✓ Enregistrer les modifications" : "✓ Publier le livre"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ width: 220, background: "#0C0A08", borderRight: "1px solid #1E1B16", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid #1E1B16" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#C9A96E,#E8C98A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#0F0D0A", fontFamily: "Georgia" }}>L</span>
            </div>
            <div>
              <p style={{ ...PF, fontSize: 14, fontWeight: 700 }}>LIBRAIRIE</p>
              <p style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1 }}>ADMIN</p>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "16px 0" }}>
          {navItems.map(item => (
            <div key={item.id} className="nav-item" onClick={() => setPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderLeft: page === item.id ? "2px solid #C9A96E" : "2px solid transparent", background: page === item.id ? "rgba(201,169,110,0.06)" : "transparent" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ ...S, fontSize: 13, color: page === item.id ? "#C9A96E" : "#7A6850", fontWeight: page === item.id ? 700 : 400 }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1E1B16" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#C9A96E" }}>A</span>
            </div>
            <div>
              <p style={{ ...S, fontSize: 12, fontWeight: 700 }}>Admin</p>
              <p style={{ ...S, fontSize: 10, color: "#5A5040" }}>Propriétaire</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 36px" }}>

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Vue d'ensemble</p>
              <h1 style={{ ...PF, fontSize: 32, fontWeight: 900 }}>Tableau de bord</h1>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 36 }}>
              <StatCard label="Revenus totaux" value={`${totalRevenue.toLocaleString()} F`} sub="↑ +12% ce mois" color="#C9A96E" icon="💰" />
              <StatCard label="Ventes" value={totalSales} sub={`${orders.filter(o=>o.status==="en attente").length} en attente`} color="#4E9E5F" icon="🧾" />
              <StatCard label="Livres" value={books.length} sub={`${books.filter(b=>b.status==="actif").length} actifs`} color="#7B6EC6" icon="📚" />
              <StatCard label="Utilisateurs" value={users.length} sub={`${users.filter(u=>u.status==="actif").length} actifs`} color="#E07B54" icon="👥" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between" }}>
                  <p style={{ ...PF, fontSize: 16, fontWeight: 700 }}>Dernières commandes</p>
                  <button className="btn" onClick={() => setPage("orders")} style={{ background: "none", border: "none", color: "#C9A96E", ...S, fontSize: 12, cursor: "pointer" }}>Voir tout →</button>
                </div>
                {orders.slice(0,4).map(o => (
                  <div key={o.id} className="row" style={{ padding: "12px 20px", borderBottom: "1px solid #1E1B16", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{o.user}</p>
                      <p style={{ ...S, fontSize: 11, color: "#5A5040", marginTop: 2 }}>{o.book.substring(0,22)}...</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{o.amount.toLocaleString()} F</p>
                      <Badge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between" }}>
                  <p style={{ ...PF, fontSize: 16, fontWeight: 700 }}>Livres les plus vendus</p>
                  <button className="btn" onClick={() => setPage("books")} style={{ background: "none", border: "none", color: "#C9A96E", ...S, fontSize: 12, cursor: "pointer" }}>Voir tout →</button>
                </div>
                {[...books].sort((a,b) => b.sales-a.sales).slice(0,5).map((book,i) => (
                  <div key={book.id} className="row" style={{ padding: "12px 20px", borderBottom: "1px solid #1E1B16", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ ...PF, fontSize: 18, fontWeight: 900, color: i===0?"#C9A96E":"#2A2420", width: 24 }}>#{i+1}</span>
                    <img src={book.cover} alt="" style={{ width: 36, height: 48, objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{book.title.substring(0,24)}...</p>
                      <p style={{ ...S, fontSize: 11, color: "#5A5040" }}>{book.sales} ventes</p>
                    </div>
                    <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{(book.sales*book.price).toLocaleString()} F</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BOOKS */}
        {page === "books" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
              <div>
                <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Gestion</p>
                <h1 style={{ ...PF, fontSize: 32, fontWeight: 900 }}>Livres</h1>
              </div>
              <button className="btn" onClick={openAdd}
                style={{ padding: "12px 24px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                + Ajouter un livre
              </button>
            </div>
            <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 120px 100px 80px 80px 80px 130px", padding: "12px 20px", borderBottom: "1px solid #2A2420" }}>
                {["", "Livre", "Catégorie", "Prix", "Ventes", "Contenu", "Statut", "Actions"].map(h => (
                  <p key={h} style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</p>
                ))}
              </div>
              {books.map(book => (
                <div key={book.id} className="row" style={{ display: "grid", gridTemplateColumns: "auto 1fr 120px 100px 80px 80px 80px 130px", padding: "14px 20px", borderBottom: "1px solid #1E1B16", alignItems: "center" }}>
                  <img src={book.cover} alt="" style={{ width: 40, height: 54, objectFit: "cover", marginRight: 14 }} />
                  <div>
                    <p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{book.title}</p>
                    <p style={{ ...S, fontSize: 11, color: "#5A5040", marginTop: 2 }}>{book.author}</p>
                  </div>
                  <p style={{ ...S, fontSize: 12, color: "#A89880" }}>{book.category}</p>
                  <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{book.price.toLocaleString()} F</p>
                  <p style={{ ...S, fontSize: 13 }}>{book.sales}</p>
                  <div>
                    {book.content ? (
                      <span style={{ ...S, fontSize: 10, color: "#4E9E5F", background: "rgba(78,158,95,0.1)", padding: "3px 8px", border: "1px solid rgba(78,158,95,0.3)" }}>✓ Oui</span>
                    ) : (
                      <span style={{ ...S, fontSize: 10, color: "#C44B4B", background: "rgba(196,75,75,0.1)", padding: "3px 8px", border: "1px solid rgba(196,75,75,0.3)" }}>✗ Non</span>
                    )}
                  </div>
                  <Badge status={book.status} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => openEdit(book)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 11, cursor: "pointer" }}>✏️</button>
                    <button className="btn" onClick={() => toggleStatus(book.id)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid #3A3228", color: book.status==="actif"?"#C9A96E":"#5A5040", ...S, fontSize: 11, cursor: "pointer" }}>{book.status==="actif"?"🟢":"⚫"}</button>
                    <button className="btn" onClick={() => setDeleteConfirm(book.id)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid #3A2020", color: "#C44B4B", ...S, fontSize: 11, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {page === "orders" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Gestion</p>
              <h1 style={{ ...PF, fontSize: 32, fontWeight: 900 }}>Commandes</h1>
            </div>
            <input type="text" placeholder="Rechercher par client ou livre..." value={searchOrders} onChange={e => setSearchOrders(e.target.value)}
              style={{ maxWidth: 360, background: "#161310", border: "1px solid #2A2420", color: "#F5F0E8", padding: "10px 14px", fontSize: 13, marginBottom: 24, display: "block", width: "100%" }} />
            <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 100px 120px 100px 90px", padding: "12px 20px", borderBottom: "1px solid #2A2420" }}>
                {["ID","Client","Livre","Montant","Méthode","Date","Statut"].map(h => (
                  <p key={h} style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</p>
                ))}
              </div>
              {orders.filter(o => !searchOrders || o.user.toLowerCase().includes(searchOrders.toLowerCase()) || o.book.toLowerCase().includes(searchOrders.toLowerCase())).map(o => (
                <div key={o.id} className="row" style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 100px 120px 100px 90px", padding: "14px 20px", borderBottom: "1px solid #1E1B16", alignItems: "center" }}>
                  <p style={{ ...S, fontSize: 12, color: "#5A5040", fontFamily: "monospace" }}>{o.id}</p>
                  <div><p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{o.user}</p><p style={{ ...S, fontSize: 11, color: "#5A5040" }}>{o.email}</p></div>
                  <p style={{ ...S, fontSize: 12, color: "#A89880" }}>{o.book.substring(0,20)}...</p>
                  <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{o.amount.toLocaleString()} F</p>
                  <p style={{ ...S, fontSize: 12, color: "#A89880" }}>{o.method}</p>
                  <p style={{ ...S, fontSize: 12, color: "#5A5040" }}>{o.date}</p>
                  <Badge status={o.status} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, padding: "16px 20px", background: "#161310", border: "1px solid #2A2420" }}>
              <p style={{ ...S, fontSize: 13, color: "#A89880" }}>Total paiements confirmés</p>
              <p style={{ ...PF, fontSize: 22, fontWeight: 700, color: "#C9A96E" }}>{totalRevenue.toLocaleString()} FCFA</p>
            </div>
          </div>
        )}

        {/* USERS */}
        {page === "users" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Gestion</p>
              <h1 style={{ ...PF, fontSize: 32, fontWeight: 900 }}>Utilisateurs</h1>
            </div>
            <input type="text" placeholder="Rechercher un utilisateur..." value={searchUsers} onChange={e => setSearchUsers(e.target.value)}
              style={{ maxWidth: 360, background: "#161310", border: "1px solid #2A2420", color: "#F5F0E8", padding: "10px 14px", fontSize: 13, marginBottom: 24, display: "block", width: "100%" }} />
            <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 80px 120px 80px", padding: "12px 20px", borderBottom: "1px solid #2A2420" }}>
                {["Utilisateur","Email","Inscription","Livres","Dépenses","Statut"].map(h => (
                  <p key={h} style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</p>
                ))}
              </div>
              {users.filter(u => !searchUsers || u.name.toLowerCase().includes(searchUsers.toLowerCase()) || u.email.toLowerCase().includes(searchUsers.toLowerCase())).map(u => (
                <div key={u.id} className="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 80px 120px 80px", padding: "14px 20px", borderBottom: "1px solid #1E1B16", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,169,110,0.12)", border: "1px solid rgba(201,169,110,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 12, color: "#C9A96E" }}>{u.name[0]}</span>
                    </div>
                    <p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{u.name}</p>
                  </div>
                  <p style={{ ...S, fontSize: 12, color: "#5A5040" }}>{u.email}</p>
                  <p style={{ ...S, fontSize: 12, color: "#A89880" }}>{u.joined}</p>
                  <p style={{ ...S, fontSize: 13, textAlign: "center" }}>{u.books}</p>
                  <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{u.spent.toLocaleString()} F</p>
                  <Badge status={u.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

