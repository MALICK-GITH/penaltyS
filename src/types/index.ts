// Types pour les données FIFA et prédiction

export interface Sport {
  id: number;
  name: string;
  nameEng: string;
  command: string;
  shortName: string;
  subSports?: SubSport[];
  isCyber: boolean;
  isTeamSport: boolean;
}

export interface SubSport {
  subSportId: number;
  name: string;
}

export interface League {
  id: number;
  name: string;
  sportId: number;
  country?: string;
  isPopular: boolean;
}

export interface Team {
  id: number;
  name: string;
  logo?: string;
  country?: string;
}

export interface Match {
  id: string;
  leagueId: number;
  sourceEventId?: number;
  homeTeam: Team;
  awayTeam: Team;
  startTime: string;
  status: 'live' | 'scheduled' | 'finished';
  score?: {
    home: number;
    away: number;
  };
  odds?: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
}

export interface Prediction {
  matchId: string;
  recommendedBet: BetRecommendation;
  alternativeBets: BetRecommendation[];
  confidence: number;
  reasoning: string[];
  riskLevel: 'low' | 'medium' | 'high';
  expectedValue: number;
}

export interface BetRecommendation {
  type: 'home_win' | 'away_win' | 'draw' | 'over_2_5' | 'under_2_5' | 'btts' | 'correct_score';
  description: string;
  odds: number;
  stake: number; // Pourcentage du bankroll recommandé
}

export interface TeamStats {
  teamId: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  recentForm: string[]; // ['W', 'D', 'L', 'W', 'W']
  homeForm?: string[];
  awayForm?: string[];
}

export type ApiUtility = 'core_data' | 'market_context' | 'configuration' | 'marketing' | 'analytics';

export interface ApiEndpointAnalysis {
  id: string;
  name: string;
  url: string;
  utility: ApiUtility;
  predictionValue: number;
  refreshCadence: string;
  usableSignals: string[];
  platformUse: string;
  risk: string;
}

export interface PredictionPipelineStep {
  title: string;
  description: string;
  inputs: string[];
  output: string;
}

export interface LiveFifaSnapshot {
  leagues: League[];
  matches: Match[];
}
