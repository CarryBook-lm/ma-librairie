import { useState, useEffect } from "react";
import { getAllBooks, addBook, updateBook, deleteBookDB } from "./supabase.js";

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
  const map = { "actif": ["#4E9E5F","rgba(78,158,95,0.12)"], "inactif": ["#5A5040","rgba(90,80,64,0.12)"] };
  const [color, bg] = map[status] || ["#A89880","rgba(168,152,128,0.1)"];
  return <span style={{ fontFamily: "Lato,sans-serif", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color, background: bg, padding: "3px 10px", border: `1px solid ${color}33` }}>{status}</span>;
}

export default function Admin() {
  const [page, setPage] = useState("dashboard");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("infos");
  const [uploading, setUploading] = useState(false);

  const PF = { fontFamily: "'Playfair Display',Georgia,serif" };
  const S = { fontFamily: "Lato,sans-serif" };

  useEffect(() => { loadBooks(); }, []);

  const loadBooks = async () => {
    setLoading(true);
    const data = await getAllBooks();
    setBooks(data);
    setLoading(false);
  };

  const showToast = (msg, color = "#4E9E5F") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  const openAdd = () => { setEditBook(null); setBookForm(EMPTY_BOOK); setActiveTab("infos"); setShowBookModal(true); };
  const openEdit = (book) => { setEditBook(book); setBookForm({ ...book, price: book.price?.toString() }); setActiveTab("infos"); setShowBookModal(true); };

  const saveBook = async () => {
    if (!bookForm.title || !bookForm.author || !bookForm.price) { showToast("Remplis titre, auteur et prix", "#C44B4B"); return; }
    setSaving(true);
    const bookData = { ...bookForm, price: parseInt(bookForm.price) };
    if (editBook) {
      const updated = await updateBook(editBook.id, bookData);
      if (updated) { showToast("Livre modifié ✓"); await loadBooks(); }
      else showToast("Erreur lors de la modification", "#C44B4B");
    } else {
      const added = await addBook(bookData);
      if (added) { showToast("Livre publié ✓"); await loadBooks(); }
      else showToast("Erreur lors de l'ajout", "#C44B4B");
    }
    setSaving(false);
    setShowBookModal(false);
  };

  const deleteBook = async (id) => {
    const ok = await deleteBookDB(id);
    if (ok) { showToast("Livre supprimé", "#C44B4B"); await loadBooks(); }
    setDeleteConfirm(null);
  };

  const toggleStatus = async (book) => {
    const newStatus = book.status === "actif" ? "inactif" : "actif";
    await updateBook(book.id, { status: newStatus });
    await loadBooks();
  };

  const inputStyle = { background: "#0F0D0A", border: "1px solid #3A3228", color: "#F5F0E8", padding: "11px 14px", ...S, fontSize: 14, width: "100%", outline: "none" };
  const labelStyle = { ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7, display: "block" };

  const navItems = [
    { id: "dashboard", label: "Tableau de bord", icon: "📊" },
    { id: "books", label: "Livres", icon: "📚" },
  ];

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
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0F0D0A}::-webkit-scrollbar-thumb{background:#2A2420}
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#1A1713", border: `1px solid ${toast.color}44`, padding: "12px 20px", zIndex: 500, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: toast.color }}>●</span>
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
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ ...PF, fontSize: 18, fontWeight: 700 }}>{editBook ? "Modifier le livre" : "Ajouter un livre"}</p>
              <button onClick={() => setShowBookModal(false)} style={{ background: "none", border: "1px solid #3A3228", color: "#A89880", width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
            <div style={{ display: "flex", borderBottom: "1px solid #2A2420" }}>
              {[["infos","📋 Informations"],["contenu","📝 Contenu du livre"]].map(([id,label]) => (
                <button key={id} onClick={() => setActiveTab(id)} className="btn"
                  style={{ flex: 1, padding: "13px", background: activeTab===id ? "rgba(201,169,110,0.08)" : "transparent", border: "none", borderBottom: activeTab===id ? "2px solid #C9A96E" : "2px solid transparent", color: activeTab===id ? "#C9A96E" : "#5A5040", ...S, fontSize: 13, fontWeight: activeTab===id ? 700 : 400, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ padding: "24px" }}>
              {activeTab === "infos" && (
                <div>
                  {[
                    { key: "title", label: "Titre *", placeholder: "Titre du livre", type: "text" },
                    { key: "author", label: "Auteur *", placeholder: "Nom et prénom", type: "text" },
                    { key: "price", label: "Prix (FCFA) *", placeholder: "Ex: 2500", type: "number" },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder} value={bookForm[f.key] || ""}
                        onChange={e => setBookForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}

                  {/* COUVERTURE — Upload ou URL */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Couverture du livre *</label>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      {/* Bouton upload */}
                      <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", cursor: "pointer", ...S, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#0F0D0A" }}>
                        {uploading ? "⏳ Upload en cours..." : "📁 Uploader depuis mon PC"}
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setUploading(true);
                            try {
                              const formData = new FormData();
                              formData.append("image", file);
                              const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_KEY}`, {
                                method: "POST",
                                body: formData,
                              });
                              const data = await res.json();
                              if (data.success) {
                                setBookForm(p => ({ ...p, cover: data.data.url }));
                                showToast("Image uploadée ✓");
                              } else {
                                showToast("Erreur upload", "#C44B4B");
                              }
                            } catch {
                              showToast("Erreur connexion", "#C44B4B");
                            }
                            setUploading(false);
                          }} />
                      </label>
                    </div>
                    {/* Ou saisir URL manuellement */}
                    <input type="text" placeholder="Ou colle une URL d'image : https://..." value={bookForm.cover || ""}
                      onChange={e => setBookForm(p => ({ ...p, cover: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Catégorie</label>
                    <select value={bookForm.category} onChange={e => setBookForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Résumé</label>
                    <textarea placeholder="Décris ton livre en 2-3 phrases..." value={bookForm.summary || ""}
                      onChange={e => setBookForm(p => ({ ...p, summary: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 90, padding: "11px 14px" }} />
                  </div>
                  {bookForm.cover && (
                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>Aperçu</label>
                      <img src={bookForm.cover} alt="" style={{ width: 80, height: 110, objectFit: "cover", border: "1px solid #3A3228" }} onError={e => e.target.style.display="none"} />
                    </div>
                  )}
                  <button className="btn" onClick={() => setActiveTab("contenu")}
                    style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid #C9A96E", color: "#C9A96E", ...S, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                    Suivant — Ajouter le contenu →
                  </button>
                </div>
              )}
              {activeTab === "contenu" && (
                <div>
                  <div style={{ padding: "14px 16px", background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.2)", marginBottom: 20 }}>
                    <p style={{ ...S, fontSize: 12, color: "#C9A96E", fontWeight: 700, marginBottom: 6 }}>💡 Format :</p>
                    <p style={{ ...S, fontSize: 12, color: "#A89880", lineHeight: 1.7 }}>
                      • <strong style={{ color: "#F5F0E8" }}>Chapitre 1 : Titre</strong> pour créer un chapitre<br />
                      • Ligne vide entre les paragraphes<br />
                      • <strong style={{ color: "#F5F0E8" }}>**texte**</strong> pour mettre en gras
                    </p>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Contenu complet du livre</label>
                    <textarea placeholder="Chapitre 1 : Introduction&#10;&#10;Tapez ou collez le contenu ici..."
                      value={bookForm.content || ""}
                      onChange={e => setBookForm(p => ({ ...p, content: e.target.value }))}
                      style={{ ...inputStyle, minHeight: 320, padding: "14px", lineHeight: 1.7, fontSize: 13 }} />
                    <p style={{ ...S, fontSize: 11, color: "#5A5040", marginTop: 6 }}>
                      {(bookForm.content || "").length} caractères · ~{Math.ceil((bookForm.content || "").length / 1500)} pages
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn" onClick={() => setActiveTab("infos")}
                      style={{ padding: "12px 20px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
                      ← Retour
                    </button>
                    <button className="btn" onClick={saveBook} disabled={saving}
                      style={{ flex: 1, padding: "12px", background: saving ? "#3A3228" : "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                      {saving ? "Publication..." : editBook ? "✓ Enregistrer" : "✓ Publier le livre"}
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
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderLeft: page===item.id ? "2px solid #C9A96E" : "2px solid transparent", background: page===item.id ? "rgba(201,169,110,0.06)" : "transparent" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ ...S, fontSize: 13, color: page===item.id ? "#C9A96E" : "#7A6850", fontWeight: page===item.id ? 700 : 400 }}>{item.label}</span>
            </div>
          ))}
          <a href="/" target="_blank" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", textDecoration: "none", borderLeft: "2px solid transparent" }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            <span style={{ ...S, fontSize: 13, color: "#7A6850" }}>Voir le site</span>
          </a>
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

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 20 }}>
            <div style={{ width: 40, height: 40, border: "2px solid #2A2420", borderTop: "2px solid #C9A96E", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <p style={{ ...S, fontSize: 13, color: "#5A5040" }}>Chargement...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* DASHBOARD */}
            {page === "dashboard" && (
              <div>
                <div style={{ marginBottom: 32 }}>
                  <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Vue d'ensemble</p>
                  <h1 style={{ ...PF, fontSize: 32, fontWeight: 900 }}>Tableau de bord</h1>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 36 }}>
                  <StatCard label="Livres publiés" value={books.filter(b=>b.status==="actif").length} sub={`${books.length} au total`} color="#C9A96E" icon="📚" />
                  <StatCard label="Avec contenu" value={books.filter(b=>b.content).length} sub={`${books.filter(b=>!b.content).length} sans contenu`} color="#4E9E5F" icon="📝" />
                  <StatCard label="Valeur catalogue" value={`${books.reduce((s,b)=>s+(b.price||0),0).toLocaleString()} F`} sub="Prix total des livres" color="#7B6EC6" icon="💰" />
                </div>

                <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
                  <div style={{ padding: "18px 20px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between" }}>
                    <p style={{ ...PF, fontSize: 16, fontWeight: 700 }}>Tous les livres</p>
                    <button className="btn" onClick={() => setPage("books")} style={{ background: "none", border: "none", color: "#C9A96E", ...S, fontSize: 12, cursor: "pointer" }}>Gérer →</button>
                  </div>
                  {books.slice(0,5).map(book => (
                    <div key={book.id} className="row" style={{ padding: "12px 20px", borderBottom: "1px solid #1E1B16", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&q=60"} alt="" style={{ width: 36, height: 48, objectFit: "cover" }} />
                        <div>
                          <p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{book.title}</p>
                          <p style={{ ...S, fontSize: 11, color: "#5A5040" }}>{book.author} · {book.category}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{book.price?.toLocaleString()} F</p>
                        {book.content ? <span style={{ ...S, fontSize: 10, color: "#4E9E5F", background: "rgba(78,158,95,0.1)", padding: "3px 8px" }}>✓ Contenu</span> : <span style={{ ...S, fontSize: 10, color: "#C44B4B", background: "rgba(196,75,75,0.1)", padding: "3px 8px" }}>✗ Vide</span>}
                        <Badge status={book.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOOKS */}
            {page === "books" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
                  <div>
                    <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 6 }}>Gestion</p>
                    <h1 style={{ ...PF, fontSize: 32, fontWeight: 900 }}>Livres ({books.length})</h1>
                  </div>
                  <button className="btn" onClick={openAdd}
                    style={{ padding: "12px 24px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                    + Ajouter un livre
                  </button>
                </div>

                {books.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0", background: "#161310", border: "1px solid #2A2420" }}>
                    <p style={{ ...PF, fontSize: 22, color: "#5A5040", marginBottom: 20 }}>Aucun livre pour l'instant</p>
                    <button className="btn" onClick={openAdd}
                      style={{ padding: "12px 24px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                      + Ajouter votre premier livre
                    </button>
                  </div>
                ) : (
                  <div style={{ background: "#161310", border: "1px solid #2A2420" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 120px 100px 80px 80px 130px", padding: "12px 20px", borderBottom: "1px solid #2A2420" }}>
                      {["","Livre","Catégorie","Prix","Contenu","Statut","Actions"].map(h => (
                        <p key={h} style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</p>
                      ))}
                    </div>
                    {books.map(book => (
                      <div key={book.id} className="row" style={{ display: "grid", gridTemplateColumns: "auto 1fr 120px 100px 80px 80px 130px", padding: "14px 20px", borderBottom: "1px solid #1E1B16", alignItems: "center" }}>
                        <img src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&q=60"} alt="" style={{ width: 40, height: 54, objectFit: "cover", marginRight: 14 }} />
                        <div>
                          <p style={{ ...S, fontSize: 13, fontWeight: 700 }}>{book.title}</p>
                          <p style={{ ...S, fontSize: 11, color: "#5A5040", marginTop: 2 }}>{book.author}</p>
                        </div>
                        <p style={{ ...S, fontSize: 12, color: "#A89880" }}>{book.category}</p>
                        <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{book.price?.toLocaleString()} F</p>
                        <div>
                          {book.content
                            ? <span style={{ ...S, fontSize: 10, color: "#4E9E5F", background: "rgba(78,158,95,0.1)", padding: "3px 8px", border: "1px solid rgba(78,158,95,0.3)" }}>✓ Oui</span>
                            : <span style={{ ...S, fontSize: 10, color: "#C44B4B", background: "rgba(196,75,75,0.1)", padding: "3px 8px", border: "1px solid rgba(196,75,75,0.3)" }}>✗ Non</span>}
                        </div>
                        <Badge status={book.status} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn" onClick={() => openEdit(book)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", fontSize: 11, cursor: "pointer" }}>✏️</button>
                          <button className="btn" onClick={() => toggleStatus(book)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid #3A3228", color: book.status==="actif"?"#C9A96E":"#5A5040", fontSize: 11, cursor: "pointer" }}>{book.status==="actif"?"🟢":"⚫"}</button>
                          <button className="btn" onClick={() => setDeleteConfirm(book.id)} style={{ padding: "6px 10px", background: "transparent", border: "1px solid #3A2020", color: "#C44B4B", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
