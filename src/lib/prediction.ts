import { Match, Prediction, BetRecommendation, TeamStats } from '@/types';
import { mockData } from './api';

export class PredictionEngine {
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

    return {
      matchId: match.id,
      recommendedBet,
      alternativeBets,
      confidence,
      reasoning,
      riskLevel,
      expectedValue,
    };
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
    };
  }
}

export const predictionEngine = new PredictionEngine();
