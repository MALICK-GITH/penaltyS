// Types pour le système multi-bots
export interface BetInput {
  nom: string;
  cote: number;
}

export interface BotResult {
  nom: string;
  cote: number;
  confiance: number;
  type: string;
  source: string;
  value?: number;
}

export interface BotDecision {
  bot_name: string;
  paris_recommandes: BotResult[];
  confiance_globale: number;
  specialite: string;
  opportunities?: BotResult[];
}

export interface MatchContext {
  score1: number;
  score2: number;
  minute: number;
}

export interface UnifiedPrediction {
  meta: {
    generatedAt: string;
    version: string;
    teams: string;
    league: string;
    context: MatchContext;
    betsAnalysed: number;
    validOddsRange: string;
  };
  bots: {
    systeme_unifie: BotDecision;
    systeme_ia: BotDecision;
    systeme_probabilites: BotDecision;
    systeme_value: BotDecision & { opportunities: BotResult[] };
    systeme_statistique: BotDecision;
  };
  maitre: {
    decision_finale: {
      action: string;
      niveau_confiance?: string;
      confiance_numerique?: number;
      pari_choisi?: string;
      cote?: number;
      type_pari?: string;
      recommandation: string;
      equipes?: string;
      raison?: string;
      confiance?: number;
    };
    analyse_bots: {
      nb_bots_consultes: number;
      consensus: string;
      bots_supporters?: string[];
      types_paris_analyses?: number;
      confiance_pari?: number;
      nb_bots_accord?: number;
      paris_analyses?: number;
    };
  };
  analyse_avancee: {
    analyses_detaillees: Array<{
      pari: string;
      cote: number;
      score_composite: number;
      probabilite_estimee: number;
      value: number;
      potentiel_gain: number;
      recommandation: string;
      risque: string;
    }>;
    top_3_recommandations: Array<{
      pari: string;
      cote: number;
      score_composite: number;
      value: number;
      recommandation: string;
    }>;
    statistiques: {
      total_paris_analyses: number;
      score_moyen: number;
      opportunities_positives: number;
      potentiel_gain_total: number;
    };
  };
}

// Fonctions utilitaires
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string | number): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseNumber(value: string | number, fallback: number = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function detectBetType(name: string): string {
  const low = normalizeText(name);
  if (low.includes("total") && (low.includes("plus") || low.includes("moins"))) return "TOTAL_BUTS";
  if (low.includes("handicap")) return "HANDICAP";
  if (low.includes("pair") || low.includes("impair")) return "PAIR_IMPAIR";
  if (low.includes("corner")) return "CORNERS";
  if (low.includes("mi-temps") || low.includes("mi temps")) return "MI_TEMPS";
  if (low.includes("victoire") || low === "1" || low === "x" || low === "2") return "1X2";
  return "AUTRE";
}

// Bot 1: Système Unifié - Analyse globale
function analyserPariUnifie(
  pari: BetInput,
  team1: string,
  team2: string,
  league: string,
  score1: number,
  score2: number,
  minute: number
): number {
  let confiance = 50;
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);
  const total = score1 + score2;

  // Adaptation FIFA Penalty: pas de draw, seulement 1 ou 2
  if (nom.includes("victoire") || nom === "1" || nom === "2") {
    if (pari.cote >= 1.8 && pari.cote <= 2.2) confiance += 12;
    if (minute > 70) confiance += 8;
  }

  if (nom.includes("plus") && nom.includes("total")) {
    if (score1 + score2 >= 2 && minute < 60) confiance += 15;
  } else if (nom.includes("moins") && nom.includes("total")) {
    if (score1 + score2 <= 1 && minute > 60) confiance += 15;
  } else if (nom.includes("pair") || nom.includes("impair")) {
    const wantsPair = nom.includes("pair") && !nom.includes("impair");
    const isPair = total % 2 === 0;
    confiance += wantsPair === isPair ? 16 : -6;
    if (minute >= 70) confiance += 6;
  }

  if (pari.cote >= 1.8 && pari.cote <= 2.5) confiance += 10;
  return clamp(confiance, 5, 95);
}

// Bot 2: IA Spécialisée - Analyse contextuelle
function analyserPariIA(
  pari: BetInput,
  team1: string,
  team2: string,
  league: string,
  score1: number,
  score2: number,
  minute: number
): number {
  let confiance = 55;
  const nom = normalizeText(pari.nom);
  const total = score1 + score2;

  if (nom.includes("total")) {
    if (nom.includes("plus")) {
      if (total >= 1 && minute < 45) confiance += 20;
      else if (total === 0 && minute > 70) confiance -= 20;
    } else if (nom.includes("moins")) {
      if (total <= 1 && minute > 60) confiance += 18;
    }
  }

  // Adaptation FIFA Penalty
  if (nom.includes("victoire") || nom === "1" || nom === "2") {
    if (minute > 50) confiance += 10;
    if (pari.cote >= 1.9 && pari.cote <= 2.1) confiance += 8;
  }

  if (nom.includes("pair") || nom.includes("impair")) {
    const wantsPair = nom.includes("pair") && !nom.includes("impair");
    const isPair = total % 2 === 0;
    if (minute <= 20) confiance += 5;
    if (minute >= 70) confiance += 8;
    confiance += wantsPair === isPair ? 10 : -8;
  }

  return clamp(confiance, 5, 95);
}

// Bot 3: Probabilités - Calculs probabilistes
function analyserPariProbabilites(
  pari: BetInput,
  score1: number,
  score2: number,
  minute: number
): number {
  let confiance = 50;
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);
  const probImplicite = (1 / Math.max(cote, 0.01)) * 100;
  let probEstimee = 50;
  const total = score1 + score2;

  if (nom.includes("total")) {
    if (nom.includes("plus")) {
      if (score1 + score2 >= 2) probEstimee = 75;
      else if (score1 + score2 === 1) probEstimee = 60;
      else probEstimee = 45;
    } else {
      probEstimee = 55;
    }
  }

  // Adaptation FIFA Penalty
  if (nom.includes("victoire") || nom === "1" || nom === "2") {
    probEstimee = pari.cote < 2.0 ? 65 : 45;
  }

  if (nom.includes("pair") || nom.includes("impair")) {
    const wantsPair = nom.includes("pair") && !nom.includes("impair");
    const isPair = total % 2 === 0;
    probEstimee = wantsPair === isPair ? 62 : 38;
  }

  if (probEstimee > probImplicite) {
    confiance += (probEstimee - probImplicite) * 0.5;
  }
  return clamp(confiance, 5, 95);
}

// Bot 4: Value Betting - Détection de value
function calculerValue(pari: BetInput): number {
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);
  let probEstimee = 50;

  if (nom.includes("total")) probEstimee = nom.includes("moins") ? 65 : 45;
  else if (nom.includes("handicap")) probEstimee = 55;
  else if (nom.includes("pair") || nom.includes("impair")) probEstimee = 54;
  else if (nom.includes("victoire") || nom === "1" || nom === "2") {
    probEstimee = cote < 2.0 ? 58 : 48;
  }

  const probImplicite = (1 / Math.max(cote, 0.01)) * 100;
  return Math.max(((probEstimee - probImplicite) / probImplicite) * 100, -50);
}

// Bot 5: Statistique - Analyse avancée
function analyserPariStat(
  pari: BetInput,
  team1: string,
  team2: string,
  league: string,
  score1: number,
  score2: number,
  minute: number
): number {
  let confiance = 52;
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);
  const total = score1 + score2;

  if (nom.includes("total")) {
    if (minute <= 30) {
      confiance += nom.includes("plus") ? 8 : 3;
    } else if (minute > 70 && nom.includes("moins") && total <= 2) {
      confiance += 15;
    }
  }

  // Adaptation FIFA Penalty
  if (nom.includes("victoire") || nom === "1" || nom === "2") {
    if (minute > 60) confiance += 12;
    if (cote >= 1.85 && cote <= 2.15) confiance += 10;
  }

  if (nom.includes("pair") || nom.includes("impair")) {
    const wantsPair = nom.includes("pair") && !nom.includes("impair");
    const isPair = total % 2 === 0;
    confiance += wantsPair === isPair ? 9 : -6;
    if (minute > 60) confiance += 5;
  }

  const hash = Array.from(`${team1}${team2}`).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100;
  if (hash > 60) confiance += 8;
  return clamp(confiance, 5, 95);
}

// Fonction principale qui exécute tous les bots
function runBots({
  team1,
  team2,
  league,
  paris,
  score1,
  score2,
  minute,
}: {
  team1: string;
  team2: string;
  league: string;
  paris: BetInput[];
  score1: number;
  score2: number;
  minute: number;
}): UnifiedPrediction['bots'] {
  const valid = paris.filter((p) => parseNumber(p.cote, 0) >= 1.399 && parseNumber(p.cote, 0) <= 3.0);

  const makeResult = (botName: string, rows: BotResult[], specialite: string): BotDecision => ({
    bot_name: botName,
    paris_recommandes: rows.sort((a, b) => b.confiance - a.confiance).slice(0, 3),
    confiance_globale: rows.length ? Math.max(...rows.map((x) => x.confiance)) : 0,
    specialite,
  });

  const botUnifieRows = valid
    .map((p) => ({ ...p, confiance: analyserPariUnifie(p, team1, team2, league, score1, score2, minute) }))
    .filter((p) => p.confiance >= 60)
    .map((p) => ({ nom: p.nom, cote: p.cote, confiance: p.confiance, type: detectBetType(p.nom), source: "BOT_UNIFIE" }));

  const botIaRows = valid
    .map((p) => ({ ...p, confiance: analyserPariIA(p, team1, team2, league, score1, score2, minute) }))
    .filter((p) => p.confiance >= 65)
    .map((p) => ({ nom: p.nom, cote: p.cote, confiance: p.confiance, type: detectBetType(p.nom), source: "BOT_IA" }));

  const botProbaRows = valid
    .map((p) => ({ ...p, confiance: analyserPariProbabilites(p, score1, score2, minute) }))
    .filter((p) => p.confiance >= 55)
    .map((p) => ({ nom: p.nom, cote: p.cote, confiance: p.confiance, type: detectBetType(p.nom), source: "BOT_PROBABILITES" }));

  const botValueRows = valid
    .map((p) => ({ ...p, value: calculerValue(p) }))
    .filter((p) => p.value >= 10)
    .map((p) => ({
      nom: p.nom,
      cote: p.cote,
      confiance: clamp(50 + p.value, 5, 95),
      value: Number(p.value.toFixed(2)),
      type: detectBetType(p.nom),
      source: "BOT_VALUE",
    }))
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const botStatsRows = valid
    .map((p) => ({ ...p, confiance: analyserPariStat(p, team1, team2, league, score1, score2, minute) }))
    .filter((p) => p.confiance >= 58)
    .map((p) => ({ nom: p.nom, cote: p.cote, confiance: p.confiance, type: detectBetType(p.nom), source: "BOT_STATS" }));

  return {
    systeme_unifie: makeResult("SYSTEME UNIFIE ALTERNATIFS", botUnifieRows, "ANALYSE UNIFIEE"),
    systeme_ia: makeResult("IA SPECIALISEE ALTERNATIFS", botIaRows, "IA CONTEXTUELLE"),
    systeme_probabilites: makeResult("PROBABILITES ALTERNATIVES", botProbaRows, "CALCULS PROBABILISTES"),
    systeme_value: {
      ...makeResult("VALUE BETTING ALTERNATIFS", botValueRows, "DETECTION VALUE"),
      opportunities: botValueRows,
    },
    systeme_statistique: makeResult("ANALYSE STATISTIQUE ALTERNATIFS", botStatsRows, "STATS AVANCEES"),
  };
}

// Maître Pronostics - Combine les décisions des bots
function maitrePronostics(
  decisionsBots: UnifiedPrediction['bots'],
  team1: string,
  team2: string,
  league: string
): UnifiedPrediction['maitre'] {
  const decisionsValides: Array<{ bot: string; paris: BotResult[]; confiance_bot: number }> = [];

  for (const [botName, decision] of Object.entries(decisionsBots)) {
    if (!decision || !Array.isArray(decision.paris_recommandes)) continue;
    const parisValides = decision.paris_recommandes.filter((pari) => {
      const cote = parseNumber(pari.cote, 0);
      return cote >= 1.399 && cote <= 3.0;
    });
    if (parisValides.length) {
      decisionsValides.push({
        bot: botName,
        paris: parisValides,
        confiance_bot: parseNumber(decision.confiance_globale, 50),
      });
    }
  }

  if (!decisionsValides.length) {
    return {
      decision_finale: {
        action: "AUCUN_PARI",
        raison: "Aucun pari avec cotes valides (1.399-3.0)",
        confiance: 0,
        recommandation: "ATTENDRE DE MEILLEURES OPPORTUNITES",
      },
      analyse_bots: {
        nb_bots_consultes: 0,
        consensus: "AUCUN",
        paris_analyses: 0,
      },
    };
  }

  const parisSpecifiques = new Map<string, Array<{ bot: string; pari: BotResult; confiance: number }>>();
  for (const d of decisionsValides) {
    for (const pari of d.paris) {
      const key = pari.nom;
      if (!parisSpecifiques.has(key)) parisSpecifiques.set(key, []);
      parisSpecifiques.get(key)!.push({ bot: d.bot, pari, confiance: parseNumber(pari.confiance, 50) });
    }
  }
  const populaires = [...parisSpecifiques.entries()].sort((a, b) => b[1].length - a[1].length);
  if (!populaires.length) {
    return {
      decision_finale: { action: "AUCUN_PARI", confiance: 0, recommandation: "AUCUNE CONVERGENCE" },
      analyse_bots: { nb_bots_consultes: decisionsValides.length, consensus: "AUCUN" },
    };
  }

  const [nomPari, votes] = populaires[0];
  const nbBotsTotal = decisionsValides.length;
  const confianceConsensus = clamp((votes.length / nbBotsTotal) * 100, 0, 90);
  const confianceMoyenneBots = decisionsValides.reduce((a, x) => a + x.confiance_bot, 0) / nbBotsTotal;
  const confianceGlobale = confianceConsensus * 0.6 + confianceMoyenneBots * 0.4;
  const confiancePari = votes.reduce((a, x) => a + x.confiance, 0) / votes.length;
  const meilleurVote = votes.reduce((best, v) => (v.confiance > best.confiance ? v : best), votes[0]);

  let action = "EVITER";
  let niveau = "TRES FAIBLE";
  if (confianceGlobale >= 80) {
    action = "MISE FORTE RECOMMANDEE";
    niveau = "TRES ELEVEE";
  } else if (confianceGlobale >= 70) {
    action = "MISE RECOMMANDEE";
    niveau = "ELEVEE";
  } else if (confianceGlobale >= 60) {
    action = "MISE MODEREE";
    niveau = "MODEREE";
  } else if (confianceGlobale >= 50) {
    action = "MISE PRUDENTE";
    niveau = "FAIBLE";
  }

  return {
    decision_finale: {
      pari_choisi: nomPari,
      cote: meilleurVote.pari.cote,
      type_pari: detectBetType(nomPari),
      action,
      niveau_confiance: niveau,
      confiance_numerique: Number(confianceGlobale.toFixed(1)),
      recommandation: `MAITRE RECOMMANDE: ${action}`,
      equipes: `${team1} vs ${team2}`,
    },
    analyse_bots: {
      nb_bots_consultes: nbBotsTotal,
      nb_bots_accord: votes.length,
      consensus: `${votes.length}/${nbBotsTotal} bots`,
      bots_supporters: votes.map((v) => v.bot),
      types_paris_analyses: new Set(decisionsValides.flatMap((d) => d.paris.map((p) => detectBetType(p.nom)))).size,
      confiance_pari: Number(confiancePari.toFixed(1)),
    },
  };
}

// Analyse avancée
function analyseAvancee(
  team1: string,
  team2: string,
  league: string,
  paris: BetInput[],
  score1: number,
  score2: number,
  minute: number
): UnifiedPrediction['analyse_avancee'] {
  const analyses = paris.map((pari) => {
    const cote = parseNumber(pari.cote, 2);
    const nom = String(pari.nom || "Pari inconnu");
    const total = score1 + score2;

    let contexte = 50;
    if (normalizeText(nom).includes("plus") && normalizeText(nom).includes("2.5")) {
      if (total >= 3) contexte = 95;
      else if (total === 2 && minute < 70) contexte = 80;
      else if (total === 0 && minute > 60) contexte = 25;
    }
    let tendances = 50;
    if (minute > 75 && normalizeText(nom).includes("plus")) tendances += 20;
    if (minute > 75 && normalizeText(nom).includes("moins")) tendances += 15;
    let equipe = 50;
    let ligue = 50;
    let momentum = 50;
    if (total >= 2 && minute < 60 && normalizeText(nom).includes("plus")) momentum += 20;
    if (total === 0 && minute > 45 && normalizeText(nom).includes("moins")) momentum += 15;

    const scoreComposite = (contexte + tendances + equipe + ligue + momentum) / 5;
    const probabiliteEstimee = scoreComposite / 100;
    const probabiliteCote = 1 / Math.max(cote, 0.01);
    const value = ((probabiliteEstimee - probabiliteCote) / probabiliteCote) * 100;
    const potentielGain = value > 0 ? value * (cote - 1) : 0;

    let recommandation = "EVITER";
    if (scoreComposite >= 80 && value > 15) recommandation = "MISE FORTE";
    else if (scoreComposite >= 70 && value > 10) recommandation = "MISE RECOMMANDEE";
    else if (scoreComposite >= 60 && value > 5) recommandation = "MISE MODEREE";
    else if (scoreComposite >= 50) recommandation = "MISE PRUDENTE";

    return {
      pari: nom,
      cote,
      score_composite: Number(scoreComposite.toFixed(1)),
      probabilite_estimee: Number((probabiliteEstimee * 100).toFixed(1)),
      value: Number(value.toFixed(2)),
      potentiel_gain: Number(potentielGain.toFixed(2)),
      recommandation,
      risque: scoreComposite >= 75 && cote < 2.5 ? "FAIBLE" : scoreComposite >= 60 ? "MODERE" : "ELEVE",
    };
  });

  analyses.sort((a, b) => b.potentiel_gain - a.potentiel_gain);
  return {
    analyses_detaillees: analyses,
    top_3_recommandations: analyses.slice(0, 3),
    statistiques: {
      total_paris_analyses: analyses.length,
      score_moyen: analyses.length
        ? Number((analyses.reduce((a, x) => a + x.score_composite, 0) / analyses.length).toFixed(1))
        : 0,
      opportunities_positives: analyses.filter((a) => a.value > 0).length,
      potentiel_gain_total: Number(analyses.reduce((a, x) => a + x.potentiel_gain, 0).toFixed(2)),
    },
  };
}

// Fonction principale - Génère une prédiction unifiée
export function genererPredictionUnifiee({
  team1,
  team2,
  league,
  context,
  bets,
}: {
  team1: string;
  team2: string;
  league: string;
  context: MatchContext;
  bets: BetInput[];
}): UnifiedPrediction {
  const score1 = parseNumber(context?.score1, 0);
  const score2 = parseNumber(context?.score2, 0);
  const minute = parseNumber(context?.minute, 0);

  const bots = runBots({ team1, team2, league, paris: bets, score1, score2, minute });
  const maitre = maitrePronostics(bots, team1, team2, league);
  const avancee = analyseAvancee(team1, team2, league, bets, score1, score2, minute);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      version: "UNIFIED-PREDICTIONS-NODE-1.0",
      teams: `${team1} vs ${team2}`,
      league,
      context: { score1, score2, minute },
      betsAnalysed: bets.length,
      validOddsRange: "1.399 - 3.0",
    },
    bots,
    maitre,
    analyse_avancee: avancee,
  };
}
