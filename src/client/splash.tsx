import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isWebPreview } from './platform';
import { deleteMyGameData, loadGame } from './api';
import { formatScore } from '../shared/format';
import { appReady, journeyStart } from './telemetry';
import { ThemeToggle } from './components/ThemeToggle';
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
    loadGame().then(setGame).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Could not load today’s game.');
    });
  }, []);

  const status = game?.status ?? 'UNSTARTED';
  const buttonLabel = status === 'COMPLETED' ? 'View results' : status === 'IN_PROGRESS' ? 'Resume game' : 'Play fontWars';
  const statusDetail = status === 'COMPLETED'
    ? `Today’s score: ${formatScore(game?.totalScore ?? 0)} points`
    : status === 'IN_PROGRESS' ? `Round ${Math.min(game?.currentRound ?? 1, 5)} of 5` : '';

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
      setError(cause instanceof Error ? cause.message : 'Could not open fontWars.');
    }
  }

  if (deleted) {
    return (
      <main className="splash-shell">
        <header className="splash-header"><div className="wordmark"><span className="wordmark-regular">font</span><span className="wordmark-bold">Wars</span></div><ThemeToggle /></header>
        <section className="privacy-confirmed" role="status" aria-live="polite">
          <h1>Game data deleted</h1>
          <p>Your fontWars profile and saved game records have been removed.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="splash-shell">
      <header className="splash-header"><div className="wordmark"><span className="wordmark-regular">font</span><span className="wordmark-bold">Wars</span></div><ThemeToggle /></header>
      <section className="splash-intro" aria-labelledby="splash-title">
        <h1 id="splash-title">A typographical skill game.</h1>
        <p className="splash-lead">Flaunt your keen sense of design.</p>
        <p className="splash-note">Playing fontWars is insanely addictive. Use responsibly.</p>
      </section>
      <footer className="splash-footer">
        {statusDetail && <p className="splash-status">{statusDetail}</p>}
        <button className="primary-button splash-cta" onClick={openGame} disabled={busy}>
          {busy ? 'Opening…' : buttonLabel}<span aria-hidden="true">↗</span>
        </button>
        {!isWebPreview() && game && (
          <div className="splash-metrics" aria-label="Community activity">
            <span><b>{game.playedToday.toLocaleString('en-US')}</b> played today</span>
            {Boolean(game.streak) && <span className="streak-pill">{game.streak} day streak</span>}
          </div>
        )}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <details className="privacy-details">
          <summary>Manage game data</summary>
          <div className="privacy-details-content">
            <p>Delete your fontWars profile, streak, leaderboard entry and saved round records. This cannot be undone.</p>
            {!deleteArmed ? (
              <button className="text-button" onClick={() => setDeleteArmed(true)}>Delete my data</button>
            ) : (
              <div className="privacy-confirm-actions">
                <button className="text-button" onClick={() => setDeleteArmed(false)} disabled={deleting}>Cancel</button>
                <button className="danger-button" onClick={() => void removeGameData()} disabled={deleting}>{deleting ? 'Deleting…' : 'Confirm deletion'}</button>
              </div>
            )}
          </div>
        </details>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SplashApp />);
