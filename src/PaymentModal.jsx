import { useState, useEffect } from "react";
import { initiatePayment, checkPaymentStatus } from "./campay";

const PAYMENT_METHODS = [
  { id: "orange", label: "Orange Money", emoji: "🟠", color: "#FF7900", bg: "rgba(255,121,0,0.08)", border: "rgba(255,121,0,0.4)", country: "CM · CI · SN · BF", instruction: "Entrez votre numéro Orange Money. Vous recevrez un code SMS à confirmer en composant *150#." },
  { id: "mtn", label: "MTN MoMo", emoji: "🟡", color: "#FFCC00", bg: "rgba(255,204,0,0.08)", border: "rgba(255,204,0,0.4)", country: "CM · GH · UG · RW", instruction: "Entrez votre numéro MTN. Vous recevrez une notification push à approuver." },
  { id: "visa", label: "Carte Bancaire", emoji: "💳", color: "#C9A96E", bg: "rgba(201,169,110,0.08)", border: "rgba(201,169,110,0.4)", country: "Visa · Mastercard", instruction: "Paiement 3D Secure. Votre banque peut envoyer un code de vérification." },
  { id: "paypal", label: "PayPal", emoji: "🌐", color: "#009cde", bg: "rgba(0,156,222,0.08)", border: "rgba(0,156,222,0.35)", country: "International · 200+ pays", instruction: "Vous serez redirigé vers PayPal pour finaliser le paiement." },
];

function fmtCard(v) { return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); }
function fmtExpiry(v) { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + " / " + d.slice(2) : d; }

export default function PaymentModal({ book, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1=method, 2=form, 3=processing, 4=success, 5=error
  const [method, setMethod] = useState(null);
  const [fields, setFields] = useState({});
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Initialisation du paiement...");
  const [errorMsg, setErrorMsg] = useState("");
  const [payRef, setPayRef] = useState(null);

  const sel = PAYMENT_METHODS.find(m => m.id === method);
  const PF = { fontFamily: "'Playfair Display',Georgia,serif" };
  const S = { fontFamily: "Lato,sans-serif" };

  // Polling pour vérifier le statut du paiement Mobile Money
  useEffect(() => {
    if (step !== 3 || !["orange", "mtn"].includes(method)) return;

    let attempts = 0;
    const maxAttempts = 24; // 2 minutes max (5s * 24)

    const poll = setInterval(async () => {
      attempts++;
      setProgress(Math.min((attempts / maxAttempts) * 100, 95));

      if (attempts === 3) setStatusMsg("En attente de votre confirmation...");
      if (attempts === 8) setStatusMsg("Vérification du paiement...");

      if (payRef) {
        const result = await checkPaymentStatus(payRef);
        if (result.success) {
          if (result.status === "SUCCESSFUL") {
            clearInterval(poll);
            setProgress(100);
            setTimeout(() => setStep(4), 500);
          } else if (result.status === "FAILED") {
            clearInterval(poll);
            setErrorMsg("Le paiement a échoué. Veuillez réessayer.");
            setStep(5);
          }
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setErrorMsg("Délai dépassé. Vérifiez votre téléphone et réessayez.");
        setStep(5);
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [step, payRef, method]);

  // Simulation progression pour Visa/PayPal
  useEffect(() => {
    if (step !== 3 || ["orange", "mtn"].includes(method)) return;
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15 + 8;
      if (p >= 100) { clearInterval(iv); setProgress(100); setTimeout(() => setStep(4), 400); return; }
      setProgress(p);
    }, 300);
    return () => clearInterval(iv);
  }, [step, method]);

  const validate = () => {
    const e = {};
    if (["orange", "mtn"].includes(method)) {
      if (!fields.phone?.trim()) e.phone = "Requis";
      else if (fields.phone.replace(/\s/g, "").length < 9) e.phone = "Numéro invalide";
    }
    if (method === "visa") {
      if (!fields.name?.trim()) e.name = "Requis";
      if (!fields.number || fields.number.replace(/\s/g, "").length < 16) e.number = "Numéro invalide";
      if (!fields.expiry || fields.expiry.length < 7) e.expiry = "Invalide";
      if (!fields.cvv || fields.cvv.length < 3) e.cvv = "Invalide";
    }
    if (method === "paypal") {
      if (!fields.email?.trim()) e.email = "Requis";
      else if (!/\S+@\S+\.\S+/.test(fields.email)) e.email = "Email invalide";
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleChange = (fid, val) => {
    let v = val;
    if (fid === "number") v = fmtCard(val);
    if (fid === "expiry") v = fmtExpiry(val);
    if (fid === "cvv") v = val.replace(/\D/g, "").slice(0, 4);
    if (fid === "phone") v = val.replace(/[^\d\s+]/g, "").slice(0, 16);
    setFields(p => ({ ...p, [fid]: v }));
    if (errors[fid]) setErrors(p => ({ ...p, [fid]: null }));
  };

  const handlePay = async () => {
    if (!validate()) return;
    setStep(3);
    setProgress(5);
    setStatusMsg("Connexion au serveur de paiement...");

    if (["orange", "mtn"].includes(method)) {
      // Vrai paiement Campay
      const result = await initiatePayment({
        phone: fields.phone.replace(/\s/g, ""),
        amount: book.price,
        description: `Achat livre: ${book.title}`,
      });

      if (result.success) {
        setPayRef(result.reference);
        setStatusMsg("Demande envoyée — confirmez sur votre téléphone...");
      } else {
        setErrorMsg("Impossible de contacter le serveur de paiement. Vérifiez votre connexion.");
        setStep(5);
      }
    }
    // Pour Visa et PayPal → simulation (intégration Stripe/PayPal à ajouter)
  };

  const inp = (err) => ({
    width: "100%", background: "#0A0907", border: `1px solid ${err ? "#C44B4B" : "#3A3228"}`,
    color: "#F5F0E8", padding: "12px 14px 12px 38px", ...S, fontSize: 14, outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={step < 3 ? onClose : undefined}>
      <div style={{ background: "#1A1713", width: "100%", maxWidth: 460, border: "1px solid #3A3228", maxHeight: "94vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        {step < 4 && step !== 5 && (
          <div style={{ padding: "20px 26px", borderBottom: "1px solid #2A2420", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {step === 2 && <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#A89880", cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>}
              <div>
                <p style={{ ...S, fontSize: 10, letterSpacing: 2.5, color: "#5A5040", textTransform: "uppercase", marginBottom: 3 }}>
                  {step === 1 ? "Étape 1/2" : step === 2 ? "Étape 2/2" : "En cours..."}
                </p>
                <p style={{ ...PF, fontSize: 17, fontWeight: 700 }}>
                  {step === 1 ? "Choisir le paiement" : step === 2 ? sel?.label : "Traitement du paiement"}
                </p>
              </div>
            </div>
            {step < 3 && <button onClick={onClose} style={{ background: "none", border: "1px solid #3A3228", color: "#A89880", width: 30, height: 30, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>}
          </div>
        )}

        {/* Book bar */}
        {step < 4 && step !== 5 && (
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

          {/* STEP 1 — Choisir méthode */}
          {step === 1 && (
            <div>
              <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Mobile Money Afrique</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {PAYMENT_METHODS.filter(m => ["orange", "mtn"].includes(m.id)).map(m => (
                  <div key={m.id} onClick={() => { setMethod(m.id); setStep(2); setFields({}); setErrors({}); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", border: "1px solid #2A2420", cursor: "pointer", transition: "all 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = m.bg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A2420"; e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, background: m.bg, border: `1px solid ${m.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{m.emoji}</div>
                      <div>
                        <p style={{ ...PF, fontSize: 15, fontWeight: 700 }}>{m.label}</p>
                        <p style={{ ...S, fontSize: 11, color: "#7A6850", marginTop: 2 }}>{m.country}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...S, fontSize: 10, color: "#4E9E5F", background: "rgba(78,158,95,0.1)", padding: "2px 8px", border: "1px solid rgba(78,158,95,0.2)" }}>ACTIF</span>
                      <span style={{ color: "#5A5040", fontSize: 20 }}>›</span>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ ...S, fontSize: 11, color: "#5A5040", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Carte & International</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PAYMENT_METHODS.filter(m => ["visa", "paypal"].includes(m.id)).map(m => (
                  <div key={m.id} onClick={() => { setMethod(m.id); setStep(2); setFields({}); setErrors({}); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", border: "1px solid #2A2420", cursor: "pointer", transition: "all 0.18s" }}
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

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, padding: "11px 14px", background: "rgba(78,158,95,0.06)", border: "1px solid rgba(78,158,95,0.18)" }}>
                <span style={{ fontSize: 13 }}>🔒</span>
                <p style={{ ...S, fontSize: 11, color: "#6AB87A", lineHeight: 1.5 }}>Paiements Mobile Money traités par Campay — chiffrement SSL 256-bit.</p>
              </div>
            </div>
          )}

          {/* STEP 2 — Formulaire */}
          {step === 2 && sel && (
            <div>
              <div style={{ padding: "12px 14px", background: sel.bg, border: `1px solid ${sel.border}`, marginBottom: 22 }}>
                <p style={{ ...S, fontSize: 12, color: "#C8BFA8", lineHeight: 1.6 }}>{sel.instruction}</p>
              </div>

              {/* Champ téléphone pour Mobile Money */}
              {["orange", "mtn"].includes(method) && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ ...S, fontSize: 10, color: errors.phone ? "#C44B4B" : "#5A5040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                    Numéro {sel.label}{errors.phone ? ` — ${errors.phone}` : ""}
                  </p>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}>📱</span>
                    <input type="tel" placeholder="6X XX XX XX XX" value={fields.phone || ""}
                      onChange={e => handleChange("phone", e.target.value)}
                      style={inp(errors.phone)} />
                  </div>
                  <p style={{ ...S, fontSize: 11, color: "#5A5040", marginTop: 6 }}>
                    Numéros de test : {method === "orange" ? "237699999999" : "237677777777"}
                  </p>
                </div>
              )}

              {/* Champs carte */}
              {method === "visa" && (
                <div>
                  {[
                    { id: "name", label: "Titulaire", placeholder: "NOM PRÉNOM", icon: "👤", type: "text" },
                    { id: "number", label: "Numéro de carte", placeholder: "•••• •••• •••• ••••", icon: "💳", type: "text" },
                  ].map(f => (
                    <div key={f.id} style={{ marginBottom: 16 }}>
                      <p style={{ ...S, fontSize: 10, color: errors[f.id] ? "#C44B4B" : "#5A5040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                        {f.label}{errors[f.id] ? ` — ${errors[f.id]}` : ""}
                      </p>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}>{f.icon}</span>
                        <input type={f.type} placeholder={f.placeholder} value={fields[f.id] || ""}
                          onChange={e => handleChange(f.id, e.target.value)} style={inp(errors[f.id])} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                    {[
                      { id: "expiry", label: "Expiration", placeholder: "MM / AA", icon: "📅" },
                      { id: "cvv", label: "CVV", placeholder: "•••", icon: "🔒" },
                    ].map(f => (
                      <div key={f.id}>
                        <p style={{ ...S, fontSize: 10, color: errors[f.id] ? "#C44B4B" : "#5A5040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                          {f.label}{errors[f.id] ? ` — ${errors[f.id]}` : ""}
                        </p>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}>{f.icon}</span>
                          <input type="text" placeholder={f.placeholder} value={fields[f.id] || ""}
                            onChange={e => handleChange(f.id, e.target.value)} style={inp(errors[f.id])} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PayPal */}
              {method === "paypal" && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ ...S, fontSize: 10, color: errors.email ? "#C44B4B" : "#5A5040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                    Email PayPal{errors.email ? ` — ${errors.email}` : ""}
                  </p>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}>✉️</span>
                    <input type="email" placeholder="vous@email.com" value={fields.email || ""}
                      onChange={e => handleChange("email", e.target.value)} style={inp(errors.email)} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button onClick={() => setStep(1)}
                  style={{ padding: "12px 18px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
                  Retour
                </button>
                <button onClick={handlePay}
                  style={{ flex: 1, padding: "13px", background: `linear-gradient(135deg, ${sel.color}, ${sel.color}bb)`, border: "none", color: method === "paypal" ? "#fff" : "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                  Payer {book.price.toLocaleString()} FCFA
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Traitement */}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ width: 60, height: 60, border: "2px solid #2A2420", borderTop: `2px solid ${sel?.color || "#C9A96E"}`, borderRadius: "50%", margin: "0 auto 26px", animation: "spin 0.9s linear infinite" }} />
              <p style={{ ...PF, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Traitement en cours</p>
              <p style={{ ...S, fontSize: 13, color: "#A89880", marginBottom: 30 }}>{statusMsg}</p>
              <div style={{ height: 4, background: "#1A1713", borderRadius: 2, margin: "0 10px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: `linear-gradient(90deg, ${sel?.color || "#C9A96E"}, ${sel?.color || "#C9A96E"}88)`, width: `${progress}%`, transition: "width 0.35s ease" }} />
              </div>
              <p style={{ ...S, fontSize: 12, color: "#5A5040", marginTop: 10 }}>{Math.round(progress)}%</p>
              {["orange", "mtn"].includes(method) && (
                <div style={{ marginTop: 24, padding: "12px 16px", background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.2)" }}>
                  <p style={{ ...S, fontSize: 12, color: "#C9A96E", lineHeight: 1.6 }}>
                    {method === "orange" ? "📱 Composez *150# sur votre téléphone Orange pour confirmer" : "📱 Approuvez la notification sur votre app MTN MoMo"}
                  </p>
                </div>
              )}
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* STEP 4 — Succès */}
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
                style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", cursor: "pointer" }}>
                Lire maintenant →
              </button>
              <style>{`@keyframes popIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
            </div>
          )}

          {/* STEP 5 — Erreur */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "32px 16px 24px" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(196,75,75,0.12)", border: "2px solid #C44B4B", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <span style={{ fontSize: 30 }}>✕</span>
              </div>
              <p style={{ ...PF, fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Paiement échoué</p>
              <p style={{ ...S, fontSize: 13, color: "#A89880", marginBottom: 28, lineHeight: 1.6 }}>{errorMsg}</p>
              <button onClick={() => { setStep(2); setProgress(0); setPayRef(null); }}
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#C9A96E,#E8C98A)", border: "none", color: "#0F0D0A", ...S, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                Réessayer
              </button>
              <button onClick={onClose}
                style={{ width: "100%", marginTop: 10, padding: "11px", background: "transparent", border: "1px solid #3A3228", color: "#A89880", ...S, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
