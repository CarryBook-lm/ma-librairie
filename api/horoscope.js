export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY manquante");
      return res.status(500).json({ error: "Cle API manquante sur le serveur" });
    }

    const { sign, age, week } = req.body || {};
    if (!sign) {
      console.error("Signe manquant dans body:", JSON.stringify(req.body));
      return res.status(400).json({ error: "Signe manquant" });
    }

    console.log("Horoscope demande pour:", sign, "age:", age, "semaine:", week);

    const prompt = "Tu es un astrologue professionnel. Genere un horoscope hebdomadaire personnalise pour le signe " + sign + " (personne de " + (age || 25) + " ans) pour la semaine du " + (week || "cette semaine") + ".\n\nRetourne UNIQUEMENT un objet JSON valide, sans texte avant ni apres, sans backticks markdown. Le JSON doit avoir exactement cette structure:\n\n{\"amour\":\"texte de 2-3 phrases\",\"argent\":\"texte de 2-3 phrases\",\"sante\":\"texte de 2-3 phrases\",\"travail\":\"texte de 2-3 phrases\",\"conseil\":\"un conseil de la semaine\",\"chiffres_chanceux\":[7,13,21],\"niveau_energie\":4,\"citation_du_jour\":\"une citation inspirante\"}";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const responseText = await anthropicRes.text();
    console.log("Anthropic status:", anthropicRes.status);
    console.log("Anthropic raw response:", responseText.substring(0, 500));

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", responseText);
      return res.status(500).json({
        error: "Erreur API Anthropic",
        status: anthropicRes.status,
        details: responseText.substring(0, 200)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("JSON parse error response Anthropic:", e.message);
      return res.status(500).json({ error: "Reponse Anthropic invalide", raw: responseText.substring(0, 200) });
    }

    if (!data.content || !Array.isArray(data.content) || !data.content[0] || !data.content[0].text) {
      console.error("Reponse Anthropic structure inattendue:", JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ error: "Reponse Anthropic vide", details: JSON.stringify(data).substring(0, 200) });
    }

    const text = data.content[0].text;
    console.log("Texte brut IA:", text.substring(0, 300));

    let jsonStr = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Impossible de parser JSON IA:", e.message, "Texte:", jsonStr.substring(0, 300));
      // Fallback: retourner un horoscope generique pour ne pas planter
      parsed = {
        amour: "Cette semaine, ouvre ton coeur aux nouvelles connexions. Une rencontre significative pourrait changer ta perspective.",
        argent: "Sois prudent avec tes depenses cette semaine. Une opportunite financiere se presente bientot.",
        sante: "Prends soin de ton corps et ton esprit. Un peu de repos te fera le plus grand bien.",
        travail: "Tes efforts vont enfin porter leurs fruits. Reste concentre sur tes objectifs.",
        conseil: "Fais confiance a ton intuition cette semaine, elle te guidera vers la bonne direction.",
        chiffres_chanceux: [3, 7, 21],
        niveau_energie: 4,
        citation_du_jour: "Le succes appartient a ceux qui osent."
      };
    }

    console.log("Horoscope genere avec succes pour:", sign);
    return res.status(200).json(parsed);

  } catch (e) {
    console.error("Erreur generale horoscope:", e.message, e.stack);
    return res.status(500).json({ error: "Erreur serveur: " + e.message });
  }
}
