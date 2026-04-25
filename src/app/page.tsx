import Link from 'next/link';
import { Activity, Circle, Clock, ShieldCheck, Target, Trophy, TrendingUp } from 'lucide-react';
import { sportsApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

function formatMatchTime(startTime: string) {
  return new Date(startTime).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function Home() {
  const snapshot = await sportsApi.getLiveFifaSnapshot();
  const matchCounts = new Map<number, number>();

  snapshot.matches.forEach((match) => {
    matchCounts.set(match.leagueId, (matchCounts.get(match.leagueId) ?? 0) + 1);
  });

  const leagues = snapshot.leagues.filter((league) => (matchCounts.get(league.id) ?? 0) > 0);
  const nextMatches = snapshot.matches.slice(0, 12);
  const averageHomeOdd = nextMatches.length
    ? nextMatches.reduce((total, match) => total + (match.odds?.homeWin ?? 0), 0) / nextMatches.length
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Circle className="h-8 w-8 text-emerald-300" />
              <h1 className="text-3xl font-bold tracking-normal">FIFA Penalty Premium</h1>
            </div>
            <p className="text-sm text-slate-300">
              Tableau de bord des matchs FIFA Penalty actifs, ligues source et cotes gagnant.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            Donnees filtrees Penalty uniquement
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <Trophy className="h-4 w-4 text-amber-300" />
              Ligues actives
            </div>
            <div className="text-3xl font-bold">{leagues.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <Activity className="h-4 w-4 text-emerald-300" />
              Matchs disponibles
            </div>
            <div className="text-3xl font-bold">{snapshot.matches.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <TrendingUp className="h-4 w-4 text-cyan-300" />
              Cote 1 moyenne
            </div>
            <div className="text-3xl font-bold">{averageHomeOdd ? averageHomeOdd.toFixed(2) : '-'}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <Target className="h-4 w-4 text-violet-300" />
              Marche
            </div>
            <div className="text-3xl font-bold">1 / 2</div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Ligues FIFA Penalty</h2>
            <span className="text-sm text-slate-400">Seules les ligues avec matchs sont affichees</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-300/50 hover:bg-white/[0.07]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{league.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{league.country}</p>
                  </div>
                  <Trophy className="h-5 w-5 text-amber-300" />
                </div>
                <div className="text-sm text-emerald-200">
                  {matchCounts.get(league.id)} match{(matchCounts.get(league.id) ?? 0) > 1 ? 's' : ''} disponible
                  {(matchCounts.get(league.id) ?? 0) > 1 ? 's' : ''}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <Clock className="h-5 w-5 text-emerald-300" />
            <h2 className="text-xl font-semibold">Matchs FIFA Penalty</h2>
          </div>

          <div className="divide-y divide-white/10">
            {nextMatches.map((match) => {
              const league = leagues.find((item) => item.id === match.leagueId);

              return (
                <Link
                  key={match.id}
                  href={`/match/${match.id}`}
                  className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.05] lg:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-emerald-200">
                      {league?.name ?? 'FIFA Penalty'}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-lg font-semibold">
                      <span>{match.homeTeam.name}</span>
                      <span className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300">VS</span>
                      <span>{match.awayTeam.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-slate-300" suppressHydrationWarning>
                    {formatMatchTime(match.startTime)}
                  </div>

                  {match.odds && (
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-200">
                        1 {match.odds.homeWin.toFixed(2)}
                      </span>
                      <span className="rounded bg-rose-400/15 px-3 py-2 text-sm font-semibold text-rose-200">
                        2 {match.odds.awayWin.toFixed(2)}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="mt-10 text-center text-sm text-slate-500">
          © 2026 Prediction FIFA Penalty Premium - SOLITAIRE HACK
        </footer>
      </div>
    </main>
  );
}
