import axios from 'axios';
import { ApiEndpointAnalysis, PredictionPipelineStep, Sport, League, Match, TeamStats, LiveFifaSnapshot, Tournament } from '@/types';
import * as tournamentService from './tournaments';

const API_BASE = 'https://1xbet.ci';
const LIVE_FEED_BASE = 'https://1xbet.com';

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'X-Requested-With': 'XMLHttpRequest',
};

const oneXBetCiHeaders = {
  ...browserHeaders,
  Origin: API_BASE,
  Referer: `${API_BASE}/fr/live/fifa`,
};

const oneXBetLiveHeaders = {
  ...browserHeaders,
  Origin: LIVE_FEED_BASE,
  Referer: `${LIVE_FEED_BASE}/fr/live/fifa`,
};

export const api = axios.create({
  baseURL: API_BASE,
  headers: oneXBetCiHeaders,
  timeout: 30000,
});

const liveFeedApi = axios.create({
  baseURL: LIVE_FEED_BASE,
  headers: oneXBetLiveHeaders,
  timeout: 30000,
});

interface LiveFeedMarket {
  C?: number;
  G?: number;
  T?: number;
}

interface LiveFeedEvent {
  E?: LiveFeedMarket[];
  I: number;
  L: string;
  LE?: string;
  LI: number;
  O1: string;
  O1I?: number;
  O2: string;
  O2I?: number;
  S: number;
  SI: number;
  SN: string;
  SC?: {
    FS?: {
      S1?: number;
      S2?: number;
    };
    SLS?: string;
  };
}

interface LiveFeedResponse {
  Success: boolean;
  Value?: LiveFeedEvent[];
}

function get1x2Odds(markets: LiveFeedMarket[] = []) {
  return {
    homeWin: markets.find((market) => market.G === 1 && market.T === 1)?.C ?? 2,
    draw: markets.find((market) => market.G === 1 && market.T === 2)?.C ?? 0,
    awayWin: markets.find((market) => market.G === 1 && market.T === 3)?.C ?? 2,
  };
}

export function normalizeLiveFifaFeed(events: LiveFeedEvent[]): LiveFifaSnapshot {
  const leaguesById = new Map<number, League>();
  const teamsByName = new Map<string, number>();
  const penaltyEvents = events.filter((event) => {
    const leagueName = `${event.L} ${event.LE ?? ''}`.toLowerCase();
    return leagueName.includes('penalty');
  });

  const getTeamId = (name: string, externalId?: number) => {
    if (externalId) return externalId;
    if (!teamsByName.has(name)) teamsByName.set(name, teamsByName.size + 1);
    return teamsByName.get(name)!;
  };

  const matches = penaltyEvents.map((event) => {
    if (!leaguesById.has(event.LI)) {
      leaguesById.set(event.LI, {
        id: event.LI,
        name: event.LE ?? event.L,
        sportId: event.SI,
        country: event.SN,
        isPopular: true,
      });
    }

    const score = event.SC?.FS?.S1 !== undefined && event.SC?.FS?.S2 !== undefined
      ? { home: event.SC.FS.S1, away: event.SC.FS.S2 }
      : undefined;

    return {
      id: String(event.I),
      sourceEventId: event.I,
      leagueId: event.LI,
      homeTeam: { id: getTeamId(event.O1, event.O1I), name: event.O1 },
      awayTeam: { id: getTeamId(event.O2, event.O2I), name: event.O2 },
      startTime: new Date(event.S * 1000).toISOString(),
      status: score ? 'live' as const : 'scheduled' as const,
      score,
      odds: get1x2Odds(event.E),
    };
  });

  return {
    leagues: Array.from(leaguesById.values()),
    matches,
  };
}

function getFallbackFifaPenaltySnapshot(): LiveFifaSnapshot {
  return {
    leagues: mockData.getLeaguesWithMatches(),
    matches: mockData.matches,
  };
}

export const sportsApi = {
  async getLiveFifaSnapshot(): Promise<LiveFifaSnapshot> {
    try {
      const response = await liveFeedApi.get<LiveFeedResponse>('/service-api/LiveFeed/Get1x2_VZip', {
        params: {
          sports: 85,
          count: 200,
          lng: 'fr',
          gr: 285,
          mode: 4,
          country: 96,
          getEmpty: true,
          virtualSports: true,
          noFilterBlockEvent: true,
        },
      });

      const snapshot = normalizeLiveFifaFeed(response.data.Value ?? []);
      return snapshot.matches.length > 0 ? snapshot : getFallbackFifaPenaltySnapshot();
    } catch (error) {
      console.error('Error fetching live FIFA feed:', error);
      return getFallbackFifaPenaltySnapshot();
    }
  },

  async getSports(): Promise<Sport[]> {
    try {
      const response = await api.get('/service-api/result/web/api/v2/sports', {
        headers: {
          ...oneXBetCiHeaders,
          Referer: `${API_BASE}/fr/results`,
        },
        params: {
          cyberFlag: 4,
          dateFrom: Math.floor(Date.now() / 1000) - 86400,
          dateTo: Math.floor(Date.now() / 1000) + 86400,
          lng: 'fr',
        },
      });
      return response.data.items;
    } catch (error) {
      console.error('Error fetching sports:', error);
      return [];
    }
  },

  async getFifaResultLeagues(dateFrom: number, dateTo: number): Promise<League[]> {
    try {
      const response = await api.get('/service-api/result/web/api/v2/champs', {
        headers: {
          ...oneXBetCiHeaders,
          Referer: `${API_BASE}/fr/results`,
        },
        params: {
          cyberFlag: 4,
          dateFrom,
          dateTo,
          lng: 'fr',
          sportIds: 85,
        },
      });

      const items = response.data.items ?? [];
      return items
        .filter((item: { id: number; name: string }) => item.name.toLowerCase().includes('penalty'))
        .map((item: { id: number; name: string }) => ({
          id: item.id,
          name: item.name,
          sportId: 85,
          country: 'FIFA Penalty',
          isPopular: true,
        }));
    } catch (error) {
      console.error('Error fetching FIFA result leagues:', error);
      return [];
    }
  },

  async getSportsDetailed(): Promise<Sport[]> {
    try {
      const response = await api.get('/service-api/restcore/api/External/v1/Web/Sports', {
        params: {
          lng: 'en',
          nameEng: true,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching detailed sports:', error);
      return [];
    }
  },

  async getFIFASports(): Promise<Sport[]> {
    const sports = await this.getSportsDetailed();
    return sports.filter(sport => 
      sport.nameEng.toLowerCase().includes('fifa') || 
      (sport.isCyber && sport.nameEng.toLowerCase().includes('football'))
    );
  },
};

export const apiIntelligence = {
  endpoints: [
    {
      id: 'live-fifa-1x2',
      name: 'Live FIFA Penalty VZip',
      url: '/service-api/LiveFeed/Get1x2_VZip?sports=85&gr=285&virtualSports=true&filter=Penalty',
      utility: 'core_data',
      predictionValue: 100,
      refreshCadence: '10 a 30 secondes pendant le live',
      usableSignals: [
        'ligues Penalty LI/L/LE',
        'equipes O1/O2',
        'cotes gagnant Penalty E',
        'heure de depart S',
        'score et statut SC',
      ],
      platformUse:
        'Source prioritaire pour afficher uniquement les matchs FIFA Penalty, leur ligue exacte et les cotes gagnant du moment.',
      risk:
        'Endpoint live non officiel pour notre application: prevoir fallback cache/mock et gestion des changements de schema.',
    },
    {
      id: 'results-sports',
      name: 'Sports et resultats',
      url: '/service-api/result/web/api/v2/sports',
      utility: 'core_data',
      predictionValue: 95,
      refreshCadence: '30 a 60 secondes sur les sessions live',
      usableSignals: [
        'sports cyber disponibles',
        'fenetre de resultats dateFrom/dateTo',
        'presence de competitions virtuelles FIFA',
        'volume de matchs actifs ou termines',
      ],
      platformUse:
        'Point d entree principal pour detecter le FIFA virtuel, separer live/resultats et construire un calendrier exploitable.',
      risk:
        'Endpoint public non contractuel: schema, domaine et politique CORS peuvent changer sans preavis.',
    },
    {
      id: 'results-champs',
      name: 'Championnats',
      url: '/service-api/result/web/api/v2/champs',
      utility: 'core_data',
      predictionValue: 90,
      refreshCadence: '1 a 5 minutes selon le volume',
      usableSignals: [
        'ligues par sport',
        'popularite des competitions',
        'segmentation par pays ou categorie',
        'mapping sportId vers championnat',
      ],
      platformUse:
        'Alimente les pages ligues, filtre les championnats FIFA Penalty et aide a grouper les matchs par competition.',
      risk:
        'Depend fortement des parametres lng, cyberFlag, dateFrom et dateTo.',
    },
    {
      id: 'sports-names',
      name: 'Noms de sports multilingues',
      url: '/service-api/restcore/api/External/v1/Web/Sports',
      utility: 'configuration',
      predictionValue: 70,
      refreshCadence: 'A cache longue duree, 6 a 24 heures',
      usableSignals: [
        'nameEng normalise',
        'isCyber',
        'command',
        'shortName',
      ],
      platformUse:
        'Normalise les noms, evite de confondre football reel et FIFA virtuel, et stabilise les filtres de recherche.',
      risk:
        'Valeur predictive indirecte: utile pour classer les donnees, pas pour predire un score.',
    },
    {
      id: 'bff-config',
      name: 'Configuration globale BFF',
      url: '/bff-api/config/group/get',
      utility: 'configuration',
      predictionValue: 35,
      refreshCadence: 'A cache longue duree, 12 a 24 heures',
      usableSignals: [
        'modules visibles',
        'parametres regionaux',
        'langues et structure UI',
      ],
      platformUse:
        'Sert a comprendre l environnement du site source, mais ne doit pas piloter directement les predictions.',
      risk:
        'Peut contenir beaucoup de bruit applicatif sans lien sportif.',
    },
    {
      id: 'payment-systems',
      name: 'Systemes de paiement',
      url: '/paysystems/information/systems',
      utility: 'market_context',
      predictionValue: 5,
      refreshCadence: 'Ne pas consommer pour la prediction',
      usableSignals: ['region', 'devise potentielle', 'methodes de depot'],
      platformUse:
        'A exclure du moteur sportif. Eventuellement utile seulement pour une page informative de conformite regionale.',
      risk:
        'Hors sujet pour predire un match; l utiliser melangerait produit de pari et analyse sportive.',
    },
    {
      id: 'welcome-bonuses',
      name: 'Bonus marketing',
      url: '/web-api/api/v3/bonuses/welcome-bonuses',
      utility: 'marketing',
      predictionValue: 0,
      refreshCadence: 'Ne pas consommer pour la prediction',
      usableSignals: ['promotions', 'messages commerciaux'],
      platformUse:
        'A ignorer dans une plateforme de prediction serieuse: aucun signal sportif.',
      risk:
        'Risque de biaiser l interface vers l incitation plutot que l analyse.',
    },
    {
      id: 'analytics',
      name: 'Analytics du site source',
      url: '/analytics-module-api/v1/analytics',
      utility: 'analytics',
      predictionValue: 0,
      refreshCadence: 'Ne pas consommer',
      usableSignals: ['tracking', 'projectId', 'domaine'],
      platformUse:
        'Non pertinent pour les predictions. A remplacer par vos propres mesures produit anonymisees.',
      risk:
        'Endpoint de suivi, pas une source de donnees sportives.',
    },
  ] satisfies ApiEndpointAnalysis[],

  pipeline: [
    {
      title: 'Decouverte du FIFA virtuel',
      description: 'Identifier uniquement les sports cyber et les competitions FIFA Penalty disponibles.',
      inputs: ['Sports', 'Noms de sports EN', 'Championnats'],
      output: 'Catalogue propre des ligues et matchs virtuels',
    },
    {
      title: 'Normalisation des matchs',
      description: 'Transformer les donnees externes en Match, Team, League et TeamStats internes.',
      inputs: ['sportId', 'champId', 'teams', 'scores', 'horaires'],
      output: 'Donnees stables pour l interface et le moteur',
    },
    {
      title: 'Features de prediction',
      description: 'Calculer forme recente, difference de buts, cadence de scores et ecart de cotes.',
      inputs: ['resultats termines', 'cotes 1X2', 'historique equipe'],
      output: 'Scores de force et probabilites estimees',
    },
    {
      title: 'Decision responsable',
      description: 'Afficher confiance, risque, valeur attendue et avertissement de limite du modele.',
      inputs: ['probabilites', 'cotes', 'qualite des donnees'],
      output: 'Prediction explicable sans promesse de gain',
    },
  ] satisfies PredictionPipelineStep[],

  getPredictiveEndpoints(): ApiEndpointAnalysis[] {
    return this.endpoints.filter((endpoint) => endpoint.predictionValue >= 70);
  },
};

export const mockData = {
  leagues: [
    { id: 2952096, name: 'FC26. Penalty', sportId: 85, country: 'FIFA Penalty', isPopular: true },
    { id: 2812138, name: 'FC25. Penalty', sportId: 85, country: 'FIFA Penalty', isPopular: true },
    { id: 2627439, name: 'FC24. Penalty', sportId: 85, country: 'FIFA Penalty', isPopular: true },
    { id: 2551768, name: 'FIFA23. Penalty', sportId: 85, country: 'FIFA Penalty', isPopular: true },
    { id: 2334988, name: 'FIFA22. Penalty', sportId: 85, country: 'FIFA Penalty', isPopular: false },
    { id: 1939256, name: 'FIFA18. Penalty', sportId: 85, country: 'FIFA Penalty', isPopular: false },
  ],

  teams: [
    { id: 1, name: 'Real Madrid FC', country: 'Spain' },
    { id: 2, name: 'FC Barcelona', country: 'Spain' },
    { id: 3, name: 'Manchester United', country: 'England' },
    { id: 4, name: 'Liverpool FC', country: 'England' },
    { id: 5, name: 'Bayern Munich', country: 'Germany' },
    { id: 6, name: 'Paris Saint-Germain', country: 'France' },
    { id: 7, name: 'Juventus FC', country: 'Italy' },
    { id: 8, name: 'AC Milan', country: 'Italy' },
    { id: 9, name: 'Chelsea FC', country: 'England' },
    { id: 10, name: 'Arsenal FC', country: 'England' },
    { id: 11, name: 'Inter Milan', country: 'Italy' },
    { id: 12, name: 'Atletico Madrid', country: 'Spain' },
  ],

  matches: [
    {
      id: 'm1',
      leagueId: 2952096,
      homeTeam: { id: 1, name: 'Barcelone', country: 'FIFA Penalty' },
      awayTeam: { id: 2, name: 'Juventus', country: 'FIFA Penalty' },
      startTime: new Date(Date.now() + 3600000).toISOString(),
      status: 'scheduled' as const,
      odds: { homeWin: 1.88, draw: 0, awayWin: 1.84 },
    },
    {
      id: 'm2',
      leagueId: 2952096,
      homeTeam: { id: 3, name: 'Bayern Munich', country: 'FIFA Penalty' },
      awayTeam: { id: 4, name: 'Al Nassr', country: 'FIFA Penalty' },
      startTime: new Date(Date.now() + 7200000).toISOString(),
      status: 'scheduled' as const,
      odds: { homeWin: 1.88, draw: 0, awayWin: 1.85 },
    },
    {
      id: 'm3',
      leagueId: 2812138,
      homeTeam: { id: 5, name: 'Bayern Munich', country: 'FIFA Penalty' },
      awayTeam: { id: 6, name: 'Barcelone', country: 'FIFA Penalty' },
      startTime: new Date(Date.now() + 10800000).toISOString(),
      status: 'scheduled' as const,
      odds: { homeWin: 1.70, draw: 0, awayWin: 2.03 },
    },
    {
      id: 'm4',
      leagueId: 2812138,
      homeTeam: { id: 7, name: 'Inter Miami', country: 'FIFA Penalty' },
      awayTeam: { id: 8, name: 'Liverpool', country: 'FIFA Penalty' },
      startTime: new Date(Date.now() + 14400000).toISOString(),
      status: 'scheduled' as const,
      odds: { homeWin: 2.49, draw: 0, awayWin: 1.45 },
    },
    {
      id: 'm5',
      leagueId: 2551768,
      homeTeam: { id: 9, name: 'Liverpool', country: 'FIFA Penalty' },
      awayTeam: { id: 10, name: 'Bayern Munich', country: 'FIFA Penalty' },
      startTime: new Date(Date.now() + 18000000).toISOString(),
      status: 'scheduled' as const,
      odds: { homeWin: 1.80, draw: 0, awayWin: 2.02 },
    },
    {
      id: 'm6',
      leagueId: 2334988,
      homeTeam: { id: 11, name: 'Arsenal', country: 'FIFA Penalty' },
      awayTeam: { id: 12, name: 'Liverpool', country: 'FIFA Penalty' },
      startTime: new Date(Date.now() + 21600000).toISOString(),
      status: 'scheduled' as const,
      odds: { homeWin: 2.09, draw: 0, awayWin: 1.66 },
    },
  ],

  teamStats: new Map<number, TeamStats>([
    [1, { teamId: 1, wins: 15, draws: 5, losses: 3, goalsFor: 45, goalsAgainst: 20, recentForm: ['W', 'W', 'D', 'W', 'L'], homeForm: ['W', 'W', 'W', 'D', 'W'], awayForm: ['D', 'W', 'L', 'W', 'W'] }],
    [2, { teamId: 2, wins: 14, draws: 4, losses: 5, goalsFor: 42, goalsAgainst: 22, recentForm: ['W', 'D', 'W', 'L', 'W'], homeForm: ['W', 'W', 'D', 'W', 'W'], awayForm: ['L', 'W', 'W', 'D', 'L'] }],
    [3, { teamId: 3, wins: 12, draws: 6, losses: 5, goalsFor: 38, goalsAgainst: 25, recentForm: ['D', 'W', 'W', 'L', 'D'], homeForm: ['W', 'D', 'W', 'W', 'D'], awayForm: ['L', 'W', 'D', 'L', 'W'] }],
    [4, { teamId: 4, wins: 13, draws: 5, losses: 5, goalsFor: 40, goalsAgainst: 23, recentForm: ['W', 'L', 'W', 'W', 'D'], homeForm: ['W', 'W', 'W', 'L', 'W'], awayForm: ['D', 'L', 'W', 'D', 'W'] }],
    [5, { teamId: 5, wins: 16, draws: 4, losses: 3, goalsFor: 50, goalsAgainst: 18, recentForm: ['W', 'W', 'W', 'D', 'W'], homeForm: ['W', 'W', 'W', 'W', 'W'], awayForm: ['D', 'W', 'L', 'W', 'W'] }],
    [6, { teamId: 6, wins: 11, draws: 5, losses: 7, goalsFor: 35, goalsAgainst: 28, recentForm: ['L', 'D', 'W', 'L', 'W'], homeForm: ['W', 'W', 'D', 'W', 'L'], awayForm: ['L', 'L', 'W', 'D', 'W'] }],
    [7, { teamId: 7, wins: 10, draws: 7, losses: 6, goalsFor: 32, goalsAgainst: 26, recentForm: ['D', 'D', 'W', 'L', 'W'], homeForm: ['W', 'D', 'W', 'D', 'W'], awayForm: ['L', 'D', 'W', 'L', 'D'] }],
    [8, { teamId: 8, wins: 9, draws: 8, losses: 6, goalsFor: 30, goalsAgainst: 27, recentForm: ['W', 'D', 'D', 'W', 'L'], homeForm: ['W', 'W', 'D', 'W', 'D'], awayForm: ['D', 'L', 'D', 'W', 'L'] }],
    [9, { teamId: 9, wins: 11, draws: 6, losses: 6, goalsFor: 36, goalsAgainst: 28, recentForm: ['W', 'L', 'D', 'W', 'W'], homeForm: ['W', 'W', 'W', 'L', 'W'], awayForm: ['L', 'D', 'W', 'D', 'W'] }],
    [10, { teamId: 10, wins: 12, draws: 5, losses: 6, goalsFor: 38, goalsAgainst: 27, recentForm: ['W', 'W', 'L', 'D', 'W'], homeForm: ['W', 'W', 'D', 'W', 'W'], awayForm: ['L', 'W', 'W', 'D', 'L'] }],
    [11, { teamId: 11, wins: 10, draws: 7, losses: 6, goalsFor: 33, goalsAgainst: 26, recentForm: ['D', 'W', 'W', 'D', 'L'], homeForm: ['W', 'D', 'W', 'W', 'D'], awayForm: ['L', 'W', 'D', 'L', 'W'] }],
    [12, { teamId: 12, wins: 9, draws: 8, losses: 6, goalsFor: 31, goalsAgainst: 28, recentForm: ['D', 'D', 'L', 'W', 'W'], homeForm: ['W', 'W', 'D', 'W', 'D'], awayForm: ['L', 'D', 'W', 'L', 'W'] }],
  ]),

  getLeagues(): League[] {
    return this.leagues;
  },

  getLeaguesWithMatches(): League[] {
    const activeLeagueIds = new Set(this.matches.map(match => match.leagueId));
    return this.leagues.filter(league => activeLeagueIds.has(league.id));
  },

  getLeagueById(leagueId: number): League | undefined {
    return this.leagues.find(league => league.id === leagueId);
  },

  getMatchesByLeague(leagueId: number): Match[] {
    return this.matches.filter(m => m.leagueId === leagueId);
  },

  getMatchById(matchId: string): Match | undefined {
    return this.matches.find(m => m.id === matchId);
  },

  getTeamStats(teamId: number): TeamStats | undefined {
    return this.teamStats.get(teamId);
  },

  // Tournament service integration
  async getTournaments(options?: { penaltyOnly?: boolean; days?: number; useFallback?: boolean }) {
    return tournamentService.getTournaments(options);
  },

  async getPenaltyTournaments() {
    return tournamentService.getPenaltyTournaments();
  },

  async getTournamentById(tournamentId: string | number) {
    return tournamentService.getTournamentById(tournamentId);
  },

  async getTournamentStats() {
    return tournamentService.getTournamentStats();
  },
};
