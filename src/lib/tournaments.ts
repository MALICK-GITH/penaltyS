/**
 * Tournament Service - Gestion des tournois FIFA Virtual
 * Récupère les compétitions disponibles depuis l'API 1xBet
 * Signed: SOLITAIRE HACK
 */

// Types pour le service de tournois
export interface Tournament {
  id: number;
  name: string;
  sportId: number;
  gamesCount: number;
  image: string | null;
  isPenalty: boolean;
  version: string;
  priority: number;
}

export interface TournamentResult {
  fetchedAt: string;
  source: "api" | "fallback" | "none";
  requestMeta?: {
    dateFrom: number;
    dateTo: number;
    url: string;
  };
  error?: string;
  totalCount: number;
  filteredCount: number;
  penaltyCount: number;
  tournaments: Tournament[];
}

export interface TournamentStats {
  totalTournaments: number;
  totalMatches: number;
  penaltyTournaments: number;
  penaltyMatches: number;
  versions: Record<string, { count: number; matches: number }>;
}

export interface TournamentStatsResult {
  fetchedAt: string;
  source: string;
  stats: TournamentStats;
}

const CHAMPS_API_URL = "https://1xbet.ci/service-api/result/web/api/v2/champs";

const DEFAULT_PARAMS = {
  lng: "fr",
  ref: "285",
  sportIds: "85",
};

const PENALTY_KEYWORDS = [
  "penalty",
  "penalties",
  "tir au but",
  "tirs au but",
  "shootout",
  "penaltis",
];

function normalizeText(value: string | number | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPenaltyTournament(tournament: any): boolean {
  const name = normalizeText(tournament?.name || "");
  return PENALTY_KEYWORDS.some((keyword) => name.includes(keyword));
}

function simplifyTournament(tournament: any): Tournament {
  const isPenalty = isPenaltyTournament(tournament);
  const versionMatch = String(tournament?.name || "").match(/(FC\s*\d+|FIFA\d+|FC\d+\.?)/i);
  const version = versionMatch ? versionMatch[1].replace(/\s+/g, "").toUpperCase() : "LEGACY";

  return {
    id: tournament.id,
    name: tournament.name,
    sportId: tournament.sportId,
    gamesCount: Number(tournament.gamesCount || 0),
    image: tournament.image || null,
    isPenalty,
    version,
    priority: isPenalty ? 10 : 5,
  };
}

function getTimestampRange(days = 1, futureOffsetDays = 20): { dateFrom: number; dateTo: number } {
  const now = Date.now();
  const dayMs = 86400000;
  const dateFrom = Math.floor((now + dayMs * futureOffsetDays) / 1000);
  const dateTo = Math.floor((now + dayMs * (futureOffsetDays + days)) / 1000);
  return { dateFrom, dateTo };
}

async function fetchTournamentsRaw(days = 1): Promise<{ payload: any; meta: any }> {
  const attempts = [
    getTimestampRange(days, 20),
    getTimestampRange(days, 1),
  ];

  let lastError: Error | null = null;

  for (const { dateFrom, dateTo } of attempts) {
    const params = new URLSearchParams({
      ...DEFAULT_PARAMS,
      dateFrom: String(dateFrom),
      dateTo: String(dateTo),
    });

    const url = `${CHAMPS_API_URL}?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
          Referer: "https://1xbet.ci/",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      return { payload, meta: { dateFrom, dateTo, url } };
    } catch (error) {
      lastError = error as Error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("Impossible de récupérer les tournois");
}

const FALLBACK_TOURNAMENTS: any[] = [
  { id: 2627439, name: "FC24. Penalty", sportId: 85, gamesCount: 80, image: "2e0481681dfa5f5c5c125731328c3f0b.png" },
  { id: 2952096, name: "FC26. Penalty", sportId: 85, gamesCount: 79, image: "767ec8bdfca0b0510ac290f30edea117.png" },
  { id: 2551768, name: "FIFA23. Penalty", sportId: 85, gamesCount: 80, image: "9598bb7b9bc62172655b5522e7eb5b0f.png" },
  { id: 2812138, name: "FC25. Penalty", sportId: 85, gamesCount: 80, image: "f4823bad7728306c4e8d674475521e03.png" },
  { id: 2334988, name: "Penalty", sportId: 85, gamesCount: 80, image: "79387ecbdf0337c4672fd5a8bb069f8d.png" },
  { id: 1939256, name: "Penalty", sportId: 85, gamesCount: 80, image: "354f5bad31d7814c02297404b4a47ae0.png" },
  { id: 2844289, name: "FC 25. 5x5 Rush. Superligue", sportId: 85, gamesCount: 40, image: "b6d789886fa686498cd4bf5b88464c21.png" },
  { id: 2648573, name: "FC 24. 4x4. Championnat d'Angleterre", sportId: 85, gamesCount: 40 },
  { id: 2860561, name: "FC 25. 3x3. Ligue de conférence", sportId: 85, gamesCount: 39, image: "a10dbaa7f75233083bc972f07452a2f0.png" },
  { id: 2902601, name: "FC 25. Championnat d'Espagne", sportId: 85, gamesCount: 20 },
  { id: 2837895, name: "FC 25. Italy Championship", sportId: 85, gamesCount: 19 },
  { id: 2870649, name: "FC 25. Championnat du monde", sportId: 85, gamesCount: 19, image: "c6d2ddf895caccac985a5ed5731b6e36.png" },
  { id: 2985586, name: "FC 26. Championnat du monde", sportId: 85, gamesCount: 19, image: "7fe71156ca8882c35d20f84cd1ce85d2.png" },
  { id: 2884422, name: "FC 25. Championnat d'Angleterre", sportId: 85, gamesCount: 19 },
  { id: 2911430, name: "FC 25. Ligue européenne", sportId: 85, gamesCount: 19, image: "df41499ba3fc1f36c7ebfc2e551e6546.png" },
  { id: 2866845, name: "FC 25. Champions League", sportId: 85, gamesCount: 19, image: "a0a3230c5d651a200e9a861ee7cc1dff.png" },
  { id: 2895064, name: "FC 25. Championnat d'Allemagne", sportId: 85, gamesCount: 19 },
];

function sortTournaments(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort((a: Tournament, b: Tournament) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.gamesCount - a.gamesCount;
  });
}

export async function getTournaments(options: { penaltyOnly?: boolean; days?: number; useFallback?: boolean } = {}): Promise<TournamentResult> {
  const { penaltyOnly = false, days = 1, useFallback = true } = options;

  try {
    const { payload, meta } = await fetchTournamentsRaw(days);
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const usingFallbackBecauseEmpty = rawItems.length === 0 && useFallback;
    const sourceItems = usingFallbackBecauseEmpty ? FALLBACK_TOURNAMENTS : rawItems;

    let tournaments = sourceItems.map(simplifyTournament);
    if (penaltyOnly) {
      tournaments = tournaments.filter((t: Tournament) => t.isPenalty);
    }

    tournaments = sortTournaments(tournaments);

    return {
      fetchedAt: new Date().toISOString(),
      source: usingFallbackBecauseEmpty ? "fallback" : "api",
      requestMeta: meta,
      totalCount: Number(payload?.count || sourceItems.length),
      filteredCount: tournaments.length,
      penaltyCount: tournaments.filter((t: Tournament) => t.isPenalty).length,
      tournaments,
    };
  } catch (error) {
    console.error("[TournamentService] Error:", (error as Error).message);

    if (useFallback) {
      let tournaments = FALLBACK_TOURNAMENTS.map(simplifyTournament);
      if (penaltyOnly) {
        tournaments = tournaments.filter((t: Tournament) => t.isPenalty);
      }

      tournaments = sortTournaments(tournaments);

      return {
        fetchedAt: new Date().toISOString(),
        source: "fallback",
        error: (error as Error).message,
        totalCount: FALLBACK_TOURNAMENTS.length,
        filteredCount: tournaments.length,
        penaltyCount: tournaments.filter((t) => t.isPenalty).length,
        tournaments,
      };
    }

    return {
      fetchedAt: new Date().toISOString(),
      source: "none",
      error: (error as Error).message,
      totalCount: 0,
      filteredCount: 0,
      penaltyCount: 0,
      tournaments: [],
    };
  }
}

export async function getPenaltyTournaments(): Promise<TournamentResult> {
  return getTournaments({ penaltyOnly: true });
}

export async function getTournamentById(tournamentId: string | number): Promise<Tournament | null> {
  const result = await getTournaments();
  return result.tournaments.find((t) => String(t.id) === String(tournamentId)) || null;
}

export async function getTournamentStats(): Promise<TournamentStatsResult> {
  const result = await getTournaments();
  const tournaments = result.tournaments;

  const stats: TournamentStats = {
    totalTournaments: tournaments.length,
    totalMatches: tournaments.reduce((sum, t) => sum + (t.gamesCount || 0), 0),
    penaltyTournaments: tournaments.filter((t) => t.isPenalty).length,
    penaltyMatches: tournaments
      .filter((t) => t.isPenalty)
      .reduce((sum, t) => sum + (t.gamesCount || 0), 0),
    versions: {},
  };

  tournaments.forEach((t) => {
    const version = t.version || "UNKNOWN";
    if (!stats.versions[version]) {
      stats.versions[version] = { count: 0, matches: 0 };
    }
    stats.versions[version].count += 1;
    stats.versions[version].matches += t.gamesCount || 0;
  });

  return {
    fetchedAt: result.fetchedAt,
    source: result.source,
    stats,
  };
}

export { isPenaltyTournament };
