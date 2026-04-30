export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { sign, age, week } = req.body;
    if (!sign) return res.status(400).json({ error: "Signe manquant" });

    const prompt = "Tu es astrologue. Genere un horoscope pour " + sign + " (age " + (age || "adulte") + " ans) semaine du " + (week || "cette semaine") + ". Reponds avec UN SEUL objet JSON, sans texte avant ni apres, sans backticks. Format: {\"amour\":\"...\",\"argent\":\"...\",\"sante\":\"...\",\"travail\":\"...\",\"conseil\":\"...\",\"chiffres_chanceux\":[7,13,21],\"niveau_energie\":4,\"citation_du_jour\":\"...\"}";

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
      return res.status(500).json({ error: "Reponse vide", details: JSON.stringify(data) });
    }

    const text = data.content[0].text;
    let jsonStr = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
