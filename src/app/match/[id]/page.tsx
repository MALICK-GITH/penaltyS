import Link from 'next/link';
import { ArrowLeft, Calculator, Clock, ShieldAlert, Target, Trophy } from 'lucide-react';
import { sportsApi } from '@/lib/api';
import { predictionEngine } from '@/lib/prediction';

export const dynamic = 'force-dynamic';

function formatMatchTime(startTime: string) {
  return new Date(startTime).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRiskLabel(risk: string) {
  switch (risk) {
    case 'low':
      return 'Faible';
    case 'medium':
      return 'Moyen';
    case 'high':
      return 'Eleve';
    default:
      return 'Inconnu';
  }
}

function getRiskClass(risk: string) {
  switch (risk) {
    case 'low':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
    case 'medium':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
    default:
      return 'border-rose-400/30 bg-rose-400/10 text-rose-100';
  }
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = await sportsApi.getLiveFifaSnapshot();
  const match = snapshot.matches.find((item) => item.id === id);

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold">Match indisponible</h1>
          <p className="mb-5 text-sm text-slate-300">
            Ce match n&apos;est plus present dans le flux FIFA Penalty actuel.
          </p>
          <Link href="/" className="text-sm font-semibold text-emerald-200 hover:text-emerald-100">
            Retour au tableau de bord
          </Link>
        </div>
      </main>
    );
  }

  const league = snapshot.leagues.find((item) => item.id === match.leagueId);
  const prediction = predictionEngine.calculatePrediction(match);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href={league ? `/league/${league.id}` : '/'}
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux matchs
        </Link>

        <header className="mb-8 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            <Trophy className="h-4 w-4" />
            {league?.name ?? 'FIFA Penalty'}
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="md:text-right">
              <h1 className="text-3xl font-bold">{match.homeTeam.name}</h1>
              <p className="mt-1 text-sm text-slate-400">Equipe 1</p>
            </div>
            <div className="w-fit rounded border border-white/10 px-4 py-3 text-lg font-bold text-slate-200">
              VS
            </div>
            <div>
              <h2 className="text-3xl font-bold">{match.awayTeam.name}</h2>
              <p className="mt-1 text-sm text-slate-400">Equipe 2</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-slate-300" suppressHydrationWarning>
            <Clock className="h-4 w-4 text-emerald-300" />
            {formatMatchTime(match.startTime)}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center gap-3">
              <Target className="h-5 w-5 text-emerald-300" />
              <h2 className="text-xl font-semibold">Prediction</h2>
            </div>

            <div className="mb-5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="mb-2 text-sm text-emerald-100">Selection recommandee</p>
              <div className="text-2xl font-bold">{prediction.recommendedBet.description}</div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="rounded bg-white/10 px-3 py-2">
                  Cote {prediction.recommendedBet.odds.toFixed(2)}
                </span>
                <span className="rounded bg-white/10 px-3 py-2">
                  Mise {prediction.recommendedBet.stake}%
                </span>
                <span className={`rounded border px-3 py-2 ${getRiskClass(prediction.riskLevel)}`}>
                  Risque {getRiskLabel(prediction.riskLevel)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-slate-400">Confiance</p>
                <div className="mt-1 text-3xl font-bold">{prediction.confidence}%</div>
              </div>
              <div className="rounded border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-slate-400">Valeur attendue</p>
                <div className="mt-1 text-3xl font-bold">{prediction.expectedValue.toFixed(1)}%</div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center gap-3">
              <Calculator className="h-5 w-5 text-cyan-300" />
              <h2 className="text-xl font-semibold">Cotes Penalty</h2>
            </div>

            {match.odds && (
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded border border-emerald-400/20 bg-emerald-400/10 p-5 text-center">
                  <p className="mb-2 text-sm text-emerald-100">Equipe 1</p>
                  <div className="text-4xl font-bold">{match.odds.homeWin.toFixed(2)}</div>
                </div>
                <div className="rounded border border-rose-400/20 bg-rose-400/10 p-5 text-center">
                  <p className="mb-2 text-sm text-rose-100">Equipe 2</p>
                  <div className="text-4xl font-bold">{match.odds.awayWin.toFixed(2)}</div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {prediction.reasoning.map((reason) => (
                <div key={reason} className="rounded border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-200">
                  {reason}
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-3 rounded border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              La prediction reste un signal d&apos;analyse. Elle ne garantit jamais le resultat d&apos;une seance Penalty.
            </div>
          </section>

          {prediction.alternativeBets.length > 0 && (
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-5 flex items-center gap-3">
                <Target className="h-5 w-5 text-violet-300" />
                <h2 className="text-xl font-semibold">Paris Alternatifs</h2>
              </div>

              <div className="space-y-3">
                {prediction.alternativeBets.map((altBet, index) => (
                  <div
                    key={index}
                    className="rounded border border-white/10 bg-white/[0.04] p-4 transition hover:border-violet-300/50"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Option {index + 1}</p>
                        <p className="font-semibold text-white">{altBet.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-violet-200">{altBet.odds.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="rounded bg-white/10 px-3 py-1 text-slate-300">
                        Mise {altBet.stake}%
                      </span>
                      <span className="text-slate-400">
                        EV: {((altBet.odds - 1) * 0.5 * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
