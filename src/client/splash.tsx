import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isWebPreview } from './platform';
import { deleteMyGameData, loadGame } from './api';
import { formatEdition, formatScore, formatUtcDate } from '../shared/format';
import { appReady, journeyStart } from './telemetry';
import './styles.css';

function SplashApp() {
  const [game, setGame] = useState<Awaited<ReturnType<typeof loadGame>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    appReady();
    loadGame().then(setGame).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load today’s duel.'));
  }, []);

  const status = game?.status ?? 'UNSTARTED';
  const title = status === 'COMPLETED'
    ? 'View specimen sheet'
    : status === 'IN_PROGRESS' ? 'Resume duel' : 'Enter the Type Foundry';
  const statusLine = isWebPreview()
    ? status === 'COMPLETED'
      ? `Practice complete · ${formatScore(game?.totalScore ?? 0)} pts`
      : status === 'IN_PROGRESS'
        ? `Resume practice · Round ${Math.min(game?.currentRound ?? 1, 5)} of 5`
        : 'Browser preview · 5 practice specimens'
    : status === 'COMPLETED'
      ? `Completed · ${formatScore(game?.totalScore ?? 0)} pts${game && game.playerCount > 1 ? ` · Top ${game.percentile ?? 100}%` : ' · First on the board'}`
      : status === 'IN_PROGRESS'
        ? `Resume Round ${Math.min(game?.currentRound ?? 1, 5)} of 5`
        : `5 daily specimens · Subreddit avg ${game?.averageAccuracy ? `${game.averageAccuracy}%` : '—'}`;

  async function removeGameData() {
    setDeleting(true);
    setError('');
    try {
      await deleteMyGameData();
      setDeleted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete your game data.');
      setDeleteArmed(false);
    } finally {
      setDeleting(false);
    }
  }

  async function openGame(event: React.MouseEvent<HTMLButtonElement>) {
    setBusy(true);
    if (isWebPreview()) {
      window.location.assign('/game.html');
      return;
    }
    void journeyStart();
    try {
      const { requestExpandedMode } = await import('@devvit/web/client');
      requestExpandedMode(event.nativeEvent, 'game');
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'Could not open the expanded game.');
    }
  }

  if (deleted) {
    return (
      <main className="splash-shell">
        <header className="splash-header"><div className="wordmark">font<span>Wars</span></div></header>
        <section className="privacy-confirmed" role="status" aria-live="polite">
          <h1>Game data deleted</h1>
          <p>{isWebPreview() ? 'Your browser-local preview session has been removed.' : 'Your fontWars profile and linked game records have been removed. Reddit comments you previously posted remain under Reddit’s controls.'}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="splash-shell">
      {isWebPreview() && <p className="web-preview-banner" role="status">WEB PREVIEW · Gameplay and progress are stored in this browser. Reddit-only features are disabled.</p>}
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
          {isWebPreview() ? <span>Progress is saved in this browser</span> : <><span><b>{game?.playedToday.toLocaleString('en-US') ?? '—'}</b> played today</span>{Boolean(game?.streak) && <span className="streak-pill">{game?.streak} day streak</span>}</>}
        </div>
        <button className="primary-button splash-cta" onClick={openGame} disabled={busy}>
          {busy ? 'Opening foundry…' : title}<span aria-hidden="true">↗</span>
        </button>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <p className="splash-footnote">{isWebPreview() ? 'A browser-only preview. Reddit community features require a Devvit installation.' : `A daily typographic identification game for r/${game?.subredditName ?? 'this community'}.`}</p>
        {!deleteArmed ? (
          <button className="text-button data-manage-link" onClick={() => setDeleteArmed(true)}>Manage game data</button>
        ) : (
          <section className="data-delete-prompt" aria-label="Delete fontWars data">
            <p>Delete your fontWars profile, streak, leaderboard entry and saved round records? This cannot be undone. Reddit comments you posted remain.</p>
            <div className="privacy-confirm-actions">
              <button className="text-button" onClick={() => setDeleteArmed(false)} disabled={deleting}>Keep data</button>
              <button className="danger-button" onClick={() => void removeGameData()} disabled={deleting}>{deleting ? 'Deleting…' : 'Confirm deletion'}</button>
            </div>
          </section>
        )}
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SplashApp />);
