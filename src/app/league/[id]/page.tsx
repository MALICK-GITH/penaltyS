import Link from 'next/link';
import { ArrowLeft, Clock, Trophy } from 'lucide-react';
import { sportsApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

function formatMatchTime(startTime: string) {
  return new Date(startTime).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const leagueId = Number(id);
  const snapshot = await sportsApi.getLiveFifaSnapshot();
  const league = snapshot.leagues.find((item) => item.id === leagueId);
  const matches = snapshot.matches.filter((match) => match.leagueId === leagueId);

  if (!league || matches.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold">Ligue indisponible</h1>
          <p className="mb-5 text-sm text-slate-300">
            Cette ligue FIFA Penalty n&apos;a pas de match disponible dans le flux actuel.
          </p>
          <Link href="/" className="text-sm font-semibold text-emerald-200 hover:text-emerald-100">
            Retour au tableau de bord
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </Link>

        <header className="mb-8 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-3 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-300" />
            <h1 className="text-3xl font-bold">{league.name}</h1>
          </div>
          <p className="text-sm text-slate-300">
            {matches.length} match{matches.length > 1 ? 's' : ''} FIFA Penalty disponible
            {matches.length > 1 ? 's' : ''} dans cette ligue.
          </p>
        </header>

        <section className="rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <Clock className="h-5 w-5 text-emerald-300" />
            <h2 className="text-xl font-semibold">Matchs de la ligue</h2>
          </div>

          <div className="divide-y divide-white/10">
            {matches.map((match) => (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.05] lg:grid-cols-[1fr_auto_auto]"
              >
                <div>
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
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
