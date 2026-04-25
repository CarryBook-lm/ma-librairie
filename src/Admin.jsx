import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CATEGORIES = ["Romans", "Histoires", "Lyrics", "Amour", "Humour", "Autres"];

const emptyForm = {
  title: "", author: "", price: "", cover: "", category: "Romans",
  summary: "", content: "", status: "actif"
};

export default function Admin() {
  const [view, setView] = useState("dashboard");
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("info");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchBooks(); fetchUsers(); }, []);

  async function fetchBooks() {
    const { data } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (data) setBooks(data);
  }

  async function fetchUsers() {
    const { data } = await supabase.from("purchases").select("user_id, book_id, created_at");
    if (data) setUsers(data);
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
    const payload = { ...form, price: parseInt(form.price) || 0 };
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
    setForm({ ...book, price: String(book.price) });
    setShowForm(true);
    setActiveTab("info");
  }

  function openAdd() {
    setEditingBook(null);
    setForm(emptyForm);
    setShowForm(true);
    setActiveTab("info");
  }

  const totalRevenue = books.reduce((s, b) => s + (b.price || 0) * (b.sales || 0), 0);
  const activeBooks = books.filter(b => b.status === "actif").length;

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
          ].map(item => (
            <div key={item.id} onClick={() => { setView(item.id); setShowMenu(false); }}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Revenus", value: `${totalRevenue.toLocaleString()} F`, icon: "💰" },
                { label: "Actifs", value: activeBooks, icon: "📚" },
                { label: "Total", value: books.length, icon: "📖" },
              ].map((stat, i) => (
                <div key={i} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#c9a84c" }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
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
                      <span style={{ fontSize: 11, color: "#aaa" }}>{book.category}</span>
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
                return (
                  <div key={userId} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>ID : {userId.substring(0, 16)}...</div>
                        <div style={{ fontSize: 12, color: "#aaa" }}>Dernier achat : {new Date(lastPurchase.created_at).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <div style={{ background: "#2a2a2a", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#c9a84c" }}>
                        {userPurchases.length} livre{userPurchases.length > 1 ? "s" : ""}
                      </div>
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
                  <label style={labelStyle}>PRIX (FCFA) *</label>
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: 2500 (0 pour gratuit)" type="number" style={inputStyle} />
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
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
              </div>
            )}

            {/* Boutons */}
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
