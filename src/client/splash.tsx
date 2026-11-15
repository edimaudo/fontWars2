import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import { loadGame } from './api';
import { formatEdition, formatScore, formatUtcDate } from '../shared/format';
import { appReady, journeyStart } from './telemetry';
import './styles.css';

function SplashApp() {
  const [game, setGame] = useState<Awaited<ReturnType<typeof loadGame>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    appReady();
    loadGame().then(setGame).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load today’s duel.'));
  }, []);

  const status = game?.status ?? 'UNSTARTED';
  const title = status === 'COMPLETED'
    ? 'View specimen sheet'
    : status === 'IN_PROGRESS' ? 'Resume duel' : 'Enter the Type Foundry';
  const statusLine = status === 'COMPLETED'
    ? `Completed · ${formatScore(game?.totalScore ?? 0)} pts${game && game.playerCount > 1 ? ` · Top ${game.percentile ?? 100}%` : ' · First on the board'}`
    : status === 'IN_PROGRESS'
      ? `Resume Round ${Math.min(game?.currentRound ?? 1, 5)} of 5`
      : `5 daily specimens · Subreddit avg ${game?.averageAccuracy ? `${game.averageAccuracy}%` : '—'}`;

  function openGame(event: React.MouseEvent<HTMLButtonElement>) {
    setBusy(true);
    void journeyStart();
    requestExpandedMode(event.nativeEvent, 'game');
  }

  return (
    <main className="splash-shell">
      <header className="splash-header">
        <div className="wordmark">font<span>Wars</span></div>
        <div className="edition-tag">Vol. {formatEdition(game?.editionNumber ?? 14)}</div>
        <time>{game ? formatUtcDate(game.date) : 'TODAY · UTC'}</time>
      </header>
      <section className="splash-specimen" aria-label="Today's typographic challenge">
        <div className="specimen-index">THE DAILY TYPE DUEL / NO. {formatEdition(game?.editionNumber ?? 14)}</div>
        <div className="splash-glyph" aria-hidden="true">Aa<span>g</span>Rr</div>
        <div className="baseline-line"><span>CAP HEIGHT</span><i></i><span>BASELINE</span></div>
        <div className="splash-copy">
          <strong>{statusLine}</strong>
          <span>Five rounds. Twelve seconds each. One shared specimen sheet.</span>
        </div>
        <div className="registration-mark">TYPE<br />/ FOUNDRY<br />EST. 2026</div>
      </section>
      <footer className="splash-footer">
        <div className="splash-metrics">
          <span><b>{game?.playedToday.toLocaleString('en-US') ?? '—'}</b> played today</span>
          {Boolean(game?.streak) && <span className="streak-pill">{game?.streak} day streak</span>}
        </div>
        <button className="primary-button splash-cta" onClick={openGame} disabled={busy}>
          {busy ? 'Opening foundry…' : title}<span aria-hidden="true">↗</span>
        </button>
        {error && <p className="inline-error">{error}</p>}
        <p className="splash-footnote">A daily typographic identification game for r/{game?.subredditName ?? 'this community'}.</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SplashApp />);
