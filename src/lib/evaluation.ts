/**
 * Match Evaluation System - Analyse avancée des matchs
 * Évalue la jouabilité d'un match basé sur flux, consensus et dominance
 * Signed: SOLITAIRE HACK
 */

// Types pour le système d'évaluation
export interface MatchEvaluationInput {
  action?: string;
  consensusBots?: number;
  confidence?: number;
  pickSide?: string;
  winHome?: number;
  winAway?: number;
  homeFlux?: number[];
  awayFlux?: number[];
  zoneNull?: number[];
}

export interface MatchMeta {
  totalMatches?: number;
}

export interface EvaluationConfig {
  minMatches?: number;
  minScore?: number;
  totalBots?: number;
}

export interface EvaluationBreakdown {
  confidencePts: number;
  consensusPts: number;
  winPts: number;
  fluxPts: number;
  fluxShare: number;
  zoneNullAvg: number | null;
}

export interface EvaluationResult {
  status: "FILTER_LOCKED" | "PLAY" | "NO_PLAY";
  playable: boolean;
  score: number;
  breakdown: EvaluationBreakdown;
  recommendation: string;
  reasons: string[];
  warnings: string[];
}

// Fonctions utilitaires
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pctToPoints(pct: number, maxPoints: number, minPct: number, maxPct: number): number {
  const x = (pct - minPct) / (maxPct - minPct);
  return clamp(x, 0, 1) * maxPoints;
}

function average(arr: number[]): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function areCurvesTooClose(homeFlux: number[], awayFlux: number[], threshold: number = 6): boolean {
  if (!homeFlux?.length || homeFlux.length !== awayFlux?.length) return true;
  let sumAbs = 0;
  for (let i = 0; i < homeFlux.length; i += 1) {
    sumAbs += Math.abs(homeFlux[i] - awayFlux[i]);
  }
  const meanAbs = sumAbs / homeFlux.length;
  return meanAbs < threshold;
}

function fluxDominanceShare(chosenFlux: number[], otherFlux: number[]): number {
  if (!chosenFlux?.length || chosenFlux.length !== otherFlux?.length) return 0;
  let above = 0;
  for (let i = 0; i < chosenFlux.length; i += 1) {
    if (chosenFlux[i] > otherFlux[i]) above += 1;
  }
  return above / chosenFlux.length;
}

function isOpponentSurgingLate(opponentFlux: number[], surgeDelta: number = 10): boolean {
  if (!opponentFlux?.length || opponentFlux.length < 8) return false;
  const n = opponentFlux.length;
  const start = Math.floor(n * 0.75);
  const first = opponentFlux[start];
  const last = opponentFlux[n - 1];
  return last - first >= surgeDelta;
}

function isZoneNullLow(zoneNull: number[], maxAvg: number = 25): boolean {
  const avg = average(zoneNull);
  if (avg === null) return false;
  return avg <= maxAvg;
}

function consensusPoints(consensus: number, totalBots: number = 4, maxPoints: number = 25): number {
  const ratio = clamp(consensus / totalBots, 0, 1);
  return ratio * maxPoints;
}

function winDominancePoints(dominantWinPct: number, otherWinPct: number, maxPoints: number = 30): number {
  if (dominantWinPct < 55) return 0;
  if (otherWinPct > 35) return 0;
  return pctToPoints(dominantWinPct, maxPoints, 55, 75);
}

function fluxPoints(share: number, zoneNullOk: boolean, maxPoints: number = 20): number {
  if (share < 0.7) return 0;
  let pts = pctToPoints(share * 100, maxPoints, 70, 90);
  if (!zoneNullOk) pts *= 0.6;
  return pts;
}

function recommendOption({
  dominantWinPct,
  confidence,
  consensus,
  fluxShare,
  zoneNullOk,
}: {
  dominantWinPct: number;
  confidence: number;
  consensus: number;
  fluxShare: number;
  zoneNullOk: boolean;
}): string {
  if (zoneNullOk && fluxShare >= 0.72 && confidence >= 60 && consensus >= 3) {
    return "TOTAL_BUTS (Over/Under)";
  }
  if (dominantWinPct >= 60 && fluxShare >= 0.75 && confidence >= 60 && consensus >= 3) {
    return "1X2 (V2)";
  }
  if (dominantWinPct >= 68 && fluxShare >= 0.82 && confidence >= 62 && consensus >= 3) {
    return "HANDICAP (prudence)";
  }
  return "NO_CLEAR_OPTION";
}

export function evaluateMatch(
  match: MatchEvaluationInput,
  meta: MatchMeta = {},
  config: EvaluationConfig = {}
): EvaluationResult {
  const cfg: Required<EvaluationConfig> = {
    minMatches: 50,
    minScore: 75,
    totalBots: 4,
    ...config,
  };

  const reasons: string[] = [];
  const warnings: string[] = [];

  if ((meta?.totalMatches ?? 0) < cfg.minMatches) {
    return {
      status: "FILTER_LOCKED",
      playable: false,
      score: 0,
      breakdown: {
        confidencePts: 0,
        consensusPts: 0,
        winPts: 0,
        fluxPts: 0,
        fluxShare: 0,
        zoneNullAvg: null,
      },
      recommendation: "COLLECT_MORE_MATCHES",
      reasons: [`Filtre desactive: ${(meta?.totalMatches ?? 0)}/${cfg.minMatches} matchs`],
      warnings: [],
    };
  }

  if (String(match.action || "").toUpperCase() !== "MISE PRUDENTE") {
    reasons.push("Action != MISE PRUDENTE");
  }

  if ((match.consensusBots ?? 0) < 3) {
    reasons.push("Consensus bots < 3/4");
  }

  if ((match.confidence ?? 0) < 60) {
    reasons.push("Confiance < 60%");
  }

  const pick = (match.pickSide || "").toUpperCase();
  const dominantWinPct = pick === "AWAY" ? match.winAway ?? 0 : match.winHome ?? 0;
  const otherWinPct = pick === "AWAY" ? match.winHome ?? 0 : match.winAway ?? 0;
  const winPts = winDominancePoints(dominantWinPct, otherWinPct, 30);
  if (winPts === 0) reasons.push("Win% pas assez dominant (>=55 et autre <=35 requis)");

  const homeFlux = match.homeFlux || [];
  const awayFlux = match.awayFlux || [];
  const zoneNull = match.zoneNull || [];

  const curvesClose = areCurvesTooClose(homeFlux, awayFlux, 6);
  if (curvesClose) reasons.push("Flux trop colles (match equilibre/chaos)");

  const chosenFlux = pick === "AWAY" ? awayFlux : homeFlux;
  const oppFlux = pick === "AWAY" ? homeFlux : awayFlux;
  const share = fluxDominanceShare(chosenFlux, oppFlux);
  const zoneNullOk = isZoneNullLow(zoneNull, 25);
  if (share < 0.7) reasons.push("Flux dominant < 70%");
  if (!zoneNullOk) warnings.push("Zone Nul pas basse (risque match bloque)");

  const oppSurgeLate = isOpponentSurgingLate(oppFlux, 10);
  if (oppSurgeLate) reasons.push("Remontee adverse en fin de match detectee");

  const confidencePts = pctToPoints(match.confidence ?? 0, 25, 60, 80);
  const consensusPts = consensusPoints(match.consensusBots ?? 0, cfg.totalBots, 25);
  const fluxPts = fluxPoints(share, zoneNullOk, 20);
  const score = Math.round(confidencePts + consensusPts + winPts + fluxPts);

  const baseMustPass =
    String(match.action || "").toUpperCase() === "MISE PRUDENTE" &&
    (match.consensusBots ?? 0) >= 3 &&
    (match.confidence ?? 0) >= 60;

  const playable = baseMustPass && score >= cfg.minScore && reasons.length === 0;
  const recommendation = recommendOption({
    dominantWinPct,
    confidence: match.confidence ?? 0,
    consensus: match.consensusBots ?? 0,
    fluxShare: share,
    zoneNullOk,
  });

  return {
    status: playable ? "PLAY" : "NO_PLAY",
    playable,
    score,
    breakdown: {
      confidencePts: Math.round(confidencePts),
      consensusPts: Math.round(consensusPts),
      winPts: Math.round(winPts),
      fluxPts: Math.round(fluxPts),
      fluxShare: Number(share.toFixed(3)),
      zoneNullAvg: average(zoneNull),
    },
    recommendation,
    reasons,
    warnings,
  };
}
