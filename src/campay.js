// src/campay.js
// Service d'intégration Campay pour Orange Money et MTN MoMo

const CAMPAY_BASE_URL = "https://demo.campay.net/api"; // Changer en https://campay.net/api quand tu passes en LIVE

// Obtenir le token d'accès
async function getToken() {
  const response = await fetch(`${CAMPAY_BASE_URL}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: import.meta.env.VITE_CAMPAY_USERNAME,
      password: import.meta.env.VITE_CAMPAY_PASSWORD,
    }),
  });
  const data = await response.json();
  return data.token;
}

// Initier un paiement Mobile Money
export async function initiatePayment({ phone, amount, description }) {
  try {
    const token = await getToken();

    const response = await fetch(`${CAMPAY_BASE_URL}/collect/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: "XAF",
        from: phone.replace(/\s/g, ""), // Supprimer les espaces
        description: description,
        external_reference: `LIB-${Date.now()}`,
      }),
    });

    const data = await response.json();
    return { success: true, reference: data.reference, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Vérifier le statut d'un paiement
export async function checkPaymentStatus(reference) {
  try {
    const token = await getToken();

    const response = await fetch(`${CAMPAY_BASE_URL}/transaction/${reference}/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    const data = await response.json();
    // status: SUCCESSFUL, FAILED, PENDING
    return { success: true, status: data.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
