import React, { useState } from 'react';
import type { InitPayload } from '../../shared/types';
import { formatEdition, formatScore } from '../../shared/format';
import { equipFlair, setNotifications, shareResult } from '../api';

interface Props {
  game: InitPayload;
  onRefresh: () => Promise<InitPayload>;
}

export function ResultCard({ game, onRefresh }: Props) {
  const [selected, setSelected] = useState<number | null>(0);
  const [sharing, setSharing] = useState(false);
  const [posted, setPosted] = useState(game.hasCommented);
  const [flairBusy, setFlairBusy] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [push, setPush] = useState(game.push);
  const [message, setMessage] = useState('');
  const scorePercent = Math.round((game.totalScore / 5_000) * 1_000) / 10;
  const correctCount = game.results.filter((entry) => entry.result.isCorrect).length;
  const accuracyPercent = Math.round((correctCount / 5) * 100);
  const completed = game.results.length;

  async function postResult() {
    setSharing(true);
    setMessage('');
    try {
      await shareResult();
      setPosted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not post your result.');
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
      <header className="game-brand-row">
        <div className="wordmark">font<span>Wars</span></div>
        <span className="edition-tag">VOL. {String(game.editionNumber).padStart(3, '0')}</span>
      </header>
      <section className="score-hero">
        <p className="eyebrow">THE DAILY DUEL / COMPLETE</p>
        <div className="score-number">{formatScore(game.totalScore)}<span> / 5,000</span></div>
        <div className="score-meta">
          <span>{correctCount}/5 correct · {accuracyPercent}%</span>
          <span>{game.isArchive ? 'Practice result' : game.playerCount > 1 ? `Top ${game.percentile ?? 100}%` : 'First on the board'}</span>
          {game.streak > 0 && <span>{game.streak} day streak</span>}
        </div>
        <div className="score-bar"><i style={{ width: `${scorePercent}%` }} /></div>
        <p className="score-subline">{completed} specimens inspected · {game.playerCount.toLocaleString('en-US')} completed players · score rate {scorePercent}%</p>
      </section>

      <section className="answer-strip-section">
        <div className="section-heading"><span>YOUR SPECIMEN SHEET</span><small>SELECT TO INSPECT</small></div>
        <div className="answer-strip">
          {game.results.map((entry, index) => (
            <button
              className={`answer-tile ${entry.result.isCorrect ? 'tile-correct' : 'tile-missed'} ${selected === index ? 'tile-active' : ''}`}
              key={entry.result.round}
              onClick={() => setSelected(index)}
              aria-label={`Inspect round ${index + 1}`}
            >
              <span>R{index + 1}</span>
              <b>{entry.result.isCorrect ? '✓' : '×'}</b>
              <small>{entry.result.roundScore} pts</small>
            </button>
          ))}
        </div>
        {selected !== null && game.results[selected] && (() => {
          const entry = game.results[selected];
          return (
            <div className="specimen-drawer">
              <div className="drawer-head"><b>{entry.font.name}</b><span>{entry.font.file}</span></div>
              <p>{entry.result.diagnosticNote}</p>
              <div className="drawer-foot"><span>CROWD ACCURACY</span><b>{entry.crowdAccuracy}%</b></div>
              {entry.result.triviaTitle && <p className="drawer-trivia"><b>{entry.result.triviaTitle}.</b> {entry.result.triviaNote}</p>}
            </div>
          );
        })()}
      </section>

      <section className="community-actions">
        <button className="primary-button" onClick={postResult} disabled={posted || sharing}>
          {posted ? 'Posted ✓' : sharing ? 'Posting…' : 'Post result to comments'}<span aria-hidden="true">↗</span>
        </button>
        <p className="action-explainer">Posts your score in this Reddit thread as u/{game.username}. Nothing is posted until you tap.</p>
      </section>

      {game.unlockedFlairs.length > 0 && (
        <section className="unlock-section">
          <div className="section-heading"><span>UNLOCKED FLAIR</span><small>YOUR MILESTONE</small></div>
          {game.unlockedFlairs.map((flair) => (
            <div className="flair-row" key={flair}>
              <b>{flair}</b>
              <button className="text-button" onClick={() => equip(flair)} disabled={flairBusy}>Equip ↗</button>
            </div>
          ))}
        </section>
      )}

      <section className="reminder-row">
        <div><b>fontWars Vol. {formatEdition(game.editionNumber + 1)}</b><span>Tomorrow · 00:00 UTC</span></div>
        <button
          className={`toggle ${push.optedIn ? 'toggle-on' : ''}`}
          onClick={toggleNotifications}
          disabled={!push.available || notificationBusy}
          aria-pressed={push.optedIn}
          aria-label="Toggle daily push reminders"
        ><i /></button>
      </section>
      {!push.available && <p className="muted-note">Daily reminders are not enabled for this subreddit yet.</p>}
      {message && <p className="inline-error">{message}</p>}
      <button className="replay-link" onClick={() => onRefresh()}>Refresh result ↻</button>
      <p className="result-footnote">fontWars / A daily typographic study</p>
    </main>
  );
}
