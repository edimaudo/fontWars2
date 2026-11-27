import React, { useEffect, useState } from 'react';
import type { InitPayload } from '../../shared/types';
import { formatScore } from '../../shared/format';
import { equipFlair, loadLeaderboard, setNotifications, shareResult } from '../api';
import { isWebPreview } from '../platform';
import { getRoundStudyGuide } from '../../shared/progression';

interface Props {
  game: InitPayload;
  onOpenSettings: () => void;
  onHome: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ResultCard({ game, onOpenSettings, onHome }: Props) {
  const [selected, setSelected] = useState<number | null>(0);
  const [sharing, setSharing] = useState(false);
  const [posted, setPosted] = useState(game.hasCommented);
  const [flairBusy, setFlairBusy] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [push, setPush] = useState(game.push);
  const [message, setMessage] = useState('');
  const [leaders, setLeaders] = useState<Array<{ username: string; score: number }>>([]);
  const correctCount = game.results.filter((entry) => entry.result.isCorrect).length;
  const accuracyPercent = game.results.length ? Math.round((correctCount / game.results.length) * 100) : 0;
  const completed = game.results.length;

  useEffect(() => {
    if (game.isArchive) return;
    let active = true;
    loadLeaderboard().then((payload) => {
      if (active) setLeaders(payload.entries);
    }).catch(() => {
      if (active) setLeaders([]);
    });
    return () => { active = false; };
  }, [game.date, game.isArchive]);

  async function postResult() {
    setSharing(true);
    setMessage('');
    try {
      await shareResult();
      setPosted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not share your result.');
    } finally {
      setSharing(false);
    }
  }

  async function equip(flair: string) {
    setFlairBusy(true);
    setMessage('');
    try {
      await equipFlair(flair);
      setMessage(`“${flair}” equipped.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not equip flair.');
    } finally {
      setFlairBusy(false);
    }
  }

  async function toggleNotifications() {
    setNotificationBusy(true);
    setMessage('');
    try {
      const response = await setNotifications(!push.optedIn);
      setPush(response);
      if (response.message) setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update reminders.');
    } finally {
      setNotificationBusy(false);
    }
  }

  return (
    <main className="result-page">
      <header className="game-brand-row result-brand-row">
        <div className="wordmark"><span className="wordmark-regular">font</span><span className="wordmark-bold">Wars</span></div>
        <div className="result-header-actions">
          <button type="button" className="result-home-button" onClick={onHome}>Home</button>
          <button type="button" className="settings-open-button" onClick={onOpenSettings}>Settings</button>
        </div>
      </header>

      <section className="score-hero" aria-labelledby="score-heading">
        <h1 id="score-heading" className="result-heading">Your score</h1>
        <div className="score-number">
          <span className="score-value">{formatScore(game.totalScore)}</span>
          <span className="score-unit">points</span>
        </div>
        <div className="score-meta">
          <span>{correctCount}/{completed} correct · {accuracyPercent}%</span>
          {!isWebPreview() && <span>{game.playerCount > 1 ? `Top ${game.percentile ?? 100}%` : 'First on the board'}</span>}
          {game.streak > 0 && <span>{game.streak} day streak</span>}
        </div>
        <p className="score-subline">{completed} of 5 rounds complete</p>
      </section>

      <section className="answer-strip-section" aria-labelledby="rounds-heading">
        <div className="section-heading"><span id="rounds-heading">Your rounds</span><small>Choose a round</small></div>
        <div className="answer-strip">
          {game.results.map((entry, index) => (
            <button
              className={`answer-tile ${entry.result.isCorrect ? 'tile-correct' : 'tile-missed'} ${selected === index ? 'tile-active' : ''}`}
              key={entry.result.round}
              onClick={() => setSelected(index)}
              aria-label={`Round ${index + 1}: ${entry.result.isCorrect ? 'correct' : 'missed'}, ${entry.result.roundScore} points`}
              aria-pressed={selected === index}
            >
              <span>{index + 1}</span>
              <b aria-hidden="true">{entry.result.isCorrect ? '✓' : '×'}</b>
              <small>{entry.result.roundScore} pts</small>
            </button>
          ))}
        </div>
        {selected !== null && game.results[selected] && (() => {
          const entry = game.results[selected];
          return (
            <div className="specimen-drawer">
              <div className="drawer-head"><b>{entry.font.name}</b></div>
              <p>{getRoundStudyGuide(entry.result.round).feedback}</p>
              {!isWebPreview() && (
                <div className="drawer-foot"><span>Community accuracy</span><b>{entry.crowdAccuracy}%</b></div>
              )}
              {entry.result.triviaTitle && <p className="drawer-trivia"><b>{entry.result.triviaTitle}.</b> {entry.result.triviaNote}</p>}
            </div>
          );
        })()}
      </section>

      {!isWebPreview() && (
        <section className="community-actions">
          <button className="primary-button" onClick={postResult} disabled={posted || sharing}>
            {posted ? 'Posted ✓' : sharing ? 'Sharing…' : 'Share result'}<span aria-hidden="true">↗</span>
          </button>
        </section>
      )}

      {!game.isArchive && (
        <section className="leaderboard-section" aria-labelledby="leaderboard-heading" aria-live="polite">
          <div className="section-heading"><span id="leaderboard-heading">Today’s leaders</span><small>Top 10</small></div>
          {leaders.length > 0 ? (
            <ol className="leaderboard-list">
              {leaders.map((entry, index) => (
                <li key={`${entry.username}-${index}`}><span><b>{index + 1}</b>{entry.username}</span><strong>{formatScore(entry.score)}</strong></li>
              ))}
            </ol>
          ) : <p className="muted-note">No scores yet.</p>}
        </section>
      )}

      {game.unlockedFlairs.length > 0 && (
        <section className="unlock-section">
          <div className="section-heading"><span>Your flair</span></div>
          {game.unlockedFlairs.map((flair) => (
            <div className="flair-row" key={flair}>
              <b>{flair}</b>
              <button className="text-button" onClick={() => equip(flair)} disabled={flairBusy}>Equip</button>
            </div>
          ))}
        </section>
      )}

      {push.available && (
        <section className="reminder-row">
          <div><b>Daily reminders</b><span>Get a reminder when the next game is ready.</span></div>
          <button
            className={`toggle ${push.optedIn ? 'toggle-on' : ''}`}
            onClick={toggleNotifications}
            disabled={notificationBusy}
            aria-pressed={push.optedIn}
            aria-label="Toggle daily reminders"
          ><i /></button>
        </section>
      )}

      {message && <p className="inline-error" role="status">{message}</p>}
    </main>
  );
}
