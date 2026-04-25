import { Match, Prediction, BetRecommendation, TeamStats, MatchEvaluationInput, EvaluationResult } from '@/types';
import { mockData } from './api';
import { genererPredictionUnifiee, BetInput, MatchContext } from './bots';
import { buildDecisionEngine, MatchRecord as HistoricalMatchRecord } from './historical';
import { evaluateMatch } from './evaluation';

export class PredictionEngine {
  private historicalEngine: ReturnType<typeof buildDecisionEngine> | null = null;

  constructor() {
    // Initialiser le moteur historique avec des données mockées
    this.initializeHistoricalEngine();
  }

  private initializeHistoricalEngine() {
    // Données historiques mockées pour FIFA Penalty
    const mockHistoricalData: HistoricalMatchRecord[] = [
      {
        id: "h1",
        date: "2026-04-20",
        ligue: "FC26",
        home: "Real Madrid",
        away: "Manchester City",
        score: "2-1",
        option: "Victoire Real Madrid",
        odds: 1.85,
        stake_fcfa: 1000,
        issue: "win",
      },
      {
        id: "h2",
        date: "2026-04-20",
        ligue: "FC25",
        home: "Barcelona",
        away: "Liverpool",
        score: "1-2",
        option: "Victoire Liverpool",
        odds: 2.10,
        stake_fcfa: 1000,
        issue: "win",
      },
      {
        id: "h3",
        date: "2026-04-19",
        ligue: "FC25_5x5_RUSH",
        home: "Bayern Munich",
        away: "PSG",
        score: "3-2",
        option: "Handicap Bayern Munich -1",
        odds: 1.95,
        stake_fcfa: 1500,
        issue: "win",
      },
      {
        id: "h4",
        date: "2026-04-19",
        ligue: "FC24_4x4",
        home: "Arsenal",
        away: "Chelsea",
        score: "2-2",
        option: "Plus de 3.5 buts",
        odds: 2.30,
        stake_fcfa: 800,
        issue: "loss",
      },
      {
        id: "h5",
        date: "2026-04-18",
        ligue: "FC26",
        home: "Juventus",
        away: "Inter Milan",
        score: "1-0",
        option: "Victoire Juventus",
        odds: 2.15,
        stake_fcfa: 1200,
        issue: "win",
      },
    ];

    this.historicalEngine = buildDecisionEngine(mockHistoricalData, mockHistoricalData.length, {
      minMatches: 5,
      minRulePlayed: 2,
    });
  }

  calculatePrediction(match: Match): Prediction {
    const homeStats = mockData.getTeamStats(match.homeTeam.id);
    const awayStats = mockData.getTeamStats(match.awayTeam.id);

    if (!homeStats || !awayStats) {
      return this.createDefaultPrediction(match);
    }

    const homeStrength = this.calculateTeamStrength(homeStats);
    const awayStrength = this.calculateTeamStrength(awayStats);
    
    const homeAdvantage = 0.15; // Avantage domicile
    const totalStrength = homeStrength + homeAdvantage + awayStrength;
    
    const homeWinProbability = (homeStrength + homeAdvantage) / totalStrength;
    const hasDrawMarket = Boolean(match.odds?.draw && match.odds.draw > 1);
    const drawProbability = hasDrawMarket ? 0.25 : 0;
    const awayWinProbability = 1 - homeWinProbability - drawProbability;

    const recommendedBet = this.getRecommendedBet(
      match,
      homeWinProbability,
      awayWinProbability,
      homeStats,
      awayStats
    );

    const alternativeBets = this.getAlternativeBets(
      match,
      homeWinProbability,
      awayWinProbability,
      drawProbability,
      homeStats,
      awayStats,
      recommendedBet
    );

    // Générer prédictions multi-bots pour les paris alternatifs
    const botPredictions = this.generateBotPredictions(match, homeStats, awayStats);

    // Générer analyse historique
    const historicalAnalysis = this.generateHistoricalAnalysis(match);

    // Générer évaluation de match
    const matchEvaluation = this.generateMatchEvaluation(match, homeStats, awayStats);

    const reasoning = this.generateReasoning(
      match,
      homeStats,
      awayStats,
      homeWinProbability,
      awayWinProbability
    );

    const confidence = this.calculateConfidence(homeStats, awayStats);
    const riskLevel = this.calculateRiskLevel(confidence, recommendedBet);
    const expectedValue = this.calculateExpectedValue(recommendedBet, homeWinProbability, awayWinProbability);

    const rawPrediction: Prediction = {
      matchId: match.id,
      recommendedBet,
      alternativeBets,
      confidence,
      reasoning,
      riskLevel,
      expectedValue,
      botPredictions,
      historicalAnalysis,
      matchEvaluation,
    };

    // Consolider les prédictions pour éviter les contradictions
    return this.consolidatePredictions(rawPrediction, botPredictions, historicalAnalysis, matchEvaluation);
  }

  private calculateTeamStrength(stats: TeamStats): number {
    const totalMatches = stats.wins + stats.draws + stats.losses;
    const winRate = stats.wins / totalMatches;
    const goalDiff = (stats.goalsFor - stats.goalsAgainst) / totalMatches;
    const recentFormScore = this.calculateFormScore(stats.recentForm);
    
    return (winRate * 0.4) + (goalDiff * 0.3) + (recentFormScore * 0.3);
  }

  private calculateFormScore(form: string[]): number {
    let score = 0;
    form.forEach(result => {
      if (result === 'W') score += 3;
      else if (result === 'D') score += 1;
      else score -= 1;
    });
    return Math.max(0, Math.min(1, (score + 5) / 15));
  }

  private getRecommendedBet(
    match: Match,
    homeWinProb: number,
    awayWinProb: number,
    homeStats: TeamStats,
    awayStats: TeamStats
  ): BetRecommendation {
    const homeOdds = match.odds?.homeWin || 2.0;
    const drawOdds = match.odds?.draw || 0;
    const awayOdds = match.odds?.awayWin || 3.0;

    const homeEV = (homeWinProb * homeOdds) - 1;
    const drawEV = drawOdds > 1 ? (0.25 * drawOdds) - 1 : Number.NEGATIVE_INFINITY;
    const awayEV = (awayWinProb * awayOdds) - 1;

    let bestBet: BetRecommendation;
    const maxEV = Math.max(homeEV, drawEV, awayEV);

    if (maxEV === homeEV && homeEV > 0) {
      bestBet = {
        type: 'home_win',
        description: `Victoire ${match.homeTeam.name}`,
        odds: homeOdds,
        stake: this.calculateStake(homeEV, homeWinProb, homeOdds),
      };
    } else if (maxEV === awayEV && awayEV > 0) {
      bestBet = {
        type: 'away_win',
        description: `Victoire ${match.awayTeam.name}`,
        odds: awayOdds,
        stake: this.calculateStake(awayEV, awayWinProb, awayOdds),
      };
    } else if (drawEV > 0 && drawOdds > 1) {
      bestBet = {
        type: 'draw',
        description: 'Match nul',
        odds: drawOdds,
        stake: this.calculateStake(drawEV, 0.25, drawOdds),
      };
    } else {
      // Si aucun EV positif, choisir le moins risqué
      if (homeWinProb > awayWinProb) {
        bestBet = {
          type: 'home_win',
          description: `Victoire ${match.homeTeam.name}`,
          odds: homeOdds,
          stake: 2,
        };
      } else {
        bestBet = {
          type: 'away_win',
          description: `Victoire ${match.awayTeam.name}`,
          odds: awayOdds,
          stake: 2,
        };
      }
    }

    // Vérifier les alternative bets
    const avgGoals = (homeStats.goalsFor + homeStats.goalsAgainst + awayStats.goalsFor + awayStats.goalsAgainst) / 4;
    if (avgGoals > 2.5 && match.odds) {
      const overOdds = 1.85;
      const overEV = (0.55 * overOdds) - 1;
      if (overEV > maxEV) {
        bestBet = {
          type: 'over_2_5',
          description: 'Plus de 2.5 buts',
          odds: overOdds,
          stake: this.calculateStake(overEV, 0.55, overOdds),
        };
      }
    }

    return bestBet;
  }

  private getAlternativeBets(
    match: Match,
    homeWinProb: number,
    awayWinProb: number,
    drawProb: number,
    homeStats: TeamStats,
    awayStats: TeamStats,
    recommendedBet: BetRecommendation
  ): BetRecommendation[] {
    const alternatives: BetRecommendation[] = [];
    const homeOdds = match.odds?.homeWin || 2.0;
    const awayOdds = match.odds?.awayWin || 2.0;
    const drawOdds = match.odds?.draw || 0;

    // Alternative 1: L'autre résultat 1X2
    if (recommendedBet.type === 'home_win') {
      const awayEV = (awayWinProb * awayOdds) - 1;
      if (awayEV > -0.2) {
        alternatives.push({
          type: 'away_win',
          description: `Victoire ${match.awayTeam.name}`,
          odds: awayOdds,
          stake: this.calculateStake(awayEV, awayWinProb, awayOdds),
        });
      }
    } else if (recommendedBet.type === 'away_win') {
      const homeEV = (homeWinProb * homeOdds) - 1;
      if (homeEV > -0.2) {
        alternatives.push({
          type: 'home_win',
          description: `Victoire ${match.homeTeam.name}`,
          odds: homeOdds,
          stake: this.calculateStake(homeEV, homeWinProb, homeOdds),
        });
      }
    }

    // Alternative 2: Handicap virtuel (équipe favorite avec cote ajustée)
    const favoriteOdds = Math.min(homeOdds, awayOdds);
    const handicapOdds = favoriteOdds * 1.3; // Cote ajustée pour handicap
    const favoriteProb = homeOdds < awayOdds ? homeWinProb : awayWinProb;
    const handicapEV = (favoriteProb * handicapOdds) - 1;
    
    if (handicapEV > -0.15) {
      alternatives.push({
        type: homeOdds < awayOdds ? 'home_win' : 'away_win',
        description: `Victoire ${homeOdds < awayOdds ? match.homeTeam.name : match.awayTeam.name} (handicap)`,
        odds: handicapOdds,
        stake: this.calculateStake(handicapEV, favoriteProb, handicapOdds),
      });
    }

    // Alternative 3: Double chance (si draw market existe)
    if (drawOdds > 1) {
      const doubleChanceHomeOdds = 1 / ((1 / homeOdds) + (1 / drawOdds));
      const doubleChanceHomeProb = homeWinProb + drawProb;
      const doubleChanceHomeEV = (doubleChanceHomeProb * doubleChanceHomeOdds) - 1;
      
      if (doubleChanceHomeEV > -0.1) {
        alternatives.push({
          type: 'home_win',
          description: `Double chance: ${match.homeTeam.name} ou nul`,
          odds: doubleChanceHomeOdds,
          stake: this.calculateStake(doubleChanceHomeEV, doubleChanceHomeProb, doubleChanceHomeOdds),
        });
      }

      const doubleChanceAwayOdds = 1 / ((1 / awayOdds) + (1 / drawOdds));
      const doubleChanceAwayProb = awayWinProb + drawProb;
      const doubleChanceAwayEV = (doubleChanceAwayProb * doubleChanceAwayOdds) - 1;
      
      if (doubleChanceAwayEV > -0.1) {
        alternatives.push({
          type: 'away_win',
          description: `Double chance: ${match.awayTeam.name} ou nul`,
          odds: doubleChanceAwayOdds,
          stake: this.calculateStake(doubleChanceAwayEV, doubleChanceAwayProb, doubleChanceAwayOdds),
        });
      }
    }

    // Alternative 4: Under/Over basé sur la forme défensive
    const avgGoalsConceded = (homeStats.goalsAgainst + awayStats.goalsAgainst) / 2;
    if (avgGoalsConceded < 1.5) {
      const underOdds = 1.9;
      const underProb = 0.6;
      const underEV = (underProb * underOdds) - 1;
      
      if (underEV > -0.1) {
        alternatives.push({
          type: 'under_2_5',
          description: 'Moins de 2.5 buts (défense solide)',
          odds: underOdds,
          stake: this.calculateStake(underEV, underProb, underOdds),
        });
      }
    }

    // Filtrer pour ne pas inclure le bet recommandé et limiter à 3 alternatives
    return alternatives
      .filter(alt => alt.description !== recommendedBet.description)
      .slice(0, 3);
  }

  private calculateStake(ev: number, probability: number, odds: number): number {
    // Kelly Criterion simplifié
    const edge = Math.max(ev, 0);
    const kelly = odds > 1 ? (edge / (odds - 1)) * probability : 0;
    const adjustedKelly = Math.min(kelly, 0.08); // Max 8% du bankroll
    return Math.max(1, Math.round(adjustedKelly * 100));
  }

  private generateReasoning(
    match: Match,
    homeStats: TeamStats,
    awayStats: TeamStats,
    homeWinProb: number,
    awayWinProb: number
  ): string[] {
    const reasoning: string[] = [];

    // Forme récente
    const homeFormScore = this.calculateFormScore(homeStats.recentForm);
    const awayFormScore = this.calculateFormScore(awayStats.recentForm);
    
    if (homeFormScore > awayFormScore) {
      reasoning.push(`${match.homeTeam.name} est en meilleure forme récente (${homeFormScore.toFixed(2)} vs ${awayFormScore.toFixed(2)})`);
    } else if (awayFormScore > homeFormScore) {
      reasoning.push(`${match.awayTeam.name} est en meilleure forme récente (${awayFormScore.toFixed(2)} vs ${homeFormScore.toFixed(2)})`);
    }

    // Statistiques offensives/défensives
    const homeGoalDiff = homeStats.goalsFor - homeStats.goalsAgainst;
    const awayGoalDiff = awayStats.goalsFor - awayStats.goalsAgainst;
    
    if (homeGoalDiff > awayGoalDiff) {
      reasoning.push(`${match.homeTeam.name} a une meilleure différence de buts (${homeGoalDiff} vs ${awayGoalDiff})`);
    } else if (awayGoalDiff > homeGoalDiff) {
      reasoning.push(`${match.awayTeam.name} a une meilleure différence de buts (${awayGoalDiff} vs ${homeGoalDiff})`);
    }

    // Taux de victoire
    const homeWinRate = (homeStats.wins / (homeStats.wins + homeStats.draws + homeStats.losses)) * 100;
    const awayWinRate = (awayStats.wins / (awayStats.wins + awayStats.draws + awayStats.losses)) * 100;
    
    reasoning.push(`Taux de victoire: ${match.homeTeam.name} ${homeWinRate.toFixed(1)}%, ${match.awayTeam.name} ${awayWinRate.toFixed(1)}%`);

    // Avantage domicile
    reasoning.push(`Avantage domicile estimé à +15% pour ${match.homeTeam.name}`);

    // Probabilités calculées
    if (match.odds?.draw && match.odds.draw > 1) {
      reasoning.push(`Probabilités estimées: ${match.homeTeam.name} ${(homeWinProb * 100).toFixed(1)}%, Match nul 25%, ${match.awayTeam.name} ${(awayWinProb * 100).toFixed(1)}%`);
    } else {
      reasoning.push(`Probabilités estimées: ${match.homeTeam.name} ${(homeWinProb * 100).toFixed(1)}%, ${match.awayTeam.name} ${(awayWinProb * 100).toFixed(1)}%`);
    }

    return reasoning;
  }

  private calculateConfidence(homeStats: TeamStats, awayStats: TeamStats): number {
    const homeConsistency = 1 - (Math.abs(homeStats.wins - homeStats.losses) / (homeStats.wins + homeStats.draws + homeStats.losses));
    const awayConsistency = 1 - (Math.abs(awayStats.wins - awayStats.losses) / (awayStats.wins + awayStats.draws + awayStats.losses));
    
    const avgConsistency = (homeConsistency + awayConsistency) / 2;
    return Math.round(avgConsistency * 100);
  }

  private calculateRiskLevel(confidence: number, bet: BetRecommendation): 'low' | 'medium' | 'high' {
    if (confidence >= 70 && bet.stake <= 3) return 'low';
    if (confidence >= 50 && bet.stake <= 5) return 'medium';
    return 'high';
  }

  private calculateExpectedValue(bet: BetRecommendation, homeProb: number, awayProb: number): number {
    const prob = bet.type === 'home_win' ? homeProb : bet.type === 'away_win' ? awayProb : 0.25;
    return ((prob * bet.odds) - 1) * 100;
  }

  private createDefaultPrediction(match: Match): Prediction {
    const homeOdds = match.odds?.homeWin || 2.0;
    const awayOdds = match.odds?.awayWin || 2.0;
    const preferHome = homeOdds <= awayOdds;

    // Générer quand même les prédictions multi-bots
    const botPredictions = this.generateBotPredictions(match);
    const historicalAnalysis = this.generateHistoricalAnalysis(match);
    const matchEvaluation = this.generateMatchEvaluation(match);

    return {
      matchId: match.id,
      recommendedBet: {
        type: preferHome ? 'home_win' : 'away_win',
        description: `Victoire ${preferHome ? match.homeTeam.name : match.awayTeam.name}`,
        odds: preferHome ? homeOdds : awayOdds,
        stake: 2,
      },
      alternativeBets: [],
      confidence: 50,
      reasoning: ['Signal base sur le marche actuel: historique equipe insuffisant pour une analyse statistique complete'],
      riskLevel: 'high',
      expectedValue: 0,
      botPredictions,
      historicalAnalysis,
      matchEvaluation,
    };
  }

  private generateBotPredictions(match: Match, homeStats?: TeamStats, awayStats?: TeamStats) {
    // Générer les paris alternatifs pour les bots
    const bets: BetInput[] = [];

    if (match.odds?.homeWin) {
      bets.push({ nom: `Victoire ${match.homeTeam.name}`, cote: match.odds.homeWin });
    }
    if (match.odds?.awayWin) {
      bets.push({ nom: `Victoire ${match.awayTeam.name}`, cote: match.odds.awayWin });
    }
    if (match.odds?.draw && match.odds.draw > 1) {
      bets.push({ nom: 'Match nul', cote: match.odds.draw });
    }

    // Ajouter des paris alternatifs basés sur les stats ou par défaut
    let avgGoals = 2.5; // Valeur par défaut
    if (homeStats && awayStats) {
      avgGoals = (homeStats.goalsFor + homeStats.goalsAgainst + awayStats.goalsFor + awayStats.goalsAgainst) / 4;
    }
    
    if (avgGoals > 2.5) {
      bets.push({ nom: 'Plus de 2.5 buts', cote: 1.85 });
    } else {
      bets.push({ nom: 'Moins de 2.5 buts', cote: 1.95 });
    }

    const context: MatchContext = {
      score1: 0,
      score2: 0,
      minute: 0,
    };

    return genererPredictionUnifiee({
      team1: match.homeTeam.name,
      team2: match.awayTeam.name,
      league: match.leagueId.toString(),
      context,
      bets,
    });
  }

  private generateHistoricalAnalysis(match: Match) {
    if (!this.historicalEngine) return null;

    // Créer un candidat pour l'analyse historique
    const candidate: HistoricalMatchRecord = {
      id: match.id,
      date: new Date(match.startTime).toISOString().split('T')[0],
      ligue: match.leagueId.toString(),
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      option: `Victoire ${match.homeTeam.name}`,
      odds: match.odds?.homeWin || 2.0,
      stake_fcfa: 1000,
      issue: "pending",
    };

    const decision = this.historicalEngine.decide(candidate);
    const scored = this.historicalEngine.scoreCandidate(candidate);

    return {
      decision,
      scored,
      report: this.historicalEngine.report,
    };
  }

  private generateMatchEvaluation(match: Match, homeStats?: TeamStats, awayStats?: TeamStats): EvaluationResult | undefined {
    if (!homeStats || !awayStats) return undefined;

    // Générer des flux basés sur les vraies stats des équipes (pas de random)
    const homeWinRate = (homeStats.wins / (homeStats.wins + homeStats.draws + homeStats.losses)) * 100;
    const awayWinRate = (awayStats.wins / (awayStats.wins + awayStats.draws + awayStats.losses)) * 100;

    // Créer des flux basés sur la forme récente (convertir W/D/L en valeurs)
    const formToValue = (form: string[]): number[] => {
      return form.map(f => {
        if (f === 'W') return 80;
        if (f === 'D') return 50;
        if (f === 'L') return 20;
        return 50;
      });
    };

    const homeFormValues = formToValue(homeStats.recentForm);
    const awayFormValues = formToValue(awayStats.recentForm);

    // Étendre les valeurs de forme à 10 points pour l'évaluation
    const homeFlux = Array.from({ length: 10 }, (_, i) => {
      const formIndex = i % homeFormValues.length;
      return homeFormValues[formIndex] + (homeWinRate - 50) * 0.3;
    });

    const awayFlux = Array.from({ length: 10 }, (_, i) => {
      const formIndex = i % awayFormValues.length;
      return awayFormValues[formIndex] + (awayWinRate - 50) * 0.3;
    });

    // Zone nulle basée sur les draws des deux équipes
    const totalDraws = homeStats.draws + awayStats.draws;
    const totalMatches = homeStats.wins + homeStats.draws + homeStats.losses + awayStats.wins + awayStats.draws + awayStats.losses;
    const drawRate = totalMatches > 0 ? (totalDraws / totalMatches) * 100 : 0;
    const zoneNull = Array.from({ length: 10 }, () => drawRate * 0.5);

    // Déterminer le consensus basé sur les bots réels
    const botPredictions = this.generateBotPredictions(match, homeStats, awayStats);
    const consensusBots = botPredictions?.maitre?.decision_finale?.confiance ? 4 : 3;

    // Confiance basée sur la cohérence des systèmes
    const confidence = this.calculateConfidence(homeStats, awayStats);

    const evaluationInput: MatchEvaluationInput = {
      action: "MISE PRUDENTE",
      consensusBots,
      confidence,
      pickSide: (match.odds?.homeWin || 2) < (match.odds?.awayWin || 2) ? "HOME" : "AWAY",
      winHome: homeWinRate,
      winAway: awayWinRate,
      homeFlux,
      awayFlux,
      zoneNull,
    };

    const meta = { totalMatches: totalMatches };

    return evaluateMatch(evaluationInput, meta, {
      minMatches: 10, // Plus bas pour FIFA Penalty
      minScore: 50, // Plus permissif
      totalBots: 5,
    });
  }

  private consolidatePredictions(
    kellyPrediction: Prediction,
    botPredictions: any,
    historicalAnalysis: any,
    matchEvaluation: EvaluationResult | undefined
  ): Prediction {
    // Système de consolidation pour éviter les contradictions
    const recommendations: string[] = [];
    
    // Récupérer la recommandation Kelly
    const kellySide = kellyPrediction.recommendedBet.type === 'home_win' ? 'HOME' : 'AWAY';
    recommendations.push(kellySide);

    // Récupérer la recommandation des bots
    if (botPredictions?.maitre?.decision_finale?.selection) {
      const botSelection = botPredictions.maitre.decision_finale.selection;
      if (typeof botSelection === 'string' && botSelection.includes('Victoire')) {
        const botSide = botSelection.toLowerCase().includes(kellyPrediction.recommendedBet.description.toLowerCase().split(' ')[1]?.toLowerCase()) ? kellySide : (kellySide === 'HOME' ? 'AWAY' : 'HOME');
        recommendations.push(botSide);
      }
    }

    // Récupérer la recommandation de l'évaluation
    if (matchEvaluation?.recommendation) {
      if (matchEvaluation.recommendation.includes('V2')) {
        recommendations.push('AWAY');
      } else if (matchEvaluation.recommendation.includes('1X2')) {
        recommendations.push(kellySide);
      }
    }

    // Calculer le consensus final
    const homeCount = recommendations.filter(r => r === 'HOME').length;
    const awayCount = recommendations.filter(r => r === 'AWAY').length;
    const finalSide = homeCount >= awayCount ? 'HOME' : 'AWAY';

    // Ajuster la prédiction principale si contradiction majeure
    if (kellySide !== finalSide && (homeCount > 1 || awayCount > 1)) {
      // Contradiction détectée - ajuster la confiance
      kellyPrediction.confidence = Math.max(30, kellyPrediction.confidence - 20);
      kellyPrediction.reasoning.push('Conflit entre systèmes - confiance réduite');
    }

    // Ajouter le consensus au reasoning
    kellyPrediction.reasoning.push(`Consensus multi-systèmes: ${finalSide} (${Math.max(homeCount, awayCount)}/${recommendations.length})`);

    return kellyPrediction;
  }
}

export const predictionEngine = new PredictionEngine();
