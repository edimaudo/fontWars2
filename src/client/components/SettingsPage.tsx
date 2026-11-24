import React, { useEffect, useState } from 'react';
import { deleteMyGameData } from '../api';
import { readSavedTheme, saveTheme, type Theme } from '../theme';

interface Props {
  onBack: (event: React.MouseEvent<HTMLButtonElement>) => void;
  backLabel: string;
  onDeleted?: () => Promise<void> | void;
}

export function SettingsPage({ onBack, backLabel, onDeleted }: Props) {
  const [theme, setTheme] = useState<Theme>(readSavedTheme);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  async function removeGameData() {
    setDeleting(true);
    setError('');
    try {
      await deleteMyGameData();
      await onDeleted?.();
      setDeleted(true);
      setDeleteArmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete your game data.');
      setDeleteArmed(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <button type="button" className="settings-back-button" onClick={onBack}>{backLabel}</button>
        <div className="wordmark" aria-label="fontWars"><span className="wordmark-regular">font</span><span className="wordmark-bold">Wars</span></div>
        <span aria-hidden="true" className="settings-header-spacer" />
      </header>

      <div className="settings-content">
        <div className="settings-intro">
          <h1>Settings</h1>
        </div>

        <section className="settings-section" aria-labelledby="appearance-heading">
          <div className="settings-section-copy">
            <h2 id="appearance-heading">Appearance</h2>
            <p>Choose how fontWars looks on this device.</p>
          </div>
          <div className="settings-theme-options" role="group" aria-label="Colour theme">
            <button type="button" onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>Light</button>
            <button type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>Dark</button>
          </div>
        </section>

        <section className="settings-section settings-data-section" aria-labelledby="data-heading">
          <div className="settings-section-copy">
            <h2 id="data-heading">Manage my data</h2>
            <p>Delete your fontWars profile, streak, leaderboard entry and saved round records. This cannot be undone.</p>
          </div>
          {!deleted && !deleteArmed && (
            <button type="button" className="danger-outline-button" onClick={() => setDeleteArmed(true)}>Delete my data</button>
          )}
          {!deleted && deleteArmed && (
            <div className="settings-delete-confirm">
              <p>Delete all saved fontWars game data?</p>
              <div className="settings-delete-actions">
                <button type="button" className="text-button" onClick={() => setDeleteArmed(false)} disabled={deleting}>Cancel</button>
                <button type="button" className="danger-button" onClick={() => void removeGameData()} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Confirm deletion'}
                </button>
              </div>
            </div>
          )}
          {deleted && (
            <p className="settings-success" role="status" aria-live="polite">Your fontWars game data has been deleted.</p>
          )}
          {error && <p className="settings-error" role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
