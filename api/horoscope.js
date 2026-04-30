export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { sign, age, week } = req.body;

    const prompt = "Tu es astrologue. Genere un horoscope pour un(e) " + sign + " age(e) de " + age + " ans pour la semaine du " + week + ". Reponds UNIQUEMENT en JSON valide sans backticks avec: {amour, argent, sante, travail, conseil, chiffres_chanceux (tableau 3 nombres), niveau_energie (1-5), citation_du_jour}. 2-3 phrases par section.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "Reponse API invalide", details: data });
    }

    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (e) {
    console.error("Horoscope error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
