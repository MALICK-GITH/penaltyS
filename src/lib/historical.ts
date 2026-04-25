// Types pour le système de décision historique
export interface MatchRecord {
  id?: string | null;
  date?: string | null;
  ligue: string;
  home: string;
  away: string;
  score?: string;
  option: string;
  odds?: number | null;
  stake_fcfa?: number | null;
  line_value?: number | null;
  issue?: string;
}

export interface FeatureRow {
  id: string | null;
  date: string | null;
  ligue: string;
  home: string | null;
  away: string | null;
  home_goals: number | null;
  away_goals: number | null;
  total_goals: number | null;
  optionType: string;
  pickSide: string;
  lineValue: number | null;
  odds: number | null;
  stake: number | null;
  label: number | null;
  void: number;
  option_raw: string;
  _hash?: string;
}

export interface GroupSummary {
  n: number;
  played: number;
  wins: number;
  losses: number;
  winrate: number;
  ci95_low: number;
  ci95_high: number;
  stakeSum: number;
  profit: number;
  roi: number;
}

export interface Rule {
  rule: string;
  n: number;
  played: number;
  wins: number;
  losses: number;
  winrate: number;
  ci95_low: number;
  ci95_high: number;
  stakeSum: number;
  profit: number;
  roi: number;
}

export interface DecisionReport {
  meta: {
    total_records: number;
    total_records_dedup: number;
    totalValidated: number;
    n: number;
    played: number;
    wins: number;
    losses: number;
    winrate: number;
    ci95_low: number;
    ci95_high: number;
    stakeSum: number;
    profit: number;
    roi: number;
  };
  byLeague: Record<string, GroupSummary>;
  byOption: Record<string, GroupSummary>;
  rules: Rule[];
}

export interface ScoredCandidate {
  score: number;
  features: FeatureRow;
  reasons: string[];
}

export interface DecisionResult {
  status: "FILTER_LOCKED" | "OK";
  playable: boolean;
  tier?: "SAFE" | "MODERATE" | "NO_PLAY";
  message?: string;
  score?: number;
  features?: FeatureRow;
  reasons?: string[];
}

// Fonctions utilitaires
function parseScore(scoreStr: string): { home: number | null; away: number | null; total: number | null } {
  const m = String(scoreStr || "").trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return { home: null, away: null, total: null };
  const home = Number(m[1]);
  const away = Number(m[2]);
  return { home, away, total: home + away };
}

function toNumber(value: any, def: number | null = null): number | null {
  if (value === "" || value === null || value === undefined) return def;
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

// Normalisation adaptée pour FIFA Penalty
function normalizeLigue(ligue: string): string {
  const s = String(ligue || "").toLowerCase();
  
  // FIFA Penalty leagues
  if (s.includes("fc26") || s.includes("fifa 26")) return "FC26";
  if (s.includes("fc25") || s.includes("fifa 25")) return "FC25";
  if (s.includes("fc24") || s.includes("fifa 24")) return "FC24";
  if (s.includes("fifa23") || s.includes("fifa 23")) return "FIFA23";
  if (s.includes("fifa22") || s.includes("fifa 22")) return "FIFA22";
  if (s.includes("fifa18") || s.includes("fifa 18")) return "FIFA18";
  
  // Modes de jeu
  if (s.includes("5x5") || s.includes("rush")) return "FC25_5x5_RUSH";
  if (s.includes("4x4")) return "FC24_4x4";
  if (s.includes("3x3")) return "FC25_3x3";
  if (s.includes("1x1")) return "FC25_1x1";
  
  // Compétitions
  if (s.includes("champions") || s.includes("ucl")) return "CHAMPIONS";
  if (s.includes("europ") || s.includes("euro")) return "EUROPE";
  if (s.includes("espagne") || s.includes("la liga")) return "ESPAGNE";
  if (s.includes("angleterre") || s.includes("premier")) return "ANGLETERRE";
  if (s.includes("allemagne") || s.includes("bundesliga")) return "ALLEMAGNE";
  if (s.includes("italie") || s.includes("serie")) return "ITALIE";
  if (s.includes("france") || s.includes("ligue 1")) return "FRANCE";
  
  return "AUTRE";
}

function normalizeOption(optionRaw: string): { optionType: string; pickSide: string; lineValue: number | null; option_raw: string } {
  const s = String(optionRaw || "").toLowerCase();
  let lineValue: number | null = null;
  const lineMatch = s.match(/\(([-+]?\d+(\.\d+)?)\)/);
  if (lineMatch) lineValue = Number(lineMatch[1]);

  let optionType = "unknown";
  
  // FIFA Penalty options
  if (s.includes("handicap")) optionType = "handicap";
  else if (s.includes("1x2") || s.includes(" v1") || s.includes(" v2") || s.includes(" nul")) optionType = "1x2";
  else if (s.includes("double") || s.includes("1x") || s.includes("x2") || s.includes("12")) optionType = "double_chance";
  else if (s.includes("total")) {
    const isUnder = s.includes("moins") || s.includes("under");
    const isOver = s.includes("plus") || s.includes("over");
    const isTeam1 = s.includes("total 1") || s.includes("equipe 1") || s.includes("équipe 1");
    const isTeam2 = s.includes("total 2") || s.includes("equipe 2") || s.includes("équipe 2");
    if (isUnder && (isTeam1 || isTeam2)) optionType = "team_total_under";
    else if (isOver && (isTeam1 || isTeam2)) optionType = "team_total_over";
    else if (isUnder) optionType = "total_under";
    else if (isOver) optionType = "total_over";
  } else if (s.includes("victoire") || s.includes("win")) {
    optionType = "1x2";
  }

  let pickSide = "MATCH";
  if (optionType === "double_chance") pickSide = "DC";
  if (optionType === "handicap" || optionType.startsWith("team_total")) {
    if (s.includes(" 1 ") || s.includes("total 1") || s.includes("equipe 1") || s.includes("équipe 1")) pickSide = "HOME";
    else if (s.includes(" 2 ") || s.includes("total 2") || s.includes("equipe 2") || s.includes("équipe 2")) pickSide = "AWAY";
    else pickSide = "HOME";
  } else if (optionType === "1x2") {
    if (s.includes("v1") || s.includes("victoire 1")) pickSide = "HOME";
    else if (s.includes("v2") || s.includes("victoire 2")) pickSide = "AWAY";
    else pickSide = "MATCH";
  }
  if (optionType === "handicap" && s.includes("handicap 2")) pickSide = "AWAY";

  return { optionType, pickSide, lineValue, option_raw: optionRaw || "" };
}

function issueToLabel(issue: string): number | null {
  const s = String(issue || "").toLowerCase();
  if (["win", "gagne", "gagné", "paye", "payé", "victoire"].includes(s)) return 1;
  if (["loss", "perdu", "défaite"].includes(s)) return 0;
  if (["void", "rembourse", "remboursé", "push", "annulé"].includes(s)) return null;
  return null;
}

// Conversion en features
export function toFeatures(match: MatchRecord): FeatureRow {
  const ligue = normalizeLigue(match.ligue);
  const odds = toNumber(match.odds, null);
  const stake = toNumber(match.stake_fcfa, null);
  const score = parseScore(match.score || "");
  const opt = normalizeOption(match.option);
  const lineValue = toNumber(match.line_value, opt.lineValue);
  const label = issueToLabel(match.issue || "");

  return {
    id: match.id ?? null,
    date: match.date ?? null,
    ligue,
    home: match.home ?? null,
    away: match.away ?? null,
    home_goals: score.home,
    away_goals: score.away,
    total_goals: score.total,
    optionType: opt.optionType,
    pickSide: opt.pickSide,
    lineValue,
    odds,
    stake,
    label,
    void: label === null ? 1 : 0,
    option_raw: opt.option_raw,
  };
}

// Hash stable pour déduplication
function stableHash(row: FeatureRow): string {
  const key = [
    row.date || "",
    row.ligue || "",
    row.home || "",
    row.away || "",
    row.optionType || "",
    row.pickSide || "",
    row.lineValue ?? "",
    row.odds ?? "",
    row.stake ?? "",
  ].join("|");
  
  // Simple hash function (crypto not available in browser)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export function deduplicate(rows: FeatureRow[]): FeatureRow[] {
  const seen = new Set<string>();
  const out: FeatureRow[] = [];
  for (const row of rows) {
    const hash = stableHash(row);
    if (seen.has(hash)) continue;
    seen.add(hash);
    out.push({ ...row, _hash: hash });
  }
  return out;
}

function computeWinLoss(rows: FeatureRow[]): { playable: FeatureRow[]; wins: number; losses: number; total: number } {
  const playable = rows.filter((r) => r.label === 0 || r.label === 1);
  const wins = playable.filter((r) => r.label === 1).length;
  const losses = playable.filter((r) => r.label === 0).length;
  return { playable, wins, losses, total: wins + losses };
}

function wilson95(wins: number, n: number): { low: number; high: number } {
  if (!n) return { low: 0, high: 0 };
  const z = 1.96;
  const phat = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (phat + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

function computeROI(rows: FeatureRow[]): { stakeSum: number; profit: number; roi: number } {
  let stakeSum = 0;
  let profit = 0;
  for (const r of rows) {
    if (typeof r.stake !== "number" || typeof r.odds !== "number") continue;
    stakeSum += r.stake;
    if (r.label === 1) profit += r.stake * (r.odds - 1);
    else if (r.label === 0) profit -= r.stake;
  }
  return { stakeSum, profit, roi: stakeSum ? profit / stakeSum : 0 };
}

function groupBy(rows: FeatureRow[], key: keyof FeatureRow): Map<string, FeatureRow[]> {
  const map = new Map<string, FeatureRow[]>();
  for (const row of rows) {
    const k = String(row[key] ?? "UNKNOWN");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(row);
  }
  return map;
}

export function summarizeGroup(rows: FeatureRow[]): GroupSummary {
  const { wins, losses, total } = computeWinLoss(rows);
  const winrate = total ? wins / total : 0;
  const ci = wilson95(wins, total);
  const roi = computeROI(rows);
  return {
    n: rows.length,
    played: total,
    wins,
    losses,
    winrate,
    ci95_low: ci.low,
    ci95_high: ci.high,
    ...roi,
  };
}

function oddsBucket(odds: number | null): string {
  if (typeof odds !== "number") return "odds_unknown";
  if (odds < 2.0) return "odds_1.xx";
  if (odds < 2.2) return "odds_2.00-2.19";
  if (odds <= 2.99) return "odds_2.20-2.99";
  return "odds_3.00+";
}

function extractRules(rows: FeatureRow[], minPlayed: number = 5): Rule[] {
  const playable = rows.filter((r) => r.label === 0 || r.label === 1);
  const rules: Rule[] = [];

  const pushRule = (name: string, filterFn: (r: FeatureRow) => boolean) => {
    const subset = playable.filter(filterFn);
    const sum = summarizeGroup(subset);
    if (sum.played >= minPlayed) rules.push({ rule: name, ...sum });
  };

  // FIFA Penalty specific rules
  pushRule("ligue=FC26", (r) => r.ligue === "FC26");
  pushRule("ligue=FC25", (r) => r.ligue === "FC25");
  pushRule("ligue=FC24", (r) => r.ligue === "FC24");
  pushRule("ligue=FC25_5x5_RUSH", (r) => r.ligue === "FC25_5x5_RUSH");
  pushRule("ligue=FC24_4x4", (r) => r.ligue === "FC24_4x4");
  pushRule("option=handicap", (r) => r.optionType === "handicap");
  pushRule("option=team_total_over", (r) => r.optionType === "team_total_over");
  pushRule("option=total_under", (r) => r.optionType === "total_under");
  pushRule("option=1x2", (r) => r.optionType === "1x2");
  pushRule("option=total_over_high(>=5.5)", (r) => r.optionType === "total_over" && typeof r.lineValue === "number" && r.lineValue >= 5.5);
  pushRule("odds=2.20-2.99", (r) => oddsBucket(r.odds) === "odds_2.20-2.99");
  pushRule("odds=2.00-2.19", (r) => oddsBucket(r.odds) === "odds_2.00-2.19");
  pushRule("odds>=3.00", (r) => oddsBucket(r.odds) === "odds_3.00+");
  pushRule("FC25_5x5 + handicap", (r) => r.ligue === "FC25_5x5_RUSH" && r.optionType === "handicap");
  pushRule("FC25_5x5 + team_total_over", (r) => r.ligue === "FC25_5x5_RUSH" && r.optionType === "team_total_over");
  pushRule("FC25_5x5 + odds 2.20-2.99", (r) => r.ligue === "FC25_5x5_RUSH" && oddsBucket(r.odds) === "odds_2.20-2.99");
  pushRule("FC26 + 1x2", (r) => r.ligue === "FC26" && r.optionType === "1x2");
  pushRule("FC24 + handicap", (r) => r.ligue === "FC24" && r.optionType === "handicap");

  rules.sort((a, b) => b.winrate - a.winrate || b.played - a.played);
  return rules;
}

export interface DecisionEngine {
  report: DecisionReport;
  scoreCandidate: (candidate: MatchRecord) => ScoredCandidate;
  decide: (candidate: MatchRecord) => DecisionResult;
}

export function buildDecisionEngine(
  rows: MatchRecord[],
  totalValidated: number,
  opts: { minMatches?: number; minRulePlayed?: number } = {}
): DecisionEngine {
  const minMatches = opts.minMatches ?? 50;
  const featureRows = rows.map(toFeatures);
  const dedup = deduplicate(featureRows);
  const report: DecisionReport = {
    meta: {
      total_records: rows.length,
      total_records_dedup: dedup.length,
      totalValidated,
      ...summarizeGroup(dedup),
    },
    byLeague: Object.fromEntries([...groupBy(dedup, "ligue")].map(([k, v]) => [k, summarizeGroup(v)])),
    byOption: Object.fromEntries([...groupBy(dedup, "optionType")].map(([k, v]) => [k, summarizeGroup(v)])),
    rules: extractRules(dedup, opts.minRulePlayed ?? 5),
  };

  function scoreCandidate(candidate: MatchRecord): ScoredCandidate {
    const f = toFeatures({ ...candidate, score: "0-0", issue: "pending" });
    let score = 50;
    const reasons: string[] = [];

    // FIFA Penalty specific scoring
    if (f.ligue === "FC26" || f.ligue === "FC25") {
      score += 20;
      reasons.push(`+ Ligue forte (${f.ligue})`);
    }
    if (f.ligue === "FC25_5x5_RUSH") {
      score += 25;
      reasons.push("+ Ligue forte (5x5 Rush)");
    }
    if (f.ligue === "FC24_4x4") {
      score += 15;
      reasons.push("+ Ligue FC24 4x4");
    }
    if (f.optionType === "handicap") {
      score += 18;
      reasons.push("+ Option forte (handicap)");
    }
    if (f.optionType === "team_total_over") {
      score += 14;
      reasons.push("+ Pattern team_total_over");
    }
    if (f.optionType === "1x2") {
      score += 10;
      reasons.push("+ Option 1X2 stable");
    }
    if (typeof f.odds === "number" && f.odds >= 2.2 && f.odds <= 2.99) {
      score += 18;
      reasons.push("+ Zone cote 2.20-2.99");
    }
    if (typeof f.odds === "number" && f.odds >= 1.8 && f.odds < 2.0) {
      score += 12;
      reasons.push("+ Zone cote 1.80-1.99");
    }

    // Penalties
    if (f.optionType === "total_over" && typeof f.lineValue === "number" && f.lineValue >= 5.5) {
      score -= 28;
      reasons.push("- Over >= 5.5 instable");
    }
    if (f.optionType === "double_chance") {
      score -= 15;
      reasons.push("- Double chance instable");
    }
    if (f.optionType === "handicap" && typeof f.lineValue === "number" && f.lineValue < -2.5) {
      score -= 20;
      reasons.push("- Handicap trop agressif");
    }
    if (f.ligue === "CHAMPIONS") {
      score -= 10;
      reasons.push("- Champions League instable");
    }
    if (f.ligue === "AUTRE") {
      score -= 5;
      reasons.push("- Ligue non identifiée");
    }

    score = Math.max(0, Math.min(100, score));
    return { score, features: f, reasons };
  }

  function decide(candidate: MatchRecord): DecisionResult {
    if (totalValidated < minMatches) {
      return {
        status: "FILTER_LOCKED",
        playable: false,
        message: `Filtre bloque: ${totalValidated}/${minMatches} matchs valides`,
      };
    }
    const scored = scoreCandidate(candidate);
    const tier = scored.score >= 85 ? "SAFE" : scored.score >= 75 ? "MODERATE" : "NO_PLAY";
    return {
      status: "OK",
      playable: tier !== "NO_PLAY",
      tier,
      ...scored,
    };
  }

  return { report, scoreCandidate, decide };
}

export function toTrainReadyCSV(featureRows: FeatureRow[]): string {
  const header = [
    "id",
    "date",
    "ligue",
    "home",
    "away",
    "home_goals",
    "away_goals",
    "total_goals",
    "option_type",
    "line_value",
    "pick_side",
    "odds",
    "stake_fcfa",
    "label",
    "void",
  ].join(",");

  const lines = featureRows.map((r) =>
    [
      r.id ?? "",
      r.date ?? "",
      r.ligue ?? "",
      r.home ?? "",
      r.away ?? "",
      r.home_goals ?? "",
      r.away_goals ?? "",
      r.total_goals ?? "",
      r.optionType ?? "",
      r.lineValue ?? "",
      r.pickSide ?? "",
      r.odds ?? "",
      r.stake ?? "",
      r.label ?? "",
      r.void ?? "",
    ].join(",")
  );

  return [header, ...lines].join("\n");
}
