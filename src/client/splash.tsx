import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isWebPreview } from './platform';
import { appReady, journeyStart } from './telemetry';
import { SettingsPage } from './components/SettingsPage';
import { applySavedTheme } from './theme';
import './styles.css';
import './splash-design.css';

function SplashApp() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    appReady();
    applySavedTheme();
  }, []);

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
    return <SettingsPage onBack={() => setShowSettings(false)} backLabel="Back to fontWars" />;
  }

  return (
    <main className="splash-shell splash-duo-shell">

      <section className="splash-hero" aria-labelledby="splash-title">
        <div className="splash-copy">
          <h1 className="wordmark splash-wordmark" aria-label="fontWars">
            <span className="wordmark-regular">font</span>
            <span className="wordmark-bold">Wars</span>
          </h1>

          <h2 id="splash-title" className="splash-challenge">
            <span>Challenge your</span>
            <span><mark>Font</mark> design knowledge</span>
          </h2>

          <h3 className="splash-note-sr">Playing fontWars is insanely addictive. Use responsibly.</h3>

          <div className="splash-actions">
            <button
              type="button"
              className="primary-button splash-cta"
              onClick={(event) => void openGame(event)}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Play'}
            </button>
            <button
              type="button"
              className="settings-open-button splash-settings-button"
              onClick={() => setShowSettings(true)}
            >
              <span aria-hidden="true" className="splash-settings-symbol">⚙</span>
              Settings
            </button>
            {error && <p className="inline-error" role="alert">{error}</p>}
          </div>
        </div>

        <div className="splash-art" aria-hidden="true">
          <div className="splash-art-blob" />
          <div className="splash-art-card splash-art-card--back"><span>Aa</span></div>
          <div className="splash-art-card splash-art-card--front"><span>Aa</span></div>
          <div className="splash-art-card splash-art-card--serif"><span>Aa</span></div>
          <span className="splash-art-spark splash-art-spark--one" />
          <span className="splash-art-spark splash-art-spark--two" />
          <span className="splash-art-spark splash-art-spark--three" />
          <svg className="splash-art-swoosh" viewBox="0 0 420 110" focusable="false"><path d="M8 87 C82 89 92 45 150 41 C201 37 172 104 244 81 C300 64 346 26 410 8" /></svg>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SplashApp />);
