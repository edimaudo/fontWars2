import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isWebPreview } from './platform';
import { loadGame } from './api';
import { formatScore } from '../shared/format';
import { appReady, journeyStart } from './telemetry';
import { SettingsPage } from './components/SettingsPage';
import { applySavedTheme } from './theme';
import './styles.css';

function SplashApp() {
  const [game, setGame] = useState<Awaited<ReturnType<typeof loadGame>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    appReady();
    applySavedTheme();
    loadGame().then(setGame).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Could not load today’s game.');
    });
  }, []);

  const status = game?.status ?? 'UNSTARTED';
  const buttonLabel = status === 'COMPLETED' ? 'View results' : status === 'IN_PROGRESS' ? 'Resume game' : 'Play fontWars';
  const statusDetail = status === 'COMPLETED'
    ? `Today’s score: ${formatScore(game?.totalScore ?? 0)} points`
    : status === 'IN_PROGRESS' ? `Round ${Math.min(game?.currentRound ?? 1, 5)} of 5` : '';

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

  if (showSettings) {
    return (
      <SettingsPage
        onBack={() => setShowSettings(false)}
        backLabel="Back to fontWars"
        onDeleted={async () => {
          try { setGame(await loadGame()); } catch { /* The confirmation remains visible if refresh fails. */ }
        }}
      />
    );
  }

  return (
    <main className="splash-shell">
      <header className="splash-header">
        <div className="wordmark"><span className="wordmark-regular">font</span><span className="wordmark-bold">Wars</span></div>
        <button type="button" className="settings-open-button" onClick={() => setShowSettings(true)}>Settings</button>
      </header>
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
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SplashApp />);
