import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CATEGORIES = ["Business", "Roman", "Développement personnel", "Religion", "Science", "Histoire", "Jeunesse", "Autre"];

const emptyForm = {
  title: "", author: "", price: "", cover: "", category: "Business",
  summary: "", content: "", status: "actif"
};

export default function Admin() {
  const [view, setView] = useState("dashboard");
  const [books, setBooks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("info");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { fetchBooks(); }, []);

  async function fetchBooks() {
    const { data } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (data) setBooks(data);
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
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f0f0f", color: "#e8e0d0", fontFamily: "Georgia, serif" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#1a1a1a", borderRight: "1px solid #2a2a2a", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #2a2a2a" }}>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#c9a84c", letterSpacing: 2 }}>LIBRAIRIE</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Admin</div>
        </div>
        {[
          { id: "dashboard", label: "Tableau de bord", icon: "📊" },
          { id: "books", label: "Livres", icon: "📚" },
        ].map(item => (
          <div key={item.id} onClick={() => setView(item.id)}
            style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              background: view === item.id ? "#2a2a2a" : "transparent",
              color: view === item.id ? "#c9a84c" : "#aaa",
              borderLeft: view === item.id ? "3px solid #c9a84c" : "3px solid transparent" }}>
            <span>{item.icon}</span><span style={{ fontSize: 14 }}>{item.label}</span>
          </div>
        ))}
        <div style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "#aaa" }}
          onClick={() => window.open("/", "_blank")}>
          <span>🌐</span><span style={{ fontSize: 14 }}>Voir le site</span>
        </div>
        <div style={{ position: "absolute", bottom: 20, left: 0, width: 220, padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "#000" }}>A</div>
            <span style={{ fontSize: 13, color: "#aaa" }}>Admin</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <h1 style={{ fontSize: 24, color: "#c9a84c", marginBottom: 24 }}>Tableau de bord</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Revenus totaux", value: `${totalRevenue.toLocaleString()} FCFA`, icon: "💰" },
                { label: "Livres actifs", value: activeBooks, icon: "📚" },
                { label: "Total livres", value: books.length, icon: "📖" },
              ].map((stat, i) => (
                <div key={i} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: "bold", color: "#c9a84c" }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 20 }}>
              <h3 style={{ color: "#c9a84c", marginBottom: 16 }}>Derniers livres ajoutés</h3>
              {books.slice(0, 5).map(book => (
                <div key={book.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #2a2a2a" }}>
                  {book.cover && <img src={book.cover} alt="" style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#e8e0d0" }}>{book.title}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{book.author}</div>
                  </div>
                  <div style={{ color: "#c9a84c", fontSize: 14 }}>{book.price === 0 ? "Gratuit" : `${book.price?.toLocaleString()} FCFA`}</div>
                  <div style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: book.status === "actif" ? "#1a3a1a" : "#3a1a1a", color: book.status === "actif" ? "#4caf50" : "#f44336" }}>{book.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOOKS */}
        {view === "books" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, color: "#c9a84c" }}>Livres</h1>
              <button onClick={openAdd}
                style={{ background: "#c9a84c", color: "#000", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 14 }}>
                + AJOUTER UN LIVRE
              </button>
            </div>

            {/* Books table */}
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                    {["Couverture", "Titre / Auteur", "Prix", "Catégorie", "Contenu", "Statut", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {books.map(book => (
                    <tr key={book.id} style={{ borderBottom: "1px solid #1e1e1e" }}>
                      <td style={{ padding: "12px 16px" }}>
                        {book.cover ? <img src={book.cover} alt="" style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }} /> : <div style={{ width: 40, height: 56, background: "#2a2a2a", borderRadius: 4 }} />}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, color: "#e8e0d0" }}>{book.title}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{book.author}</div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#c9a84c" }}>{book.price === 0 ? "Gratuit" : `${book.price?.toLocaleString()} F`}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#aaa" }}>{book.category}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: book.content ? "#4caf50" : "#888" }}>{book.content ? "✓ Oui" : "✗ Non"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => toggleStatus(book)}
                          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: book.status === "actif" ? "#1a3a1a" : "#3a1a1a", color: book.status === "actif" ? "#4caf50" : "#f44336" }}>
                          {book.status}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => openEdit(book)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", marginRight: 8, fontSize: 16 }}>✏️</button>
                        <button onClick={() => handleDelete(book.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f44336", fontSize: 16 }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {books.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#555" }}>Aucun livre ajouté</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, width: "90%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ color: "#c9a84c", fontSize: 18 }}>{editingBook ? "Modifier le livre" : "Ajouter un livre"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #2a2a2a" }}>
              {[{ id: "info", label: "📋 Informations" }, { id: "content", label: "📝 Contenu" }].map(tab => (
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
                {/* Titre */}
                <div>
                  <label style={labelStyle}>TITRE *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Titre du livre" style={inputStyle} />
                </div>

                {/* Auteur */}
                <div>
                  <label style={labelStyle}>AUTEUR *</label>
                  <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                    placeholder="Nom et prénom" style={inputStyle} />
                </div>

                {/* Prix */}
                <div>
                  <label style={labelStyle}>PRIX (FCFA) *</label>
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: 2500 (mettez 0 pour gratuit)" type="number" style={inputStyle} />
                </div>

                {/* COUVERTURE */}
                <div>
                  <label style={labelStyle}>COUVERTURE</label>

                  {/* Bouton upload depuis PC */}
                  <div style={{ marginBottom: 10 }}>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      disabled={uploading}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 6, border: "2px dashed #c9a84c",
                        background: uploading ? "#1e1e1e" : "transparent", color: uploading ? "#888" : "#c9a84c",
                        cursor: uploading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: "bold",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                      }}>
                      {uploading ? "⏳ Upload en cours..." : "📁 Uploader depuis mon PC"}
                    </button>
                    {uploadError && <div style={{ color: "#f44336", fontSize: 12, marginTop: 6 }}>{uploadError}</div>}
                  </div>

                  {/* Séparateur */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
                    <span style={{ fontSize: 11, color: "#555" }}>OU COLLER UNE URL</span>
                    <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
                  </div>

                  <input value={form.cover} onChange={e => setForm(f => ({ ...f, cover: e.target.value }))}
                    placeholder="https://i.ibb.co/.../image.jpg" style={inputStyle} />

                  {/* Aperçu */}
                  {form.cover && (
                    <div style={{ marginTop: 10, textAlign: "center" }}>
                      <img src={form.cover} alt="Aperçu" style={{ maxHeight: 150, borderRadius: 6, border: "1px solid #2a2a2a" }}
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
                <button onClick={() => {
                  const cleaned = form.content
                    .replace(/
/g, '
')
                    .replace(/([^
])
([^
])/g, '$1 $2')
                    .replace(/
{3,}/g, '

')
                    .replace(/[ 	]+/g, ' ')
                    .trim();
                  setForm(f => ({ ...f, content: cleaned }));
                }} style={{ marginBottom: 10, padding: "8px 16px", background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: 12 }}>
                  🧹 Nettoyer le texte PDF
                </button>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="CHAPITRE 1&#10;&#10;Le texte de ton livre commence ici..." rows={16}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7 }} />
                <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                  {form.content ? `${form.content.length} caractères · ~${Math.ceil(form.content.length / 1800)} pages` : "Aucun contenu"}
                </div>
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: "10px 20px", background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: "#888", cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "10px 24px", background: "#c9a84c", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: saving ? "not-allowed" : "pointer" }}>
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
