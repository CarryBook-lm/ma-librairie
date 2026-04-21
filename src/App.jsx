import { useState, useEffect } from "react";

const BOOKS = [
  { id: 1, title: "L'Art de la Discipline", author: "Marcus Aurelius", category: "Développement Personnel", price: 2500, cover: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80", summary: "Un guide intemporel pour maîtriser son esprit, ses émotions et ses actions au quotidien. Basé sur la philosophie stoïcienne, ce livre transforme votre façon de voir les obstacles.", pages: 220, rating: 4.8, readers: 1240, color: "#C9A96E" },
  { id: 2, title: "Entrepreneur d'Afrique", author: "Kofi Mensah", category: "Business", price: 3000, cover: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", summary: "Comment construire une entreprise prospère dans un marché émergent africain. Des stratégies concrètes, des témoignages réels, des erreurs à éviter.", pages: 310, rating: 4.9, readers: 870, color: "#E07B54" },
  { id: 3, title: "Finances Sans Tabou", author: "Aïsha Diallo", category: "Finance", price: 2000, cover: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80", summary: "Comprendre et gérer son argent en Afrique francophone. Épargne, investissement, crédit — tout ce que l'on ne vous a jamais enseigné à l'école.", pages: 180, rating: 4.7, readers: 2100, color: "#5B9E8F" },
  { id: 4, title: "Le Code de la Résilience", author: "Dr. Serge Mballa", category: "Psychologie", price: 2800, cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80", summary: "Face aux crises, comment les personnes qui réussissent pensent différemment. Un livre basé sur la recherche et l'expérience terrain dans les contextes africains.", pages: 260, rating: 4.6, readers: 650, color: "#7B6EC6" },
  { id: 5, title: "Marketing Digital Douala", author: "Jean-Paul Fotso", category: "Marketing", price: 3500, cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80", summary: "Vendre sur Facebook, Instagram et WhatsApp dans le contexte camerounais. Techniques avancées, cas pratiques, scripts de vente qui convertissent.", pages: 195, rating: 5.0, readers: 3400, color: "#C44B6E" },
  { id: 6, title: "Santé & Vitalité Naturelle", author: "Dr. Amina Touré", category: "Santé", price: 1500, cover: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80", summary: "Récupérer une santé optimale avec des habitudes simples et des nutriments essentiels. Un guide pratique adapté aux modes de vie africains modernes.", pages: 150, rating: 4.5, readers: 980, color: "#4E9E5F" },
];

const CATEGORIES = ["Tous", "Business", "Finance", "Marketing", "Développement Personnel", "Psychologie", "Santé"];

const READER_CONTENT = `Toute grande réussite commence dans le silence d'une décision. Pas une décision spectaculaire, annoncée à la foule — mais cette décision intime, prise seul face à soi-même, où l'on choisit de ne plus être la même personne qu'hier.\n\nNous vivons à une époque de bruit. Les réseaux sociaux nous bombardent de success stories filtrées, de conseils contradictoires, de comparaisons épuisantes. Dans ce chaos, il est facile de perdre le fil de ce qui compte vraiment : votre propre chemin.\n\nCe premier chapitre pose une seule question : **Qui voulez-vous devenir ?**\n\nNon pas ce que vous voulez avoir, ni ce que vous voulez faire — mais qui. Car tout le reste découle de cette réponse.\n\n---\n\n**L'identité précède le comportement**\n\nLes chercheurs en psychologie comportementale ont démontré depuis longtemps ce que les sages ont toujours su : nous agissons de manière cohérente avec l'image que nous avons de nous-mêmes.\n\nSi vous vous voyez comme quelqu'un de discipliné, vous trouverez des moyens d'être discipliné — même dans les moments difficiles. Si vous vous voyez comme quelqu'un qui "essaie de maigrir", vous saboterez vos efforts à la première tentation.\n\nLa différence n'est pas la volonté. C'est l'identité.\n\nExercice pratique : Prenez une feuille. Écrivez trois phrases commençant par "Je suis quelqu'un qui..." en lien avec la personne que vous souhaitez devenir. Relisez-les chaque matin pendant 30 jours.\n\n*Continuez votre lecture pour découvrir le Chapitre 2 : Les Habitudes Silencieuses...*`;

const PAYMENT_METHODS = [
  { id: "orange", label: "Orange Money", emoji: "🟠", color: "#FF7900", bg: "rgba(255,121,0,0.08)", border: "rgba(255,121,0,0.4)", country: "CM · CI · SN · BF", fields: [{ id: "phone", label: "Numéro Orange Money", placeholder: "6X XX XX XX XX", type: "tel", icon: "📱" }], instruction: "Un code de confirmation vous sera envoyé par SMS. Composez *150# sur votre téléphone pour valider le paiement." },
  { id: "mtn", label: "MTN MoMo", emoji: "🟡", color: "#FFCC00", bg: "rgba(255,204,0,0.08)", border: "rgba(255,204,0,0.4)", country: "CM · GH · UG · RW", fields: [{ id: "phone", label: "Numéro MTN Mobile Money", placeholder: "6X XX XX XX XX", type: "tel", icon: "📱" }], instruction: "Vous recevrez une notification push sur votre application MTN MoMo. Approuvez le paiement pour confirmer." },
  { id: "visa", label: "Carte Bancaire", emoji: null, color: "#C9A96E", bg: "rgba(201,169,110,0.08)", border: "rgba(201,169,110,0.4)", country: "Visa · Mastercard · Mondial", fields: [{ id: "name", label: "Titulaire de la carte", placeholder: "NOM PRÉNOM", type: "text", icon: "👤" }, { id: "number", label: "Numéro de carte", placeholder: "•••• •••• •••• ••••", type: "text", icon: "💳", format: "card" }, { id: "expiry", label: "Expiration", placeholder: "MM / AA", type: "text", icon: "📅", half: true }, { id: "cvv", label: "CVV", placeholder: "•••", type: "password", icon: "🔒", half: true }], instruction: "Paiement sécurisé 3D Secure. Votre banque peut envoyer un code de vérification par SMS." },
  { id: "paypal", label: "PayPal", emoji: null, color: "#009cde", bg: "rgba(0,156,222,0.08)", border: "rgba(0,156,222,0.35)", country: "International · 200+ pays", fields: [{ id: "email", label: "Adresse e-mail PayPal", placeholder: "vous@email.com", type: "email", icon: "✉️" }], instruction: "Vous serez redirigé vers PayPal pour saisir votre mot de passe et finaliser le paiement en toute sécurité." },
];

function fmtCard(v) { return v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim(); }
function fmtExpiry(v) { const d=v.replace(/\D/g,"").slice(0,4); return d.length>=3?d.slice(0,2)+" / "+d.slice(2):d; }

function PaymentModal({ book, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState(null);
  const [fields, setFields] = useState({});
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);
  const sel = PAYMENT_METHODS.find(m => m.id === method);

  useEffect(() => {
    if (step !== 3) return;
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15 + 6;
      if (p >= 100) { clearInterval(iv); setProgress(100); setTimeout(() => setStep(4), 500); return; }
      setProgress(p);
    }, 300);
    return () => clearInterval(iv);
  }, [step]);

  const validate = () => {
    const e = {};
    sel.fields.forEach(f => {
      if (!fields[f.id]?.trim()) e[f.id] = "Requis";
      if (f.id === "email" && fields[f.id] && !/\S+@\S+\.\S+/.test(fields[f.id])) e[f.id] = "Email invalide";
    });
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleChange = (fid, val, fmt) => {
    let v = val;
    if (fmt === "card") v = fmtCard(val);
    if (fid === "expiry") v = fmtExpiry(val);
    if (fid === "cvv") v = val.replace(/\D/g,"").slice(0,4);
    if (fid === "phone") v = val.replace(/[^\d\s+]/g,"").slice(0,16);
    setFields(p => ({ ...p, [fid]: v }));
    if (errors[fid]) setErrors(p => ({ ...p, [fid]: null }));
  };

  const S = { fontFamily: "Lato, sans-serif" };
  const PF = { fontFamily: "'Playfair Display', Georgia, serif" };

  const inp = (err, active) => ({
    width: "100%", background: "#0A0907", border: `1px solid ${err ? "#C44B4B" : active ? (sel?.color || "#C9A96E") : "#3A3228"}`,
    color: "#F5F0E8", padding: "12px 14px 12px 38px", ...S, fontSize: 14, outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={step < 3 ? onClose : undefined}>
      <div style={{ background: "#1A1713", width: "100%", maxWidth: 460, border: "1px solid #3A3228", maxHeight: "94vh", overflowY: "auto", position: "relative" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        {step < 4 && (
          <div style={{ padding: "20px 26px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {step === 2 && <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>}
              <div>
                <p style={{ ...S, fontSize: 10, letterSpacing: 2.5, color: "#5A5040", textTransform: "uppercase", marginBottom: 3 }}>
                  {step === 1 ? "Étape 1 / 2" : step === 2 ? "Étape 2 / 2" : "En cours..."}
                </p>
                <p style={{ ...PF, fontSize: 17, fontWeight: 700 }}>
                  {step === 1 ? "Choisir le paiement" : step === 2 ? sel?.label : "Traitement du paiement"}
                </p>
              </div>
            </div>
            {step < 3 && (
              <button onClick={onClose} style={{ background: "none", border: "1px solid #3A3228", color: "#A89880", width: 30, height: 30, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            )}
          </div>
        )}

        {/* Book bar */}
        {step < 4 && (
          <div style={{ margin: "18px 26px 0", background: "#0F0D0A", border: "1px solid #2A2420", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={book.cover} alt="" style={{ width: 34, height: 46, objectFit: "cover" }} />
              <div>
                <p style={{ ...PF, fontSize: 13, fontWeight: 700 }}>{book.title}</p>
                <p style={{ ...S, fontSize: 11, color: "#A89880", marginTop: 2 }}>{book.author}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...PF, fontSize: 19, fontWeight: 700, color: "#C9A96E" }}>{book.price.toLocaleString()}</p>
              <p style={{ ...S, fontSize: 9, color: "#A89880", letterSpacing: 1.5 }}>FCFA</p>
            </div>
          </div>
        )}

        <div style={{ padding: "22px 26px 28px" }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Mobile Money Afrique</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {PAYMENT_METHODS.filter(m => ["orange","mtn"].includes(m.id)).map(m => (
                  <div key={m.id} onClick={() => { setMethod(m.id); setStep(2); setFields({}); setErrors({}); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", border: `1px solid #2A2420`, cursor: "pointer", background: "transparent", transition: "all 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = m.bg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A2420"; e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, background: m.bg, border: `1px solid ${m.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{m.emoji}</div>
                      <div>
                        <p style={{ ...PF, fontSize: 15, fontWeight: 700 }}>{m.label}</p>
                        <p style={{ ...S, fontSize: 11, color: "#7A6850", marginTop: 2 }}>{m.country}</p>
                      </div>
                    </div>
                    <span style={{ color: "#5A5040", fontSize: 20 }}>›</span>
                  </div>
                ))}
              </div>

              <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Carte & International</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PAYMENT_METHODS.filter(m => ["visa","paypal"].includes(m.id)).map(m => (
                  <div key={m.id} onClick={() => { setMethod(m.id); setStep(2); setFields({}); setErrors({}); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", border: "1px solid #2A2420", cursor: "pointer", background: "transparent", transition: "all 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = m.bg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A2420"; e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, background: m.bg, border: `1px solid ${m.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {m.id === "visa" ? (
                          <svg viewBox="0 0 750 471" width="36" height="22">
                            <path fill="#1A1F71" d="M278 334l33-195h54l-34 195zm247-190c-11-4-27-8-48-8-53 0-90 27-90 65-1 28 26 43 47 53 21 9 28 15 28 24 0 13-17 19-32 19-21 0-33-3-50-10l-7-3-8 44c13 5 35 10 59 10 56 0 92-26 92-66 0-22-14-39-44-53-18-9-30-15-30-24 0-8 10-17 30-17 17 0 30 4 39 7l5 2 8-42zm131-5h-41c-13 0-22 4-28 16l-79 179h56l11-29h68l6 29h49l-42-195zm-66 124l21-53 7-18 3 16 12 55h-43zm-388-124l-52 133-6-27c-10-31-40-65-74-82l48 171h56l83-195h-55z" />
                            <path fill="#F2AE14" d="M132 139H46l-1 4c67 16 111 55 129 102l-19-89c-3-12-12-17-23-17z" />
                          </svg>
                        ) : (
                          <span style={{ ...S, fontWeight: 900, fontSize: 13 }}>
                            <span style={{ color: "#003087" }}>Pay</span><span style={{ color: "#009cde" }}>Pal</span>
                          </span>
                        )}
                      </div>
                      <div>
                        <p style={{ ...PF, fontSize: 15, fontWeight: 700 }}>{m.label}</p>
                        <p style={{ ...S, fontSize: 11, color: "#7A6850", marginTop: 2 }}>{m.country}</p>
                      </div>
                    </div>
                    <span style={{ color: "#5A5040", fontSize: 20 }}>›</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, padding: "11px 14px", background: "rgba(78,158,95,0.06)", border: "1px solid rgba(78,158,95,0.18)" }}>
                <span style={{ fontSize: 13 }}>🔒</span>
                <p style={{ ...S, fontSize: 11, color: "#6AB87A", lineHeight: 1.5 }}>Paiement chiffré SSL 256-bit — vos données sont protégées.</p>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && sel && (
            <div>
              <div style={{ padding: "12px 14px", background: sel.bg, border: `1px solid ${sel.border}`, marginBottom: 22, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                <p style={{ ...S, fontSize: 12, color: "#C8BFA8", lineHeight: 1.6 }}>{sel.instruction}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {sel.fields.map(f => {
                  const [focused, setFocused] = useState(false);
                  return (
                    <div key={f.id} style={{ gridColumn: f.half ? "span 1" : "span 2" }}>
                      <p style={{ ...S, fontSize: 10, color: errors[f.id] ? "#C44B4B" : "#7A6850", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                        {f.label}{errors[f.id] ? ` — ${errors[f.id]}` : ""}
                      </p>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none", opacity: 0.7 }}>{f.icon}</span>
                        <input type={f.type} placeholder={f.placeholder} value={fields[f.id] || ""}
                          onChange={e => handleChange(f.id, e.target.value, f.format)}
                          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                          style={inp(errors[f.id], focused)} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {sel.id === "visa" && (
                <div style={{ margin: "18px 0", background: "linear-gradient(135deg, #1A1713 0%, #221E18 100%)", border: "1px solid #3A3228", borderLeft: `3px solid ${sel.color}`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 2, marginBottom: 8 }}>CARTE</p>
                    <p style={{ fontFamily: "'Courier New', monospace", fontSize: 15, letterSpacing: 3, color: "#F5F0E8" }}>{fields.number || "•••• •••• •••• ••••"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 2, marginBottom: 8 }}>EXPIRE</p>
                    <p style={{ ...S, fontSize: 14, color: "#C9A96E", fontWeight: 700 }}>{fields.expiry || "MM / AA"}</p>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button onClick={() => setStep(1)}
                  style={{ padding: "12px 18px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
                  Retour
                </button>
                <button onClick={() => validate() && setStep(3)}
                  style={{ flex: 1, padding: "13px", background: `linear-gradient(135deg, ${sel.color}, ${sel.color}bb)`, border: "none", color: sel.id === "paypal" ? "#fff" : "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                  Payer {book.price.toLocaleString()} FCFA
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16 }}>
                {["🔒 SSL", "✓ Sécurisé", "⚡ Instantané"].map(t => (
                  <p key={t} style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1 }}>{t}</p>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ width: 60, height: 60, border: "2px solid #2A2420", borderTop: `2px solid ${sel?.color || "#C9A96E"}`, borderRadius: "50%", margin: "0 auto 26px", animation: "spin 0.9s linear infinite" }} />
              <p style={{ ...PF, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Traitement en cours</p>
              <p style={{ ...S, fontSize: 13, color: "#A89880", marginBottom: 30 }}>Vérification {sel?.label}...</p>
              <div style={{ height: 4, background: "#1A1713", borderRadius: 2, margin: "0 10px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: `linear-gradient(90deg, ${sel?.color || "#C9A96E"}, ${sel?.color || "#C9A96E"}88)`, width: `${progress}%`, transition: "width 0.35s ease", borderRadius: 2 }} />
              </div>
              <p style={{ ...S, fontSize: 12, color: "#5A5040", marginTop: 10 }}>{Math.round(progress)}%</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div style={{ textAlign: "center", padding: "32px 16px 24px" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(78,158,95,0.12)", border: "2px solid #4E9E5F", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "popIn 0.45s cubic-bezier(0.175,0.885,0.32,1.275)" }}>
                <span style={{ fontSize: 30, color: "#4E9E5F" }}>✓</span>
              </div>
              <p style={{ ...PF, fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Paiement confirmé !</p>
              <p style={{ ...S, fontSize: 14, color: "#A89880", marginBottom: 4 }}>
                <strong style={{ color: "#C9A96E" }}>{book.title}</strong>
              </p>
              <p style={{ ...S, fontSize: 13, color: "#6AB87A", marginBottom: 28 }}>est maintenant dans votre bibliothèque.</p>

              <div style={{ background: "#0F0D0A", border: "1px solid #2A2420", padding: "14px 18px", marginBottom: 24, display: "flex", justifyContent: "space-between" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, marginBottom: 5 }}>MONTANT PAYÉ</p>
                  <p style={{ ...PF, fontSize: 20, fontWeight: 700, color: "#C9A96E" }}>{book.price.toLocaleString()} FCFA</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ ...S, fontSize: 10, color: "#5A5040", letterSpacing: 1.5, marginBottom: 5 }}>VIA</p>
                  <p style={{ ...S, fontSize: 14, fontWeight: 700 }}>{sel?.label}</p>
                </div>
              </div>

              <button onClick={onSuccess}
                style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #C9A96E, #E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", cursor: "pointer" }}>
                Lire maintenant →
              </button>
              <style>{`@keyframes popIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────── */
export default function BookPlatform() {
  const [view, setView] = useState("home");
  const [sel, setSel] = useState(null);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [purchased, setPurchased] = useState([5, 3]);
  const [payModal, setPayModal] = useState(false);
  const [search, setSearch] = useState("");

  const PF = { fontFamily: "'Playfair Display', Georgia, serif" };
  const S = { fontFamily: "Lato, sans-serif" };

  const filtered = BOOKS.filter(b => {
    const mc = activeCategory === "Tous" || b.category === activeCategory;
    const ms = b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const featured = BOOKS[4];

  const openPay = (book) => { setSel(book); setPayModal(true); };
  const onPaySuccess = () => {
    setPurchased(p => [...p, sel.id]);
    setPayModal(false);
    setView("reader");
  };

  return (
    <div style={{ ...S, background: "#0F0D0A", minHeight: "100vh", color: "#F5F0E8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Lato:wght@300;400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .bg { background: linear-gradient(135deg, #C9A96E, #E8C98A); }
        .btn-gold{background:linear-gradient(135deg,#C9A96E,#E8C98A);color:#0F0D0A;border:none;padding:12px 28px;font-family:Lato,sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .3s}
        .btn-gold:hover{opacity:.85;transform:translateY(-1px)}
        .btn-out{background:transparent;color:#C9A96E;border:1px solid #C9A96E;padding:10px 24px;font-family:Lato,sans-serif;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .3s}
        .btn-out:hover{background:rgba(201,169,110,.1)}
        .card{transition:transform .3s,box-shadow .3s;cursor:pointer}
        .card:hover{transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,.5)}
        input{outline:none;font-family:Lato,sans-serif}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0F0D0A}::-webkit-scrollbar-thumb{background:#3A3228}
      `}</style>

      {payModal && sel && <PaymentModal book={sel} onClose={() => setPayModal(false)} onSuccess={onPaySuccess} />}

      {/* NAV */}
      <nav style={{ borderBottom: "1px solid #2A2420", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, background: "rgba(15,13,10,0.97)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#C9A96E,#E8C98A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#0F0D0A", fontFamily: "Georgia" }}>L</span>
          </div>
          <span style={{ ...PF, fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>LIBRAIRIE<span style={{ color: "#C9A96E" }}>.</span></span>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {[["home","Accueil"],["catalog","Catalogue"],["library","Ma Bibliothèque"]].map(([v,l]) => (
            <span key={v} onClick={() => setView(v)}
              style={{ cursor: "pointer", ...S, fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: view === v ? "#C9A96E" : "#A89880", transition: "color .2s" }}>{l}</span>
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,169,110,.12)", border: "1px solid rgba(201,169,110,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, color: "#C9A96E" }}>L</span>
        </div>
      </nav>

      {/* HOME */}
      {view === "home" && (
        <div>
          <div style={{ padding: "80px 40px 60px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,169,110,.1)", border: "1px solid rgba(201,169,110,.3)", padding: "6px 16px", marginBottom: 28 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A96E", display: "block" }}></span>
                <span style={{ ...S, fontSize: 11, letterSpacing: 2, color: "#C9A96E", textTransform: "uppercase" }}>Plateforme de Lecture Premium</span>
              </div>
              <h1 style={{ ...PF, fontSize: 52, fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
                Les livres qui<br /><em style={{ color: "#C9A96E" }}>transforment</em><br />des vies.
              </h1>
              <p style={{ ...S, fontSize: 15, color: "#A89880", lineHeight: 1.8, marginBottom: 36, maxWidth: 400 }}>
                Accédez à des livres soigneusement sélectionnés. Payez uniquement ce que vous lisez — Orange Money, MTN, Visa ou PayPal.
              </p>
              <div style={{ display: "flex", gap: 14 }}>
                <button className="btn-gold" onClick={() => setView("catalog")}>Explorer le catalogue</button>
                <button className="btn-out" onClick={() => setView("library")}>Ma bibliothèque</button>
              </div>
              <div style={{ display: "flex", gap: 32, marginTop: 44 }}>
                {[["6","Livres"],["8 240","Lecteurs"],["4.8★","Note moy."]].map(([n,l]) => (
                  <div key={l}>
                    <p style={{ ...PF, fontSize: 24, fontWeight: 700, color: "#C9A96E" }}>{n}</p>
                    <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 1, textTransform: "uppercase" }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {BOOKS.slice(0,4).map((book,i) => (
                <div key={book.id} className="card" onClick={() => { setSel(book); setView("book"); }} style={{ transform: i%2===1?"translateY(20px)":"none" }}>
                  <img src={book.cover} alt={book.title} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                  <div style={{ background: "#1A1713", padding: "12px 14px", borderTop: `2px solid ${book.color}` }}>
                    <p style={{ ...PF, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{book.title}</p>
                    <p style={{ ...S, fontSize: 11, color: "#A89880" }}>{book.price.toLocaleString()} FCFA</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment strip */}
          <div style={{ borderTop: "1px solid #1E1B16", borderBottom: "1px solid #1E1B16", padding: "18px 40px", background: "#0C0A08" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 36, flexWrap: "wrap" }}>
              <p style={{ ...S, fontSize: 10, letterSpacing: 2.5, color: "#3A3228", textTransform: "uppercase" }}>Paiements acceptés</p>
              {[["🟠","Orange Money","#FF7900"],["🟡","MTN MoMo","#FFCC00"],["💳","Visa / Mastercard","#C9A96E"],["🌐","PayPal","#009cde"],["🔒","SSL 256-bit","#4E9E5F"]].map(([icon,label,color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.75 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ ...S, fontSize: 12, color, fontWeight: 700 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Featured */}
          <div style={{ background: "#161310", borderBottom: "1px solid #2A2420", padding: "60px 40px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "auto 1fr", gap: 48, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", inset: -10, background: `linear-gradient(135deg, ${featured.color}33, transparent)` }}></div>
                <img src={featured.cover} alt={featured.title} style={{ width: 220, height: 300, objectFit: "cover", position: "relative", zIndex: 1, display: "block" }} />
              </div>
              <div>
                <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(201,169,110,.12)", border: "1px solid rgba(201,169,110,.3)", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#C9A96E", marginBottom: 16 }}>⭐ Coup de cœur</div>
                <h2 style={{ ...PF, fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{featured.title}</h2>
                <p style={{ ...S, color: "#A89880", marginBottom: 16, fontSize: 14 }}>par {featured.author} · {featured.category}</p>
                <p style={{ ...S, fontSize: 15, color: "#C8BFA8", lineHeight: 1.75, maxWidth: 500, marginBottom: 28 }}>{featured.summary}</p>
                <div style={{ display: "flex", gap: 28, marginBottom: 28 }}>
                  {[["Note",`${featured.rating}/5`],["Lecteurs",featured.readers.toLocaleString()],["Prix",`${featured.price.toLocaleString()} FCFA`]].map(([k,v]) => (
                    <div key={k}>
                      <p style={{ ...S, fontSize: 10, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{k}</p>
                      <p style={{ ...PF, fontSize: 20, color: "#C9A96E" }}>{v}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn-gold" onClick={() => { setSel(featured); setView("book"); }}>Voir le livre</button>
                  {!purchased.includes(featured.id) && <button className="btn-out" onClick={() => openPay(featured)}>Acheter maintenant</button>}
                  {purchased.includes(featured.id) && <button className="btn-out" onClick={() => { setSel(featured); setView("reader"); }}>Lire maintenant</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATALOG */}
      {view === "catalog" && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "50px 40px" }}>
          <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 8 }}>Notre sélection</p>
          <h1 style={{ ...PF, fontSize: 42, fontWeight: 900, marginBottom: 28 }}>Catalogue</h1>
          <input type="text" placeholder="Rechercher un livre ou un auteur..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 400, width: "100%", background: "#1A1713", border: "1px solid #3A3228", color: "#F5F0E8", padding: "10px 16px", fontSize: 14, marginBottom: 32, display: "block" }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 40, flexWrap: "wrap" }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                style={{ padding: "8px 18px", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", background: activeCategory===c ? "linear-gradient(135deg,#C9A96E,#E8C98A)" : "transparent", color: activeCategory===c ? "#0F0D0A" : "#A89880", border: activeCategory===c ? "none" : "1px solid #3A3228", fontWeight: activeCategory===c ? 700 : 400 }}>
                {c}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
            {filtered.map(book => (
              <div key={book.id} className="card" style={{ background: "#1A1713", border: "1px solid #2A2420" }}>
                <div style={{ position: "relative" }} onClick={() => { setSel(book); setView("book"); }}>
                  <img src={book.cover} alt={book.title} style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
                  {purchased.includes(book.id) && <div style={{ position: "absolute", top: 10, right: 10, background: "#4E9E5F", padding: "3px 8px" }}><span style={{ ...S, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#fff" }}>Acheté</span></div>}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${book.color},transparent)` }}></div>
                </div>
                <div style={{ padding: 18 }}>
                  <div style={{ display: "inline-block", padding: "3px 9px", ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", background: `${book.color}18`, color: book.color, marginBottom: 10 }}>{book.category}</div>
                  <h3 style={{ ...PF, fontSize: 16, fontWeight: 700, marginBottom: 5, lineHeight: 1.3, cursor: "pointer" }} onClick={() => { setSel(book); setView("book"); }}>{book.title}</h3>
                  <p style={{ ...S, fontSize: 12, color: "#A89880", marginBottom: 8 }}>{book.author}</p>
                  <p style={{ ...S, fontSize: 13, color: "#7A6850", lineHeight: 1.6, marginBottom: 14 }}>{book.summary.substring(0,85)}...</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ ...PF, fontSize: 18, fontWeight: 700, color: "#C9A96E" }}>{book.price.toLocaleString()} FCFA</span>
                    <span style={{ ...S, fontSize: 12, color: "#A89880" }}>{"★".repeat(Math.floor(book.rating))} {book.rating}</span>
                  </div>
                  {purchased.includes(book.id)
                    ? <button className="btn-gold" style={{ width: "100%", padding: "10px" }} onClick={() => { setSel(book); setView("reader"); }}>Lire maintenant</button>
                    : <button className="btn-gold" style={{ width: "100%", padding: "10px" }} onClick={() => openPay(book)}>Acheter</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOOK */}
      {view === "book" && sel && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "50px 40px" }}>
          <button style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", ...S, fontSize: 13, letterSpacing: 1, marginBottom: 40, display: "flex", alignItems: "center", gap: 8 }} onClick={() => setView("catalog")}>← Retour au catalogue</button>
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 60 }}>
            <div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", inset: -12, background: `linear-gradient(135deg,${sel.color}22,transparent)` }}></div>
                <img src={sel.cover} alt={sel.title} style={{ width: "100%", display: "block", position: "relative", zIndex: 1 }} />
              </div>
              <div style={{ marginTop: 22 }}>
                {purchased.includes(sel.id)
                  ? <button className="btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={() => setView("reader")}>Lire maintenant</button>
                  : <button className="btn-gold" style={{ width: "100%", marginBottom: 10 }} onClick={() => setPayModal(true)}>Acheter — {sel.price.toLocaleString()} FCFA</button>}
                <button className="btn-out" style={{ width: "100%" }} onClick={() => setView("catalog")}>Voir d'autres livres</button>
              </div>
              <div style={{ marginTop: 16, padding: "12px", background: "rgba(78,158,95,.06)", border: "1px solid rgba(78,158,95,.18)", textAlign: "center" }}>
                <p style={{ ...S, fontSize: 11, color: "#6AB87A", lineHeight: 1.7 }}>🔒 Paiement sécurisé<br />Orange Money · MTN · Visa · PayPal</p>
              </div>
            </div>
            <div>
              <div style={{ display: "inline-block", padding: "4px 12px", background: `${sel.color}18`, color: sel.color, ...S, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>{sel.category}</div>
              <h1 style={{ ...PF, fontSize: 38, fontWeight: 900, lineHeight: 1.15, marginBottom: 10 }}>{sel.title}</h1>
              <p style={{ ...S, fontSize: 15, color: "#A89880", marginBottom: 28 }}>par <span style={{ color: "#C9A96E" }}>{sel.author}</span></p>
              <div style={{ display: "flex", gap: 32, marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid #2A2420" }}>
                {[["Note",`${sel.rating}/5`],["Lecteurs",sel.readers.toLocaleString()],["Pages",sel.pages]].map(([k,v]) => (
                  <div key={k}>
                    <p style={{ ...S, fontSize: 10, color: "#5A5040", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>{k}</p>
                    <p style={{ ...PF, fontSize: 22, color: "#C9A96E" }}>{v}</p>
                  </div>
                ))}
              </div>
              <h2 style={{ ...PF, fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Résumé</h2>
              <p style={{ ...S, fontSize: 15, color: "#C8BFA8", lineHeight: 1.8 }}>{sel.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* READER */}
      {view === "reader" && sel && (
        <div>
          <div style={{ background: "#161310", borderBottom: "1px solid #2A2420", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", ...S, fontSize: 12, letterSpacing: 1 }} onClick={() => setView("book")}>← Retour</button>
            <div style={{ textAlign: "center" }}>
              <p style={{ ...PF, fontSize: 14, fontWeight: 700 }}>{sel.title}</p>
              <p style={{ ...S, fontSize: 11, color: "#5A5040" }}>Chapitre 1 sur 12</p>
            </div>
            <div style={{ ...S, fontSize: 11, color: "#5A5040" }}>8% lu</div>
          </div>
          <div style={{ height: 3, background: "#1A1713" }}><div style={{ height: "100%", width: "8%", background: "linear-gradient(90deg,#C9A96E,#E8C98A)" }}></div></div>
          <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 40px 100px", fontFamily: "Georgia, serif", lineHeight: 1.9, fontSize: 17, color: "#E8DFD0" }}>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <p style={{ ...S, fontSize: 11, color: "#C9A96E", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>Chapitre 1</p>
              <h1 style={{ ...PF, fontSize: 32, fontWeight: 900, fontStyle: "italic" }}>Les Fondations</h1>
              <div style={{ width: 60, height: 1, background: "#C9A96E", margin: "22px auto" }}></div>
            </div>
            {READER_CONTENT.split("\n\n").map((para, i) => {
              if (para === "---") return <div key={i} style={{ width: 60, height: 1, background: "#2A2420", margin: "36px auto" }}></div>;
              const html = para.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#C9A96E">$1</strong>');
              if (para.startsWith("*") && para.endsWith("*")) return <p key={i} style={{ fontStyle: "italic", color: "#5A5040", fontSize: 14, textAlign: "center", marginTop: 40 }} dangerouslySetInnerHTML={{ __html: html.slice(1,-1) }} />;
              return <p key={i} style={{ marginBottom: 24 }} dangerouslySetInnerHTML={{ __html: html }} />;
            })}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
              <button className="btn-gold">Chapitre suivant →</button>
            </div>
          </div>
        </div>
      )}

      {/* LIBRARY */}
      {view === "library" && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "50px 40px" }}>
          <p style={{ ...S, fontSize: 11, letterSpacing: 3, color: "#C9A96E", textTransform: "uppercase", marginBottom: 8 }}>Vos acquisitions</p>
          <h1 style={{ ...PF, fontSize: 42, fontWeight: 900, marginBottom: 40 }}>Ma Bibliothèque</h1>
          {purchased.length === 0
            ? <div style={{ textAlign: "center", padding: "80px 0" }}>
                <p style={{ ...PF, fontSize: 22, color: "#A89880", marginBottom: 20 }}>Votre bibliothèque est vide</p>
                <button className="btn-gold" onClick={() => setView("catalog")}>Explorer le catalogue</button>
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
                {BOOKS.filter(b => purchased.includes(b.id)).map(book => (
                  <div key={book.id} style={{ background: "#1A1713", border: "1px solid #2A2420", display: "flex", gap: 18, padding: 18 }}>
                    <img src={book.cover} alt={book.title} style={{ width: 76, height: 104, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ ...PF, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{book.title}</p>
                      <p style={{ ...S, fontSize: 12, color: "#A89880", marginBottom: 10 }}>{book.author}</p>
                      <div style={{ height: 3, background: "#2A2420", marginBottom: 7 }}>
                        <div style={{ height: "100%", width: book.id===5?"45%":"8%", background: "linear-gradient(90deg,#C9A96E,#E8C98A)" }}></div>
                      </div>
                      <p style={{ ...S, fontSize: 11, color: "#5A5040", marginBottom: 12 }}>{book.id===5?"45":"8"}% lu</p>
                      <button className="btn-gold" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => { setSel(book); setView("reader"); }}>Continuer</button>
                    </div>
                  </div>
                ))}
              </div>
          }
          <div style={{ marginTop: 56, borderTop: "1px solid #2A2420", paddingTop: 36 }}>
            <h2 style={{ ...PF, fontSize: 22, marginBottom: 22 }}>Découvrir plus de livres</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
              {BOOKS.filter(b => !purchased.includes(b.id)).slice(0,3).map(book => (
                <div key={book.id} className="card" style={{ background: "#1A1713", border: "1px solid #2A2420", padding: 14, display: "flex", gap: 12, alignItems: "center" }}
                  onClick={() => { setSel(book); setView("book"); }}>
                  <img src={book.cover} alt={book.title} style={{ width: 52, height: 70, objectFit: "cover" }} />
                  <div>
                    <p style={{ ...PF, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{book.title}</p>
                    <p style={{ ...S, fontSize: 11, color: "#A89880", marginBottom: 5 }}>{book.author}</p>
                    <p style={{ ...S, fontSize: 13, color: "#C9A96E", fontWeight: 700 }}>{book.price.toLocaleString()} FCFA</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view !== "reader" && (
        <footer style={{ borderTop: "1px solid #1E1B16", padding: "28px 40px", marginTop: 40 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...PF, fontSize: 16, fontWeight: 700 }}>LIBRAIRIE<span style={{ color: "#C9A96E" }}>.</span></span>
            <p style={{ ...S, fontSize: 11, color: "#5A5040" }}>🔒 Orange Money · MTN MoMo · Visa · Mastercard · PayPal</p>
            <p style={{ ...S, fontSize: 11, color: "#2A2420" }}>© 2025</p>
          </div>
        </footer>
      )}
    </div>
  );
}

