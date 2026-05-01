import { useState, useEffect, useRef } from "react";
import { Preferences } from "@capacitor/preferences";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: "carrybooks-auth",
      storage: {
        getItem: async (key) => {
          try {
            const { value } = await Preferences.get({ key });
            return value;
          } catch { return localStorage.getItem(key); }
        },
        setItem: async (key, value) => {
          try {
            await Preferences.set({ key, value });
            localStorage.setItem(key, value);
          } catch { localStorage.setItem(key, value); }
        },
        removeItem: async (key) => {
          try {
            await Preferences.remove({ key });
            localStorage.removeItem(key);
          } catch { localStorage.removeItem(key); }
        },
      },
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    }
  }
);

const CATEGORIES = {
  "Romans": ["Romance", "Drame", "Suspense", "Thriller", "Poesie", "Serie"],
  "Lifestyle": ["Amour et relation", "Santé & bien-être", "Beauté & Astuces"],
  "Développement personnel": ["Confiance en soi", "Motivation", "Finance personnelle", "Spiritualité", "Relations", "Productivité"],
  "Jeunesse": ["Amour et relation", "Contes", "Humour", "Histoires d'amour", "Education"],
  "Formation": [],
  "Business": ["Marketing & ventes", "Management & leadership", "E-commerce & stratégie digitale"],
  "Biographies": ["Essais & chroniques", "Histoire & politique", "Sciences & nature"],
  "Lyrics": ["Focus", "À la une"],
  "Livre Audio": ["Roman", "Conte", "Développement personnel", "Business", "Enfants", "Adultes"],
  "Livres Gratuits": [],
  "Podcast": ["Amour", "Argent", "Confiance en soi", "Spiritualité", "Motivation"],
};

const G = {
  bg: "#f5f0e8", surface: "#ede7d9", surface2: "#e8e0ce", border: "#d8cdb8",
  gold: "#c9a84c", goldLight: "#e0be7a", goldDim: "rgba(201,168,76,0.15)",
  text: "#1a1208", textDim: "#7a6a50", textFaint: "#b0a090",
  green: "#4caf50", greenDim: "rgba(76,175,80,0.15)",
  navBg: "#f5f0e8", navSurface: "#ede7d9", navBorder: "#d8cdb8", navText: "#1a1208",
};


// ============================================================
// QUIZ DATA — 12 quiz prêts à l'emploi
// ============================================================

// ============================================================
// CARRY'QUIZ — Quiz System
// ============================================================

const QUIZ_CATEGORIES = ["Tous", "❤️ Amour", "🧠 Test du QI", "💭 Personnalité", "💰 Argent & Succès", "🔥 Quiz Choc", "🌸 Beauté & Santé"];

const QUIZ_DATA = [
  // ─── AMOUR ───
  {
    id: "trompe",
    category: "❤️ Amour",
    title: "Ton partenaire te trompe-t-il ?",
    emoji: "💔",
    popular: true,
    description: "Les signes que tu ignores révèlent tout.",
    questions: [
      { q: "Comment réagit-il/elle quand tu touches son téléphone ?", options: ["Rien, c'est normal", "Le cache discrètement", "Devient nerveux/se", "Le verrouille immédiatement"] },
      { q: "Les sorties tardives ont-elles changé ces derniers mois ?", options: ["Non, pareil", "Un peu plus souvent", "Oui, régulièrement", "Presque tous les soirs"] },
      { q: "Est-il/elle moins câlin(e) ou intime avec toi ?", options: ["Pas du tout", "Légèrement", "Nettement moins", "Plus rien depuis longtemps"] },
      { q: "A-t-il/elle de nouveaux amis dont tu n'entends jamais parler ?", options: ["Non", "Un nom revient souvent", "Plusieurs contacts secrets", "Refuse d'en parler"] },
      { q: "Comment réagit-il/elle à ton arrivée inattendue ?", options: ["Heureux/se de te voir", "Légèrement surpris(e)", "Très nerveux/se", "Panique ou devient agressif"] },
      { q: "Son apparence physique a-t-elle changé récemment ?", options: ["Non, pareil", "Un peu plus soigné(e)", "Beaucoup plus soigné(e)", "Style complètement différent"] },
      { q: "Vous disputez-vous pour des raisons sans importance ?", options: ["Jamais", "Rarement", "Souvent", "Tous les jours"] },
      { q: "A-t-il/elle commencé à te critiquer plus souvent ?", options: ["Non, jamais", "Parfois", "Régulièrement", "Constamment"] },
      { q: "Évite-t-il/elle de parler d'avenir avec toi ?", options: ["Non, parle d'avenir", "Moins qu'avant", "Esquive le sujet", "Refuse catégoriquement"] },
      { q: "Son comportement au lit a-t-il changé ?", options: ["Non, tout va bien", "Légèrement différent", "Très différent", "Refus total d'intimité"] },
      { q: "Est-il/elle mystérieux/se sur son emploi du temps ?", options: ["Non, transparent(e)", "Quelques imprécisions", "Souvent flou", "Total mystère"] },
      { q: "Ton instinct te dit-il que quelque chose ne va pas ?", options: ["Non, j'ai confiance", "Un léger doute", "Oui, souvent", "Je le sens profondément"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      const pct = Math.round((score / (answers.length * 3)) * 100);
      if (score <= 8) return { level: "💚 Risque faible", preview: `Indice d'infidélité : ${pct}%`, teaser: "Ton/ta partenaire semble fidèle MAIS il y a 2 signaux que tu ne dois pas ignorer…", color: "#4caf50", advice: "Continue à entretenir la confiance et la communication. Exprime tes besoins ouvertement." };
      if (score <= 18) return { level: "🟡 Signaux suspects", preview: `Indice d'infidélité : ${pct}%`, teaser: "Plusieurs comportements sont ANORMAUX. Le signal le plus inquiétant que tu n'as pas remarqué…", color: "#ff9800", advice: "Parle directement à ton/ta partenaire. Les non-dits créent plus de dégâts que la vérité." };
      if (score <= 26) return { level: "🔴 Risque élevé", preview: `Indice d'infidélité : ${pct}%`, teaser: "L'analyse révèle un schéma CLASSIQUE de tromperie. La preuve que tu cherches est plus proche que tu ne crois…", color: "#f44336", advice: "Fais confiance à ton instinct. Cherche une conversation honnête avant de prendre toute décision." };
      return { level: "💀 Très probable", preview: `Indice d'infidélité : ${pct}%`, teaser: "Les données sont claires. Ce que nous avons trouvé sur ton/ta partenaire va te CHOQUER…", color: "#b71c1c", advice: "Tu mérites mieux. Protège ton cœur et prends soin de toi avant tout." };
    }
  },
  {
    id: "amoureux_attache",
    category: "❤️ Amour",
    title: "Es-tu vraiment amoureux(se) ou juste attaché(e) ?",
    emoji: "💘",
    popular: true,
    description: "La différence peut changer toute ta vie.",
    questions: [
      { q: "Quand tu penses à cette personne, tu ressens…", options: ["Un sourire spontané et du bonheur", "Un sentiment de sécurité", "De l'anxiété mêlée d'attraction", "La peur de la perdre avant tout"] },
      { q: "Si cette personne partait demain pour toujours, tu…", options: ["Serais triste mais tu irais de l'avant", "Te sentirais perdu(e) et vide", "Ne pourrais pas fonctionner", "Tomberais dans une dépression"] },
      { q: "Tu aimes cette personne ou l'idée qu'elle représente ?", options: ["Je l'aime elle/lui vraiment", "Les deux à parts égales", "Surtout l'idée qu'elle représente", "Je ne sais pas vraiment"] },
      { q: "Cette relation te rend-elle meilleur(e) ?", options: ["Oui, je m'épanouis", "Parfois", "Pas vraiment", "Elle m'affaiblit"] },
      { q: "Imagines-tu ta vie dans 10 ans avec cette personne ?", options: ["Oui, clairement", "J'y pense parfois", "Rarement", "Jamais"] },
      { q: "L'acceptes-tu avec tous ses défauts ?", options: ["Oui, totalement", "La plupart du temps", "J'essaie mais c'est dur", "Non, j'espère qu'il/elle change"] },
      { q: "Comment te sens-tu quand vous n'êtes pas ensemble ?", options: ["Bien, j'ai ma propre vie", "Un peu seul(e)", "Anxieux/se et inquiet(e)", "Perdu(e) et paniqué(e)"] },
      { q: "Cette personne te respecte-t-elle vraiment ?", options: ["Profondément", "Généralement", "Pas toujours", "Rarement"] },
      { q: "Pourquoi restes-tu dans cette relation ?", options: ["Par amour sincère", "Par habitude et confort", "Par peur de la solitude", "Par dépendance émotionnelle"] },
      { q: "Serais-tu capable de vouloir son bonheur même sans toi ?", options: ["Oui, sans hésitation", "Avec beaucoup de mal", "Difficilement", "Non, je ne peux pas"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      if (score <= 10) return { level: "💖 Amour véritable", preview: "Tu es profondément amoureux/se", teaser: "Mais il y a un détail CRUCIAL que ton amour t'empêche de voir clairement…", color: "#e91e63", advice: "Nourris cet amour avec de la communication et du respect mutuel. C'est rare ce que vous avez." };
      if (score <= 20) return { level: "🔀 Mélange des deux", preview: "Amour ET attachement", teaser: "Tu oscilles entre l'amour et la peur. Ce que tu ressens vraiment au fond…", color: "#ff9800", advice: "Travaille sur ton indépendance émotionnelle. Un amour sain commence par s'aimer soi-même." };
      return { level: "🔗 Attachement émotionnel", preview: "C'est de l'attachement, pas de l'amour", teaser: "La vérité difficile : tu as peur d'être seul(e). Ce que ça révèle sur toi…", color: "#9c27b0", advice: "L'attachement n'est pas une faiblesse — c'est humain. Mais tu mérites un amour libre, pas une prison dorée." };
    }
  },
  {
    id: "attirance_mauvaises",
    category: "❤️ Amour",
    title: "Pourquoi tu attires toujours les mauvaises personnes ?",
    emoji: "😳",
    popular: true,
    description: "Le schéma répétitif que tu dois briser.",
    questions: [
      { q: "Dans tes relations passées, le problème venait souvent de…", options: ["L'autre", "Les deux à parts égales", "Surtout de moi", "Les circonstances"] },
      { q: "Tu tombes amoureux/se de personnes qui…", options: ["Sont disponibles et stables", "Ont besoin d'être sauvées", "Sont mystérieuses et distantes", "Sont intenses et passionnées"] },
      { q: "Comment réagis-tu quand quelqu'un te traite mal ?", options: ["Je mets des limites immédiatement", "Je lui explique et attends", "Je supporte en espérant que ça change", "Je m'excuse souvent même si ce n'est pas ma faute"] },
      { q: "Tu as tendance à…", options: ["Choisir des partenaires sains", "Vouloir changer les gens", "Ignorer les red flags", "Rester trop longtemps dans des relations toxiques"] },
      { q: "Comment est ta relation avec tes parents ?", options: ["Équilibrée et aimante", "Quelques tensions mais bien", "Compliquée", "Traumatisante ou absente"] },
      { q: "Quand une relation finit, tu penses…", options: ["C'est la vie, je passe à autre chose", "Qu'est-ce que j'aurais pu faire mieux ?", "C'est ma faute", "Je ne suis pas fait(e) pour être aimé(e)"] },
      { q: "Ton estime de toi en amour est…", options: ["Solide", "Correcte", "Fragile", "Très basse"] },
      { q: "Les 'bad boys/girls' te…", options: ["N'intéressent pas du tout", "Attirent parfois", "Attirent souvent", "Attirent toujours irrésistiblement"] },
      { q: "As-tu des schémas répétitifs en amour ?", options: ["Non, chaque relation est différente", "Parfois les mêmes erreurs", "Oui, je le remarque", "Oui, c'est un cycle que je n'arrive pas à briser"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      if (score <= 9) return { level: "✅ Schéma sain", preview: "Tu fais de bons choix amoureux", teaser: "MAIS il y a un point aveugle dans ta vie amoureuse que personne ne t'a jamais dit…", color: "#4caf50", advice: "Maintiens ces standards. Fais confiance à ton instinct et continue à choisir avec ta tête ET ton cœur." };
      if (score <= 18) return { level: "⚠️ Schéma à risque", preview: "Tu attires parfois les mauvaises personnes", teaser: "La VRAIE raison (liée à ton enfance) que tu répètes sans le savoir…", color: "#ff9800", advice: "Pose-toi la question : 'Est-ce que je choisis ou est-ce que j'accepte ce qu'on me donne ?' Tu mérites de choisir." };
      return { level: "🔄 Schéma toxique", preview: "Tu attires systématiquement des personnes toxiques", teaser: "Ce n'est PAS une malchance. C'est un programme inconscient installé dès l'enfance. Voici le décoder…", color: "#f44336", advice: "La blessure d'abandon ou de rejet précoce attire souvent des personnes qui la confirment. Une thérapie peut tout changer." };
    }
  },
  {
    id: "toxique_amour",
    category: "❤️ Amour",
    title: "Es-tu toxique en amour sans le savoir ?",
    emoji: "😈",
    popular: false,
    description: "La vérité que tes ex n'ont jamais osé te dire.",
    questions: [
      { q: "Quand ton/ta partenaire sort sans toi, tu…", options: ["Profites de ton temps seul(e)", "Envoies quelques messages", "Envoies beaucoup de messages", "Contrôles où il/elle est"] },
      { q: "Pendant une dispute, tu utilises…", options: ["Des arguments constructifs", "Parfois le passé de l'autre", "La culpabilisation", "Les menaces ou le chantage émotionnel"] },
      { q: "Utilises-tu le silence punitif ?", options: ["Jamais", "Rarement", "Parfois", "Souvent"] },
      { q: "Quand tu as tort dans une dispute, tu…", options: ["Reconnais ton erreur facilement", "Reconnais mais lentement", "Trouves une excuse", "Ne reconnais jamais tes torts"] },
      { q: "Ton/ta partenaire marche-t-il/elle sur des œufs avec toi ?", options: ["Non, il/elle est libre", "Un peu", "Parfois", "Souvent"] },
      { q: "Tu lis les messages de ton/ta partenaire sans permission ?", options: ["Jamais", "Une fois par curiosité", "Parfois", "Régulièrement"] },
      { q: "Compares-tu ton/ta partenaire à tes ex ou à d'autres ?", options: ["Jamais", "Rarement", "Parfois", "Souvent"] },
      { q: "Comment gères-tu la jalousie ?", options: ["Très bien", "Correctement", "Avec quelques débordements", "Très mal, je deviens incontrôlable"] },
      { q: "Tes amis ont-ils déjà dit que tu étais compliqué(e) en amour ?", options: ["Jamais", "Une fois", "Quelques fois", "Souvent"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      if (score <= 7) return { level: "💚 Non-toxique", preview: "Tu es un(e) partenaire sain(e)", teaser: "MAIS il y a 1 comportement inconscient que tu as et qui nuit à tes relations…", color: "#4caf50", advice: "Continue à cultiver cette honnêteté et ce respect. Tu es le type de partenaire que tout le monde cherche." };
      if (score <= 15) return { level: "🟡 Légèrement toxique", preview: "Quelques comportements à corriger", teaser: "Ces comportements sabotent tes relations sans que tu le remarques. Voici comment les stopper…", color: "#ff9800", advice: "La prise de conscience est déjà un grand pas. Travaille sur la communication non-violente et la gestion des émotions." };
      return { level: "🔴 Comportements toxiques significatifs", preview: "Tes partenaires souffrent en silence", teaser: "Ce que tes ex ne t'ont JAMAIS dit par peur de te blesser. La vérité complète…", color: "#f44336", advice: "Ce n'est pas qui tu ES, c'est ce que tu as APPRIS. Un accompagnement thérapeutique peut transformer tes relations radicalement." };
    }
  },
  {
    id: "relation_durer",
    category: "❤️ Amour",
    title: "Cette relation va-t-elle durer ?",
    emoji: "⏳",
    popular: true,
    description: "Les statistiques ne mentent pas sur votre avenir.",
    questions: [
      { q: "Comment est la communication dans votre couple ?", options: ["Ouverte et fluide", "Bonne avec quelques difficultés", "Souvent compliquée", "Presque inexistante"] },
      { q: "Partagez-vous les mêmes valeurs fondamentales ?", options: ["Totalement", "Globalement oui", "Quelques différences importantes", "Très différentes"] },
      { q: "Comment gérez-vous les désaccords ?", options: ["On trouve toujours un compromis", "En général on s'en sort", "L'un impose sa vision", "Ça finit toujours mal"] },
      { q: "Avez-vous des projets d'avenir communs ?", options: ["Oui, très concrets", "On y pense", "On évite le sujet", "On n'en parle jamais"] },
      { q: "Le respect est-il présent au quotidien ?", options: ["Toujours", "Généralement", "Parfois non", "Souvent absent"] },
      { q: "Êtes-vous vraiment heureux/se dans cette relation ?", options: ["Très heureux/se", "Généralement bien", "Souvent insatisfait(e)", "Malheureux/se mais je reste"] },
      { q: "Votre entourage pense que vous allez bien ensemble ?", options: ["Tout le monde s'en réjouit", "La plupart", "Mitigé", "Personne ne comprend ce couple"] },
      { q: "La confiance est-elle solide entre vous ?", options: ["Totalement", "En grande partie", "Quelques failles", "Très fragilisée"] },
      { q: "Faites-vous des efforts mutuels pour entretenir la relation ?", options: ["Oui, les deux", "Plutôt moi", "Plutôt l'autre", "Aucun effort de l'un ou l'autre"] },
      { q: "En cas de crise grave, pensez-vous surmonter ensemble ?", options: ["Absolument", "Probablement", "Je doute", "Non, ça se terminerait là"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      const pct = Math.round(95 - (score / (answers.length * 3)) * 75);
      if (score <= 10) return { level: `💍 ${pct}% de chances`, preview: `Probabilité de durée : ${pct}%`, teaser: "Votre couple a les bases d'une relation durable. MAIS il y a 1 fragilité cachée qui peut tout faire s'effondrer…", color: "#4caf50", advice: "Continuez à investir dans votre communication et vos projets communs. Les couples qui durent se choisissent chaque jour." };
      if (score <= 20) return { level: `⚠️ ${pct}% de chances`, preview: `Probabilité de durée : ${pct}%`, teaser: "Des signaux d'alarme existent. Ce qui va se passer dans les 6 prochains mois si rien ne change…", color: "#ff9800", advice: "Il est encore temps de renforcer les fondations. Une thérapie de couple préventive peut sauver votre relation." };
      return { level: `💔 ${pct}% de chances`, preview: `Probabilité de durée : ${pct}%`, teaser: "Statistiquement, cette relation est en danger réel. La date critique que tu dois connaître…", color: "#f44336", advice: "La question n'est pas si ça va finir, mais COMMENT tu veux que ça finisse. Avec dignité ou avec souffrance ?" };
    }
  },
  // ─── INTELLIGENCE ───
  {
    id: "vrai_qi",
    category: "🧠 Test du QI",
    title: "Test du QI — Quel est ton quotient intellectuel ?",
    subtitle: "Intelligence",
    subtitleDesc: "Quel est ton quotient intellectuel ?",
    emoji: "🧩",
    popular: true,
    description: "Test validé sur 50 000 participants africains.",
    questions: [
      { q: "Complète la série : 2, 6, 12, 20, 30, __", options: ["38", "40", "42", "36"] },
      { q: "Si tu retournes une horloge face au mur, le 3 devient le…", options: ["9", "6", "12", "3"] },
      { q: "5 machines font 5 pièces en 5 min. 100 machines feront 100 pièces en…", options: ["100 min", "50 min", "5 min", "20 min"] },
      { q: "Un nénuphar double chaque jour. Il couvre le lac en 48 jours. La moitié en…", options: ["24 jours", "47 jours", "32 jours", "12 jours"] },
      { q: "Mot intrus : Requin, Baleine, Dauphin, Saumon, Pieuvre", options: ["Requin", "Baleine", "Saumon", "Pieuvre"] },
      { q: "Si A > B et B > C, alors…", options: ["A > C forcément", "C > A possible", "B est le plus grand", "Impossible à savoir"] },
      { q: "Résous : 3 × (4 + 2) − 8 ÷ 2 = ?", options: ["14", "18", "10", "22"] },
      { q: "Quelle forme suit la série ? ○□△○□__", options: ["○", "□", "△", "◇"] },
      { q: "Ana est l'amie de Ben. Ben est le frère de Carla. Carla est la cousine de Dan. Ana et Dan sont…", options: ["Cousins", "Amis indirects", "Aucun lien direct", "Frère et sœur"] },
      { q: "10% de 500 + 20% de 250 = ?", options: ["100", "90", "110", "75"] },
      { q: "Combien de mois ont 28 jours ?", options: ["1", "4", "12", "7"] },
      { q: "Tu es dans une course et tu dépasses la 2ème place. Tu es maintenant…", options: ["1er", "2ème", "3ème", "Dernier"] },
    ],
    correctAnswers: [2, 0, 2, 1, 2, 0, 0, 2, 1, 0, 2, 1],
    compute: (answers) => {
      const correct = answers.filter((a, i) => a === [2,0,2,1,2,0,0,2,1,0,2,1][i]).length;
      const iq = Math.min(160, 82 + correct * 7 + Math.floor(Math.random() * 5));
      const pct = Math.round((correct / 12) * 100);
      if (correct >= 10) return { level: `🏆 QI ${iq} — Supérieur`, preview: `${pct}% de bonnes réponses`, teaser: `Ton QI de ${iq} te place dans le top 3% de la population. Mais voici le type d'intelligence RARE que tu possèdes en plus…`, color: "#9c27b0", advice: "Ton potentiel intellectuel est exceptionnel. Ne le gâche pas — trouve un environnement qui le stimule." };
      if (correct >= 7) return { level: `⭐ QI ${iq} — Au-dessus de la moyenne`, preview: `${pct}% de bonnes réponses`, teaser: `Ton QI de ${iq} surpasse 70% des gens. Le domaine où ton intelligence est SOUS-UTILISÉE…`, color: "#2196f3", advice: "Tu as clairement un potentiel supérieur. Investis dans ta formation et ton développement — tu iras loin." };
      if (correct >= 4) return { level: `✅ QI ${iq} — Dans la moyenne`, preview: `${pct}% de bonnes réponses`, teaser: `QI moyen ne veut pas dire ordinaire. Voici quelle intelligence SPÉCIALE compense chez toi…`, color: "#4caf50", advice: "Le QI logique n'est qu'une mesure. L'intelligence émotionnelle, créative et sociale comptent tout autant." };
      return { level: `💪 QI ${iq} — À développer`, preview: `${pct}% de bonnes réponses`, teaser: `Le QI n'est pas fixe — il peut augmenter de 15-20 points. La méthode exacte pour y arriver…`, color: "#ff9800", advice: "Des études prouvent que la lecture quotidienne, les jeux de logique et la méditation augmentent réellement le QI." };
    }
  },
  {
    id: "age_mental",
    category: "🧠 Test du QI",
    title: "Ton âge mental est-il supérieur à ton âge réel ?",
    emoji: "🧮",
    popular: false,
    description: "La maturité psychologique se mesure, pas le physique.",
    questions: [
      { q: "Face à un problème, ta première réaction est…", options: ["Analyser calmement", "Chercher de l'aide", "Stresser puis agir", "Éviter le problème"] },
      { q: "Comment gères-tu les critiques ?", options: ["Je les prends comme une opportunité", "Je les accepte difficilement", "Je me défends", "Je les rejette toujours"] },
      { q: "Tes décisions importantes sont basées sur…", options: ["La raison et l'expérience", "Un mélange de raison et d'émotion", "Surtout l'émotion", "L'impulsion du moment"] },
      { q: "Comment vis-tu les échecs ?", options: ["Comme des leçons précieuses", "Avec de la déception puis je rebondis", "Très mal pendant longtemps", "Je ne supporte pas l'échec"] },
      { q: "Ta gestion de l'argent est…", options: ["Très rigoureuse", "Correcte", "Peu organisée", "Je dépense tout"] },
      { q: "Quand tu blesses quelqu'un, tu…", options: ["M'excuse sincèrement et rapidement", "M'excuse après réflexion", "Attends que l'autre fasse le premier pas", "Nis rarement avoir tort"] },
      { q: "Ta vision du futur est…", options: ["Planifiée et réaliste", "Optimiste et floue", "Anxieuse", "Je vis dans le présent uniquement"] },
      { q: "Comment gères-tu le conflit ?", options: ["Dialogue calme", "Discussion animée mais constructive", "Évitement", "Explosions émotionnelles"] },
      { q: "Ton rapport aux responsabilités est…", options: ["Je les assume pleinement", "Je les assume avec quelques difficultés", "J'ai tendance à les fuir", "Je les fuis systématiquement"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      const ages = ["40+", "35-40", "25-35", "18-25"];
      const idx = score <= 9 ? 0 : score <= 17 ? 1 : score <= 24 ? 2 : 3;
      const ageLabel = ages[idx];
      const teasers = [
        "Ton âge mental est de 40+ ans. Tu as une sagesse rare. Mais voici le piège que les gens sages tombent souvent…",
        "Ton âge mental est de 35-40 ans. Mature et équilibré(e). Ce qui te manque encore pour atteindre la pleine sagesse…",
        "Ton âge mental est de 25-35 ans. Tu grandis vite mais il reste cette habitude destructrice à éliminer…",
        "Ton âge mental est de 18-25 ans. L'impulsivité te coûte cher. Voici comment la transformer en force…"
      ];
      const colors = ["#9c27b0", "#2196f3", "#ff9800", "#f44336"];
      const advices = [
        "Ta maturité est un atout précieux. Partage-la avec les jeunes autour de toi — c'est là où tu auras le plus d'impact.",
        "Tu combines maturité et énergie — un équilibre rare. Continue à te former et à te remettre en question.",
        "La maturité s'acquiert par l'expérience ET la réflexion. Tiens un journal intime — ça accélère énormément la croissance.",
        "L'immaturité émotionnelle n'est pas un défaut de caractère — c'est un manque de modèles. Cherche des mentors."
      ];
      return { level: `🧠 Âge mental : ${ageLabel}`, preview: `Ta maturité psychologique`, teaser: teasers[idx], color: colors[idx], advice: advices[idx] };
    }
  },
  // ─── PERSONNALITÉ ───
  {
    id: "pourquoi_echec",
    category: "💭 Personnalité",
    title: "Pourquoi échoues-tu dans la vie ?",
    emoji: "🧠",
    popular: true,
    description: "La vraie raison que tu n'as jamais osé regarder en face.",
    questions: [
      { q: "Quand tu échoues, tu penses d'abord à…", options: ["Ce que j'ai mal fait", "La malchance", "Les autres qui m'ont freiné", "Que je ne suis pas fait pour ça"] },
      { q: "Tu as commencé combien de projets sans les finir ces 2 ans ?", options: ["0-1", "2-3", "4-6", "Plus de 6"] },
      { q: "Comment te comportes-tu face aux opportunités ?", options: ["Je fonce et j'agis", "J'analyse puis j'agis", "Je procrastine longuement", "Je laisse passer par peur"] },
      { q: "Ton rapport à l'effort est…", options: ["J'aime me dépasser", "Je fournis l'effort nécessaire", "Je cherche le chemin de moindre effort", "J'évite l'effort dès que possible"] },
      { q: "Quand quelqu'un réussit mieux que toi, tu…", options: ["Suis inspiré(e)", "Apprends de son exemple", "Ressens de la jalousie", "Minimise ses succès"] },
      { q: "Ta discipline personnelle est…", options: ["Très forte", "Correcte", "Faible", "Inexistante"] },
      { q: "As-tu un mentor ou des modèles qui t'inspirent ?", options: ["Oui, je m'inspire activement", "Oui, vaguement", "Pas vraiment", "Non et je n'en vois pas l'utilité"] },
      { q: "Comment réagis-tu à une critique constructive ?", options: ["Je la note et m'améliore", "Je l'entends mais j'ai du mal", "Je me défends", "Je deviens agressif(ve)"] },
      { q: "Ta peur principale dans la vie est…", options: ["De ne pas avoir d'impact", "De décevoir les autres", "De l'échec public", "Du jugement des autres"] },
      { q: "As-tu une vision claire de qui tu veux devenir ?", options: ["Très claire et précise", "Floue mais j'y travaille", "Vague", "Aucune vision"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      if (score <= 10) return { level: "🚀 Mentalité de succès", preview: "Tu as les bases pour réussir", teaser: "MAIS il y a 1 blocage invisible qui ralentit ton ascension sans que tu le vois…", color: "#4caf50", advice: "Continue à affiner ta vision et entoure-toi de personnes qui ont déjà réussi ce que tu veux accomplir." };
      if (score <= 19) return { level: "⚠️ Quelques freins majeurs", preview: "Des blocages importants identifiés", teaser: "Ces comportements spécifiques te font perdre des mois chaque année. Voici lesquels exactement…", color: "#ff9800", advice: "Le premier pas : tiens un journal d'actions quotidiennes. La discipline se construit par l'observation de soi." };
      return { level: "🚫 Schéma d'auto-sabotage", preview: "Tu te bloques toi-même", teaser: "La vérité choc : ce n'est pas la malchance, ce sont tes propres décisions inconscientes. Voici le schéma complet…", color: "#f44336", advice: "L'auto-sabotage est souvent une protection contre la peur du succès. Oui, la peur de réussir existe — et elle est réelle." };
    }
  },
  {
    id: "destin_bloque",
    category: "💭 Personnalité",
    title: "Pourquoi ton destin est bloqué ?",
    emoji: "🌪",
    popular: true,
    description: "Les forces invisibles qui bloquent ta progression.",
    questions: [
      { q: "As-tu l'impression de tourner en rond depuis des années ?", options: ["Non, j'avance", "Parfois", "Souvent", "Constamment, depuis trop longtemps"] },
      { q: "Les malchances et obstacles s'accumulent dans ta vie ?", options: ["Non, ça va", "Quelques-uns", "Plus que la normale", "Une série noire interminable"] },
      { q: "Tes proches te soutiennent-ils vraiment ?", options: ["Totalement", "En partie", "Peu", "Certains me jalousent ou me freinent"] },
      { q: "Penses-tu mériter le succès ?", options: ["Absolument", "Oui mais avec des doutes", "Je ne sais pas vraiment", "Souvent non"] },
      { q: "As-tu des regrets ou rancœurs du passé non réglés ?", options: ["Aucun", "Quelques-uns", "Plusieurs", "Beaucoup et ça me ronge"] },
      { q: "Ta famille ou tes origines te pèsent-elles ?", options: ["Non, je suis libre", "Un peu", "Elles influencent mes choix", "Elles me définissent et m'écrasent"] },
      { q: "Crois-tu en ta propre valeur ?", options: ["Totalement", "La plupart du temps", "Rarement", "Jamais vraiment"] },
      { q: "As-tu des pensées négatives récurrentes sur toi-même ?", options: ["Presque jamais", "Parfois", "Souvent", "Tous les jours"] },
      { q: "Tes actions sont-elles alignées avec tes rêves ?", options: ["Totalement", "Partiellement", "Peu", "Pas du tout"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      if (score <= 9) return { level: "🌟 Destin en mouvement", preview: "Tu es sur la bonne voie", teaser: "Mais il y a 1 ennemi silencieux dans ton entourage qui freine inconsciemment ton ascension…", color: "#4caf50", advice: "Protège ton énergie. Toutes les personnes dans ta vie n'ont pas les mêmes objectifs que toi." };
      if (score <= 18) return { level: "⚡ Destin ralenti", preview: "Des forces te freinent", teaser: "Ces 3 blocages spécifiques créent un mur invisible entre toi et ta destinée. Les voici nommés…", color: "#ff9800", advice: "Le pardon (de soi et des autres) est souvent la clé qui déverrouille ce qui est bloqué depuis des années." };
      return { level: "🔒 Destin profondément bloqué", preview: "Blocages majeurs détectés", teaser: "L'analyse révèle un blocage profond d'origine émotionnelle. Ce n'est pas la malchance — voici la vérité…", color: "#9c27b0", advice: "Les croyances limitantes s'installent entre 0 et 7 ans. Identifier leur source, c'est déjà commencer à les dissoudre." };
    }
  },
  // ─── ARGENT & SUCCÈS ───
  {
    id: "pourquoi_pauvre",
    category: "💰 Argent & Succès",
    title: "Pourquoi es-tu encore pauvre ?",
    emoji: "💸",
    popular: true,
    description: "La vraie raison que personne ne t'a dite.",
    questions: [
      { q: "Comment gères-tu ton argent chaque mois ?", options: ["Je planifie et épargne rigoureusement", "J'essaie d'épargner", "Je dépense tout avant la fin du mois", "Je n'ai même pas de plan"] },
      { q: "Que ferais-tu avec 500 000 FCFA inattendus ?", options: ["Investissement immédiat", "Épargne puis investissement réfléchi", "Achat plaisir + un peu d'épargne", "Je dépenserais tout rapidement"] },
      { q: "Ta relation avec l'argent est…", options: ["Je contrôle l'argent", "L'argent et moi, on s'entend", "J'en ai peur parfois", "L'argent me contrôle"] },
      { q: "Tes habitudes de dépenses sont…", options: ["Très disciplinées", "Correctes", "Impulsives parfois", "Très impulsives"] },
      { q: "Tu crois que tu mérites d'être riche ?", options: ["Absolument, je le construis", "Oui mais je ne sais pas comment", "Peut-être pour quelqu'un comme moi…", "Non, l'argent c'est pour les autres"] },
      { q: "Combien de sources de revenus as-tu ?", options: ["3 ou plus", "2", "1 (salaire uniquement)", "Aucune stable"] },
      { q: "Investis-tu dans ta formation ou compétences ?", options: ["Régulièrement", "Parfois", "Rarement", "Jamais, c'est trop cher"] },
      { q: "Ton entourage parle d'argent comment ?", options: ["Positivement, en termes d'investissement", "Normalement", "Avec des croyances limitantes", "L'argent c'est le mal / honte d'en vouloir"] },
      { q: "As-tu un plan financier pour les 5 prochaines années ?", options: ["Oui, détaillé", "Vaguement", "Non mais j'y pense", "Non et je ne sais pas par où commencer"] },
      { q: "Comment vois-tu les riches ?", options: ["Comme des modèles et inspirations", "Avec respect neutre", "Avec méfiance", "Avec jalousie ou rancœur"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      const pct = Math.round(90 - (score / (answers.length * 3)) * 70);
      if (score <= 10) return { level: `📈 Trajectoire de richesse`, preview: `${pct}% de probabilité de succès financier`, teaser: `Ton profil ressemble à 87% des millionnaires africains de moins de 40 ans. MAIS voici l'erreur que beaucoup font à ton stade…`, color: "#4caf50", advice: "Continue. Diversifie tes revenus et investis 20% minimum de chaque revenu avant de dépenser." };
      if (score <= 20) return { level: `⚠️ Potentiel freiné`, preview: `${pct}% de probabilité de succès financier`, teaser: `Ces habitudes spécifiques te font perdre des millions sur 10 ans sans que tu t'en rendes compte. Le calcul exact…`, color: "#ff9800", advice: "Commence par une règle simple : 50% besoins, 30% désirs, 20% épargne/investissement. Applique pendant 90 jours." };
      return { level: `🔴 Schéma de pauvreté actif`, preview: `${pct}% de probabilité de succès financier`, teaser: `Ce n'est pas un manque d'argent — c'est un manque de RELATION avec l'argent. La croyance exacte qui te bloque…`, color: "#f44336", advice: "Lis 'L'Homme le plus riche de Babylone'. Ça prend 2h et ça peut changer toute ta vie financière." };
    }
  },
  {
    id: "mindset_riche",
    category: "💰 Argent & Succès",
    title: "As-tu l'état d'esprit d'un riche ?",
    emoji: "🚀",
    popular: false,
    description: "Ce que les riches pensent différemment.",
    questions: [
      { q: "Quand tu entends 'risque financier', tu penses…", options: ["Opportunité calculée", "À évaluer sérieusement", "Danger à éviter", "Perte assurée"] },
      { q: "Face à une occasion d'affaires, ton premier réflexe est…", options: ["Comment je peux en profiter", "J'analyse les pour et contre", "J'attends de voir", "Trop risqué, je passe"] },
      { q: "Pour toi, travailler pour quelqu'un d'autre c'est…", options: ["Temporaire, le temps de me lancer", "Bien si c'est épanouissant", "La sécurité avant tout", "La seule option réaliste pour moi"] },
      { q: "Quand tu dépenses de l'argent, tu penses…", options: ["Investissement ou dépense ?", "Est-ce dans mon budget ?", "Est-ce que j'en ai envie ?", "Je dépense sans trop réfléchir"] },
      { q: "Ton réseau professionnel est…", options: ["Puissant et actif", "Correct", "Limité", "Presque inexistant"] },
      { q: "Les riches autour de toi te…", options: ["Inspirent profondément", "Motivent", "Dérangent", "Rendent jaloux/se"] },
      { q: "Tu penses que la richesse est…", options: ["Un résultat de valeur créée", "Accessible avec du travail", "Réservée à certains", "Fruit de la chance ou des relations"] },
      { q: "Tu te lèves le matin avec…", options: ["Une mission et des objectifs", "De l'énergie et de la motivation", "L'obligation de travailler", "La fatigue et le manque d'envie"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      const pct = Math.round(95 - (score / (answers.length * 3)) * 75);
      if (score <= 8) return { level: `💰 Mindset de riche (${pct}%)`, preview: `Tu penses comme les gens qui réussissent`, teaser: `Ton mindset est au niveau. Voici la dernière chose qui sépare les gens comme toi du succès réel…`, color: "#9c27b0", advice: "Passe maintenant à l'action. Un bon mindset sans exécution ne produit rien. Lance-toi dans les 30 prochains jours." };
      if (score <= 16) return { level: `📊 Mindset en développement (${pct}%)`, preview: `Tu as des bases mais des croyances limitantes`, teaser: `Ces 3 croyances spécifiques sabotent ton potentiel financier chaque jour. Les voici dévoilées…`, color: "#2196f3", advice: "Commence à consommer du contenu financier positif : podcasts, livres, personnes qui réussissent. L'environnement mental est clé." };
      return { level: `⚠️ Mindset de pauvreté (${pct}%)`, preview: `Tes croyances te bloquent financièrement`, teaser: `Ces pensées automatiques créent une barrière invisible entre toi et l'argent. La principale…`, color: "#f44336", advice: "La bonne nouvelle : le mindset se change. Il faut en moyenne 66 jours pour créer une nouvelle habitude mentale." };
    }
  },
  // ─── QUIZ CHOC ───
  {
    id: "secret_sombre",
    category: "🔥 Quiz Choc",
    title: "Ton secret le plus sombre révélé",
    emoji: "😳",
    popular: true,
    description: "Ce que tu caches même à toi-même.",
    questions: [
      { q: "Ce que tu n'avoues jamais aux autres c'est que tu…", options: ["As parfois envie de tout abandonner", "Te sens souvent incompris(e)", "Joues un rôle pour être accepté(e)", "As peur de ne jamais être vraiment aimé(e)"] },
      { q: "La nuit, quand tu ne dors pas, tu penses à…", options: ["Tes ambitions et rêves", "Tes erreurs et regrets", "Quelqu'un que tu as perdu ou désiré", "Ta propre valeur et utilité"] },
      { q: "La chose dont tu es le plus honteux/se secrètement est…", options: ["Une décision passée", "Un sentiment ou désir inavouable", "Quelque chose que tu as fait à quelqu'un", "Ce que tu es vraiment au fond"] },
      { q: "Si les gens savaient vraiment qui tu es, ils…", options: ["Seraient impressionnés", "Seraient surpris", "Seraient déçus", "Te rejetteraient probablement"] },
      { q: "Ce que tu désires le plus et n'oses pas dire est…", options: ["Être reconnu(e) et admiré(e)", "Aimer et être aimé(e) inconditionnellement", "Être libre de toute attente", "Réparer quelque chose du passé"] },
      { q: "La blessure que tu portes en silence est…", options: ["Un abandon ou trahison", "Une humiliation publique", "Une perte irréparable", "Une erreur que tu ne te pardonnes pas"] },
      { q: "Tu as déjà pensé que ta vie aurait été meilleure si…", options: ["Tu avais fait des choix différents", "Tu étais né(e) dans un autre milieu", "Tu avais rencontré d'autres personnes", "Tu n'avais jamais existé"] },
      { q: "Le masque que tu portes le plus souvent est…", options: ["La force (quand tu es fragile)", "La joie (quand tu souffres)", "La confiance (quand tu doutes)", "L'indifférence (quand tu ressens beaucoup)"] },
    ],
    compute: (answers) => {
      const profiles = [
        { level: "🦁 Le Guerrier Blessé", preview: "Tu portes une force douloureuse", teaser: "Derrière ta carapace se cache une blessure précise qui dirige toute ta vie sans que tu le saches. Voici laquelle…", color: "#ff5722", advice: "Ta force vient de ta douleur — c'est réel. Mais guérir ne te rendra pas faible. Ça te rendra libre." },
        { level: "🌊 L'Âme Incomprise", preview: "Tu te sens seul(e) dans ta profondeur", teaser: "Il y a une raison précise pourquoi tu te sens incompris(e) des autres. Et ce n'est pas leur faute ni la tienne…", color: "#9c27b0", advice: "Les âmes profondes attirent peu de gens mais ceux qu'elles attirent sont pour la vie. Reste authentique." },
        { level: "🎭 Le Maître des Masques", preview: "Tu joues un rôle depuis trop longtemps", teaser: "L'analyse révèle exactement QUAND tu as commencé à porter ce masque et pourquoi tu ne peux pas l'enlever…", color: "#2196f3", advice: "Commencer à enlever le masque dans des espaces sûrs est la première étape vers une liberté authentique." },
        { level: "💎 La Lumière Cachée", preview: "Tu sous-estimes profondément ta valeur", teaser: "Ce que tu es vraiment est INFINIMENT plus grand que ce que tu crois. Voici la preuve dans tes propres réponses…", color: "#e91e63", advice: "La peur d'être vu(e) vraiment est la plus universelle des peurs humaines. Tu n'es pas seul(e)." }
      ];
      return profiles[answers[7] % 4];
    }
  },
  {
    id: "erreur_vie",
    category: "🔥 Quiz Choc",
    title: "Quelle erreur va détruire ta vie ?",
    emoji: "💀",
    popular: true,
    description: "Mieux vaut savoir avant que ça arrive.",
    questions: [
      { q: "Ton plus grand défaut que tu ne corriges pas est…", options: ["La procrastination", "La confiance excessive en certaines personnes", "L'impulsivité dans mes décisions", "L'inaction par peur de l'échec"] },
      { q: "Dans tes relations, tu as tendance à…", options: ["Bien choisir tes proches", "Parfois faire confiance trop vite", "Souvent ignorer les signaux d'alarme", "Garder des personnes néfastes par loyauté"] },
      { q: "Ta gestion des conflits peut te coûter cher car tu…", options: ["Règles les problèmes rapidement", "Attends parfois trop", "Laisses traîner jusqu'à l'explosion", "Fuis systématiquement les confrontations"] },
      { q: "L'argent peut te détruire si tu continues à…", options: ["Rien, ma gestion est saine", "Reporter les bonnes décisions", "Dépenser sans planifier", "Ne jamais épargner ni investir"] },
      { q: "Ta santé est menacée par…", options: ["Rien, je prends soin de moi", "Un peu de stress", "Beaucoup de stress et mauvaises habitudes", "Négligence totale de ma santé"] },
      { q: "Dans 5 ans, ce qui pourrait tout faire s'effondrer c'est…", options: ["Rien de prévisible", "Une mauvaise décision financière", "Une relation toxique non quittée", "Ma propre incapacité à m'imposer"] },
      { q: "La personne qui pourrait te trahir le plus est…", options: ["Personne dans mon entourage", "Un ami dont je doute parfois", "Quelqu'un à qui j'ai donné trop de pouvoir", "Moi-même"] },
      { q: "L'habitude qui te détruit lentement est…", options: ["Aucune vraiment", "La comparaison aux autres", "L'auto-sabotage", "La négativité et les pensées limitantes"] },
    ],
    compute: (answers) => {
      const types = [
        { level: "⚠️ Erreur : La Trahison Silencieuse", preview: "Quelqu'un dans ta vie prépare ta chute", teaser: "Les données révèlent que tu accordes ta confiance à quelqu'un qui ne la mérite pas. Les signaux exacts…", color: "#f44336", advice: "Observe qui profite de tes succès et qui est là dans tes échecs. La liste sera courte mais précieuse." },
        { level: "⚠️ Erreur : L'Inaction Chronique", preview: "Le temps qui passe est ton ennemi n°1", teaser: "Chaque jour sans décision te coûte exactement ce montant en opportunités perdues. Le calcul…", color: "#ff9800", advice: "L'action imparfaite vaut infiniment mieux que la perfection paralysante. Lance-toi maintenant." },
        { level: "⚠️ Erreur : La Relation Toxique", preview: "Une personne freine tout ton potentiel", teaser: "Il y a quelqu'un dans ta vie qui, consciemment ou non, sabote ton évolution. Son profil exact…", color: "#9c27b0", advice: "S'éloigner d'une personne toxique n'est pas cruel — c'est une nécessité de survie." },
        { level: "⚠️ Erreur : L'Auto-Sabotage", preview: "Tu es ton propre plus grand ennemi", teaser: "L'analyse montre que tu sabotes tes succès au moment précis où ils arrivent. Voici pourquoi et comment stopper…", color: "#e91e63", advice: "L'auto-sabotage protège d'une peur plus profonde. Identifie cette peur et tu libères tout le reste." }
      ];
      return types[answers.reduce((s,a)=>s+a,0) % 4];
    }
  },
  {
    id: "danger_cache",
    category: "🔥 Quiz Choc",
    title: "Es-tu en danger sans le savoir ?",
    emoji: "⚠️",
    popular: false,
    description: "Les menaces invisibles dans ta vie.",
    questions: [
      { q: "As-tu des ennemis silencieux dans ton entourage proche ?", options: ["Non, j'ai confiance en tous", "Je me méfie d'une personne", "Il y en a probablement", "J'en suis presque sûr(e)"] },
      { q: "Ressens-tu parfois une énergie négative sans raison ?", options: ["Jamais", "Rarement", "Parfois", "Souvent et ça m'épuise"] },
      { q: "Des projets avancent-ils puis s'effondrent mystérieusement ?", options: ["Non, tout se passe bien", "Une fois ou deux", "Régulièrement", "C'est un schéma récurrent"] },
      { q: "As-tu confié des secrets à des personnes dont tu n'es plus sûr(e) ?", options: ["Non", "Un ou deux", "Plusieurs", "Beaucoup trop"] },
      { q: "As-tu des dettes ou engagements financiers risqués ?", options: ["Aucun", "Un engagement gérable", "Plusieurs préoccupants", "Des dettes qui menacent mon équilibre"] },
      { q: "Ta santé te donne-t-elle des signes d'alarme ignorés ?", options: ["Non, tout va bien", "Quelques petits signes", "Des signes que j'évite d'examiner", "Des problèmes sérieux non traités"] },
      { q: "Quelqu'un a-t-il accès à des informations qui pourraient te nuire ?", options: ["Non", "Peut-être 1 personne", "Probablement oui", "Oui et ça m'inquiète"] },
    ],
    compute: (answers) => {
      const score = answers.reduce((s, a) => s + a, 0);
      if (score <= 5) return { level: "✅ Faible danger détecté", preview: "Ta vie semble relativement sécurisée", teaser: "MAIS l'analyse a détecté 1 vulnérabilité spécifique que tu ignores. Elle peut tout changer…", color: "#4caf50", advice: "Maintiens ta vigilance. Le danger vient rarement là où on l'attend." };
      if (score <= 11) return { level: "⚠️ Danger modéré", preview: "Plusieurs signaux d'alerte détectés", teaser: "Ces signaux indiquent une menace réelle dans les prochains mois. Voici d'où elle vient exactement…", color: "#ff9800", advice: "Fais l'inventaire de tes relations et engagements. Identifie les risques et agis maintenant." };
      return { level: "🔴 Danger élevé", preview: "Tu es vulnérable sur plusieurs fronts", teaser: "L'analyse révèle des zones de risque critiques dans ta vie. Ce que tu dois faire dans les 30 prochains jours…", color: "#f44336", advice: "Prends ces signaux au sérieux. Commence par sécuriser tes informations personnelles et évaluer tes relations proches." };
    }
  },
];

// ============================================================
// QUIZ COMPONENTS
// ============================================================

function QuizHome({ setActiveQuiz, setQuizPage, setQuizAnswers, setCurrentQuestion, quizCategory, setQuizCategory, G, quizPrice, setPage, setCarryCarePage }) {
  const filtered = quizCategory === "Tous" ? QUIZ_DATA : QUIZ_DATA.filter(q => q.category === quizCategory);

  function startQuiz(quiz) {
    setActiveQuiz(quiz);
    setQuizAnswers([]);
    setCurrentQuestion(0);
    setQuizPage("quizPlay");
    setPage("quiz");
  }

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Hero — minimal comme sur la capture */}
      <div style={{ background: "linear-gradient(135deg, #1a1208 0%, #3d2b0a 100%)", padding: "32px 16px 28px", textAlign: "center", position: "relative" }}>
        <button onClick={() => setPage("home")} style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>← Retour</button>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🎯</div>
        <div style={{ fontSize: 26, fontWeight: "bold", color: G.gold, fontFamily: "Georgia, serif", marginBottom: 8 }}>Carry'Quiz</div>
        <div style={{ fontSize: 15, color: "#ccc", marginBottom: 28 }}>Découvre des vérités sur toi-même</div>
        {/* Catégories uniquement */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {QUIZ_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => {
              if (cat === "🌸 Beauté & Santé") { setPage("carrycare"); setCarryCarePage("home"); return; }
              setQuizCategory(cat);
            }} style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13, cursor: "pointer", fontWeight: quizCategory === cat ? "bold" : "normal",
              border: "1.5px solid " + (quizCategory === cat ? G.gold : "rgba(255,255,255,0.25)"),
              background: quizCategory === cat ? G.gold : "transparent",
              color: quizCategory === cat ? "#1a1208" : "#ddd",
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Liste des quiz — sans prix affiché */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(quiz => (
            <div key={quiz.id} onClick={() => startQuiz(quiz)} style={{
              background: G.surface, border: "1px solid " + G.border, borderRadius: 14,
              padding: "16px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
              transition: "border-color 0.2s"
            }}>
              <div style={{ fontSize: 34, flexShrink: 0 }}>{quiz.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: G.gold, marginBottom: 3, letterSpacing: 1, textTransform: "uppercase" }}>{quiz.category}</div>
                <div style={{ fontSize: 14, fontWeight: "bold", color: G.text, lineHeight: 1.4 }}>{quiz.title}</div>
                <div style={{ fontSize: 12, color: G.textDim, marginTop: 4 }}>{quiz.description}</div>
              </div>
              <div style={{ color: G.gold, fontSize: 22, flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuizPlay({ quiz, answers, setAnswers, currentQ, setCurrentQ, setQuizPage, setQuizResult, G, setPage }) {
  const q = quiz.questions[currentQ];
  const progress = (currentQ / quiz.questions.length) * 100;
  const [selected, setSelected] = useState(null);
  const [animating, setAnimating] = useState(false);

  function answer(idx) {
    if (animating) return;
    setSelected(idx);
    setAnimating(true);
    setTimeout(() => {
      const newAnswers = [...answers, idx];
      setAnswers(newAnswers);
      if (currentQ + 1 >= quiz.questions.length) {
        setQuizResult(quiz.compute(newAnswers));
        setQuizPage("quizSuspense");
      } else {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setAnimating(false);
      }
    }, 350);
  }

  return (
    <div style={{ padding: "0 0 80px" }}>
      <div style={{ background: G.surface, padding: "14px 16px 0", borderBottom: "1px solid " + G.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: G.textDim, marginBottom: 6 }}>
          <button onClick={() => setQuizPage("quizHome")} style={{ background: "none", border: "none", color: G.gold, fontSize: 13, cursor: "pointer", padding: 0 }}>← Retour</button>
          <span style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quiz.emoji} {quiz.title}</span>
          <span>{currentQ + 1}/{quiz.questions.length}</span>
        </div>
        <div style={{ height: 5, background: G.border, borderRadius: 3, marginBottom: 10 }}>
          <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg, " + G.gold + ", #e0be7a)", borderRadius: 3, transition: "width 0.4s" }} />
        </div>
      </div>
      <div style={{ padding: "24px 16px 16px" }}>
        <div style={{ fontSize: 11, color: G.gold, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Question {currentQ + 1}</div>
        <div style={{ fontSize: 17, fontWeight: "bold", color: G.text, lineHeight: 1.6, marginBottom: 24 }}>{q.q}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((opt, i) => (
            <button key={i} onClick={() => answer(i)} style={{
              padding: "15px 18px", border: "2px solid " + (selected === i ? G.gold : G.border),
              borderRadius: 12, background: selected === i ? G.goldDim : G.surface,
              color: G.text, fontSize: 14, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s",
              transform: selected === i ? "scale(0.98)" : "scale(1)"
            }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: selected === i ? G.gold : G.goldDim, border: "1px solid " + G.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", color: selected === i ? "#fff" : G.gold, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuizSuspense({ setQuizPage, G }) {
  const [step, setStep] = useState(0);
  const msgs = ["Analyse de tes réponses…", "Calcul de ton profil psychologique…", "Préparation de ta vérité personnalisée…"];
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 900);
    const t2 = setTimeout(() => setStep(2), 1800);
    const t3 = setTimeout(() => setStep(3), 2700);
    const t4 = setTimeout(() => setQuizPage("quizPayment"), 3200);
    return () => [t1,t2,t3,t4].forEach(clearTimeout);
  }, []);
  return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", background: G.bg }}>
      <div style={{ fontSize: 60, marginBottom: 20, animation: "spinAnim 1.5s linear infinite" }}>⚙️</div>
      <div style={{ fontSize: 19, fontWeight: "bold", color: G.text, marginBottom: 6 }}>Analyse en cours…</div>
      <div style={{ fontSize: 13, color: G.textDim, marginBottom: 28 }}>Calcul de ton résultat…</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
        {msgs.map((msg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: step > i ? 1 : 0.25, transition: "opacity 0.5s", background: step > i ? G.goldDim : "transparent", borderRadius: 8, padding: "8px 12px" }}>
            <span style={{ fontSize: 16 }}>{step > i ? "✅" : "⏳"}</span>
            <span style={{ fontSize: 13, color: G.text }}>{msg}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes spinAnim{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function QuizPayment({ quiz, quizResult, quizPaymentStep, setQuizPaymentStep, quizPhone, setQuizPhone, quizPaymentMethod, setQuizPaymentMethod, setQuizPage, G, quizPrice }) {
  const ORANGE_LOGO_LOCAL = "data:image/png;base64,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";
  const MTN_LOGO_LOCAL = "data:image/png;base64,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+4urmYpMGZmTFjDSaWgW7De91pXBMEdPyjL3DDEkcMdO9jGtTJGojY0REPp5USKtjsmSKv62/d/lNvpFEkiyJGxHrvcjUzX2kyRRyIiSRseibtZqKXrMWaNVlqiYV+aY1tr67NLb3tle99RVu6jXk4sqH/fcTe2q5Bta66m7+RdX/wDHP/pqae0cYMpcY6HJaSRGxV0NbK+knVNrHardi/yr095vlURU1VRMt2RxjjZG3VjY1idTUyQsKbiKNTpZ8KALPL2vDr6tG+VrZ3vn1K5mqXDmorXxM2hpaRvvbwsq+aDYrrBpcqae8pMlbBRSQyeE3pq6jU29OxE2lhTikcaSLIkbUeu92W3vOR8YkrvpubEzzYZZobYHLLdkLDq2KtKp3o+CYWlpZk37UABgFk0AARAAEQABEIfzHcCSH8x3ABUXmQADqZR8gACL03ZzG8CTgx7NRv227usnXZ2295yzZSCuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkDjrs7be8a7O23vFkXIHHXZ229412dtveLIuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkDjrs7be8a7O23vFkXIHHXZ229412dtveLIuQOOuztt7xrs7be8WRcgcddnbb3jXZ2294si5A467O23vGuztt7xZFyBx12dtveNdnbb3iyLkQ/mO4Ea7O23vIe9mo77bd3WAEXmUADqZR8gACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAiAAIgACIAAi//9k=";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const price = quizPrice || 500;

  const methods = [
    { id: "orange", label: "Orange Money", logo: ORANGE_LOGO_LOCAL, color: "#ff6600" },
    { id: "mtn", label: "MTN MoMo", logo: MTN_LOGO_LOCAL, color: "#ffc000" }
  ];

  async function handlePay() {
    if (!quizPhone || quizPhone.replace(/[^0-9]/g,"").length < 9) { setError("Entre un numéro valide (9 chiffres)"); return; }
    if (!quizPaymentMethod) { setError("Choisis MTN MoMo ou Orange Money"); return; }
    setLoading(true); setError("");
    setQuizPaymentStep(4);
    try {
      const phone = quizPhone.replace(/[^0-9]/g,"");
      const fullPhone = phone.startsWith("237") ? phone : "237" + phone;
      const collectRes = await fetch("/api/campay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collect", amount: price, phone: fullPhone, description: "Carry'Quiz — " + quiz.title, external_reference: "quiz_" + quiz.id + "_" + Date.now() })
      });
      const collectData = await collectRes.json();
      if (collectData.reference) {
        let attempts = 0;
        const check = setInterval(async () => {
          attempts++;
          try {
            const checkRes = await fetch("/api/campay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check", reference: collectData.reference }) });
            const checkData = await checkRes.json();
            if (checkData.status === "SUCCESSFUL") { clearInterval(check); setQuizPage("quizResult"); setLoading(false); }
            else if (checkData.status === "FAILED" || attempts > 20) { clearInterval(check); setQuizPaymentStep(5); setLoading(false); }
          } catch(e) { clearInterval(check); setQuizPaymentStep(5); setLoading(false); }
        }, 3000);
      } else {
        setQuizPaymentStep(5);
        setLoading(false);
      }
    } catch (e) { setQuizPaymentStep(5); setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", background: G.bg }}>
      {/* Back button */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center" }}>
        <button onClick={() => setQuizPage("quizHome")} style={{ background: "none", border: "none", color: G.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Retour aux quiz</button>
      </div>
      {/* Blurred preview */}
      <div style={{ padding: "16px", filter: "blur(6px)", userSelect: "none", pointerEvents: "none", opacity: 0.5 }}>
        <div style={{ background: G.surface, borderRadius: 12, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28 }}>{quiz.emoji}</div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: quizResult?.color || G.gold, marginTop: 6 }}>{quizResult?.level || "Résultat prêt"}</div>
          <div style={{ fontSize: 13, color: G.textDim, marginTop: 6 }}>████████ ██████ ████ ███████</div>
          <div style={{ fontSize: 12, color: G.textDim, marginTop: 4 }}>██████ ████ ███████ ████ ██████</div>
          <div style={{ fontSize: 12, color: G.textDim, marginTop: 4 }}>████ ██████████ ███████ ████████</div>
        </div>
      </div>

      {/* Payment card */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", margin: "0", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)", zIndex: 10 }}>
        {quizPaymentStep === 1 && (
          <>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 26 }}>{quiz.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: "bold", color: "#1a1208", marginTop: 6 }}>Ton résultat est prêt…</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4, fontStyle: "italic" }}>Ce que nous avons trouvé est surprenant</div>
              {quizResult?.teaser && (
                <div style={{ background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#e65100", textAlign: "left" }}>
                  🔒 {quizResult.teaser}
                </div>
              )}
              <div style={{ background: "#fff8e1", padding: "10px 14px", borderRadius: 8, marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#7a5c00" }}>Prix</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a1a" }}>{price} FCFA</div>
              </div>
            </div>
            <button onClick={() => setQuizPaymentStep(2)} style={{
              width: "100%", padding: 14, background: "linear-gradient(135deg, #c9a84c, #e0be7a)", color: "#1a1208",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: "bold", cursor: "pointer", marginBottom: 10
            }}>
              💎 Continuer vers le paiement
            </button>
            <div style={{ textAlign: "center", fontSize: 11, color: "#999" }}>🔒 Paiement sécurisé via Campay</div>
          </>
        )}
        {quizPaymentStep === 2 && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>💳</div>
            <h3 style={{ color: "#1a1a1a", marginBottom: 8, fontSize: 16 }}>Choisis ta méthode</h3>
            <p style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>Avec quel opérateur veux-tu payer ?</p>
            <button onClick={() => { setQuizPaymentMethod("mtn"); setQuizPaymentStep(3); }} style={{
              width: "100%", padding: 16, marginBottom: 10, background: "#FFCC00", color: "#000",
              border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
            }}>📱 MTN Mobile Money</button>
            <button onClick={() => { setQuizPaymentMethod("orange"); setQuizPaymentStep(3); }} style={{
              width: "100%", padding: 16, marginBottom: 14, background: "#FF6600", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
            }}>📱 Orange Money</button>
            <button onClick={() => setQuizPaymentStep(1)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>← Retour</button>
          </div>
        )}
        {quizPaymentStep === 3 && (
          <div style={{ padding: "10px 0" }}>
            <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16, textAlign: "center" }}>Entre ton numéro</h3>
            <p style={{ color: "#888", fontSize: 12, marginBottom: 16, textAlign: "center" }}>{quizPaymentMethod === "mtn" ? "📱 MTN Mobile Money" : "📱 Orange Money"}</p>
            <input value={quizPhone} onChange={e => setQuizPhone(e.target.value.replace(/[^0-9]/g,""))}
              placeholder="Ex : 671234567"
              style={{ width: "100%", padding: "14px", background: "#f5f5f5", border: "2px solid #ddd", borderRadius: 10, color: "#1a1a1a", fontSize: 16, marginBottom: 10, textAlign: "center", boxSizing: "border-box" }} />
            <p style={{ color: "#aaa", fontSize: 11, marginBottom: 16, textAlign: "center" }}>Sans le 237, juste tes 9 chiffres</p>
            {error && <div style={{ color: "#f44336", fontSize: 12, marginBottom: 8, textAlign: "center" }}>{error}</div>}
            <button onClick={handlePay} disabled={loading || !quizPhone || quizPhone.length < 8}
              style={{ width: "100%", padding: 14, background: (quizPhone && quizPhone.length >= 8 && !loading) ? "#1a1a1a" : "#ccc", border: "none", borderRadius: 10, color: "#fff", fontWeight: "bold", cursor: (quizPhone && quizPhone.length >= 8 && !loading) ? "pointer" : "not-allowed", fontSize: 14, marginBottom: 10 }}>
              {loading ? "Traitement..." : "💎 Payer " + price + " FCFA"}
            </button>
            <button onClick={() => setQuizPaymentStep(2)} style={{ width: "100%", background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: 8 }}>← Retour</button>
          </div>
        )}
        {quizPaymentStep === 4 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <h3 style={{ color: "#1a1a1a", marginBottom: 12, fontSize: 16 }}>Paiement en cours...</h3>
            <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, textAlign: "left", marginBottom: 16 }}>
              <p style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: "bold" }}>
                ⚠️ Ne quittez pas cet écran, veuillez patienter jusqu'à la finalisation.
              </p>
            </div>
            <p style={{ color: "#666", fontSize: 12, lineHeight: 1.5 }}>
              Confirme la transaction sur ton téléphone {quizPaymentMethod === "mtn" ? "MTN" : "Orange"}.<br/>
              Cela peut prendre jusqu'à 30 secondes.
            </p>
          </div>
        )}
        {quizPaymentStep === 5 && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
              <h3 style={{ color: "#c62828", marginBottom: 8, fontSize: 17 }}>Paiement non finalisé</h3>
              <p style={{ color: "#888", fontSize: 13 }}>Le réseau de l'opérateur est peut-être occupé.</p>
            </div>
            <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, marginBottom: 18 }}>
              <p style={{ color: "#7a4a00", fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 0 }}>💡 Essaie ces solutions :</p>
              <p style={{ color: "#7a4a00", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                ✅ Vérifie ton solde Mobile Money<br/>
                ✅ Réessaie avec l'autre opérateur (MTN/Orange)<br/>
                ✅ Patiente quelques minutes et réessaie<br/>
                ✅ Vérifie ta connexion internet
              </p>
            </div>
            <button onClick={() => { setQuizPaymentStep(2); setQuizPaymentMethod(null); setQuizPhone(""); setLoading(false); setError(""); }} style={{
              width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
            }}>
              🔁 Réessayer
            </button>
            <button onClick={() => { setQuizPaymentStep(1); setQuizPaymentMethod(null); setQuizPhone(""); setLoading(false); setError(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizResult({ quiz, result, setQuizPage, G, setActiveQuiz, setQuizAnswers, setCurrentQuestion }) {
  const related = QUIZ_DATA.filter(q => q.id !== quiz.id && q.category === quiz.category).slice(0, 3);
  const others = QUIZ_DATA.filter(q => q.id !== quiz.id && q.category !== quiz.category).slice(0, 2);
  const [showFireworks, setShowFireworks] = useState(true);

  useEffect(() => {
    setShowFireworks(true);
    const t = setTimeout(() => setShowFireworks(false), 2000);
    return () => clearTimeout(t);
  }, [quiz.id]);

  if (showFireworks) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {/* Feux d'artifice */}
        {[
          { left: "20%", top: "30%", delay: "0s", color: "#ffd700" },
          { left: "70%", top: "25%", delay: "0.3s", color: "#ff4081" },
          { left: "45%", top: "55%", delay: "0.5s", color: "#00e5ff" },
          { left: "30%", top: "65%", delay: "0.7s", color: "#76ff03" },
          { left: "75%", top: "60%", delay: "0.9s", color: "#ff9100" },
          { left: "55%", top: "20%", delay: "1.1s", color: "#e040fb" },
        ].map((fw, i) => (
          <div key={i} style={{ position: "absolute", left: fw.left, top: fw.top, width: 10, height: 10 }}>
            {[0,1,2,3,4,5,6,7].map(angle => (
              <div key={angle} style={{
                position: "absolute",
                width: 6, height: 6,
                borderRadius: "50%",
                background: fw.color,
                boxShadow: `0 0 12px ${fw.color}`,
                animation: `fwExplode 1.4s ${fw.delay} ease-out forwards`,
                transform: `rotate(${angle * 45}deg)`,
                transformOrigin: "center"
              }} />
            ))}
          </div>
        ))}
        <div style={{ textAlign: "center", color: "#fff", zIndex: 10 }}>
          <div style={{ fontSize: 80, marginBottom: 14, animation: "rocketBounce 0.8s ease-out" }}>🎆</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: G.gold, animation: "fadeIn 0.5s ease-out" }}>Ton résultat est prêt !</div>
        </div>
        <style>{`
          @keyframes fwExplode {
            0% { transform: translate(0, 0) scale(0.5); opacity: 1; }
            100% { transform: translate(var(--tx, 60px), var(--ty, 0)) scale(0.2); opacity: 0; }
          }
          @keyframes rocketBounce {
            0% { transform: scale(0) rotate(-30deg); }
            60% { transform: scale(1.3) rotate(10deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  function startQuiz(q) {
    setActiveQuiz(q);
    setQuizAnswers([]);
    setCurrentQuestion(0);
    setQuizPage("quizPlay");
  }

  function shareResult() {
    const text = `J'ai fait le quiz "${quiz.title}" sur Carry'Quiz 🎯\n\n${result.level}\n\nFais le test toi aussi 👉 https://www.carrybooks.com`;
    if (navigator.share) {
      navigator.share({ title: "Carry'Quiz — " + quiz.title, text, url: "https://www.carrybooks.com" });
    } else {
      navigator.clipboard.writeText(text).then(() => alert("Copié ! Partage sur WhatsApp 📲"));
    }
  }

  function shareWithPartner() {
    const text = `Fais ce quiz avec moi 👉 "${quiz.title}" sur Carry'Quiz\n\nhttps://www.carrybooks.com`;
    if (navigator.share) navigator.share({ title: quiz.title, text, url: "https://www.carrybooks.com" });
    else navigator.clipboard.writeText(text).then(() => alert("Lien copié ! Envoie à ton/ta partenaire 💌"));
  }

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Back button */}
      <div style={{ padding: "10px 14px", background: G.surface, borderBottom: "1px solid " + G.border }}>
        <button onClick={() => setQuizPage("quizHome")} style={{ background: "none", border: "none", color: G.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Autres quiz</button>
      </div>
      {/* Result header */}
      <div style={{ background: "linear-gradient(135deg, #1a1208, #3d2b0a)", padding: "28px 16px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>{quiz.emoji}</div>
        <div style={{ fontSize: 11, color: G.gold, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Ton résultat</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>{result.level}</div>
        <div style={{ fontSize: 14, color: "#ccc", marginTop: 6 }}>{result.preview}</div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Main result card */}
        <div style={{ background: G.surface, border: "2px solid " + result.color, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: result.color }} />
            <div style={{ fontSize: 15, fontWeight: "bold", color: result.color }}>Analyse complète</div>
          </div>
          <div style={{ fontSize: 14, color: G.text, lineHeight: 1.8 }}>{result.teaser}</div>
        </div>

        {/* Advice card */}
        {result.advice && (
          <div style={{ background: G.goldDim, border: "1px solid " + G.gold, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: G.gold, fontWeight: "bold", marginBottom: 6 }}>💡 CONSEIL PERSONNALISÉ</div>
            <div style={{ fontSize: 14, color: G.text, lineHeight: 1.7 }}>{result.advice}</div>
          </div>
        )}

        {/* Share buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={shareResult} style={{ flex: 1, padding: "13px", background: "#25D366", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>
            📲 Partager mon résultat
          </button>
          <button onClick={shareWithPartner} style={{ flex: 1, padding: "13px", background: "transparent", border: "2px solid " + G.gold, borderRadius: 12, color: G.gold, fontSize: 12, fontWeight: "bold", cursor: "pointer" }}>
            👯 Partager avec un(e) ami(e)
          </button>
        </div>

        {/* Related quizzes */}
        {related.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: G.text, marginBottom: 10 }}>🎯 Dans la même catégorie</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {related.map(q => (
                <div key={q.id} onClick={() => startQuiz(q)} style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{q.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: G.text }}>{q.title}</div>
                    <div style={{ fontSize: 11, color: G.gold, marginTop: 2 }}>Commencer ▶</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other quizzes */}
        {others.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: G.text, marginBottom: 10 }}>🔥 Tu pourrais aussi aimer</div>
            <div style={{ display: "flex", gap: 10 }}>
              {others.map(q => (
                <div key={q.id} onClick={() => startQuiz(q)} style={{ flex: 1, background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 26 }}>{q.emoji}</div>
                  <div style={{ fontSize: 11, color: G.text, marginTop: 4, lineHeight: 1.3 }}>{q.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setQuizPage("quizHome")} style={{ width: "100%", padding: "14px", background: G.gold, border: "none", borderRadius: 12, color: "#1a1208", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>
          🎯 Faire un autre Carry'Quiz
        </button>
      </div>
    </div>
  );
}

// ─── LIBRARY PAGE COMPONENT ───
function LibraryPage({ books, purchasedBooks, purchaseHistory, startReading, setPage, G }) {
  const [libTab, setLibTab] = useState("books"); // "books" | "history"
  const myBooks = books.filter(b => purchasedBooks.includes(b.id));

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px 0", background: G.surface, borderBottom: "1px solid " + G.border }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "none", color: G.gold, cursor: "pointer", fontSize: 14, padding: 0, marginRight: 12 }}>← Retour</button>
          <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase" }}>Ma bibliothèque</div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {[["books", "📚 Mes livres (" + myBooks.length + ")"], ["history", "🧾 Historique"]].map(([id, label]) => (
            <button key={id} onClick={() => setLibTab(id)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: "2px solid " + (libTab === id ? G.gold : "transparent"),
              color: libTab === id ? G.gold : G.textDim, fontSize: 13, cursor: "pointer", fontWeight: libTab === id ? "bold" : "normal"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Books tab */}
      {libTab === "books" && (
        <div style={{ padding: "16px 16px 0" }}>
          {myBooks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 16px", border: "1px dashed " + G.border, borderRadius: 8, marginTop: 8 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
              <div style={{ color: G.textDim, marginBottom: 4, fontWeight: "bold", fontSize: 14 }}>Votre bibliothèque est vide</div>
              <div style={{ color: G.textFaint, fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>Tous vos livres achetés apparaîtront ici. Achetez un livre et retrouvez-le à tout moment, même hors connexion !</div>
              <button onClick={() => setPage("home")} style={{ padding: "10px 20px", background: "none", border: "1px solid " + G.gold, borderRadius: 4, color: G.gold, fontSize: 12, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase", marginTop: 12 }}>Parcourir</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {myBooks.map(book => {
                const prog = parseInt(localStorage.getItem("readingProgress_" + book.id) || "0");
                return (
                  <div key={book.id} style={{ cursor: "pointer" }} onClick={() => startReading(book)}>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 0, overflow: "hidden", marginBottom: 8 }}>
                      {book.cover && <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.8))", padding: "12px 8px 8px", textAlign: "center" }}>
                        <span style={{ fontSize: 9, color: G.green, letterSpacing: 1 }}>✓ ACHETÉ</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: G.text, marginBottom: 2, lineHeight: 1.3 }}>{book.title}</div>
                    <div style={{ fontSize: 10, color: G.textDim, marginBottom: 6 }}>{book.author}</div>
                    {(() => {
                      const pdfProg = parseInt(localStorage.getItem("pdfProgress_" + book.id) || "0");
                      const showProg = book.pdf_url ? pdfProg > 1 : prog > 0;
                      const label = book.pdf_url ? (pdfProg > 1 ? "P." + pdfProg : "") : (prog > 0 ? "P." + prog : "");
                      return showProg ? (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: G.textFaint, marginBottom: 2 }}>
                            <span>Progression</span><span>{label}</span>
                          </div>
                          <div style={{ height: 3, background: G.border, borderRadius: 2 }}>
                            <div style={{ height: "100%", width: "60%", background: G.gold, borderRadius: 2 }} />
                          </div>
                        </div>
                      ) : null;
                    })()}
                    <button onClick={(e) => { e.stopPropagation(); startReading(book); }} style={{ width: "100%", padding: 8, background: G.goldDim, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 4, color: G.gold, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>
                      {(book.pdf_url ? parseInt(localStorage.getItem("pdfProgress_" + book.id) || "0") > 1 : prog > 0) ? "▶ CONTINUER" : "📖 LIRE"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {libTab === "history" && (
        <div style={{ padding: "16px 16px 0" }}>
          {purchaseHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 16px", border: "1px dashed " + G.border, borderRadius: 8 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ color: G.textDim }}>Aucun achat enregistré</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Total */}
              <div style={{ background: G.goldDim, border: "1px solid " + G.gold, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: G.textDim }}>Total dépensé</div>
                  <div style={{ fontSize: 20, fontWeight: "bold", color: G.gold }}>
                    {purchaseHistory.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} FCFA
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: G.textDim }}>Livres achetés</div>
                  <div style={{ fontSize: 20, fontWeight: "bold", color: G.gold }}>{purchaseHistory.length}</div>
                </div>
              </div>

              {/* Purchase list */}
              {purchaseHistory.map((purchase, i) => {
                const book = books.find(b => b.id === purchase.book_id);
                if (!book) return null;
                const date = purchase.created_at ? new Date(purchase.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
                return (
                  <div key={i} style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                    {book.cover && <img src={book.cover} alt={book.title} style={{ width: 44, height: 60, objectFit: "contain", borderRadius: 4, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: G.text, lineHeight: 1.3, marginBottom: 3 }}>{book.title}</div>
                      <div style={{ fontSize: 11, color: G.textDim, marginBottom: 4 }}>{book.author}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: G.textFaint }}>📅 {date}</span>
                        <span style={{ fontSize: 12, fontWeight: "bold", color: G.gold }}>{purchase.amount ? purchase.amount.toLocaleString() + " F" : "—"}</span>
                      </div>
                    </div>
                    <button onClick={() => startReading(book)} style={{ padding: "6px 12px", background: G.goldDim, border: "1px solid " + G.gold, borderRadius: 6, color: G.gold, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
                      📖
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── PDF READER WITH LOADING SCREEN ───
function PdfReader({ reading, excerptMode, startPage, activePdfUrl, onBack }) {
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [dots, setDots] = useState(".");
  const [elapsed, setElapsed] = useState(0);
  const [key, setKey] = useState(0);
  const [pageInput, setPageInput] = useState(String(startPage));
  const [pageSaved, setPageSaved] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pdfLoaded) return;
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [pdfLoaded, key]);

  function savePage() {
    const p = parseInt(pageInput);
    if (p > 0) {
      localStorage.setItem("pdfProgress_" + reading.id, String(p));
      setPageSaved(true);
      setTimeout(() => setPageSaved(false), 2000);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #333", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14 }}>← Retour</button>
        <span style={{ color: "#ccc", fontSize: 13, fontStyle: "italic", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {reading.title}{excerptMode ? " — Extrait" : ""}
        </span>
        <span style={{ opacity: 0, width: 48 }}>x</span>
      </div>

      {/* Loading overlay */}
      {!pdfLoaded && (
        <div style={{ position: "absolute", top: 56, left: 0, right: 0, bottom: 0, background: "#1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>📖</div>
          <div style={{ color: "#c9a84c", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>Chargement du livre{dots}</div>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 28 }}>Merci de patienter</div>
          <div style={{ width: 200, height: 4, background: "#333", borderRadius: 2, overflow: "hidden", marginBottom: 32 }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #c9a84c, #e0be7a)", borderRadius: 2, animation: "pdfLoad 1.5s ease-in-out infinite" }} />
          </div>
          {elapsed > 8 && (
            <button onClick={() => { setKey(k => k + 1); setElapsed(0); }} style={{ padding: "10px 24px", background: "#c9a84c", border: "none", borderRadius: 8, color: "#1a1208", fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>
              🔄 Actualiser
            </button>
          )}
          <style>{`@keyframes pdfLoad { 0%{width:0%;margin-left:0} 50%{width:70%;margin-left:0} 100%{width:0%;margin-left:100%} }`}</style>
        </div>
      )}

      {/* Save progress banner — shows after load */}
      {pdfLoaded && !excerptMode && (
        <div style={{ background: "#1e1e10", borderBottom: "1px solid #c9a84c33", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#aaa", flexShrink: 0 }}>📌 Sauvegarder ma page :</span>
          <input
            type="number" min="1" value={pageInput}
            onChange={e => { setPageInput(e.target.value); setPageSaved(false); }}
            style={{ width: 52, background: "#2a2a1a", border: "1px solid #c9a84c55", color: "#c9a84c", borderRadius: 6, padding: "4px 8px", fontSize: 13, fontWeight: "bold", textAlign: "center" }}
          />
          <button onClick={savePage} style={{ padding: "4px 12px", background: pageSaved ? "#2a4a2a" : "#c9a84c", border: "none", borderRadius: 6, color: pageSaved ? "#4caf50" : "#1a1208", fontWeight: "bold", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
            {pageSaved ? "✅ Sauvegardé !" : "OK"}
          </button>
          {startPage > 1 && (
            <span style={{ fontSize: 10, color: "#666", marginLeft: "auto", flexShrink: 0 }}>Dernière: p.{startPage}</span>
          )}
        </div>
      )}

      {/* PDF iframe */}
      <div onContextMenu={e => e.preventDefault()} style={{ flex: 1, userSelect: "none", WebkitUserSelect: "none" }}>
        <iframe
          key={key}
          src={"https://docs.google.com/viewer?url=" + encodeURIComponent(activePdfUrl) + "&embedded=true"}
          style={{ width: "100%", height: pdfLoaded ? "calc(100vh - 96px)" : "calc(100vh - 56px)", border: "none", opacity: pdfLoaded ? 1 : 0 }}
          title={reading.title}
          onLoad={() => { setPdfLoaded(true); setElapsed(0); }}
        />
      </div>

      {excerptMode && (
        <div style={{ background: "#111", padding: "12px 16px", textAlign: "center" }}>
          <span style={{ color: "#aaa", fontSize: 12 }}>Extrait limité — Achetez pour lire la suite</span>
        </div>
      )}
    </div>
  );
}


// ============================================================
// ─── CARRYCARE — BEAUTÉ & SANTÉ ─────────────────────────────
// ============================================================

// Palette CarryCare (rose poudré + blanc + noir)
const CC = {
  rose: "#e8b4b8",
  roseDeep: "#c08a8e",
  roseLight: "#f5d7d9",
  blanc: "#fdf8f8",
  blancCasse: "#f5ecec",
  noir: "#1a1a1a",
  noirSoft: "#2d2d2d",
  text: "#1a1a1a",
  textFaint: "#6b5050",
  border: "#e8d4d6",
  gold: "#c9a66b"
};

// ─── PAGE D'ACCUEIL CARRYCARE ───
function CarryCareHome({ setPage, setCarryCarePage, setBfStep, setBfTypeAnswers, setBfProblems, setBfLifestyle, setBfResult }) {

  function startFacial() {
    setBfStep(1);
    setBfTypeAnswers([]);
    setBfProblems([]);
    setBfLifestyle({ age: null, sun: null, spf: null, makeup: null, water: null, sleep: null });
    setBfResult(null);
    setCarryCarePage("facialQuiz");
  }

  const quizCards = [
    { id: "facial", emoji: "💄", title: "Beauté Faciale", subtitle: "Diagnostic peau + routine personnalisée", available: true, action: startFacial, gradient: "linear-gradient(135deg, #f5d7d9 0%, #e8b4b8 100%)" },
    { id: "body", emoji: "🧴", title: "Beauté Corporelle", subtitle: "Vergetures, taches, hydratation", available: false, gradient: "linear-gradient(135deg, #f5ecec 0%, #d4b896 100%)" },
    { id: "hair", emoji: "💇🏾‍♀️", title: "Beauté Capillaire", subtitle: "Cheveux crépus, croissance, routines", available: false, gradient: "linear-gradient(135deg, #e8d4b8 0%, #c9a66b 100%)" },
    { id: "weight", emoji: "⚖️", title: "Garde la Ligne", subtitle: "Plan nutrition personnalisé", available: false, gradient: "linear-gradient(135deg, #d4e8d6 0%, #8eb896 100%)" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: CC.blanc, padding: "0 0 80px" }}>
      {/* Hero CarryCare */}
      <div style={{ background: "linear-gradient(135deg, #fdf8f8 0%, #f5d7d9 100%)", padding: "32px 16px 36px", textAlign: "center", position: "relative", borderBottom: "1px solid " + CC.border }}>
        <button onClick={() => setPage("quiz")} style={{ position: "absolute", left: 14, top: 14, background: CC.noir, border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>← Retour</button>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🌸</div>
        <div style={{ fontSize: 32, fontWeight: "bold", color: CC.noir, fontFamily: "Georgia, serif", marginBottom: 6, letterSpacing: 1 }}>CarryCare</div>
        <div style={{ fontSize: 14, color: CC.textFaint, fontStyle: "italic", marginBottom: 4 }}>Ton diagnostic personnalisé</div>
        <div style={{ fontSize: 13, color: CC.textFaint }}>Beauté & Santé</div>
      </div>

      {/* Cartes Quiz */}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {quizCards.map(card => (
          <div key={card.id} onClick={() => card.available && card.action && card.action()} style={{
            background: card.gradient, borderRadius: 18, padding: "20px 18px", cursor: card.available ? "pointer" : "default",
            position: "relative", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            opacity: card.available ? 1 : 0.7, transition: "transform 0.2s"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 44 }}>{card.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: "bold", color: CC.noir, marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: CC.noirSoft }}>{card.subtitle}</div>
              </div>
              {card.available ? (
                <div style={{ background: CC.noir, color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: "bold" }}>Tester</div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.6)", color: CC.noir, borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: "bold" }}>Bientôt</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 20px", textAlign: "center", marginTop: 10 }}>
        <div style={{ fontSize: 11, color: CC.textFaint, fontStyle: "italic" }}>
          ✨ Diagnostic personnalisé propulsé par CarryCare
        </div>
      </div>
    </div>
  );
}


// ─── QUIZ BEAUTÉ FACIALE ───
const BF_TYPE_QUESTIONS = [
  { q: "Le matin au réveil, ta peau est :", options: [
    { label: "Brillante surtout sur le front et le nez", v: "A" },
    { label: "Tendue, inconfortable, ça tire", v: "B" },
    { label: "Confortable, ni grasse ni sèche", v: "C" },
    { label: "Brillante au centre, sèche sur les joues", v: "D" },
    { label: "Rouge, irritée ou sensible au toucher", v: "E" },
  ]},
  { q: "2-3 heures après ta crème hydratante :", options: [
    { label: "Ma peau brille beaucoup", v: "A" },
    { label: "Ma peau tire encore", v: "B" },
    { label: "Ma peau reste confortable", v: "C" },
    { label: "Ça brille au centre, sec ailleurs", v: "D" },
    { label: "Ma peau réagit (rougeurs, picotements)", v: "E" },
  ]},
  { q: "Tes pores sont :", options: [
    { label: "Visibles partout", v: "A" },
    { label: "Très fins, presque invisibles", v: "B" },
    { label: "Normaux, peu visibles", v: "C" },
    { label: "Visibles au centre du visage", v: "D" },
    { label: "Variables selon les zones", v: "E" },
  ]},
  { q: "As-tu des points noirs ?", options: [
    { label: "Beaucoup, surtout nez et front", v: "A" },
    { label: "Très peu ou aucun", v: "B" },
    { label: "Quelques-uns occasionnellement", v: "C" },
    { label: "Sur la zone T uniquement", v: "D" },
    { label: "Rarement", v: "E" },
  ]},
  { q: "Le maquillage tient sur ta peau :", options: [
    { label: "Mal, il fond rapidement", v: "A" },
    { label: "Il craque sur les zones sèches", v: "B" },
    { label: "Très bien toute la journée", v: "C" },
    { label: "Bien sur joues, mal au centre", v: "D" },
    { label: "Ma peau réagit au maquillage", v: "E" },
    { label: "🚫 Je ne me maquille pas", v: "skip" },
  ]},
  { q: "Quand tu transpires :", options: [
    { label: "Ma peau devient huileuse rapidement", v: "A" },
    { label: "Je transpire peu, ma peau reste sèche", v: "B" },
    { label: "Normal", v: "C" },
    { label: "Le centre devient gras", v: "D" },
    { label: "Ma peau rougit ou s'irrite", v: "E" },
  ]},
  { q: "Tu as souvent des boutons ou imperfections ?", options: [
    { label: "Oui, régulièrement, surtout zone T", v: "A" },
    { label: "Très rarement", v: "B" },
    { label: "Parfois (avant les règles ou en cas de stress)", v: "C" },
    { label: "Sur menton et front uniquement", v: "D" },
    { label: "Rarement, mais peau sensible", v: "E" },
  ]},
  { q: "Comment réagit ta peau à un nouveau produit ?", options: [
    { label: "Plutôt bien", v: "A" },
    { label: "Elle a besoin de produits riches", v: "B" },
    { label: "Aucune réaction particulière", v: "C" },
    { label: "Réactions différentes selon zones", v: "D" },
    { label: "Souvent rougeurs, picotements", v: "E" },
  ]},
];

const BF_PROBLEMS = [
  { id: "acne", emoji: "🔴", label: "Acné active" },
  { id: "taches", emoji: "🟤", label: "Taches noires / hyperpigmentation" },
  { id: "cicatrices", emoji: "⚪", label: "Cicatrices d'acné anciennes" },
  { id: "pores", emoji: "⚫", label: "Points noirs / pores dilatés" },
  { id: "cernes", emoji: "👁️", label: "Cernes ou poches" },
  { id: "terne", emoji: "😐", label: "Peau terne, manque d'éclat" },
  { id: "rides", emoji: "⏳", label: "Premières rides ou relâchement" },
  { id: "rougeurs", emoji: "🌹", label: "Rougeurs ou peau qui réagit" },
  { id: "secheresse", emoji: "💧", label: "Sécheresse, tiraillements" },
];

// ─── BASE DE CONTENU BEAUTÉ FACIALE ───
const BF_CONTENT = {
  routines: {
    grasse: {
      intro: "Ma belle, ta peau brille parce qu'elle produit beaucoup de sébum. C'est en fait une bonne nouvelle — ta peau vieillira moins vite ! Mais il faut bien la gérer pour éviter brillance et boutons.",
      naturel: {
        matin: ["Nettoie ton visage à l'eau tiède + savon noir africain (très doux et purifiant)", "Tonifie avec de l'eau de rose maison (ou de l'hamamélis)", "Hydrate avec du gel d'aloe vera pur (à conserver au frigo)", "Protection solaire (essentielle, même peau grasse !)"],
        soir: ["Démaquille à l'huile de jojoba (oui, le gras dissout le gras !)", "Nettoie au savon noir", "Eau de rose", "Gel d'aloe vera"],
        bonus: "2x/semaine : Masque à l'argile verte (15 min) + gommage doux sucre + miel + jus de citron",
        delai: "Ta peau s'équilibre en 4-8 semaines"
      },
      express: {
        matin: ["Gel nettoyant doux (sans sulfates)", "Tonique à la niacinamide", "Sérum Niacinamide 10% → régule le sébum", "Crème hydratante légère non comédogène", "SPF 50 matifiant"],
        soir: ["Démaquillant huile + gel nettoyant (double nettoyage)", "Tonique", "Sérum Acide Salicylique (BHA) → désincruste les pores", "Crème de nuit fluide"],
        bonus: "2x/semaine : Masque à l'argile professionnel",
        delai: "Visible en 2-4 semaines"
      },
      eviter: ["Eau brûlante (active le sébum)", "Trop laver ton visage (4-5x par jour) — effet rebond pire", "Crèmes très riches type beurre de karité pur", "Toucher tes boutons"]
    },
    seche: {
      intro: "Ma belle, ta peau manque d'eau et de gras. Elle a besoin d'amour et d'hydratation profonde. Bonne nouvelle : avec les bons soins, elle deviendra douce, lumineuse et confortable.",
      naturel: {
        matin: ["Rince ton visage à l'eau tiède (jamais chaude !) — pas de savon le matin", "Tonifie avec de l'eau florale (rose, fleur d'oranger)", "Sérum maison : 2 gouttes d'huile de jojoba + 3 gouttes d'eau de rose", "Crème hydratante riche au beurre de karité", "Protection solaire"],
        soir: ["Démaquille à l'huile de coco ou d'amande douce", "Lait nettoyant doux (pas de gel mousseux)", "Sérum hydratant maison (miel + eau de rose)", "Crème de nuit riche", "Huile pure (argan ou rose musquée) en finition"],
        bonus: "2x/semaine : Masque au miel pur (15 min) + masque avocat + miel + huile d'olive",
        delai: "Peau plus confortable en 2-3 semaines"
      },
      express: {
        matin: ["Lait nettoyant doux ou eau micellaire", "Brume hydratante", "Sérum Acide Hyaluronique → hydrate en profondeur", "Crème nourrissante riche", "SPF 50 crème (pas en gel)"],
        soir: ["Huile démaquillante + lait nettoyant", "Sérum Céramides → reconstruit la barrière cutanée", "Crème de nuit nourrissante", "Huile végétale en finition (jojoba, argan)"],
        bonus: "2x/semaine : Masque hydratant intensif",
        delai: "Peau transformée en 3-6 semaines"
      },
      eviter: ["Eau chaude (assèche +++)", "Savons agressifs et nettoyants moussants", "Exfoliation trop fréquente", "Climatiseur sec sans humidificateur", "Boire moins de 2L d'eau par jour"]
    },
    normale: {
      intro: "Ma belle, tu as la chance d'avoir une peau équilibrée ! Ta mission n'est pas de la corriger, mais de la préserver dans le temps. Avec une routine simple et régulière, tu vas la garder belle longtemps.",
      naturel: {
        matin: ["Eau tiède + savon doux (savon d'Alep ou savon noir doux)", "Tonique à l'eau de rose", "Crème hydratante légère (gel d'aloe vera ou crème naturelle)", "Protection solaire"],
        soir: ["Démaquille à l'huile de jojoba", "Savon doux", "Eau de rose", "Sérum maison : aloe + 1 goutte d'huile de rose musquée"],
        bonus: "1-2x/semaine : Gommage doux (sucre + miel) + masque hydratant au miel",
        delai: "Éclat préservé toute l'année"
      },
      express: {
        matin: ["Nettoyant doux", "Tonique apaisant", "Sérum Vitamine C → éclat et anti-âge préventif", "Hydratant léger", "SPF 30-50"],
        soir: ["Démaquillant + nettoyant", "Sérum Hyaluronique + Niacinamide (combo équilibre)", "Crème de nuit hydratante"],
        bonus: "1-2x/semaine : Exfoliant doux (AHA léger)",
        delai: "Peau lumineuse, prévention anti-âge"
      },
      eviter: ["Trop de produits actifs (rétinol, acides forts) — tu n'en as pas besoin", "Changer constamment de routine — la régularité fait tout", "Négliger le SPF en pensant 'j'ai pas besoin'"]
    },
    mixte: {
      intro: "Ma belle, ta peau est un mélange : grasse au centre (zone T : front, nez, menton) et normale/sèche sur les joues. Le secret ? Traiter chaque zone différemment. C'est plus de travail mais ça vaut le coup.",
      naturel: {
        matin: ["Eau tiède + savon noir (sur tout le visage)", "Tonique : eau de rose sur les joues, hamamélis sur la zone T", "Hydratation différenciée : aloe léger zone T, aloe + 1 goutte de jojoba sur joues", "Protection solaire matifiante"],
        soir: ["Huile de jojoba pour démaquiller (équilibre)", "Savon noir", "Tonique", "Hydratation : aloe sur zone T, crème naturelle légère sur les joues"],
        bonus: "2x/semaine : Masque argile UNIQUEMENT sur la zone T + masque hydratant miel sur tout le visage",
        delai: "Équilibre retrouvé en 4-6 semaines"
      },
      express: {
        matin: ["Gel nettoyant doux", "Tonique à la niacinamide (régule la zone T sans assécher)", "Sérum Niacinamide sur tout le visage", "Hydratant : léger sur zone T, plus riche sur joues", "SPF léger"],
        soir: ["Démaquillant + nettoyant", "Sérum Hyaluronique sur joues", "Sérum BHA léger sur zone T uniquement", "Crème de nuit légère"],
        bonus: "2x/semaine : Masque argile zone T + masque hydratant joues",
        delai: "Zones équilibrées en 3-5 semaines"
      },
      eviter: ["Traiter le visage entier comme s'il était gras (assèche les joues)", "Ou comme s'il était sec (gras zone T)", "Crèmes très riches partout"]
    },
    sensible: {
      intro: "Ma belle, ta peau réagit vite — rougeurs, picotements, irritations. C'est qu'elle a une barrière cutanée fragile. Le secret ? Moins de produits, plus de douceur. On évite tout ce qui agresse, on chouchoute la barrière.",
      naturel: {
        matin: ["Eau tiède UNIQUEMENT (pas de savon le matin)", "Hydrolat de camomille ou bleuet (apaisants)", "Gel d'aloe vera pur (fraîcheur)", "Crème hydratante simple, sans parfum", "Protection solaire minérale (SPF physique, pas chimique)"],
        soir: ["Démaquille à l'huile de jojoba ou amande douce", "Lait nettoyant doux SANS parfum", "Hydrolat apaisant", "Crème de nuit pour peaux sensibles", "1 goutte d'huile de calendula sur les zones très réactives"],
        bonus: "1x/semaine maximum : Masque ultra-doux miel pur + 1 goutte de yaourt nature",
        delai: "Moins de réactions en 2-4 semaines"
      },
      express: {
        matin: ["Gel nettoyant doux pour peaux sensibles", "Eau thermale (Avène, La Roche-Posay)", "Sérum Centella Asiatica (Cica) → apaise et répare", "Crème barrière à la Centella ou panthénol", "SPF 50 minéral"],
        soir: ["Eau micellaire pour peaux sensibles", "Sérum Niacinamide (apaisant)", "Crème réparatrice riche"],
        bonus: "PAS de gommage abrasif. Brume thermale plusieurs fois par jour si rougeurs",
        delai: "Peau apaisée en 3-5 semaines"
      },
      eviter: ["Tout produit parfumé", "Alcool dans les cosmétiques", "Eau chaude", "Frottements (sèche-toi en tapotant)", "Changements brusques de température", "Trop de produits superposés", "Acides forts, rétinol, gommages mécaniques"]
    }
  },

  problems: {
    acne: {
      titre: "🔴 Acné active",
      naturel: ["Tea tree pur (1 goutte sur chaque bouton, le soir uniquement)", "Masque argile verte + 1 goutte de tea tree, 2x/semaine", "Eau de rose au frigo plusieurs fois par jour", "Boire 2L d'eau + thé vert"],
      express: ["Sérum Acide Salicylique 2% → désincruste les pores (le soir)", "Sérum Niacinamide 10% → régule le sébum", "Spot treatment au tea tree pour boutons isolés"],
      conseils: "Lave tes pinceaux/téléphone/oreiller régulièrement. Change de taie d'oreiller 2-3x/semaine. Diminue le sucre, lait, et aliments très transformés. Ne JAMAIS percer tes boutons. Si acné sévère ou cicatrices : consulte un dermatologue."
    },
    taches: {
      titre: "🟤 Taches noires / hyperpigmentation",
      naturel: ["Jus de citron + miel + curcuma : 10 min sur les taches le SOIR uniquement (jamais le jour, photosensibilisant)", "Aloe vera pur matin et soir", "Huile de rose musquée : 2 gouttes le soir sur les taches"],
      express: ["Sérum Vitamine C 15% → éclaircit et unifie (matin)", "Sérum Acide Kojique → cible précisément les taches (soir uniquement, ciblé)", "Crème Niacinamide → atténue progressivement"],
      conseils: "⚠️ Sans SPF, ces produits sont INUTILES voire pires ! Le soleil aggrave les taches. Patience : compter 2-4 mois pour voir des résultats. Pas de gommage agressif sur les taches, pas d'épilation à la cire."
    },
    cicatrices: {
      titre: "⚪ Cicatrices d'acné anciennes",
      naturel: ["Huile de rose musquée pure : 2 gouttes matin et soir, en massage circulaire", "Miel pur en masque 15 min, 3x/semaine", "Vitamine E (perles à percer) en application ciblée"],
      express: ["Sérum Niacinamide → atténue les marques rouges/brunes", "Crème à la rose musquée concentrée", "Sérum AHA léger → renouvelle les cellules"],
      conseils: "Patience extrême : les cicatrices d'acné mettent 3-6 mois à s'estomper. Massage circulaire quotidien stimule la régénération. Cicatrices très creuses → consulte un dermato pour soins ciblés."
    },
    pores: {
      titre: "⚫ Points noirs / Pores dilatés",
      naturel: ["Bain de vapeur facial (eau bouillante + serviette sur la tête) 5 min, 1x/semaine", "Masque bicarbonate + miel sur la zone T uniquement, 1x/semaine", "Argile verte sur les zones avec points noirs"],
      express: ["Sérum BHA (Acide Salicylique) → entre dans les pores et nettoie", "Sérum Niacinamide → resserre visuellement les pores", "Patchs nez (utilisation occasionnelle)"],
      conseils: "Ne pas extraire à la main (cicatrices, infection). Pas de scrub agressif (irrite et augmente le sébum). Double nettoyage le soir (huile + nettoyant aqueux). Exfoliation chimique BHA > exfoliation mécanique."
    },
    cernes: {
      titre: "👁️ Cernes / Poches",
      naturel: ["Tranches de concombre ou sachets de thé vert froids, 10 min le matin", "Cuillères au congélateur appliquées sous les yeux", "Huile d'amande douce en massage léger le soir"],
      express: ["Crème contour des yeux à la caféine (matin) → décongestionne", "Crème contour à la vitamine K (soir) → atténue les vaisseaux", "Sérum peptides → fermeté et réparation"],
      conseils: "Sommeil 7-8h est ton meilleur allié. Hydratation 2L d'eau/jour. Réduire le sel (cause des poches). Limiter les écrans tard le soir. Application en TAPOTANT avec l'annulaire (jamais frotter)."
    },
    terne: {
      titre: "😐 Peau terne",
      naturel: ["Masque éclat : 1 cuillère de miel + 1 cuillère de yaourt + 1/2 cuillère de jus de citron, 15 min, 2x/semaine", "Gommage sucre + miel + huile d'olive, 1x/semaine", "Eau citronnée au réveil (à jeun)"],
      express: ["Sérum Vitamine C → relance immédiatement l'éclat", "Exfoliant chimique AHA (acide glycolique) → renouvelle les cellules", "Brume vitaminée pour boost éclat instantané"],
      conseils: "Vitamines = éclat : mange plus de fruits (mangue, papaye, agrumes), légumes verts. 2L d'eau non négociable. Sommeil de qualité. Limite tabac et alcool. Toujours protéger du soleil."
    },
    rides: {
      titre: "⏳ Premières rides / Relâchement",
      naturel: ["Huile de rose musquée pure matin et soir → riche en vitamine A naturelle", "Massage facial : 5 minutes le soir, mouvements ascendants → stimule collagène", "Masque blanc d'œuf (1x/semaine) → effet tenseur naturel"],
      express: ["Sérum Acide Hyaluronique → repulpe et hydrate (matin et soir)", "Sérum Rétinol 0,3% → stimule collagène (soir uniquement, 2-3x/semaine pour commencer)", "Sérum Peptides → fermeté", "Crème anti-âge complète"],
      conseils: "SPF tous les jours = ton anti-rides numéro 1. Hydratation interne et externe. Antioxydants : myrtilles, baies, légumes colorés, thé vert. Sommeil profond. ⚠️ Rétinol incompatible avec grossesse et allaitement."
    },
    rougeurs: {
      titre: "🌹 Rougeurs / Sensibilité",
      naturel: ["Hydrolat de bleuet ou camomille plusieurs fois par jour", "Masque yaourt nature + miel (15 min) → ultra-apaisant", "Gel d'aloe vera au frigo (effet froid décongestionnant)", "Huile de calendula en application ciblée"],
      express: ["Sérum Centella Asiatica (Cica) → apaise et répare", "Crème à la panthénol (vitamine B5) → calmante", "Eau thermale (Avène, La Roche-Posay)", "Crème spéciale peau sensible"],
      conseils: "Tout ce qui contient parfum, alcool, agrumes → à bannir. Pas de gommage mécanique. Eau chaude à éviter. Sèche-toi en TAPOTANT. SPF minéral (pas chimique). Si rougeurs persistantes ou rosacée → dermato."
    },
    secheresse: {
      titre: "💧 Sécheresse / Tiraillements",
      naturel: ["Huile végétale pure (jojoba, argan, rose musquée) en finition matin et soir", "Masque avocat + miel + huile d'olive, 2x/semaine", "Brume d'eau de rose plusieurs fois par jour"],
      express: ["Sérum Acide Hyaluronique → ultra-hydratant", "Crème aux Céramides → reconstruit la barrière cutanée", "Baume nuit nourrissant → en cure de 2 semaines"],
      conseils: "2,5L d'eau par jour minimum. Bonnes graisses : avocat, noix, poisson gras. Humidificateur dans la chambre si climatiseur ou harmattan. Douches tièdes et courtes. Astuce : applique tes soins sur peau légèrement humide → meilleure pénétration."
    }
  },

  soleil: {
    low: { titre: "☀️ Exposition faible (-1h/jour)", text: "Pour toi, le soleil n'est pas ton ennemi quotidien — mais il reste essentiel de te protéger. SPF 30 minimum chaque matin (oui, même si tu restes à l'intérieur, la lumière bleue des écrans et UV par les fenêtres comptent). Renouveler 1x dans la journée si tu sors. La protection solaire n'est pas optionnelle — c'est le meilleur anti-âge naturel." },
    med: { titre: "☀️ Exposition modérée (1-3h/jour)", text: "Tu es exposée régulièrement — ta peau a besoin de protection sérieuse. SPF 50 OBLIGATOIRE chaque matin. Renouveler toutes les 4 heures quand tu es dehors. Lunettes de soleil (protègent les yeux et préviennent les rides du contour). Chapeau dans les heures fortes (12h-15h). Évite l'exposition entre 12h et 15h si possible." },
    high: { titre: "🔥 Exposition intense (+3h/jour)", text: "Ton activité t'expose énormément au soleil — protection MAXIMALE indispensable. SPF 50+ ÉCRAN TOTAL, à renouveler toutes les 2h. Chapeau à larges bords ou casquette. Lunettes de soleil systématiquement. Vêtements couvrants (manches longues légères). Hydratation interne ++ (3L d'eau). ⚠️ Important : sans cette protection, AUCUN soin de ta routine ne fonctionnera. Le soleil détruit tout." }
  },

  age: {
    ado: { titre: "🌱 Moins de 20 ans", text: "Ma belle, à ton âge, voici ce qu'il faut RETENIR : priorité = gérer l'acné, poser de bonnes habitudes. Routine SIMPLE : nettoyage doux + hydratant + SPF. Évite absolument les produits anti-âge (rétinol fort, peelings agressifs) — ta peau n'en a pas besoin. Hygiène de vie importante : sommeil, alimentation peu sucrée, hydratation. Les habitudes que tu prends maintenant détermineront l'état de ta peau à 40 ans. Mantra : 'Je pose les bases d'une belle peau pour la vie !'" },
    "20s": { titre: "🌸 20-29 ans", text: "Ma belle, c'est l'âge idéal pour commencer la prévention. Priorité = traiter les problèmes actuels + commencer la prévention. Routine COMPLÈTE : nettoyage, sérum (vitamine C ou niacinamide), hydratant, SPF. Tu peux introduire DOUCEMENT les actifs (vitamine C le matin). SPF tous les jours = la meilleure décision anti-âge que tu peux prendre. Sommeil de qualité, hydratation, alimentation équilibrée. Mantra : 'Mes choix d'aujourd'hui dessinent mon visage de demain !'" },
    "30s": { titre: "🌺 30-39 ans", text: "Ma belle, ta peau commence sa transformation — c'est le moment d'agir. Priorité = prévention anti-âge + uniformisation. Routine plus structurée : sérums actifs (vitamine C, niacinamide, hyaluronique). Introduction du rétinol en douceur (2x/semaine pour commencer). Soins contour des yeux essentiels. Massage facial régulier (stimule collagène). Hydratation interne renforcée (2,5L d'eau). Antioxydants (baies, thé vert, légumes colorés). Mantra : 'Ma peau évolue, je l'accompagne avec amour !'" },
    "40s": { titre: "🌹 40-49 ans", text: "Ma belle, ta peau a une histoire — voici comment la sublimer. Priorité = anti-âge actif + fermeté + uniformisation. Routine RICHE : peptides, rétinol régulier, acide hyaluronique, vitamine C. Soins cou et décolleté indispensables. Soins contour des yeux ciblés. Massages quotidiens (5 min) → stimule collagène. Crèmes plus riches, surtout le soir. Considère un sérum aux peptides pour la fermeté. Mantra : 'Mes années d'expérience méritent une routine premium !'" },
    "50plus": { titre: "🌷 50 ans et plus", text: "Ma belle, ta peau a vécu — donnons-lui ce qu'elle mérite. Priorité = nutrition profonde + densité + confort. Routine TRÈS nourrissante : huiles précieuses (rose musquée, argan), beurres. Sérums ciblés ménopause (peptides, hyaluronique haute concentration). Crèmes ultra-riches matin et soir. Soins anti-relâchement (massages, gua sha). Soins du cou et dos des mains essentiels. Hydratation interne renforcée + bonnes graisses (oméga-3, avocat, noix). Mantra : 'Ma beauté évolue, et chaque âge a sa lumière !'" }
  }
};

function BeautyFacialQuiz({ setPage, setCarryCarePage, bfStep, setBfStep, bfTypeAnswers, setBfTypeAnswers, bfProblems, setBfProblems, bfLifestyle, setBfLifestyle, bfResult, setBfResult, beautyQuizPrice, bfPaymentStep, setBfPaymentStep, bfPaymentPhone, setBfPaymentPhone, bfPaymentMethod, setBfPaymentMethod }) {

  function getSkinType(answers) {
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    answers.forEach(a => { if (counts[a] !== undefined) counts[a]++; });
    const max = Math.max(...Object.values(counts));
    const winner = Object.keys(counts).find(k => counts[k] === max);
    const types = {
      A: { code: "grasse", emoji: "🔵", name: "Peau Grasse", desc: "Ta peau produit beaucoup de sébum, surtout au niveau de la zone T" },
      B: { code: "seche", emoji: "🟡", name: "Peau Sèche", desc: "Ta peau manque de lipides et tire facilement" },
      C: { code: "normale", emoji: "🟢", name: "Peau Normale", desc: "Ta peau est équilibrée, ni grasse ni sèche" },
      D: { code: "mixte", emoji: "🟣", name: "Peau Mixte", desc: "Ta peau est grasse au centre et normale ou sèche sur les côtés" },
      E: { code: "sensible", emoji: "🔴", name: "Peau Sensible", desc: "Ta peau réagit facilement aux produits et agressions" },
    };
    return types[winner] || types.C;
  }

  function selectAnswer(questionIdx, value) {
    const newAnswers = [...bfTypeAnswers];
    newAnswers[questionIdx] = value;
    setBfTypeAnswers(newAnswers);
  }

  function toggleProblem(id) {
    if (bfProblems.includes(id)) {
      setBfProblems(bfProblems.filter(p => p !== id));
    } else {
      setBfProblems([...bfProblems, id]);
    }
  }

  // Header commun
  const Header = ({ title, onBack }) => (
    <div style={{ background: "linear-gradient(135deg, #fdf8f8 0%, #f5d7d9 100%)", padding: "20px 16px 18px", position: "relative", borderBottom: "1px solid " + CC.border }}>
      <button onClick={onBack} style={{ position: "absolute", left: 14, top: 14, background: CC.noir, border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>← Retour</button>
      <div style={{ textAlign: "center", paddingTop: 8 }}>
        <div style={{ fontSize: 13, color: CC.textFaint, marginBottom: 2 }}>💄 Beauté Faciale</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: CC.noir }}>{title}</div>
      </div>
    </div>
  );

  // ÉTAPE 1 — Type de peau
  if (bfStep === 1) {
    const answeredCount = BF_TYPE_QUESTIONS.filter((_, i) => bfTypeAnswers[i]).length;
    const allAnswered = answeredCount === BF_TYPE_QUESTIONS.length;
    return (
      <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
        <Header title="Étape 1 / 3 — Type de peau" onBack={() => setCarryCarePage("home")} />
        <div style={{ padding: "16px" }}>
          <div style={{ background: CC.roseLight, padding: "12px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, color: CC.noir }}>
            ✨ Réponds à ces 8 questions pour identifier précisément ton type de peau
          </div>
          {BF_TYPE_QUESTIONS.map((q, idx) => (
            <div key={idx} style={{ background: "#fff", borderRadius: 14, padding: "14px 14px", marginBottom: 12, border: "1px solid " + CC.border }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: CC.noir, marginBottom: 10 }}>
                {idx + 1}. {q.q}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {q.options.map(opt => (
                  <button key={opt.v} onClick={() => selectAnswer(idx, opt.v)} style={{
                    padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", textAlign: "left",
                    border: "1.5px solid " + (bfTypeAnswers[idx] === opt.v ? CC.roseDeep : CC.border),
                    background: bfTypeAnswers[idx] === opt.v ? CC.roseLight : "#fff",
                    color: CC.noir,
                    fontWeight: bfTypeAnswers[idx] === opt.v ? "bold" : "normal"
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => allAnswered && setBfStep(2)} disabled={!allAnswered} style={{
            width: "100%", padding: 16, background: allAnswered ? CC.noir : "#ccc", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: "bold",
            cursor: allAnswered ? "pointer" : "not-allowed", marginTop: 10
          }}>
            {allAnswered ? "Suivant — Tes problèmes →" : `Réponds aux ${BF_TYPE_QUESTIONS.length - answeredCount} questions restantes`}
          </button>
        </div>
      </div>
    );
  }

  // ÉTAPE 2 — Problèmes
  if (bfStep === 2) {
    return (
      <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
        <Header title="Étape 2 / 3 — Tes problèmes" onBack={() => setBfStep(1)} />
        <div style={{ padding: "16px" }}>
          <div style={{ background: CC.roseLight, padding: "12px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, color: CC.noir }}>
            ✨ Coche tous les problèmes que tu as actuellement (plusieurs choix possibles)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BF_PROBLEMS.map(p => (
              <button key={p.id} onClick={() => toggleProblem(p.id)} style={{
                padding: "14px 16px", borderRadius: 12, fontSize: 14, cursor: "pointer", textAlign: "left",
                border: "1.5px solid " + (bfProblems.includes(p.id) ? CC.roseDeep : CC.border),
                background: bfProblems.includes(p.id) ? CC.roseLight : "#fff",
                color: CC.noir, display: "flex", alignItems: "center", gap: 12,
                fontWeight: bfProblems.includes(p.id) ? "bold" : "normal"
              }}>
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                <span style={{ flex: 1 }}>{p.label}</span>
                <span style={{ fontSize: 18 }}>{bfProblems.includes(p.id) ? "✅" : "⬜"}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setBfStep(3)} style={{
            width: "100%", padding: 16, background: CC.noir, color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: "bold",
            cursor: "pointer", marginTop: 16
          }}>
            Suivant — Ton mode de vie →
          </button>
          <button onClick={() => { setBfProblems([]); setBfStep(3); }} style={{
            width: "100%", padding: 12, background: "transparent", color: CC.textFaint,
            border: "none", fontSize: 12, cursor: "pointer", marginTop: 6
          }}>
            Aucun problème majeur, juste de l'entretien →
          </button>
        </div>
      </div>
    );
  }

  // ÉTAPE 3 — Mode de vie
  if (bfStep === 3) {
    const lifestyleQuestions = [
      { key: "age", q: "Ta tranche d'âge ?", options: [
        { label: "🌱 Moins de 20 ans", v: "ado" },
        { label: "🌸 20 - 29 ans", v: "20s" },
        { label: "🌺 30 - 39 ans", v: "30s" },
        { label: "🌹 40 - 49 ans", v: "40s" },
        { label: "🌷 50 ans et plus", v: "50plus" },
      ]},
      { key: "sun", q: "Combien de temps au soleil par jour ?", options: [
        { label: "🌤️ Moins d'1 heure", v: "low" },
        { label: "☀️ Entre 1 et 3 heures", v: "med" },
        { label: "🔥 Plus de 3 heures", v: "high" },
      ]},
      { key: "spf", q: "Tu utilises une protection solaire (SPF) ?", options: [
        { label: "✅ Oui, tous les jours", v: "always" },
        { label: "🟡 Parfois", v: "sometimes" },
        { label: "❌ Non, jamais", v: "never" },
      ]},
      { key: "makeup", q: "Tu te maquilles à quelle fréquence ?", options: [
        { label: "💄 Tous les jours", v: "daily" },
        { label: "🎉 Occasionnellement", v: "occ" },
        { label: "🚫 Rarement ou jamais", v: "rarely" },
      ]},
      { key: "water", q: "Combien d'eau bois-tu par jour ?", options: [
        { label: "💧 Moins d'1 litre", v: "low" },
        { label: "💧💧 1 à 2 litres", v: "med" },
        { label: "💧💧💧 Plus de 2 litres", v: "high" },
      ]},
      { key: "sleep", q: "Sommeil et stress ?", options: [
        { label: "😴 Bon sommeil et détendue", v: "good" },
        { label: "😐 Moyen", v: "med" },
        { label: "😩 Peu de sommeil et stressée", v: "bad" },
      ]},
    ];
    const allDone = lifestyleQuestions.every(q => bfLifestyle[q.key] !== null);

    return (
      <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
        <Header title="Étape 3 / 3 — Ton mode de vie" onBack={() => setBfStep(2)} />
        <div style={{ padding: "16px" }}>
          <div style={{ background: CC.roseLight, padding: "12px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, color: CC.noir }}>
            ✨ Ces dernières questions affinent ton diagnostic
          </div>
          {lifestyleQuestions.map((lq, idx) => (
            <div key={lq.key} style={{ background: "#fff", borderRadius: 14, padding: "14px 14px", marginBottom: 12, border: "1px solid " + CC.border }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: CC.noir, marginBottom: 10 }}>
                {idx + 1}. {lq.q}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lq.options.map(opt => (
                  <button key={opt.v} onClick={() => setBfLifestyle({ ...bfLifestyle, [lq.key]: opt.v })} style={{
                    padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", textAlign: "left",
                    border: "1.5px solid " + (bfLifestyle[lq.key] === opt.v ? CC.roseDeep : CC.border),
                    background: bfLifestyle[lq.key] === opt.v ? CC.roseLight : "#fff",
                    color: CC.noir,
                    fontWeight: bfLifestyle[lq.key] === opt.v ? "bold" : "normal"
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => {
            if (!allDone) return;
            // Calcul résultat
            const skinType = getSkinType(bfTypeAnswers);
            setBfResult({ skinType, problems: bfProblems, lifestyle: bfLifestyle });
            setBfStep(4); // suspense
            setTimeout(() => setBfStep(5), 2500); // payment
          }} disabled={!allDone} style={{
            width: "100%", padding: 16, background: allDone ? CC.noir : "#ccc", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: "bold",
            cursor: allDone ? "pointer" : "not-allowed", marginTop: 10
          }}>
            {allDone ? "Voir mon diagnostic ✨" : "Réponds aux questions restantes"}
          </button>
        </div>
      </div>
    );
  }

  // ÉTAPE 4 — Suspense
  if (bfStep === 4) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fdf8f8 0%, #f5d7d9 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 20 }}>
        <div style={{ fontSize: 80, marginBottom: 20, animation: "spin 2s linear infinite" }}>✨</div>
        <div style={{ fontSize: 22, fontWeight: "bold", color: CC.noir, marginBottom: 8, textAlign: "center" }}>Analyse en cours...</div>
        <div style={{ fontSize: 14, color: CC.textFaint, textAlign: "center" }}>Préparation de ton diagnostic personnalisé</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); }}`}</style>
      </div>
    );
  }

  // ÉTAPE 5 — Paiement
  if (bfStep === 5) {
    if (bfPaymentStep === 1) {
      return (
        <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
          <Header title="Ton diagnostic est prêt ✨" onBack={() => setBfStep(3)} />
          <div style={{ padding: 16 }}>
            <div style={{ background: "linear-gradient(135deg, #fdf8f8 0%, #f5d7d9 100%)", borderRadius: 18, padding: "32px 20px", marginBottom: 16, textAlign: "center", border: "1px solid " + CC.border }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: CC.noir, marginBottom: 10 }}>Ton diagnostic personnalisé</div>
              <div style={{ fontSize: 13, color: CC.noirSoft, lineHeight: 1.6, fontStyle: "italic" }}>Notre analyse a révélé des résultats surprenants sur ta peau...</div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 16, border: "1px solid " + CC.border }}>
              <div style={{ fontSize: 15, fontWeight: "bold", color: CC.noir, marginBottom: 8 }}>✨ Ton diagnostic complet inclut :</div>
              <div style={{ fontSize: 13, color: CC.noirSoft, lineHeight: 1.8 }}>
                ✅ Ton vrai type de peau identifié<br/>
                ✅ Ta routine matin/soir personnalisée<br/>
                ✅ Tes ingrédients miracles<br/>
                ✅ Conseils ciblés pour tes problèmes<br/>
                ✅ Option 100% naturel (recettes maison)<br/>
                ✅ Option rapide & efficace (produits pro)<br/>
                ✅ Erreurs à éviter
              </div>
            </div>

            <button onClick={() => setBfPaymentStep(2)} style={{
              width: "100%", padding: 16, background: CC.noir, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 16, fontWeight: "bold", cursor: "pointer"
            }}>
              💎 Débloquer mon diagnostic — {beautyQuizPrice} FCFA
            </button>
          </div>
        </div>
      );
    }

    // Choix méthode paiement
    if (bfPaymentStep === 2) {
      return (
        <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
          <Header title="Méthode de paiement" onBack={() => setBfPaymentStep(1)} />
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 14, color: CC.noir, marginBottom: 16, textAlign: "center" }}>
              Choisis ta méthode de paiement
            </div>
            <button onClick={() => { setBfPaymentMethod("MTN"); setBfPaymentStep(3); }} style={{
              width: "100%", padding: 18, background: "#FFCC00", color: "#000",
              border: "none", borderRadius: 12, fontSize: 16, fontWeight: "bold", cursor: "pointer", marginBottom: 12
            }}>
              📱 MTN Mobile Money
            </button>
            <button onClick={() => { setBfPaymentMethod("ORANGE"); setBfPaymentStep(3); }} style={{
              width: "100%", padding: 18, background: "#FF6600", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 16, fontWeight: "bold", cursor: "pointer"
            }}>
              📱 Orange Money
            </button>
          </div>
        </div>
      );
    }

    // Saisie numéro
    if (bfPaymentStep === 3) {
      return (
        <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
          <Header title={"Ton numéro " + bfPaymentMethod} onBack={() => setBfPaymentStep(2)} />
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: CC.textFaint, marginBottom: 12 }}>
              Entre ton numéro {bfPaymentMethod} (9 chiffres, sans +237)
            </div>
            <input type="tel" value={bfPaymentPhone} onChange={(e) => setBfPaymentPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="6XXXXXXXX" style={{
                width: "100%", padding: 14, fontSize: 18, border: "1.5px solid " + CC.border,
                borderRadius: 12, marginBottom: 16, outline: "none"
              }} />
            <button onClick={async () => {
              if (bfPaymentPhone.length !== 9) { alert("Numéro invalide (9 chiffres requis)"); return; }
              setBfPaymentStep(4);
              const fullPhone = "237" + bfPaymentPhone;
              try {
                const collect = await fetch("/api/campay", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "collect", amount: beautyQuizPrice, phone: fullPhone, description: "CarryCare — Beauté Faciale", external_reference: "carrycare_facial_" + Date.now() })
                });
                const data = await collect.json();
                if (!data.reference) { setBfPaymentStep(5); return; }
                // Polling check
                const ref = data.reference;
                let attempts = 0;
                const maxAttempts = 25;
                const interval = setInterval(async () => {
                  attempts++;
                  if (attempts >= maxAttempts) { clearInterval(interval); setBfPaymentStep(5); return; }
                  try {
                    const checkRes = await fetch("/api/campay", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "check", reference: ref })
                    });
                    const checkData = await checkRes.json();
                    if (checkData.status === "SUCCESSFUL") { clearInterval(interval); setBfStep(6); setBfPaymentStep(1); }
                    else if (checkData.status === "FAILED") { clearInterval(interval); setBfPaymentStep(5); }
                  } catch (e) {}
                }, 3000);
              } catch (e) {
                setBfPaymentStep(5);
              }
            }} style={{
              width: "100%", padding: 16, background: CC.noir, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 16, fontWeight: "bold", cursor: "pointer"
            }}>
              💎 Payer {beautyQuizPrice} FCFA
            </button>
          </div>
        </div>
      );
    }

    // En cours
    if (bfPaymentStep === 4) {
      return (
        <div style={{ minHeight: "100vh", background: CC.blanc, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 20 }}>
          <div style={{ fontSize: 70, marginBottom: 20, animation: "spin 2s linear infinite" }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: "bold", color: CC.noir, marginBottom: 12, textAlign: "center" }}>Paiement en cours...</div>
          <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, maxWidth: 360, marginBottom: 14 }}>
            <div style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.5, fontWeight: "bold" }}>
              ⚠️ Ne quittez pas cet écran, veuillez patienter jusqu'à la finalisation.
            </div>
          </div>
          <div style={{ fontSize: 12, color: CC.textFaint, textAlign: "center", lineHeight: 1.5 }}>
            Confirme la transaction sur ton téléphone {bfPaymentMethod}.<br/>
            Cela peut prendre jusqu'à 30 secondes.
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); }}`}</style>
        </div>
      );
    }

    // ÉCHEC
    if (bfPaymentStep === 5) {
      return (
        <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
          <Header title="Paiement non finalisé" onBack={() => setBfPaymentStep(2)} />
          <div style={{ padding: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 64, marginBottom: 14 }}>❌</div>
              <h3 style={{ color: "#c62828", marginBottom: 8, fontSize: 18 }}>Paiement non finalisé</h3>
              <p style={{ color: CC.textFaint, fontSize: 14 }}>Le réseau de l'opérateur est peut-être occupé.</p>
            </div>
            <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 16, borderRadius: 10, marginBottom: 20 }}>
              <p style={{ color: "#7a4a00", fontSize: 13, fontWeight: "bold", marginBottom: 8, marginTop: 0 }}>💡 Essaie ces solutions :</p>
              <p style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                ✅ Vérifie ton solde Mobile Money<br/>
                ✅ Réessaie avec l'autre opérateur (MTN/Orange)<br/>
                ✅ Patiente quelques minutes et réessaie<br/>
                ✅ Vérifie ta connexion internet
              </p>
            </div>
            <button onClick={() => { setBfPaymentStep(2); setBfPaymentMethod(null); setBfPaymentPhone(""); }} style={{
              width: "100%", padding: 16, background: CC.noir, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: "bold", cursor: "pointer", marginBottom: 10
            }}>
              🔁 Réessayer
            </button>
            <button onClick={() => { setBfPaymentStep(1); setBfPaymentMethod(null); setBfPaymentPhone(""); }} style={{
              width: "100%", padding: 14, background: "transparent", color: CC.textFaint,
              border: "1px solid " + CC.border, borderRadius: 12, fontSize: 13, cursor: "pointer"
            }}>
              Annuler
            </button>
          </div>
        </div>
      );
    }
  }

  // ÉTAPE 6 — Résultat débloqué COMPLET
  if (bfStep === 6 && bfResult) {
    const problemLabels = bfResult.problems.map(pid => BF_PROBLEMS.find(p => p.id === pid)).filter(Boolean);
    const skinCode = bfResult.skinType.code;
    const routine = BF_CONTENT.routines[skinCode] || BF_CONTENT.routines.normale;
    const sunData = BF_CONTENT.soleil[bfResult.lifestyle.sun] || BF_CONTENT.soleil.med;
    const ageData = BF_CONTENT.age[bfResult.lifestyle.age] || BF_CONTENT.age["20s"];

    function reset() {
      setCarryCarePage("home");
      setBfStep(1);
      setBfTypeAnswers([]);
      setBfProblems([]);
      setBfLifestyle({ age: null, sun: null, spf: null, makeup: null, water: null, sleep: null });
      setBfResult(null);
      setBfPaymentStep(1);
      setBfPaymentPhone("");
      setBfPaymentMethod(null);
    }

    return (
      <div style={{ minHeight: "100vh", background: CC.blanc, paddingBottom: 80 }}>
        <Header title="Ton diagnostic complet ✨" onBack={reset} />
        <div style={{ padding: 16 }}>

          {/* DIAGNOSTIC PRINCIPAL */}
          <div style={{ background: "linear-gradient(135deg, #fdf8f8 0%, #f5d7d9 100%)", borderRadius: 18, padding: "24px 20px", marginBottom: 16, textAlign: "center", border: "1px solid " + CC.border }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{bfResult.skinType.emoji}</div>
            <div style={{ fontSize: 12, color: CC.textFaint, marginBottom: 4 }}>Ton diagnostic</div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: CC.noir, marginBottom: 10 }}>{bfResult.skinType.name}</div>
            <div style={{ fontSize: 13, color: CC.noirSoft, lineHeight: 1.5, fontStyle: "italic" }}>{bfResult.skinType.desc}</div>
          </div>

          {/* PROBLÈMES IDENTIFIÉS */}
          {problemLabels.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 16, border: "1px solid " + CC.border }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: CC.noir, marginBottom: 12 }}>🎯 Tes problèmes identifiés</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {problemLabels.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: CC.roseLight, borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>{p.emoji}</span>
                    <span style={{ fontSize: 13, color: CC.noir }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTRO ROUTINE */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 16, border: "1px solid " + CC.border }}>
            <div style={{ fontSize: 13, color: CC.noirSoft, lineHeight: 1.6, fontStyle: "italic" }}>{routine.intro}</div>
          </div>

          {/* OPTION 1 — NATUREL */}
          <div style={{ background: "linear-gradient(135deg, #f0f7e8 0%, #d4e8c5 100%)", borderRadius: 16, padding: 18, marginBottom: 16, border: "1px solid #b8d4a0" }}>
            <div style={{ fontSize: 17, fontWeight: "bold", color: "#2d5016", marginBottom: 4 }}>🌿 Option 1 — 100% Naturel</div>
            <div style={{ fontSize: 11, color: "#4a7028", marginBottom: 14, fontStyle: "italic" }}>Recettes maison, ingrédients du marché — économique et accessible</div>

            <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: "#2d5016", marginBottom: 6 }}>🌅 MATIN</div>
              {routine.naturel.matin.map((step, i) => (
                <div key={i} style={{ fontSize: 12, color: CC.noir, marginBottom: 4, lineHeight: 1.5, paddingLeft: 8 }}>
                  {i + 1}. {step}
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: "#2d5016", marginBottom: 6 }}>🌙 SOIR</div>
              {routine.naturel.soir.map((step, i) => (
                <div key={i} style={{ fontSize: 12, color: CC.noir, marginBottom: 4, lineHeight: 1.5, paddingLeft: 8 }}>
                  {i + 1}. {step}
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: CC.noir, lineHeight: 1.5 }}>✨ <strong>Bonus :</strong> {routine.naturel.bonus}</div>
            </div>

            <div style={{ fontSize: 11, color: "#4a7028", fontStyle: "italic", textAlign: "center", marginTop: 8 }}>
              ⏰ {routine.naturel.delai}
            </div>
          </div>

          {/* OPTION 2 — EXPRESS */}
          <div style={{ background: "linear-gradient(135deg, #f5d7d9 0%, #e8b4b8 100%)", borderRadius: 16, padding: 18, marginBottom: 16, border: "1px solid " + CC.roseDeep }}>
            <div style={{ fontSize: 17, fontWeight: "bold", color: CC.noir, marginBottom: 4 }}>⚡ Option 2 — Rapide & Efficace</div>
            <div style={{ fontSize: 11, color: CC.noirSoft, marginBottom: 14, fontStyle: "italic" }}>Sérums modernes — résultats rapides — disponibles bientôt sur CarryGoo.net</div>

            <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: CC.noir, marginBottom: 6 }}>🌅 MATIN</div>
              {routine.express.matin.map((step, i) => (
                <div key={i} style={{ fontSize: 12, color: CC.noir, marginBottom: 4, lineHeight: 1.5, paddingLeft: 8 }}>
                  {i + 1}. {step}
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: CC.noir, marginBottom: 6 }}>🌙 SOIR</div>
              {routine.express.soir.map((step, i) => (
                <div key={i} style={{ fontSize: 12, color: CC.noir, marginBottom: 4, lineHeight: 1.5, paddingLeft: 8 }}>
                  {i + 1}. {step}
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: CC.noir, lineHeight: 1.5 }}>✨ <strong>Bonus :</strong> {routine.express.bonus}</div>
            </div>

            <div style={{ fontSize: 11, color: CC.noirSoft, fontStyle: "italic", textAlign: "center", marginTop: 8 }}>
              ⏰ {routine.express.delai}
            </div>
          </div>

          {/* À ÉVITER */}
          <div style={{ background: "#fff5f5", borderRadius: 14, padding: 18, marginBottom: 16, border: "1px solid #ffcdd2" }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#c62828", marginBottom: 10 }}>❌ À éviter absolument</div>
            {routine.eviter.map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: CC.noir, marginBottom: 6, lineHeight: 1.5 }}>
                • {item}
              </div>
            ))}
          </div>

          {/* MODULES PROBLÈMES */}
          {problemLabels.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: "bold", color: CC.noir, marginBottom: 12, textAlign: "center" }}>
                🎯 Conseils ciblés pour tes problèmes
              </div>
              {problemLabels.map(p => {
                const probContent = BF_CONTENT.problems[p.id];
                if (!probContent) return null;
                return (
                  <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid " + CC.border }}>
                    <div style={{ fontSize: 15, fontWeight: "bold", color: CC.noir, marginBottom: 12 }}>{probContent.titre}</div>

                    <div style={{ background: "#f0f7e8", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#2d5016", marginBottom: 6 }}>🌿 Solutions naturelles</div>
                      {probContent.naturel.map((sol, i) => (
                        <div key={i} style={{ fontSize: 11, color: CC.noir, marginBottom: 4, lineHeight: 1.5 }}>• {sol}</div>
                      ))}
                    </div>

                    <div style={{ background: CC.roseLight, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: CC.noir, marginBottom: 6 }}>⚡ Solutions express</div>
                      {probContent.express.map((sol, i) => (
                        <div key={i} style={{ fontSize: 11, color: CC.noir, marginBottom: 4, lineHeight: 1.5 }}>• {sol}</div>
                      ))}
                    </div>

                    <div style={{ background: "#fffbe6", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: "#7a5c00", lineHeight: 1.5 }}>📌 {probContent.conseils}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AJUSTEMENT SOLEIL */}
          <div style={{ background: "linear-gradient(135deg, #fff8e1 0%, #ffe082 100%)", borderRadius: 14, padding: 18, marginBottom: 16, border: "1px solid #ffcc80" }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#7a5c00", marginBottom: 8 }}>{sunData.titre}</div>
            <div style={{ fontSize: 12, color: CC.noir, lineHeight: 1.6 }}>{sunData.text}</div>
          </div>

          {/* AJUSTEMENT ÂGE */}
          <div style={{ background: "linear-gradient(135deg, #f5ecec 0%, #e8d4b8 100%)", borderRadius: 14, padding: 18, marginBottom: 16, border: "1px solid " + CC.border }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: CC.noir, marginBottom: 8 }}>{ageData.titre}</div>
            <div style={{ fontSize: 12, color: CC.noir, lineHeight: 1.6 }}>{ageData.text}</div>
          </div>

          {/* DISCLAIMER */}
          <div style={{ background: "#fff8e1", borderLeft: "3px solid " + CC.gold, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#7a5c00", lineHeight: 1.5 }}>
              ⚠️ Ces conseils sont indicatifs. Avant d'utiliser un nouveau produit, fais un test sur une petite zone de peau (intérieur du poignet, 24h). En cas de problème de peau important, consulte un dermatologue.
            </div>
          </div>

          {/* PROCHAINEMENT */}
          <div style={{ background: CC.noir, borderRadius: 14, padding: 18, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🛒</div>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>Bientôt sur CarryGoo.net</div>
            <div style={{ fontSize: 11, color: "#ddd", lineHeight: 1.5 }}>
              Tous les sérums et produits recommandés seront disponibles à la vente dès le lancement de notre boutique. Reste connectée !
            </div>
          </div>

          {/* BOUTON RETOUR */}
          <button onClick={reset} style={{
            width: "100%", padding: 14, background: CC.noir, color: "#fff",
            border: "none", borderRadius: 12, fontSize: 14, fontWeight: "bold", cursor: "pointer"
          }}>
            🌸 Retour à CarryCare
          </button>
        </div>
      </div>
    );
  }

  return null;
}


export default function App() {
  const [page, setPage] = useState("home");
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [bookRatings, setBookRatings] = useState({}); // { bookId: { avg, count, userRating } }
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [reading, setReading] = useState(null);
  const [readingPage, setReadingPage] = useState(0);
  const [selectedSubCategory, setSelectedSubCategory] = useState("Tous");
  const [readerSize, setReaderSize] = useState(15);
  const [readerFont, setReaderFont] = useState("Georgia, serif");
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [readerDark, setReaderDark] = useState(false);
  const [excerptMode, setExcerptMode] = useState(false);
  const [purchasedBooks, setPurchasedBooks] = useState([]);
  const [favoriteBooks, setFavoriteBooks] = useState([]);
  const [cachedBooks, setCachedBooks] = useState({});
  const [showPayment, setShowPayment] = useState(false);
  const [paymentBook, setPaymentBook] = useState(null);
  const [paymentStep, setPaymentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMenu, setShowMenu] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [readerScrollMode, setReaderScrollMode] = useState(false);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [translateLang, setTranslateLang] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioRef] = useState(() => ({ current: null }));
  const [audioMode, setAudioMode] = useState(null); // 'mp3' only
  const [heroIndex, setHeroIndex] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [subSettings, setSubSettings] = useState({ monthly_price: 2000, annual_price: 20000, books_per_month: 3 });
  const [showSubModal, setShowSubModal] = useState(false);
  const [subPlan, setSubPlan] = useState("mensuel");
  const [subPaymentStep, setSubPaymentStep] = useState(1);
  const [subPhone, setSubPhone] = useState("");
  const [subPaymentMethod, setSubPaymentMethod] = useState(null);
  // Modals système d'abonnement avec quota
  const [showSubUnlockModal, setShowSubUnlockModal] = useState(null); // book à débloquer
  const [showSubLimitModal, setShowSubLimitModal] = useState(null); // book bloqué (quota atteint)
  const [subLowWarningShown, setSubLowWarningShown] = useState(false);
  const [quizPrice, setQuizPrice] = useState(500);
  const [quizPage, setQuizPage] = useState("quizHome"); // quizHome | quizPlay | quizSuspense | quizPayment | quizResult
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizResult, setQuizResult] = useState(null);
  const [quizPaymentStep, setQuizPaymentStep] = useState(1);
  const [quizPhone, setQuizPhone] = useState("");
  const [quizPaymentMethod, setQuizPaymentMethod] = useState(null);
  const [quizCategory, setQuizCategory] = useState("Tous");

  // ─── CARRYCARE / BEAUTÉ & SANTÉ ───
  const [carryCarePage, setCarryCarePage] = useState("home"); // home | facialQuiz
  const [beautyQuizPrice, setBeautyQuizPrice] = useState(1000);
  const [bfStep, setBfStep] = useState(1); // 1=type peau, 2=problèmes, 3=mode vie, 4=résultat suspense, 5=paiement, 6=résultat
  const [bfTypeAnswers, setBfTypeAnswers] = useState([]); // 8 réponses A/B/C/D/E
  const [bfProblems, setBfProblems] = useState([]); // cases cochées
  const [bfLifestyle, setBfLifestyle] = useState({ age: null, sun: null, spf: null, makeup: null, water: null, sleep: null });
  const [bfResult, setBfResult] = useState(null);
  const [bfPaymentStep, setBfPaymentStep] = useState(1);
  const [bfPaymentPhone, setBfPaymentPhone] = useState("");
  const [bfPaymentMethod, setBfPaymentMethod] = useState(null);

  useEffect(() => {
    const featuredBooks = books.filter(b => b.featured);
    if (featuredBooks.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(i => (i + 1) % featuredBooks.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [books]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const handleInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    fetchBooks();
    // Charger les paramètres d'abonnement au démarrage
    supabase.from("sub_settings").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setSubSettings(data[0]);
        if (data[0].quiz_price) setQuizPrice(data[0].quiz_price);
      }
    });
    // Load all book ratings for catalog display
    supabase.from("book_reviews").select("book_id, rating").then(({ data }) => {
      if (!data) return;
      const grouped = {};
      data.forEach(r => {
        if (!grouped[r.book_id]) grouped[r.book_id] = [];
        grouped[r.book_id].push(r.rating);
      });
      const ratings = {};
      Object.keys(grouped).forEach(id => {
        const arr = grouped[id];
        ratings[id] = { avg: Math.round((arr.reduce((s,v)=>s+v,0)/arr.length)*10)/10, count: arr.length, userRating: 0 };
      });
      setBookRatings(ratings);
    });
    const p = localStorage.getItem("purchasedBooks");
    if (p) setPurchasedBooks(JSON.parse(p));
    const f = localStorage.getItem("favoriteBooks");
    if (f) setFavoriteBooks(JSON.parse(f));
    const c = localStorage.getItem("cachedBooks");
    if (c) setCachedBooks(JSON.parse(c));
  }, []);

  // Auth listener
  useEffect(() => {
    // Enregistrement du Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Traiter le hash de retour Google OAuth (mobile)
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          loadUserPurchases(session.user.id);
          window.history.replaceState(null, "", window.location.pathname);
        }
        setAuthChecked(true);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) loadUserPurchases(session.user.id);
        else setShowAuthModal(true); // Afficher modal si non connecté
        setAuthChecked(true);
      });
    }
    // Restaurer session depuis Preferences si disponible
    Preferences.get({ key: "sb-session" }).then(({ value }) => {
      if (value) {
        try {
          const saved = JSON.parse(value);
          supabase.auth.setSession(saved).then(({ data }) => {
            if (data?.session?.user) {
              setUser(data.session.user);
              loadUserPurchases(data.session.user.id);
            }
          }).catch(() => {});
        } catch(e) {}
      }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserPurchases(session.user.id);
        // Sauvegarder session dans Preferences
        Preferences.set({ key: "sb-session", value: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }) }).catch(() => {});
      }
      if (event === "SIGNED_OUT") {
        setPurchasedBooks([]);
        localStorage.removeItem("purchasedBooks");
        setShowAuthModal(false);
        Preferences.remove({ key: "sb-session" }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadUserPurchases(userId) {
    const { data } = await supabase.from("purchases").select("book_id, created_at, amount").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) {
      const remoteIds = data.map(p => p.book_id);
      const local = JSON.parse(localStorage.getItem("purchasedBooks") || "[]");
      const merged = [...new Set([...remoteIds, ...local])];
      setPurchasedBooks(merged);
      localStorage.setItem("purchasedBooks", JSON.stringify(merged));
      setPurchaseHistory(data);
    }
    // Charger abonnement actif
    const { data: sub, error: subErr } = await supabase.from("subscriptions")
      .select("*").eq("user_id", userId).eq("status", "actif")
      .order("started_at", { ascending: false }).limit(1);
    if (subErr) console.error("Erreur chargement abo:", subErr);
    if (sub && sub.length > 0) {
      let activeSub = sub[0];
      const expDate = new Date(activeSub.expires_at);
      if (expDate > new Date()) {
        // Reset mensuel automatique : si started_at date de plus d'1 mois, reset books_used à 0
        const startDate = new Date(activeSub.started_at);
        const oneMonthLater = new Date(startDate);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        if (new Date() >= oneMonthLater && activeSub.books_used > 0) {
          // Reset
          const newStartDate = new Date().toISOString();
          await supabase.from("subscriptions").update({ books_used: 0, started_at: newStartDate }).eq("id", activeSub.id);
          activeSub = { ...activeSub, books_used: 0, started_at: newStartDate };
        }
        setSubscription(activeSub);
      } else setSubscription(null);
    } else setSubscription(null);
    // Charger paramètres abonnement
    const { data: settings } = await supabase.from("sub_settings").select("*").limit(1);
    if (settings && settings.length > 0) setSubSettings(settings[0]);
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://www.carrybooks.com" }
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setPurchasedBooks([]);
    localStorage.removeItem("purchasedBooks");
  }

  async function fetchBooks() {
    setLoading(true);
    const { data } = await supabase.from("books").select("*").eq("status", "actif").order("created_at", { ascending: false });
    if (data) setBooks(data);
    setLoading(false);
  }

  function shareBook(book) {
    const url = window.location.origin + "/?book=" + book.id;
    const text = "📚 Découvrez \"" + book.title + "\" par " + book.author + " sur CarryBooks !";
    if (navigator.share) {
      navigator.share({ title: book.title, text, url }).catch(() => {});
    } else {
      // Fallback: copier le lien
      navigator.clipboard?.writeText(url).then(() => alert("Lien copié ! Partagez-le où vous voulez.")).catch(() => {
        // Fallback: WhatsApp
        window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank");
      });
    }
  }

  function hasAccess(book) {
    if (book.price === 0) return true;
    if (purchasedBooks.includes(book.id)) return true;
    return false;
  }

  // L'abonné peut-il utiliser son abonnement pour débloquer ce livre ?
  function canUseSubscriptionFor(book) {
    if (!subscription || subscription.status !== "actif") return false;
    if (book.price === 0 || purchasedBooks.includes(book.id)) return false;
    return booksLeftThisMonth() > 0;
  }

  function booksLeftThisMonth() {
    if (!subscription) return 0;
    return Math.max(0, (subscription.books_per_month || subSettings.books_per_month) - (subscription.books_used || 0));
  }

  async function handleSubscribe() {
    if (!subPaymentMethod || !subPhone) return;
    setSubPaymentStep(4);
    try {
      let phone = subPhone.replace(/\s/g, "").replace(/^\+/, "");
      if (phone.startsWith("0")) phone = "237" + phone.slice(1);
      if (!phone.startsWith("237")) phone = "237" + phone;
      const price = subPlan === "annuel" ? subSettings.annual_price : subSettings.monthly_price;
      const payRes = await fetch("/api/campay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect",
          amount: price,
          phone,
          description: "Abonnement CarryBooks " + subPlan,
          external_reference: "SUB_" + subPlan + "_" + (user ? user.id : "guest") + "_" + Date.now()
        })
      });
      const payData = await payRes.json();
      if (payData.reference) {
        setTimeout(async () => {
          try {
            const checkRes = await fetch("/api/campay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check", reference: payData.reference })
            });
            const checkData = await checkRes.json();
            if (checkData.status === "SUCCESSFUL") {
              const now = new Date();
              const expires = new Date(now);
              if (subPlan === "mensuel") expires.setMonth(expires.getMonth() + 1);
              else expires.setFullYear(expires.getFullYear() + 1);
              if (user) {
                // Désactiver les anciens abonnements actifs de cet utilisateur
                await supabase.from("subscriptions").update({ status: "expire" }).eq("user_id", user.id).eq("status", "actif");
                // Créer le nouveau
                const { data: newSub } = await supabase.from("subscriptions").insert([{
                  user_id: user.id,
                  plan: subPlan,
                  books_per_month: subSettings.books_per_month,
                  books_used: 0,
                  price,
                  started_at: now.toISOString(),
                  expires_at: expires.toISOString(),
                  status: "actif"
                }]).select().single();
                if (newSub) setSubscription(newSub);
              }
              setSubPaymentStep(5);
            } else {
              setSubPaymentStep(6);
            }
          } catch(e) { setSubPaymentStep(6); }
        }, 25000);
      } else {
        setSubPaymentStep(6);
      }
    } catch(e) { setSubPaymentStep(6); }
  }

  function cacheBook(book) {
    const newCache = { ...cachedBooks, [book.id]: book };
    setCachedBooks(newCache);
    localStorage.setItem("cachedBooks", JSON.stringify(newCache));
  }

  function shareBook(book) {
    const url = window.location.origin + "/?book=" + book.id;
    const text = "📚 Découvre « " + book.title + " » de " + book.author + " sur CarryBooks !\n" + url;
    if (navigator.share) {
      navigator.share({ title: book.title, text: "Découvre ce livre sur CarryBooks !", url });
    } else {
      const waUrl = "https://wa.me/?text=" + encodeURIComponent(text);
      window.open(waUrl, "_blank");
    }
  }

  async function loadBookRatings(bookId) {
    const { data } = await supabase.from("book_reviews").select("rating, user_id").eq("book_id", bookId);
    if (data && data.length > 0) {
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      const userRating = user ? (data.find(r => r.user_id === user.id)?.rating || 0) : 0;
      setBookRatings(prev => ({ ...prev, [bookId]: { avg: Math.round(avg * 10) / 10, count: data.length, userRating } }));
    } else {
      setBookRatings(prev => ({ ...prev, [bookId]: { avg: 0, count: 0, userRating: 0 } }));
    }
  }

  async function submitRating(bookId, rating) {
    if (!user) { alert("Connecte-toi pour noter ce livre"); return; }
    const existing = await supabase.from("book_reviews").select("id").eq("book_id", bookId).eq("user_id", user.id).limit(1);
    if (existing.data && existing.data.length > 0) {
      await supabase.from("book_reviews").update({ rating }).eq("id", existing.data[0].id);
    } else {
      await supabase.from("book_reviews").insert([{ book_id: bookId, user_id: user.id, rating }]);
    }
    loadBookRatings(bookId);
  }

  function openBook(book) {
    setSelectedBook(book);
    setPage("detail");
    loadBookRatings(book.id);
    setShowMenu(false);
    if (book.price === 0) cacheBook(book);
  }

  function startReading(book, excerpt = false) {
    const bookToRead = (!isOnline && cachedBooks[book.id]) ? cachedBooks[book.id] : book;
    if (!excerpt && !hasAccess(bookToRead)) {
      // Si abonné et peut utiliser son abonnement → propose de débloquer via abo
      if (canUseSubscriptionFor(book)) {
        setShowSubUnlockModal(book);
        return;
      }
      // Si abonné mais quota atteint → modal limite
      if (subscription && subscription.status === "actif" && booksLeftThisMonth() === 0 && !purchasedBooks.includes(book.id) && book.price > 0) {
        setShowSubLimitModal(book);
        return;
      }
      // Sinon, achat individuel
      setPaymentBook(book);
      setShowPayment(true);
      setPaymentStep(1);
      setPaymentMethod(null);
      setPhoneNumber("");
      return;
    }
    setExcerptMode(excerpt);
    setReading(bookToRead);
    if (!excerpt) {
      const saved = localStorage.getItem("readingProgress_" + bookToRead.id);
      setReadingPage(saved ? parseInt(saved) : 0);
    } else {
      setReadingPage(0);
    }
    setPage("reader");
    setTranslatedContent(null);
    setTranslateLang(null);
    stopAudio();
  }

  // Débloquer un livre en utilisant un crédit de l'abonnement
  async function unlockWithSubscription(book) {
    if (!user || !subscription) return;
    if (booksLeftThisMonth() <= 0) {
      setShowSubUnlockModal(null);
      setShowSubLimitModal(book);
      return;
    }
    try {
      // 1) Ajouter le livre aux purchases (bibliothèque permanente)
      await supabase.from("purchases").insert([{
        user_id: user.id,
        book_id: book.id,
        amount: 0
      }]);
      // 2) Incrémenter books_used dans subscriptions
      const newUsed = (subscription.books_used || 0) + 1;
      await supabase.from("subscriptions").update({ books_used: newUsed }).eq("id", subscription.id);
      // 3) Mettre à jour les states
      const newPurchased = [...purchasedBooks, book.id];
      setPurchasedBooks(newPurchased);
      localStorage.setItem("purchasedBooks", JSON.stringify(newPurchased));
      setSubscription({ ...subscription, books_used: newUsed });
      cacheBook(book);
      // 4) Avertissement si plus que 2 livres
      const totalBooks = subscription.books_per_month || subSettings.books_per_month;
      if (totalBooks - newUsed === 2 && !subLowWarningShown) {
        setSubLowWarningShown(true);
        setTimeout(() => alert("⚠️ Plus que 2 livres pour cet abonnement actif"), 500);
      }
      // 5) Lancer la lecture
      setShowSubUnlockModal(null);
      startReading(book);
    } catch (e) {
      alert("Erreur. Réessaie.");
    }
  }

  function toggleFavorite(bookId) {
    setFavoriteBooks(prev => {
      const updated = prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId];
      localStorage.setItem("favoriteBooks", JSON.stringify(updated));
      return updated;
    });
  }

 async function handlePurchase() {
    setPaymentStep(4);
    try {
      // Formater le numéro
      let phone = phoneNumber.replace(/\s/g, "");
      if (phone.startsWith("0")) phone = "237" + phone.slice(1);
      if (!phone.startsWith("237")) phone = "237" + phone;

      // Appel via notre fonction serverless (évite CORS)
      const payRes = await fetch("/api/campay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect",
          amount: paymentBook.price,
          phone: phone,
          description: "Achat " + paymentBook.title + " sur CarryBooks",
          external_reference: "CB_" + paymentBook.id + "_" + (user ? user.id : "guest") + "_" + Date.now()
        })
      });
      const payData = await payRes.json();

      if (payData.reference) {
        // Vérifier le statut après 25 secondes
        setTimeout(async () => {
          try {
            const checkRes = await fetch("/api/campay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check", reference: payData.reference })
            });
            const checkData = await checkRes.json();
            if (checkData.status === "SUCCESSFUL") {
              setPaymentStep(5);
              const newP = [...purchasedBooks, paymentBook.id];
              setPurchasedBooks(newP);
              localStorage.setItem("purchasedBooks", JSON.stringify(newP));
              if (user) await supabase.from("purchases").insert([{ user_id: user.id, book_id: paymentBook.id }]);
              cacheBook(paymentBook);
            } else {
              setPaymentStep(6);
            }
          } catch(e) {
            setPaymentStep(6);
          }
        }, 25000);
      } else {
        setPaymentStep(6);
      }
    } catch(e) {
      setPaymentStep(6);
    }
  }

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioPlaying(false);
    setAudioMode(null);
  }

  function playMp3(url) {
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setAudioPlaying(true);
    setAudioMode('mp3');
    audio.onended = () => { setAudioPlaying(false); setAudioMode(null); };
  }

  async function translateText(text, targetLang) {
    setTranslating(true);
    try {
      const chunks = text.match(/.{1,4000}/gs) || [text];
      const results = [];
      for (const chunk of chunks) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(url);
        const data = await res.json();
        const translated = data[0].map(s => s[0]).join("");
        results.push(translated);
      }
      setTranslatedContent(results.join(""));
      setTranslateLang(targetLang);
    } catch(e) {
      alert("Erreur de traduction. Vérifiez votre connexion.");
    }
    setTranslating(false);
  }

  function resetTranslation() {
    setTranslatedContent(null);
    setTranslateLang(null);
  }

  function getPages(content) {
    if (!content) return ["Ce livre n'a pas encore de contenu."];
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    const pages = [];
    let current = "";
    for (const para of paragraphs) {
      if ((current + para).length > 1600 && current.length > 0) {
        pages.push(current.trim());
        current = para + "\n\n";
      } else {
        current += para + "\n\n";
      }
    }
    if (current.trim()) pages.push(current.trim());
    return pages.length > 0 ? pages : ["Ce livre n'a pas encore de contenu."];
  }

  const filteredBooks = books.filter(b => {
    const matchSearch = b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author?.toLowerCase().includes(searchQuery.toLowerCase());
    let matchCat = selectedCategory === "Tous" ||
      b.category === selectedCategory ||
      b.category?.toLowerCase().startsWith(selectedCategory.toLowerCase().replace(/s$/, ""));
    if (selectedCategory === "Livres Gratuits") matchCat = b.price === 0;
    if (selectedCategory === "Livre Audio") matchCat = b.category === "Livre Audio" || !!b.audio_url;
    const matchSub = selectedSubCategory === "Tous" || b.subcategory === selectedSubCategory;
    return matchSearch && matchCat && matchSub;
  });

  const navItems = [
    { id: "home", label: "Accueil" },
    { id: "catalog", label: "Catalogue" },
    { id: "subscription", label: "Abonnement" },
    { id: "library", label: "Ma bibliothèque" },
    { id: "favorites", label: `Favoris${favoriteBooks.length > 0 ? " (" + favoriteBooks.length + ")" : ""}` },
    { id: "quiz", label: "🎯 Quiz" },
    { id: "contact", label: "Contact" },
  ];

  // READER
  if (page === "reader" && reading) {
    // Mode PDF
    if (reading.pdf_url && reading.pdf_url !== "pending") {
      const savedPdfPage = parseInt(localStorage.getItem("pdfProgress_" + reading.id) || "0");
      const maxPage = excerptMode ? (reading.extract_pages || 5) : 9999;
      const startPage = excerptMode ? 1 : (savedPdfPage > 0 ? savedPdfPage : 1);
      // Use excerpt_pdf_url if in excerpt mode and available
      const activePdfUrl = excerptMode && reading.excerpt_pdf_url ? reading.excerpt_pdf_url : reading.pdf_url;
      const pdfSrc = activePdfUrl + "#page=" + startPage;
      return (
        <PdfReader
          reading={reading}
          excerptMode={excerptMode}
          startPage={startPage}
          activePdfUrl={activePdfUrl}
          onBack={() => { setPage(selectedBook ? "detail" : "home"); setReading(null); }}
        />
      );
    }

    const allPages = getPages(translatedContent || reading.content);
    const pages = excerptMode ? allPages.slice(0, 2) : allPages;
    const total = pages.length;

    // In scroll mode, show all paragraphs; in page mode show current page only
    const scrollAllParagraphs = readerScrollMode
      ? pages.flatMap(p => p.split(/\n\n+/).filter(x => x.trim()))
      : (pages[readingPage] ? pages[readingPage].split(/\n\n+/).filter(p => p.trim().length > 0) : []);

    const FONTS = [
      { label: "Georgia", value: "Georgia, serif" },
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Verdana", value: "Verdana, sans-serif" },
      { label: "Palatino", value: "Palatino, serif" },
    ];

    return (
      <div style={{ minHeight: "100vh", background: readerDark ? "#1a1a1a" : "#ffffff", display: "flex", flexDirection: "column", fontFamily: readerFont }}>
        {/* Header */}
        <div style={{ background: readerDark ? "#111" : "#fff", borderBottom: "1px solid " + (readerDark ? "#333" : "#ddd"), padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => { setPage(selectedBook ? "detail" : "home"); setReading(null); }}
            style={{ background: "none", border: "none", color: readerDark ? "#aaa" : "#888", cursor: "pointer", fontSize: 14 }}>
            ← Retour
          </button>
          <span style={{ color: readerDark ? "#ccc" : "#555", fontSize: 13, fontStyle: "italic", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reading.title}
          </span>
          <button onClick={() => setShowReaderSettings(s => !s)}
            style={{ background: "none", border: "1px solid " + (readerDark ? "#444" : "#ddd"), borderRadius: 6, color: readerDark ? "#ccc" : "#888", cursor: "pointer", fontSize: 13, padding: "4px 10px", fontWeight: "bold" }}>
            Aa
          </button>
          {reading.audio_url && (
          <button onClick={() => {
            if (audioPlaying) { stopAudio(); }
            else { playMp3(reading.audio_url); }
          }}
            style={{ background: audioPlaying ? G.gold : "none", border: "1px solid " + (audioPlaying ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, color: audioPlaying ? "#000" : (readerDark ? "#ccc" : "#888"), cursor: "pointer", fontSize: 16, padding: "4px 10px" }}>
            {audioPlaying ? "⏸" : "🔊"}
          </button>
          )}
        </div>

        {/* Panneau paramètres */}
        {showReaderSettings && (
          <div style={{ background: readerDark ? "#222" : "#fafafa", borderBottom: "1px solid " + (readerDark ? "#333" : "#e0e0e0"), padding: "14px 16px" }}>
            {/* Mode jour/nuit */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Mode</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setReaderDark(false)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (!readerDark ? G.gold : "#ddd"), borderRadius: 6, background: !readerDark ? "#fdf8ee" : "#fff", color: !readerDark ? G.gold : "#555", cursor: "pointer", fontSize: 13 }}>
                  ☀️ Jour
                </button>
                <button onClick={() => setReaderDark(true)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (readerDark ? G.gold : "#555"), borderRadius: 6, background: readerDark ? "#333" : "#222", color: readerDark ? G.gold : "#aaa", cursor: "pointer", fontSize: 13 }}>
                  🌙 Nuit
                </button>
              </div>
            </div>
            {/* Taille police */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Taille du texte</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <button onClick={() => setReaderSize(s => Math.max(12, s - 1))}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid " + (readerDark ? "#444" : "#ddd"), background: readerDark ? "#333" : "#fff", fontSize: 18, cursor: "pointer", color: readerDark ? "#ccc" : "#555" }}>−</button>
                <span style={{ fontSize: readerSize, fontFamily: readerFont, flex: 1, textAlign: "center", color: readerDark ? "#ccc" : "#333" }}>Aa ({readerSize}px)</span>
                <button onClick={() => setReaderSize(s => Math.min(24, s + 1))}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid " + (readerDark ? "#444" : "#ddd"), background: readerDark ? "#333" : "#fff", fontSize: 18, cursor: "pointer", color: readerDark ? "#ccc" : "#555" }}>+</button>
              </div>
            </div>
            {/* Police */}
            <div>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Police</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FONTS.map(f => (
                  <button key={f.value} onClick={() => setReaderFont(f.value)}
                    style={{ padding: "6px 12px", border: "1.5px solid " + (readerFont === f.value ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: readerFont === f.value ? (readerDark ? "#333" : "#fdf8ee") : (readerDark ? "#2a2a2a" : "#fff"), color: readerFont === f.value ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13, fontFamily: f.value }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Mode de lecture */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Mode de lecture</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setReaderScrollMode(false)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (!readerScrollMode ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: !readerScrollMode ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: !readerScrollMode ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  📄 Page à page
                </button>
                <button onClick={() => setReaderScrollMode(true)}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (readerScrollMode ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: readerScrollMode ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: readerScrollMode ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  📜 Scroll
                </button>
              </div>
            </div>
            {/* Traduction */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: readerDark ? "#888" : "#aaa", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Traduction</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => translating ? null : (translateLang === "fr" ? resetTranslation() : translateText(reading.content, "fr"))}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (translateLang === "fr" ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: translateLang === "fr" ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: translateLang === "fr" ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  🇫🇷 Français
                </button>
                <button onClick={() => translating ? null : (translateLang === "en" ? resetTranslation() : translateText(reading.content, "en"))}
                  style={{ flex: 1, padding: "8px 0", border: "1.5px solid " + (translateLang === "en" ? G.gold : (readerDark ? "#444" : "#ddd")), borderRadius: 6, background: translateLang === "en" ? (readerDark ? "#333" : "#fdf8ee") : "transparent", color: translateLang === "en" ? G.gold : (readerDark ? "#aaa" : "#555"), cursor: "pointer", fontSize: 13 }}>
                  🇬🇧 English
                </button>
                {translateLang && (
                  <button onClick={resetTranslation}
                    style={{ padding: "8px 12px", border: "1.5px solid " + (readerDark ? "#444" : "#ddd"), borderRadius: 6, background: "transparent", color: readerDark ? "#aaa" : "#555", cursor: "pointer", fontSize: 13 }}>
                    ✕ Original
                  </button>
                )}
              </div>
              {translating && <p style={{ color: G.gold, fontSize: 12, marginTop: 6, textAlign: "center" }}>Traduction en cours...</p>}
            </div>
          </div>
        )}

        {/* Contenu */}
        <div
          onContextMenu={e => e.preventDefault()}
          style={{ flex: 1, padding: "20px 12px 100px 12px", maxWidth: "100%", width: "100%", boxSizing: "border-box", overflowX: "hidden", userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none" }}>
          {scrollAllParagraphs.map(function(para, i) {
            return (
              <p key={i} style={{
                fontFamily: readerFont,
                fontSize: readerSize + "px",
                lineHeight: "1.9",
                color: readerDark ? "#e0e0e0" : "#1a1a1a",
                textAlign: "justify",
                margin: 0,
                marginBottom: "1em",
                textIndent: i === 0 ? "0" : "1.5em",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                userSelect: "none",
                WebkitUserSelect: "none"
              }} dangerouslySetInnerHTML={{ __html: para.trim() }} />
            );
          })}

          {excerptMode && readingPage === total - 1 && (
            <div style={{ marginTop: 48, padding: 24, background: "#fdf8ee", border: "1px solid #e8d5a3", borderRadius: 8, textAlign: "center" }}>
              <div style={{ color: G.gold, fontSize: 15, marginBottom: 8, fontStyle: "italic" }}>— Fin de l'extrait —</div>
              <div style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>Achetez le livre pour lire la suite</div>
              <button onClick={() => { setPage("detail"); setReading(null); }}
                style={{ padding: "11px 28px", background: G.gold, border: "none", borderRadius: 4, color: "#000", fontSize: 13, fontWeight: "bold", cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                Acheter ce livre
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", color: readerDark ? "#555" : "#ccc", fontSize: 13, marginTop: 40, fontFamily: readerFont }}>
            — {readingPage + 1} —
          </div>

        </div>

        {/* Navigation - cachée en mode scroll */}
        {!readerScrollMode && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: readerDark ? "#111" : "#fff", borderTop: "1px solid " + (readerDark ? "#333" : "#e0e0e0"), padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <button onClick={() => { setReadingPage(function(p) { const np = Math.max(0, p - 1); if(reading) localStorage.setItem("readingProgress_" + reading.id, np); return np; }); window.scrollTo(0,0); }} disabled={readingPage === 0}
            style={{ width: 44, height: 44, borderRadius: "50%", background: readingPage === 0 ? (readerDark ? "#222" : "#f5f5f5") : (readerDark ? "#2a2a2a" : "#fdf8ee"), border: "1px solid " + (readingPage === 0 ? (readerDark ? "#333" : "#e0e0e0") : G.gold), color: readingPage === 0 ? (readerDark ? "#444" : "#ccc") : G.gold, fontSize: 22, cursor: readingPage === 0 ? "not-allowed" : "pointer" }}>
            ‹
          </button>
          <input type="range" min={0} max={total - 1} value={readingPage}
            onChange={function(e) { setReadingPage(Number(e.target.value)); window.scrollTo(0,0); }}
            style={{ flex: 1, accentColor: G.gold }} />
          <button onClick={() => { setReadingPage(function(p) { const np = Math.min(total - 1, p + 1); if(reading) localStorage.setItem("readingProgress_" + reading.id, np); return np; }); window.scrollTo(0,0); }} disabled={readingPage === total - 1}
            style={{ width: 44, height: 44, borderRadius: "50%", background: readingPage === total - 1 ? (readerDark ? "#222" : "#f5f5f5") : (readerDark ? "#2a2a2a" : "#fdf8ee"), border: "1px solid " + (readingPage === total - 1 ? (readerDark ? "#333" : "#e0e0e0") : G.gold), color: readingPage === total - 1 ? (readerDark ? "#444" : "#ccc") : G.gold, fontSize: 22, cursor: readingPage === total - 1 ? "not-allowed" : "pointer" }}>
            ›
          </button>
        </div>
        )}
      </div>
    );
  }

    // DETAIL
  if (page === "detail" && selectedBook) {
    const book = selectedBook;
    const free = book.price === 0;
    const owned = hasAccess(book);
    const isFav = favoriteBooks.includes(book.id);
    return (
      <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "Georgia, serif" }}>
        <div style={{ background: G.surface, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #262626", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "none", color: G.gold, cursor: "pointer", fontSize: 13 }}>← Retour</button>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={() => shareBook(book)} style={{ background: "none", border: "none", color: G.textDim, fontSize: 20, cursor: "pointer" }}>🔗</button>
            <button onClick={() => toggleFavorite(book.id)} style={{ background: "none", border: "none", color: isFav ? G.gold : G.textDim, fontSize: 22, cursor: "pointer" }}>{isFav ? "♥" : "♡"}</button>
          </div>
        </div>
        <div style={{ padding: "24px 16px 40px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            {book.cover
              ? <img src={book.cover} alt={book.title} style={{ width: 160, borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }} />
              : <div style={{ width: 160, height: 226, background: G.surface2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📖</div>}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
            {free && <span style={{ background: G.greenDim, color: G.green, fontSize: 10, padding: "3px 10px", borderRadius: 10, letterSpacing: 1 }}>GRATUIT</span>}
            {book.category && <span style={{ background: G.goldDim, color: G.gold, fontSize: 10, padding: "3px 10px", borderRadius: 10, letterSpacing: 1 }}>{book.category}</span>}
          </div>
          <h1 style={{ fontSize: 22, color: G.text, textAlign: "center", marginBottom: 6, lineHeight: 1.3, fontWeight: "bold" }}>{book.title}</h1>
          <p style={{ color: G.textDim, textAlign: "center", fontSize: 13, marginBottom: 16 }}>par <span style={{ color: G.gold }}>{book.author}</span></p>
          <div style={{ textAlign: "center", fontSize: 22, color: free ? G.green : G.gold, fontWeight: "bold", marginBottom: 20 }}>
            {free ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}
          </div>
          {book.summary && (
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Résumé</div>
              <p style={{ color: G.text, lineHeight: 1.8, fontSize: 12, margin: 0, fontStyle: "italic", textAlign: "justify" }}>{book.summary}</p>
            </div>
          )}
          {/* ⭐ Ratings */}
          {(() => {
            const r = bookRatings[book.id] || { avg: 0, count: 0, userRating: 0 };
            return (
              <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: "bold", color: G.gold }}>{r.count > 0 ? r.avg.toFixed(1) : "—"}</span>
                    <div>
                      <div style={{ display: "flex", gap: 2 }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ fontSize: 14, color: s <= Math.round(r.avg) ? "#f5c518" : G.border }}>★</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: G.textFaint }}>{r.count} avis</div>
                    </div>
                  </div>
                  {owned || free ? (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: G.textDim, marginBottom: 4 }}>Ton avis</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => submitRating(book.id, s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: s <= r.userRating ? "#f5c518" : G.border, padding: 0 }}>★</button>
                        ))}
                      </div>
                    </div>
                  ) : <div style={{ fontSize: 11, color: G.textFaint, textAlign: "right" }}>Achète pour<br/>laisser un avis</div>}
                </div>
              </div>
            );
          })()}

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button onClick={() => startReading(book, true)}
              style={{ flex: 1, padding: "12px 8px", background: "none", border: "1.5px solid " + G.gold, borderRadius: 6, color: G.gold, cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" }}>
              📄 Extrait
            </button>
            <button onClick={() => toggleFavorite(book.id)}
              style={{ flex: 1, padding: "12px 8px", background: isFav ? G.goldDim : "none", border: "1.5px solid " + (isFav ? G.gold : G.border), borderRadius: 6, color: isFav ? G.gold : G.textDim, cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              {isFav ? "♥ Favoris" : "♡ Favoris"}
            </button>
            <button onClick={() => shareBook(book)}
              style={{ flex: 1, padding: "12px 8px", background: "none", border: "1.5px solid " + G.border, borderRadius: 6, color: G.textDim, cursor: "pointer", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              🔗 Partager
            </button>
          </div>
          <button
            onClick={() => startReading(book)}
            style={{ width: "100%", padding: 15, background: G.gold, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold" }}>
            {owned || free ? "📖 Lire maintenant" : (subscription && subscription.status === "actif" && booksLeftThisMonth() > 0) ? "✨ Débloquer avec mon abonnement" : "💳 Acheter — " + book.price?.toLocaleString() + " FCFA"}
          </button>

          {(owned || free) && (
            <button onClick={() => { cacheBook(book); alert("✅ Livre sauvegardé pour la lecture hors connexion !"); }}
              style={{ width: "100%", padding: 11, background: cachedBooks[book.id] ? G.surface2 : "transparent", border: "1px solid " + (cachedBooks[book.id] ? G.border : G.gold), borderRadius: 6, color: cachedBooks[book.id] ? G.textDim : G.gold, cursor: "pointer", fontSize: 13, marginTop: 8 }}>
              {cachedBooks[book.id] ? "✅ Disponible hors connexion" : "📥 Télécharger hors connexion"}
            </button>
          )}
        </div>

        {/* PAYMENT MODAL in detail page */}
        {showPayment && paymentBook && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
            <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid #e0e0e0" }}>
              {paymentStep === 1 && (
                <>
                  <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
                  {paymentBook.coverUrl && (
                    <div style={{ textAlign: "center", marginBottom: 14 }}>
                      <img src={paymentBook.coverUrl} alt={paymentBook.title} style={{ height: 110, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} />
                    </div>
                  )}
                  <h3 style={{ color: "#1a1a1a", marginBottom: 6, fontSize: 17, textAlign: "center" }}>{paymentBook.title}</h3>
                  <p style={{ color: "#888", fontSize: 13, marginBottom: 6, textAlign: "center" }}>par {paymentBook.author || "Auteur"}</p>
                  <div style={{ background: "#fff8e1", padding: "10px 14px", borderRadius: 8, marginBottom: 18, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#7a5c00", marginBottom: 4 }}>Prix du livre</div>
                    <div style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a1a" }}>{paymentBook.price?.toLocaleString()} FCFA</div>
                  </div>
                  <button onClick={() => setPaymentStep(2)} style={{
                    width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
                  }}>
                    💎 Continuer vers le paiement
                  </button>
                  <button onClick={() => { setShowPayment(false); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>Annuler</button>
                </>
              )}
              {paymentStep === 2 && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 14 }}>💳</div>
                  <h3 style={{ color: "#1a1a1a", marginBottom: 8, fontSize: 16 }}>Choisis ta méthode</h3>
                  <p style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>Avec quel opérateur veux-tu payer ?</p>
                  <button onClick={() => { setPaymentMethod("mtn"); setPaymentStep(3); }} style={{
                    width: "100%", padding: 16, marginBottom: 10, background: "#FFCC00", color: "#000",
                    border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
                  }}>📱 MTN Mobile Money</button>
                  <button onClick={() => { setPaymentMethod("orange"); setPaymentStep(3); }} style={{
                    width: "100%", padding: 16, marginBottom: 14, background: "#FF6600", color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
                  }}>📱 Orange Money</button>
                  <button onClick={() => setPaymentStep(1)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>← Retour</button>
                </div>
              )}
              {paymentStep === 3 && (
                <div style={{ padding: "10px 0" }}>
                  <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16, textAlign: "center" }}>Entre ton numéro</h3>
                  <p style={{ color: "#888", fontSize: 12, marginBottom: 16, textAlign: "center" }}>{paymentMethod === "mtn" ? "📱 MTN Mobile Money" : "📱 Orange Money"}</p>
                  <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="Ex : 671234567"
                    style={{ width: "100%", padding: "14px", background: "#f5f5f5", border: "2px solid #ddd", borderRadius: 10, color: "#1a1a1a", fontSize: 16, marginBottom: 10, textAlign: "center", boxSizing: "border-box" }} />
                  <p style={{ color: "#aaa", fontSize: 11, marginBottom: 16, textAlign: "center" }}>Sans le 237, juste tes 9 chiffres</p>
                  <button onClick={handlePurchase} disabled={!phoneNumber || phoneNumber.length < 8}
                    style={{ width: "100%", padding: 14, background: phoneNumber && phoneNumber.length >= 8 ? "#1a1a1a" : "#ccc", border: "none", borderRadius: 10, color: "#fff", fontWeight: "bold", cursor: phoneNumber && phoneNumber.length >= 8 ? "pointer" : "not-allowed", fontSize: 14, marginBottom: 10 }}>
                    💎 Payer {paymentBook.price?.toLocaleString()} FCFA
                  </button>
                  <button onClick={() => setPaymentStep(2)} style={{ width: "100%", background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: 8 }}>← Retour</button>
                </div>
              )}
              {paymentStep === 4 && (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
                  <h3 style={{ color: "#1a1a1a", marginBottom: 12, fontSize: 16 }}>Paiement en cours...</h3>
                  <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, textAlign: "left", marginBottom: 16 }}>
                    <p style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: "bold" }}>
                      ⚠️ Ne quittez pas cet écran, veuillez patienter jusqu'à la finalisation.
                    </p>
                  </div>
                  <p style={{ color: "#666", fontSize: 12, lineHeight: 1.5 }}>
                    Confirme la transaction sur ton téléphone.<br/>
                    Cela peut prendre jusqu'à 30 secondes.
                  </p>
                </div>
              )}
              {paymentStep === 5 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                  <h3 style={{ color: G.gold, marginBottom: 8, fontSize: 18 }}>Paiement réussi !</h3>
                  <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>{paymentBook.title} est à toi 📚</p>
                  <button onClick={() => { setShowPayment(false); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); startReading(paymentBook); }}
                    style={{ width: "100%", padding: 14, background: G.gold, border: "none", borderRadius: 10, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>
                    📖 Lire maintenant
                  </button>
                </div>
              )}
              {paymentStep === 6 && (
                <div style={{ padding: "24px 0" }}>
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
                    <h3 style={{ color: "#c62828", marginBottom: 8, fontSize: 17 }}>Paiement non finalisé</h3>
                    <p style={{ color: "#888", fontSize: 13 }}>Le réseau de l'opérateur est peut-être occupé.</p>
                  </div>
                  <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, marginBottom: 18 }}>
                    <p style={{ color: "#7a4a00", fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 0 }}>💡 Essaie ces solutions :</p>
                    <p style={{ color: "#7a4a00", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                      ✅ Vérifie ton solde Mobile Money<br/>
                      ✅ Réessaie avec l'autre opérateur (MTN/Orange)<br/>
                      ✅ Patiente quelques minutes et réessaie<br/>
                      ✅ Vérifie ta connexion internet
                    </p>
                  </div>
                  <button onClick={() => { setPaymentStep(2); setPaymentMethod(null); setPhoneNumber(""); }} style={{
                    width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
                  }}>
                    🔁 Réessayer
                  </button>
                  <button onClick={() => { setShowPayment(false); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // HOME / CATALOG / LIBRARY / FAVORITES
  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "Georgia, serif" }}>
      <style>{`* { box-sizing: border-box; } input, select { outline: none; } ::-webkit-scrollbar { display: none; }`}</style>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(245,240,232,0.97)", borderBottom: "1px solid " + G.navBorder, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div onClick={() => { setPage("home"); setShowMenu(false); }} style={{ cursor: "pointer" }}>
          <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 40, borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {!isOnline && <span style={{ fontSize: 10, background: "#3a2a00", color: G.gold, padding: "3px 8px", borderRadius: 10 }}>📴</span>}
          {user
            ? <img src={user.user_metadata?.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid " + G.gold, cursor: "pointer" }} onClick={() => setShowMenu(m => !m)} />
            : <button onClick={() => setShowAuthModal(true)} style={{ background: G.gold, border: "none", borderRadius: 6, color: "#000", fontSize: 12, fontWeight: "bold", padding: "6px 12px", cursor: "pointer" }}>Connexion</button>
          }
          {page === "home" && (
            <button onClick={() => setPage("catalog")} style={{ background: "none", border: "none", color: G.text, fontSize: 20, cursor: "pointer", padding: 4 }}>
              🔍
            </button>
          )}
          <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", color: "#1a1208", fontSize: 28, cursor: "pointer", padding: 4 }}>
            {showMenu ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* BOUTON RETOUR GLOBAL (sur toutes les pages sauf accueil) */}
      {page !== "home" && !showMenu && (
        <div style={{ position: "sticky", top: 56, zIndex: 49, background: G.surface, borderBottom: "1px solid " + G.border, padding: "10px 16px" }}>
          <button onClick={() => { setPage("home"); setSelectedCategory("Tous"); setSelectedSubCategory("Tous"); setSearchQuery(""); }} style={{
            background: "none", border: "none", color: G.gold, fontSize: 14, fontWeight: "bold",
            cursor: "pointer", padding: "4px 0", display: "flex", alignItems: "center", gap: 6
          }}>
            ← Retour à l'accueil
          </button>
        </div>
      )}

      {/* MENU */}
      {showMenu && (
        <div style={{ position: "fixed", top: 56, left: 0, right: 0, bottom: 0, zIndex: 99, background: "rgba(0,0,0,0.95)" }} onClick={() => setShowMenu(false)}>
          <div style={{ background: G.navSurface, borderBottom: "1px solid " + G.navBorder }} onClick={e => e.stopPropagation()}>
            {user && (
              <div style={{ padding: "16px 24px", borderBottom: "1px solid " + G.navBorder, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <img src={user.user_metadata?.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                <div>
                  <div style={{ fontSize: 14, color: G.navText, fontWeight: "bold" }}>{user.user_metadata?.full_name || user.email}</div>
                  <div style={{ fontSize: 11, color: G.textDim }}>{user.email}</div>
                </div>
              </div>
            )}
            {navItems.map(item => (
              <div key={item.id} onClick={() => { setPage(item.id); setShowMenu(false); }}
                style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: page === item.id ? G.gold : G.navText, borderLeft: "3px solid " + (page === item.id ? G.gold : "transparent"), background: page === item.id ? G.goldDim : "transparent", borderBottom: "1px solid " + G.navBorder }}>
                {item.label}
              </div>
            ))}
            {user
              ? <div onClick={() => { signOut(); setShowMenu(false); }} style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: "#e53935", borderBottom: "1px solid " + G.navBorder }}>🚪 Se déconnecter</div>
              : <div onClick={() => { signInWithGoogle(); setShowMenu(false); }} style={{ padding: "18px 24px", cursor: "pointer", fontSize: 15, color: G.gold, borderBottom: "1px solid " + G.navBorder }}>🔑 Se connecter avec Google</div>
            }
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && authChecked && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 340, textAlign: "center", border: "1px solid #e0d8c8" }}>
            <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 48, marginBottom: 20 }} />
            <h2 style={{ color: G.text, fontSize: 18, marginBottom: 8 }}>Bienvenue sur CarryBooks 📚</h2>
            <p style={{ color: G.textDim, fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>Connecte-toi en un clic avec Google pour :</p>
            <div style={{ textAlign: "left", marginBottom: 24, padding: "0 8px" }}>
              <div style={{ fontSize: 13, color: G.text, marginBottom: 6 }}>✅ Accéder à tes livres depuis n'importe quel appareil</div>
              <div style={{ fontSize: 13, color: G.text, marginBottom: 6 }}>✅ Ne jamais perdre tes achats</div>
              <div style={{ fontSize: 13, color: G.text }}>✅ Sans mot de passe</div>
            </div>
            <button onClick={signInWithGoogle}
              style={{ width: "100%", padding: "14px 0", background: "#fff", border: "2px solid " + G.gold, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "bold", color: "#333", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 18 }} />
              Continuer avec Google
            </button>
            <button onClick={() => setShowAuthModal(false)} style={{ background: "none", border: "none", color: G.textFaint, cursor: "pointer", fontSize: 12 }}>Continuer sans compte →</button>
          </div>
        </div>
      )}

      <div style={{ paddingTop: 56 }}>
        {/* HERO */}
        {/* SEARCH + CATEGORIES - caché sur home Netflix */}
        {(page === "catalog" || searchQuery || selectedCategory !== "Tous" || page !== "home") && (
        <div style={{ padding: "14px 16px 8px", background: G.bg, position: "sticky", top: 56, zIndex: 9, borderBottom: "1px solid " + G.border }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un livre ou auteur..."
            style={{ width: "100%", padding: "11px 14px", background: "#fff", border: "1px solid " + G.border, borderRadius: 8, color: G.text, fontSize: 14, fontFamily: "Georgia, serif", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            <button onClick={() => { setSelectedCategory("Tous"); setSelectedSubCategory("Tous"); }}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1px solid " + (selectedCategory === "Tous" ? G.gold : G.border), background: selectedCategory === "Tous" ? G.goldDim : "transparent", color: selectedCategory === "Tous" ? G.gold : G.textDim, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              Tous
            </button>
            {Object.keys(CATEGORIES).map(cat => (
              <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedSubCategory("Tous"); }}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1px solid " + (selectedCategory === cat ? G.gold : G.border), background: selectedCategory === cat ? G.goldDim : "transparent", color: selectedCategory === cat ? G.gold : G.textDim, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                {cat}
              </button>
            ))}
          </div>
          {selectedCategory !== "Tous" && CATEGORIES[selectedCategory] && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginTop: 6 }}>
              <button onClick={() => setSelectedSubCategory("Tous")}
                style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 20, border: "1px solid " + (selectedSubCategory === "Tous" ? G.goldLight : G.border), background: selectedSubCategory === "Tous" ? G.goldDim : "transparent", color: selectedSubCategory === "Tous" ? G.gold : G.textFaint, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                Tous
              </button>
              {CATEGORIES[selectedCategory].map(sub => (
                <button key={sub} onClick={() => setSelectedSubCategory(sub)}
                  style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 20, border: "1px solid " + (selectedSubCategory === sub ? G.goldLight : G.border), background: selectedSubCategory === sub ? G.goldDim : "transparent", color: selectedSubCategory === sub ? G.gold : G.textFaint, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* BOOKS GRID - Netflix style for home, grid for catalog */}
        {(page === "home" || page === "catalog") && (
          <div style={{ paddingBottom: 80 }}>
            {page === "home" && !searchQuery && selectedCategory === "Tous" ? (
              <>
                {/* HERO CAROUSEL */}
                {(() => {
                  const featuredBooks = books.filter(b => b.featured);
                  const heroBooks = featuredBooks.length > 0 ? featuredBooks : books.slice(0, 5);
                  if (heroBooks.length === 0) return null;
                  const featuredBook = heroBooks[heroIndex % heroBooks.length];
                  return (
                    <div style={{ position: "relative", width: "100%", height: 420, overflow: "hidden", marginBottom: 24 }}>
                      {heroBooks.map((book, idx) => (
                        <div key={book.id} onClick={() => openBook(book)}
                          style={{ position: "absolute", inset: 0, cursor: "pointer", opacity: idx === (heroIndex % heroBooks.length) ? 1 : 0, transition: "opacity 0.8s ease" }}>
                          {book.cover
                            ? <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", background: G.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>📖</div>}
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(245,240,232,0.7) 70%, " + G.bg + " 100%)" }} />
                        </div>
                      ))}
                      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
                        <button onClick={e => { e.stopPropagation(); shareBook(featuredBook); }}
                          style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                          🔗
                        </button>
                      </div>
                      <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 2 }}>
                        <div style={{ fontSize: 10, color: G.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>★ À la une</div>
                        <div style={{ fontSize: 22, fontWeight: "bold", color: G.text, marginBottom: 4, lineHeight: 1.2 }}>{featuredBook.title}</div>
                        <div style={{ fontSize: 13, color: G.textDim, marginBottom: 12 }}>par {featuredBook.author}</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <button onClick={e => { e.stopPropagation(); openBook(featuredBook); }}
                            style={{ padding: "10px 20px", background: G.gold, border: "none", borderRadius: 4, color: "#000", fontSize: 12, fontWeight: "bold", cursor: "pointer", letterSpacing: 1 }}>
                            Découvrir
                          </button>
                          <button onClick={e => { e.stopPropagation(); toggleFavorite(featuredBook.id); }}
                            style={{ padding: "10px 16px", background: "rgba(255,255,255,0.7)", border: "1px solid " + G.border, borderRadius: 4, color: G.text, fontSize: 14, cursor: "pointer" }}>
                            {favoriteBooks.includes(featuredBook.id) ? "♥" : "♡"}
                          </button>
                          <button onClick={e => { e.stopPropagation(); shareBook(featuredBook); }}
                            style={{ padding: "10px 16px", background: "rgba(255,255,255,0.7)", border: "1px solid " + G.border, borderRadius: 4, color: G.text, fontSize: 14, cursor: "pointer" }}>
                            🔗
                          </button>
                        </div>
                        {heroBooks.length > 1 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                            {heroBooks.map((_, idx) => (
                              <div key={idx} onClick={e => { e.stopPropagation(); setHeroIndex(idx); }}
                                style={{ width: idx === (heroIndex % heroBooks.length) ? 20 : 6, height: 6, borderRadius: 3, background: idx === (heroIndex % heroBooks.length) ? G.gold : "rgba(201,168,76,0.4)", cursor: "pointer", transition: "all 0.3s" }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* HERO BUTTONS */}
                <div style={{ display: "flex", gap: 0, margin: "0 0 20px 0" }}>
                  {/* Install button — hidden once app is installed */}
                  {!window.matchMedia("(display-mode: standalone)").matches && (
                    <button onClick={async () => {
                      if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === "accepted") setDeferredPrompt(null);
                      } else {
                        setShowInstallModal(true);
                      }
                    }} style={{ flex: 1, padding: "14px 6px", background: G.gold, border: "none", color: "#1a1208", fontWeight: "bold", fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderRight: "1px solid rgba(0,0,0,0.1)" }}>
                      <span style={{ fontSize: 20 }}>📲</span>
                      <span style={{ lineHeight: 1.2, textAlign: "center" }}>Installer CarryBooks</span>
                    </button>
                  )}
                  <button onClick={() => setPage("library")} style={{ flex: 1, padding: "14px 6px", background: G.surface, border: "none", borderLeft: window.matchMedia("(display-mode: standalone)").matches ? "none" : "1px solid " + G.border, color: G.text, fontWeight: "bold", fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 20 }}>📚</span>
                    <span style={{ lineHeight: 1.2, textAlign: "center" }}>Ma Bibliotheque</span>
                  </button>
                  <button onClick={() => { setPage("carrycare"); setCarryCarePage("home"); }} style={{ flex: 1, padding: "14px 6px", background: "#f5d7d9", border: "none", borderLeft: "1px solid " + G.border, color: "#1a1a1a", fontWeight: "bold", fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 20 }}>🌸</span>
                    <span style={{ lineHeight: 1.2, textAlign: "center" }}>CarryCare</span>
                  </button>
                  <button onClick={() => { setPage("quiz"); setQuizPage("quizHome"); setQuizCategory("Tous"); }} style={{ flex: 1, padding: "14px 6px", background: G.surface, border: "none", borderLeft: "1px solid " + G.border, color: G.text, fontWeight: "bold", fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 20 }}>🎯</span>
                    <span style={{ lineHeight: 1.2, textAlign: "center" }}>Carry'Quiz</span>
                  </button>
                </div>

                {/* NOUVEAUTÉS */}
                {books.slice(0, 10).length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: G.text, padding: "0 16px", marginBottom: 12 }}>Nouveautés</div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
                      {books.slice(0, 10).map(book => (
                        <div key={book.id} onClick={() => openBook(book)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                          <div style={{ width: 110, height: 155, background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                            {book.cover
                              ? <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>📖</div>}
                            {book.price === 0 && <div style={{ position: "absolute", top: 4, left: 4, background: G.green, color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 6 }}>GRATUIT</div>}
                          </div>
                          <div style={{ fontSize: 11, color: G.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</div>
                          <div style={{ fontSize: 9, color: G.textFaint, marginTop: 1 }}>{book.can_download ? "⬇️ Téléchargeable" : "📖 Liseuse"}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: 10, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>{book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " F"}</span>
                            {bookRatings[book.id] && bookRatings[book.id].count > 0 && (
                              <span style={{ fontSize: 9, color: "#f5c518" }}>{"★ " + bookRatings[book.id].avg.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CARROUSELS PAR CATÉGORIE */}
                {Object.keys(CATEGORIES).map(cat => {
                  const catBooks = books.filter(b => b.category === cat || b.category?.toLowerCase().startsWith(cat.toLowerCase().replace(/s$/, "")));
                  if (catBooks.length === 0) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 28 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: G.text }}>{cat}</div>
                        <button onClick={() => { setSelectedCategory(cat); setPage("catalog"); }}
                          style={{ fontSize: 12, color: G.gold, background: "none", border: "none", cursor: "pointer" }}>Tout voir →</button>
                      </div>
                      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
                        {catBooks.map(book => (
                          <div key={book.id} onClick={() => openBook(book)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                            <div style={{ width: 110, height: 155, background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                              {book.cover
                                ? <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>📖</div>}
                              {book.price === 0 && <div style={{ position: "absolute", top: 4, left: 4, background: G.green, color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 6 }}>GRATUIT</div>}
                            </div>
                            <div style={{ fontSize: 11, color: G.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</div>
                            <div style={{ fontSize: 9, color: G.textFaint, marginTop: 1 }}>{book.can_download ? "⬇️ Téléchargeable" : "📖 Liseuse"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: 10, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>{book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " F"}</span>
                            {bookRatings[book.id] && bookRatings[book.id].count > 0 && (
                              <span style={{ fontSize: 9, color: "#f5c518" }}>{"★ " + bookRatings[book.id].avg.toFixed(1)}</span>
                            )}
                          </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* MES FAVORIS */}
                {favoriteBooks.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: G.text, padding: "0 16px", marginBottom: 12 }}>Mes favoris</div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
                      {books.filter(b => favoriteBooks.includes(b.id)).map(book => (
                        <div key={book.id} onClick={() => openBook(book)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                          <div style={{ width: 110, height: 155, background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                            {book.cover && <img src={book.cover} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            <div style={{ position: "absolute", top: 4, right: 4, color: G.gold, fontSize: 14 }}>♥</div>
                          </div>
                          <div style={{ fontSize: 11, color: G.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{book.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "20px 16px 80px" }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 16 }}>
                  {searchQuery ? "Résultats" : selectedCategory !== "Tous" ? selectedCategory : "Catalogue"}
                  {!loading && <span style={{ color: G.textFaint, marginLeft: 8, fontSize: 11, letterSpacing: 0 }}>({filteredBooks.length})</span>}
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: G.textDim }}>Chargement...</div>
                ) : filteredBooks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: G.textFaint }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                    <div style={{ color: G.textDim, fontSize: 15, fontStyle: "italic" }}>Projet en cours,<br />revenez dans quelques jours ✨</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {filteredBooks.map(book => (
                      <div key={book.id} onClick={() => openBook(book)} style={{ cursor: "pointer" }}>
                        <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                          {book.cover
                            ? <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: G.textFaint }}>📖</div>}
                          {book.price === 0 && <div style={{ position: "absolute", top: 8, left: 8, background: G.green, color: "#fff", fontSize: 9, padding: "2px 8px", borderRadius: 8, fontWeight: "bold", letterSpacing: 1 }}>GRATUIT</div>}
                        </div>
                        <div style={{ fontSize: 13, color: G.text, marginBottom: 3, lineHeight: 1.3 }}>{book.title}</div>
                        <div style={{ fontSize: 11, color: G.textDim, marginBottom: 4 }}>{book.can_download ? "⬇️ Téléchargeable" : "📖 Liseuse"}</div>
                        <div style={{ fontSize: 13, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>
                          {book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BIBLIOTHEQUE */}
        {page === "library" && (
          <LibraryPage books={books} purchasedBooks={purchasedBooks} purchaseHistory={purchaseHistory} startReading={startReading} setPage={setPage} G={G} />
        )}

        {/* FAVORIS */}
        {page === "favorites" && (
          <div style={{ padding: "20px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 4 }}>Favoris</div>
            <p style={{ color: G.textFaint, fontSize: 12, marginBottom: 20 }}>{favoriteBooks.length === 0 ? "Aucun favori" : favoriteBooks.length + " livre" + (favoriteBooks.length > 1 ? "s" : "")}</p>
            {favoriteBooks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", border: "1px dashed " + G.border, borderRadius: 8 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>♡</div>
                <div style={{ color: G.textDim }}>Aucun livre dans vos favoris</div>
                <button onClick={() => setPage("home")} style={{ padding: "10px 20px", background: "none", border: "1px solid " + G.gold, borderRadius: 4, color: G.gold, fontSize: 12, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase", marginTop: 16 }}>Parcourir</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {books.filter(b => favoriteBooks.includes(b.id)).map(book => (
                  <div key={book.id} style={{ cursor: "pointer" }} onClick={() => openBook(book)}>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "141%", background: G.surface, borderRadius: 0, overflow: "hidden", marginBottom: 8 }}>
                      {book.cover && <img src={book.cover} alt={book.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
                      <div style={{ position: "absolute", top: 8, right: 8, color: G.gold, fontSize: 16 }}>♥</div>
                    </div>
                    <div style={{ fontSize: 12, color: G.text, marginBottom: 2, lineHeight: 1.3 }}>{book.title}</div>
                    <div style={{ fontSize: 10, color: G.textDim, marginBottom: 4 }}>{book.author}</div>
                    <div style={{ fontSize: 12, color: book.price === 0 ? G.green : G.gold, fontWeight: "bold" }}>{book.price === 0 ? "Gratuit" : book.price?.toLocaleString() + " FCFA"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

        {/* ABONNEMENT */}
        {page === "subscription" && (
          <div style={{ padding: "24px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 4 }}>Abonnement</div>
            <p style={{ color: G.textDim, fontSize: 13, marginBottom: 24 }}>Accédez à {subSettings.books_per_month} livres par mois pour un tarif fixe.</p>

            {/* Abonnement actif */}
            {subscription && (
              <div style={{ background: G.goldDim, border: "2px solid " + G.gold, borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>✅ Abonnement actif</div>
                <div style={{ fontSize: 15, color: G.text, fontWeight: "bold", marginBottom: 4 }}>Plan {subscription.plan}</div>
                <div style={{ fontSize: 13, color: G.textDim, marginBottom: 4 }}>Expire le {new Date(subscription.expires_at).toLocaleDateString("fr-FR")}</div>
                <div style={{ fontSize: 13, color: G.text }}>📚 {booksLeftThisMonth()} livre{booksLeftThisMonth() > 1 ? "s" : ""} restant{booksLeftThisMonth() > 1 ? "s" : ""} ce mois</div>
              </div>
            )}

            {/* Offre Mensuel uniquement */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ border: "2px solid " + G.gold, borderRadius: 12, padding: 20, background: G.goldDim }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: G.text, marginBottom: 4 }}>Abonnement Mensuel</div>
                    <div style={{ fontSize: 13, color: G.textDim }}>{subSettings.books_per_month} livres par mois</div>
                    <div style={{ fontSize: 11, color: G.textFaint, marginTop: 4 }}>Sans engagement — résiliable à tout moment</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: "bold", color: G.gold }}>{subSettings.monthly_price?.toLocaleString()} F</div>
                    <div style={{ fontSize: 11, color: G.textDim }}>/ mois</div>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => { if (!user) { setShowAuthModal(true); return; } setShowSubModal(true); setSubPaymentStep(1); setSubPaymentMethod(null); setSubPhone(""); }}
              style={{ width: "100%", padding: 15, background: G.gold, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold" }}>
              {subscription ? "Renouveler l'abonnement" : "S'abonner maintenant"}
            </button>

            <div style={{ marginTop: 24, padding: 16, background: G.surface, borderRadius: 8, border: "1px solid " + G.border }}>
              <div style={{ fontSize: 13, color: G.text, fontWeight: "bold", marginBottom: 12 }}>✅ Ce que comprend l'abonnement :</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 8 }}>📚 {subSettings.books_per_month} livres de ton choix chaque mois</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 8 }}>📱 Lecture sur tous tes appareils</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 8 }}>🔄 Accès immédiat après paiement</div>
              <div style={{ fontSize: 13, color: G.textDim }}>💳 Tu peux aussi acheter des livres hors quota</div>
            </div>
          </div>
        )}

        {/* CONTACT */}
        {page === "contact" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>Contact</div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>EMAIL</div>
              <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.text, fontSize: 15, textDecoration: "none" }}>carrybooks.com@gmail.com</a>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>WHATSAPP</div>
              <a href="https://chat.whatsapp.com/CarryBooks" target="_blank" rel="noreferrer" style={{ color: G.gold, fontSize: 14 }}>Rejoindre le groupe WhatsApp</a>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>SUPPORT</div>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                Pour toute question ou problème, écrivez-nous à <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.gold }}>carrybooks.com@gmail.com</a>. Nous répondons sous 24h.
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        {page === "faq" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>FAQ</div>
            {[
              { q: "Comment acheter un livre ?", r: "Clique sur le livre de ton choix, puis sur le bouton Acheter. Paye avec MTN MoMo ou Orange Money. Le livre est disponible immédiatement après paiement." },
              { q: "Qu'est-ce que l'abonnement ?", r: "L'abonnement mensuel te donne accès à un certain nombre de livres par mois pour un prix fixe. Tu peux aussi acheter des livres en dehors de ton quota." },
              { q: "Puis-je lire hors connexion ?", r: "Oui ! Après avoir acheté un livre, clique sur 'Télécharger hors connexion' sur la page du livre pour le sauvegarder sur ton appareil." },
              { q: "Mes achats sont-ils sauvegardés ?", r: "Oui, en te connectant avec Google, tous tes achats sont synchronisés et accessibles depuis n'importe quel appareil." },
              { q: "Comment contacter le support ?", r: "Écris-nous à carrybooks.com@gmail.com. Nous répondons sous 24h." },
            ].map((item, i) => (
              <div key={i} style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: "bold", color: G.text, marginBottom: 8 }}>❓ {item.q}</div>
                <p style={{ color: G.textDim, fontSize: 13, lineHeight: 1.7, margin: 0 }}>{item.r}</p>
              </div>
            ))}
          </div>
        )}

        {/* À PROPOS */}
        {page === "about" && (
          <div style={{ padding: "32px 16px 80px" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: G.gold, textTransform: "uppercase", marginBottom: 24 }}>À propos de nous</div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 60, borderRadius: 8, marginBottom: 12 }} />
              <p style={{ color: G.gold, fontSize: 13, fontStyle: "italic", letterSpacing: 1 }}>Lis. Apprends. Évolue.</p>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.9, margin: 0 }}>
                CarryBooks est la première librairie numérique africaine pensée pour les lecteurs camerounais et africains. Notre mission est de rendre la lecture accessible à tous, partout en Afrique, depuis son téléphone.
              </p>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>NOTRE VISION</div>
              <p style={{ color: G.textDim, fontSize: 14, lineHeight: 1.9, margin: 0 }}>
                Faire de l'Afrique un continent de lecteurs numériques, en proposant des œuvres africaines et internationales accessibles via Mobile Money.
              </p>
            </div>
            <div style={{ background: G.surface, border: "1px solid " + G.border, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: G.gold, letterSpacing: 1, marginBottom: 8 }}>CARRYBOOKS EN CHIFFRES</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 8 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: G.gold }}>{books.length}+</div>
                  <div style={{ fontSize: 11, color: G.textFaint }}>Livres disponibles</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: G.gold }}>🌍</div>
                  <div style={{ fontSize: 11, color: G.textFaint }}>Afrique & Monde</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {page === "quiz" && (
          <div style={{ padding: "0 0 80px" }}>
            {quizPage === "quizHome" && <QuizHome setActiveQuiz={setActiveQuiz} setQuizPage={setQuizPage} setQuizAnswers={setQuizAnswers} setCurrentQuestion={setCurrentQuestion} quizCategory={quizCategory} setQuizCategory={setQuizCategory} G={G} quizPrice={quizPrice} setPage={setPage} setCarryCarePage={setCarryCarePage} />}
            {quizPage === "quizPlay" && activeQuiz && <QuizPlay quiz={activeQuiz} answers={quizAnswers} setAnswers={setQuizAnswers} currentQ={currentQuestion} setCurrentQ={setCurrentQuestion} setQuizPage={setQuizPage} setQuizResult={setQuizResult} G={G} setPage={setPage} />}
            {quizPage === "quizSuspense" && <QuizSuspense setQuizPage={setQuizPage} G={G} />}
            {quizPage === "quizPayment" && <QuizPayment quiz={activeQuiz} quizResult={quizResult} quizPaymentStep={quizPaymentStep} setQuizPaymentStep={setQuizPaymentStep} quizPhone={quizPhone} setQuizPhone={setQuizPhone} quizPaymentMethod={quizPaymentMethod} setQuizPaymentMethod={setQuizPaymentMethod} setQuizPage={setQuizPage} G={G} quizPrice={quizPrice} />}
            {quizPage === "quizResult" && <QuizResult quiz={activeQuiz} result={quizResult} setQuizPage={setQuizPage} G={G} setActiveQuiz={setActiveQuiz} setQuizAnswers={setQuizAnswers} setCurrentQuestion={setCurrentQuestion} />}
          </div>
        )}

        {page === "carrycare" && (
          <div>
            {carryCarePage === "home" && (
              <CarryCareHome
                setPage={setPage}
                setCarryCarePage={setCarryCarePage}
                setBfStep={setBfStep}
                setBfTypeAnswers={setBfTypeAnswers}
                setBfProblems={setBfProblems}
                setBfLifestyle={setBfLifestyle}
                setBfResult={setBfResult}
              />
            )}
            {carryCarePage === "facialQuiz" && (
              <BeautyFacialQuiz
                setPage={setPage}
                setCarryCarePage={setCarryCarePage}
                bfStep={bfStep} setBfStep={setBfStep}
                bfTypeAnswers={bfTypeAnswers} setBfTypeAnswers={setBfTypeAnswers}
                bfProblems={bfProblems} setBfProblems={setBfProblems}
                bfLifestyle={bfLifestyle} setBfLifestyle={setBfLifestyle}
                bfResult={bfResult} setBfResult={setBfResult}
                beautyQuizPrice={beautyQuizPrice}
                bfPaymentStep={bfPaymentStep} setBfPaymentStep={setBfPaymentStep}
                bfPaymentPhone={bfPaymentPhone} setBfPaymentPhone={setBfPaymentPhone}
                bfPaymentMethod={bfPaymentMethod} setBfPaymentMethod={setBfPaymentMethod}
              />
            )}
          </div>
        )}


        {/* CARRY'QUIZ WIDGET — compact 3 lines */}
        {page === "home" && (
          <div style={{ padding: "12px 16px 0", background: G.bg }}>
            <div style={{ background: "linear-gradient(135deg, #1a1208 0%, #3d2b0a 100%)", borderRadius: 12, padding: "12px 14px", border: "1px solid " + G.gold, textAlign: "center" }}>
              {/* Line 1: Logo + Title */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>🎯</span>
                <span style={{ fontSize: 15, fontWeight: "bold", color: G.gold, fontFamily: "Georgia, serif" }}>Carry'Quiz</span>
              </div>
              {/* Line 2: Subtitle */}
              <div style={{ fontSize: 11, color: "#bbb", marginBottom: 10 }}>Découvre des vérités sur toi-même</div>
              {/* Line 3: 4 buttons on one line */}
              <div style={{ display: "flex", gap: 6 }}>
                {[["❤️", "Amour", "❤️ Amour"], ["🧠", "Test du QI", "🧠 Test du QI"], ["💰", "Argent", "💰 Argent & Succès"]].map(([emoji, label, cat]) => (
                  <button key={cat} onClick={() => { setPage("quiz"); setQuizPage("quizHome"); setQuizCategory(cat); }} style={{
                    flex: 1, padding: "6px 4px", borderRadius: 8, border: "1px solid rgba(201,168,76,0.3)",
                    background: "rgba(255,255,255,0.06)", color: "#ddd", fontSize: 11, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                  }}>
                    <span>{emoji}</span>
                    <span style={{ fontSize: 9 }}>{label}</span>
                  </button>
                ))}
                <button onClick={() => { setPage("quiz"); setQuizPage("quizHome"); setQuizCategory("Tous"); }} style={{
                  flex: 1, padding: "6px 4px", borderRadius: 8, border: "none",
                  background: G.gold, color: "#1a1208", fontSize: 11, fontWeight: "bold", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                }}>
                  <span>🔥</span>
                  <span style={{ fontSize: 9 }}>Tous</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* INSTALL GUIDE MODAL */}
        {showInstallModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
            <div style={{ background: "#fff", width: "100%", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px" }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📲</div>
                <div style={{ fontSize: 17, fontWeight: "bold", color: "#1a1208" }}>Installer CarryBooks</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Acces rapide depuis ton ecran</div>
              </div>
              <div style={{ background: "#f9f9f9", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#333", marginBottom: 10 }}>🍎 Sur iPhone (Safari)</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>1. Appuie sur le bouton Partager ⬆️ en bas</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>2. Appuie sur Sur l'ecran d'accueil 📋</div>
                <div style={{ fontSize: 13, color: "#555" }}>3. Appuie sur Ajouter ✅</div>
              </div>
              <div style={{ background: "#f9f9f9", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#333", marginBottom: 10 }}>🤖 Sur Android (Chrome)</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>1. Appuie sur les 3 points ⋮ en haut a droite</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>2. Appuie sur Ajouter a l'ecran d'accueil ➕</div>
                <div style={{ fontSize: 13, color: "#555" }}>3. Confirme en appuyant Ajouter ✅</div>
              </div>
              <button onClick={() => setShowInstallModal(false)} style={{ width: "100%", padding: 14, background: "#c9a84c", border: "none", borderRadius: 12, color: "#1a1208", fontWeight: "bold", fontSize: 15, cursor: "pointer" }}>
                OK compris !
              </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        {page !== "reader" && (
          <div style={{ background: G.navSurface, borderTop: "1px solid " + G.navBorder, padding: "28px 16px 40px" }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <img src="https://i.ibb.co/j9ScrTDq/Sans-nom-4-Photoroom-1.png" alt="CarryBooks" style={{ height: 40, borderRadius: 6 }} />
            </div>
            {/* Liens */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 24px", marginBottom: 20 }}>
              <button onClick={() => setPage("faq")} style={{ background: "none", border: "none", color: G.textDim, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>FAQ</button>
              <button onClick={() => setPage("about")} style={{ background: "none", border: "none", color: G.textDim, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>À propos de nous</button>
              <a href="mailto:carrybooks.com@gmail.com" style={{ color: G.textDim, fontSize: 13, textDecoration: "underline" }}>Nous contacter</a>
            </div>
            {/* Réseaux sociaux */}
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 20 }}>
              <a href="https://www.facebook.com/CarryBooks" target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>📘</span>
                <span style={{ fontSize: 10, color: G.textFaint }}>Facebook</span>
              </a>
              <a href="https://chat.whatsapp.com/CarryBooks" target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>💬</span>
                <span style={{ fontSize: 10, color: G.textFaint }}>WhatsApp</span>
              </a>
              <a href="https://www.tiktok.com/@CarryBooks" target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>🎵</span>
                <span style={{ fontSize: 10, color: G.textFaint }}>TikTok</span>
              </a>
            </div>
            <div style={{ color: G.textFaint, fontSize: 11, textAlign: "center" }}>© 2026 CarryBooks. Tous droits réservés.</div>
          </div>
        )}
      {/* MODAL DÉBLOQUER VIA ABONNEMENT */}
      {showSubUnlockModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              {showSubUnlockModal.coverUrl && (
                <img src={showSubUnlockModal.coverUrl} alt={showSubUnlockModal.title} style={{ height: 100, borderRadius: 6, marginBottom: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} />
              )}
              <h3 style={{ color: "#1a1a1a", marginBottom: 6, fontSize: 17 }}>{showSubUnlockModal.title}</h3>
              <p style={{ color: "#888", fontSize: 13 }}>par {showSubUnlockModal.author || "Auteur"}</p>
            </div>
            <div style={{ background: "#fff8e1", padding: 14, borderRadius: 8, marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#7a5c00", lineHeight: 1.5 }}>
                📚 Tu as <strong>{booksLeftThisMonth()}</strong> livre{booksLeftThisMonth() > 1 ? "s" : ""} restant{booksLeftThisMonth() > 1 ? "s" : ""} sur ton abonnement.<br/>
                Ce livre rejoindra ta bibliothèque <strong>à vie</strong>.
              </div>
            </div>
            <button onClick={() => unlockWithSubscription(showSubUnlockModal)} style={{
              width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
            }}>
              ✨ Débloquer avec mon abonnement
            </button>
            <button onClick={() => {
              const book = showSubUnlockModal;
              setShowSubUnlockModal(null);
              setPaymentBook(book);
              setShowPayment(true);
              setPaymentStep(1);
              setPaymentMethod(null);
              setPhoneNumber("");
            }} style={{ width: "100%", padding: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
              💎 Acheter individuellement ({showSubUnlockModal.price?.toLocaleString()} FCFA)
            </button>
            <button onClick={() => setShowSubUnlockModal(null)} style={{ width: "100%", padding: 8, background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* MODAL LIMITE ATTEINTE */}
      {showSubLimitModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px" }}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>📚</div>
              <h3 style={{ color: "#1a1a1a", marginBottom: 8, fontSize: 17 }}>Limite atteinte</h3>
              <p style={{ color: "#666", fontSize: 13, lineHeight: 1.5 }}>
                Tu as utilisé tes <strong>{subscription?.books_per_month || subSettings.books_per_month} livres</strong> de ce mois.
              </p>
            </div>
            <div style={{ background: "#fff3e0", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, marginBottom: 18 }}>
              <p style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                💡 Patiente jusqu'au prochain mois pour récupérer 20 nouveaux livres,<br/>
                <strong>OU</strong> achète ce livre individuellement pour le garder à vie.
              </p>
            </div>
            <button onClick={() => {
              const book = showSubLimitModal;
              setShowSubLimitModal(null);
              setPaymentBook(book);
              setShowPayment(true);
              setPaymentStep(1);
              setPaymentMethod(null);
              setPhoneNumber("");
            }} style={{
              width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
            }}>
              💎 Acheter ce livre — {showSubLimitModal.price?.toLocaleString()} FCFA
            </button>
            <button onClick={() => setShowSubLimitModal(null)} style={{ width: "100%", padding: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer" }}>
              Patienter
            </button>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION PAYMENT MODAL */}
      {showSubModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid #e0e0e0" }}>
            {subPaymentStep === 1 && (
              <>
                <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>{subPlan === "mensuel" ? "🌟" : "💎"}</div>
                  <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 18 }}>Abonnement {subPlan}</h3>
                </div>
                <div style={{ background: "#fff8e1", padding: "10px 14px", borderRadius: 8, marginBottom: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#7a5c00", marginBottom: 4 }}>Prix {subPlan === "mensuel" ? "mensuel" : "annuel"}</div>
                  <div style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a1a" }}>{subPlan === "mensuel" ? subSettings.monthly_price?.toLocaleString() : subSettings.annual_price?.toLocaleString()} FCFA</div>
                </div>
                <div style={{ background: "#f5f5f5", padding: 14, borderRadius: 8, marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "#1a1a1a", marginBottom: 8 }}>✨ Tu obtiens :</div>
                  <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                    ✅ {subSettings.books_per_month} livres / mois<br/>
                    ✅ Accès aux nouveautés en priorité<br/>
                    ✅ Annulable à tout moment
                  </div>
                </div>
                <button onClick={() => setSubPaymentStep(2)} style={{
                  width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
                }}>
                  💎 Continuer vers le paiement
                </button>
                <button onClick={() => { setShowSubModal(false); setSubPaymentStep(1); setSubPaymentMethod(null); setSubPhone(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>Annuler</button>
              </>
            )}
            {subPaymentStep === 2 && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>💳</div>
                <h3 style={{ color: "#1a1a1a", marginBottom: 8, fontSize: 16 }}>Choisis ta méthode</h3>
                <p style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>Avec quel opérateur veux-tu payer ?</p>
                <button onClick={() => { setSubPaymentMethod("mtn"); setSubPaymentStep(3); }} style={{
                  width: "100%", padding: 16, marginBottom: 10, background: "#FFCC00", color: "#000",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
                }}>📱 MTN Mobile Money</button>
                <button onClick={() => { setSubPaymentMethod("orange"); setSubPaymentStep(3); }} style={{
                  width: "100%", padding: 16, marginBottom: 14, background: "#FF6600", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
                }}>📱 Orange Money</button>
                <button onClick={() => setSubPaymentStep(1)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>← Retour</button>
              </div>
            )}
            {subPaymentStep === 3 && (
              <div style={{ padding: "10px 0" }}>
                <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16, textAlign: "center" }}>Entre ton numéro</h3>
                <p style={{ color: "#888", fontSize: 12, marginBottom: 16, textAlign: "center" }}>{subPaymentMethod === "mtn" ? "📱 MTN Mobile Money" : "📱 Orange Money"}</p>
                <input value={subPhone} onChange={e => setSubPhone(e.target.value)}
                  placeholder="Ex : 671234567"
                  style={{ width: "100%", padding: "14px", background: "#f5f5f5", border: "2px solid #ddd", borderRadius: 10, color: "#1a1a1a", fontSize: 16, marginBottom: 10, textAlign: "center", boxSizing: "border-box" }} />
                <p style={{ color: "#aaa", fontSize: 11, marginBottom: 16, textAlign: "center" }}>Sans le 237, juste tes 9 chiffres</p>
                <button onClick={handleSubscribe} disabled={!subPhone || subPhone.length < 8}
                  style={{ width: "100%", padding: 14, background: subPhone && subPhone.length >= 8 ? "#1a1a1a" : "#ccc", border: "none", borderRadius: 10, color: "#fff", fontWeight: "bold", cursor: subPhone && subPhone.length >= 8 ? "pointer" : "not-allowed", fontSize: 14, marginBottom: 10 }}>
                  💎 Payer {(subPlan === "annuel" ? subSettings.annual_price : subSettings.monthly_price)?.toLocaleString()} FCFA
                </button>
                <button onClick={() => setSubPaymentStep(2)} style={{ width: "100%", background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: 8 }}>← Retour</button>
              </div>
            )}
            {subPaymentStep === 4 && (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
                <h3 style={{ color: "#1a1a1a", marginBottom: 12, fontSize: 16 }}>Paiement en cours...</h3>
                <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, textAlign: "left", marginBottom: 16 }}>
                  <p style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: "bold" }}>
                    ⚠️ Ne quittez pas cet écran, veuillez patienter jusqu'à la finalisation.
                  </p>
                </div>
                <p style={{ color: "#666", fontSize: 12, lineHeight: 1.5 }}>
                  Confirme la transaction sur ton téléphone.<br/>
                  Cela peut prendre jusqu'à 30 secondes.
                </p>
              </div>
            )}
            {subPaymentStep === 5 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                <h3 style={{ color: G.gold, marginBottom: 8, fontSize: 18 }}>Bienvenue dans le club !</h3>
                <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>Profite de tes {subSettings.books_per_month} livres ce mois 📚</p>
                <button onClick={() => { setShowSubModal(false); setSubPaymentStep(1); setSubPaymentMethod(null); setSubPhone(""); setPage("home"); }}
                  style={{ width: "100%", padding: 14, background: G.gold, border: "none", borderRadius: 10, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>
                  📚 Explorer les livres
                </button>
              </div>
            )}
            {subPaymentStep === 6 && (
              <div style={{ padding: "24px 0" }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
                  <h3 style={{ color: "#c62828", marginBottom: 8, fontSize: 17 }}>Paiement non finalisé</h3>
                  <p style={{ color: "#888", fontSize: 13 }}>Le réseau de l'opérateur est peut-être occupé.</p>
                </div>
                <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, marginBottom: 18 }}>
                  <p style={{ color: "#7a4a00", fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 0 }}>💡 Essaie ces solutions :</p>
                  <p style={{ color: "#7a4a00", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                    ✅ Vérifie ton solde Mobile Money<br/>
                    ✅ Réessaie avec l'autre opérateur (MTN/Orange)<br/>
                    ✅ Patiente quelques minutes et réessaie<br/>
                    ✅ Vérifie ta connexion internet
                  </p>
                </div>
                <button onClick={() => { setSubPaymentStep(2); setSubPaymentMethod(null); setSubPhone(""); }} style={{
                  width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
                }}>
                  🔁 Réessayer
                </button>
                <button onClick={() => { setShowSubModal(false); setSubPaymentStep(1); setSubPaymentMethod(null); setSubPhone(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* PAYMENT MODAL */}
      {showPayment && paymentBook && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", width: "100%", padding: "24px 20px 40px", border: "1px solid #e0e0e0" }}>
            {paymentStep === 1 && (
              <>
                <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
                {paymentBook.coverUrl && (
                  <div style={{ textAlign: "center", marginBottom: 14 }}>
                    <img src={paymentBook.coverUrl} alt={paymentBook.title} style={{ height: 110, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} />
                  </div>
                )}
                <h3 style={{ color: "#1a1a1a", marginBottom: 6, fontSize: 17, textAlign: "center" }}>{paymentBook.title}</h3>
                <p style={{ color: "#888", fontSize: 13, marginBottom: 6, textAlign: "center" }}>par {paymentBook.author || "Auteur"}</p>
                <div style={{ background: "#fff8e1", padding: "10px 14px", borderRadius: 8, marginBottom: 18, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#7a5c00", marginBottom: 4 }}>Prix du livre</div>
                  <div style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a1a" }}>{paymentBook.price?.toLocaleString()} FCFA</div>
                </div>
                <button onClick={() => setPaymentStep(2)} style={{
                  width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
                }}>
                  💎 Continuer vers le paiement
                </button>
                <button onClick={() => { setShowPayment(false); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>Annuler</button>
              </>
            )}
            {paymentStep === 2 && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>💳</div>
                <h3 style={{ color: "#1a1a1a", marginBottom: 8, fontSize: 16 }}>Choisis ta méthode</h3>
                <p style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>Avec quel opérateur veux-tu payer ?</p>
                <button onClick={() => { setPaymentMethod("mtn"); setPaymentStep(3); }} style={{
                  width: "100%", padding: 16, marginBottom: 10, background: "#FFCC00", color: "#000",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
                }}>📱 MTN Mobile Money</button>
                <button onClick={() => { setPaymentMethod("orange"); setPaymentStep(3); }} style={{
                  width: "100%", padding: 16, marginBottom: 14, background: "#FF6600", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer"
                }}>📱 Orange Money</button>
                <button onClick={() => setPaymentStep(1)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>← Retour</button>
              </div>
            )}
            {paymentStep === 3 && (
              <div style={{ padding: "10px 0" }}>
                <h3 style={{ color: "#1a1a1a", marginBottom: 4, fontSize: 16, textAlign: "center" }}>Entre ton numéro</h3>
                <p style={{ color: "#888", fontSize: 12, marginBottom: 16, textAlign: "center" }}>{paymentMethod === "mtn" ? "📱 MTN Mobile Money" : "📱 Orange Money"}</p>
                <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="Ex : 671234567"
                  style={{ width: "100%", padding: "14px", background: "#f5f5f5", border: "2px solid #ddd", borderRadius: 10, color: "#1a1a1a", fontSize: 16, marginBottom: 10, textAlign: "center", boxSizing: "border-box" }} />
                <p style={{ color: "#aaa", fontSize: 11, marginBottom: 16, textAlign: "center" }}>Sans le 237, juste tes 9 chiffres</p>
                <button onClick={handlePurchase} disabled={!phoneNumber || phoneNumber.length < 8}
                  style={{ width: "100%", padding: 14, background: phoneNumber && phoneNumber.length >= 8 ? "#1a1a1a" : "#ccc", border: "none", borderRadius: 10, color: "#fff", fontWeight: "bold", cursor: phoneNumber && phoneNumber.length >= 8 ? "pointer" : "not-allowed", fontSize: 14, marginBottom: 10 }}>
                  💎 Payer {paymentBook.price?.toLocaleString()} FCFA
                </button>
                <button onClick={() => setPaymentStep(2)} style={{ width: "100%", background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: 8 }}>← Retour</button>
              </div>
            )}
            {paymentStep === 4 && (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
                <h3 style={{ color: "#1a1a1a", marginBottom: 12, fontSize: 16 }}>Paiement en cours...</h3>
                <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, textAlign: "left", marginBottom: 16 }}>
                  <p style={{ color: "#7a4a00", fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: "bold" }}>
                    ⚠️ Ne quittez pas cet écran, veuillez patienter jusqu'à la finalisation.
                  </p>
                </div>
                <p style={{ color: "#666", fontSize: 12, lineHeight: 1.5 }}>
                  Confirme la transaction sur ton téléphone.<br/>
                  Cela peut prendre jusqu'à 30 secondes.
                </p>
              </div>
            )}
            {paymentStep === 5 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                <h3 style={{ color: G.gold, marginBottom: 8, fontSize: 18 }}>Paiement réussi !</h3>
                <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>{paymentBook.title} est à toi 📚</p>
                <button onClick={() => { setShowPayment(false); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); startReading(paymentBook); }}
                  style={{ width: "100%", padding: 14, background: G.gold, border: "none", borderRadius: 10, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>
                  📖 Lire maintenant
                </button>
              </div>
            )}
            {paymentStep === 6 && (
              <div style={{ padding: "24px 0" }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
                  <h3 style={{ color: "#c62828", marginBottom: 8, fontSize: 17 }}>Paiement non finalisé</h3>
                  <p style={{ color: "#888", fontSize: 13 }}>Le réseau de l'opérateur est peut-être occupé.</p>
                </div>
                <div style={{ background: "#fff8e1", borderLeft: "3px solid #ff9800", padding: 14, borderRadius: 8, marginBottom: 18 }}>
                  <p style={{ color: "#7a4a00", fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 0 }}>💡 Essaie ces solutions :</p>
                  <p style={{ color: "#7a4a00", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                    ✅ Vérifie ton solde Mobile Money<br/>
                    ✅ Réessaie avec l'autre opérateur (MTN/Orange)<br/>
                    ✅ Patiente quelques minutes et réessaie<br/>
                    ✅ Vérifie ta connexion internet
                  </p>
                </div>
                <button onClick={() => { setPaymentStep(2); setPaymentMethod(null); setPhoneNumber(""); }} style={{
                  width: "100%", padding: 14, background: "#1a1a1a", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: "bold", cursor: "pointer", marginBottom: 10
                }}>
                  🔁 Réessayer
                </button>
                <button onClick={() => { setShowPayment(false); setPaymentStep(1); setPaymentMethod(null); setPhoneNumber(""); }} style={{ width: "100%", background: "none", border: "1px solid #ddd", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer", padding: 12 }}>
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}













