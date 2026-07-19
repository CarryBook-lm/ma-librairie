export default async function handler(req, res) {
  const m = process.env.PAYDUNYA_MASTER_KEY || "";
  const priv = process.env.PAYDUNYA_PRIVATE_KEY || "";
  const tok = process.env.PAYDUNYA_TOKEN || "";
  const mode = process.env.PAYDUNYA_MODE || "";
  const info = (v) => ({
    presente: v.length > 0,
    longueur: v.length,
    debut: v.slice(0, 4),
    fin: v.slice(-4),
    espace_debut_fin: v !== v.trim(),
  });
  return res.status(200).json({
    MASTER_KEY: info(m),
    PRIVATE_KEY: info(priv),
    TOKEN: info(tok),
    MODE: mode,
  });
}