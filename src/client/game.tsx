import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { exitExpandedMode } from '@devvit/web/client';
import type { ActiveRoundPayload, InitPayload, RevealPayload } from '../shared/types';
import { appReady, journeyEnd, journeyProgress } from './telemetry';
import { loadGame, registerFontFaces, startRound, submitAnswer } from './api';
import { SpecimenCanvas } from './components/SpecimenCanvas';
import { RevealOverlay } from './components/RevealOverlay';
import { ResultCard } from './components/ResultCard';
import { isWebPreview } from './platform';
import './styles.css';

const ROUND_MS = 12_000;
const ROUND_PROMPTS = [
  'Compare the overall shape of the word.',
  'Compare the height and width of the letters.',
  'Look closely at distinctive letter shapes.',
  'Compare thick and thin strokes.',
  'Look at the spacing between letters.',
] as const;

function GameApp() {
  const [game, setGame] = useState<InitPayload | null>(null);
  const [round, setRound] = useState<ActiveRoundPayload | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fontReady, setFontReady] = useState(false);
  const deadlineRef = useRef(0);
  const submittedRef = useRef(false);
  const timerFrameRef = useRef<number | null>(null);
  const transitionRef = useRef<number | null>(null);
  const endDialogRef = useRef<HTMLElement | null>(null);

  const syncGame = useCallback(async () => {
    const fresh = await loadGame();
    setGame(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (!showEndConfirm) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = endDialogRef.current;
    const controls: HTMLButtonElement[] = dialog
      ? Array.from(dialog.querySelectorAll('button:not(:disabled)')) as HTMLButtonElement[]
      : [];
    controls[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowEndConfirm(false);
        return;
      }
      if (event.key !== 'Tab' || controls.length === 0) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [showEndConfirm]);

  function leaveGame(event: React.MouseEvent<HTMLButtonElement>) {
    setShowEndConfirm(false);
    if (isWebPreview()) {
      window.location.assign('/');
      return;
    }
    try {
      exitExpandedMode(event.nativeEvent);
    } catch {
      setError('Could not close fontWars. Use the back button to return.');
    }
  }

  const activateRound = useCallback(async (source?: ActiveRoundPayload | null) => {
    setLoading(true);
    setError('');
    try {
      let fresh = source ? null : await loadGame();
      let prepared = source ?? fresh?.activeRound ?? null;
      if (fresh) setGame(fresh);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (!prepared) {
          if (fresh?.status === 'COMPLETED') {
            setRound(null);
            setLoading(false);
            return;
          }
          throw new Error('No active round was returned. Refresh fontWars to continue.');
        }

        setFontReady(false);
        await registerFontFaces(prepared);
        setFontReady(true);

        // A resumed round's server timer continues while the page and fonts load.
        // Refresh the remaining time after preloading so rendering adds no grace time.
        if (prepared.startedAt !== null) {
          fresh = await loadGame();
          setGame(fresh);
          if (fresh.status === 'COMPLETED' || !fresh.activeRound) {
            setRound(null);
            setLoading(false);
            return;
          }
          if (fresh.activeRound.round !== prepared.round) {
            prepared = fresh.activeRound;
            continue;
          }
          prepared = fresh.activeRound;
        }

        let live = prepared;
        if (prepared.startedAt === null) {
          const started = await startRound();
          if (!started.activeRound) {
            const completed = await loadGame();
            setGame(completed);
            setRound(null);
            setLoading(false);
            return;
          }
          live = started.activeRound;
        }

        setRound(live);
        setRemainingMs(live.remainingMs ?? ROUND_MS);
        deadlineRef.current = performance.now() + (live.remainingMs ?? ROUND_MS);
        submittedRef.current = false;
        setReveal(null);
        setSubmitting(false);
        setLoading(false);
        return;
      }

      throw new Error('The round changed repeatedly while fonts were loading. Refresh to continue.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The next round could not be prepared.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    appReady();
    let mounted = true;
    loadGame().then(async (initial) => {
      if (!mounted) return;
      setGame(initial);
      if (initial.status === 'COMPLETED' || !initial.activeRound) {
        setLoading(false);
        return;
      }
      await activateRound(initial.activeRound);
    }).catch((cause: unknown) => {
      if (!mounted) return;
      setError(cause instanceof Error ? cause.message : 'Could not load fontWars.');
      setLoading(false);
    });
    return () => {
      mounted = false;
      if (timerFrameRef.current !== null) cancelAnimationFrame(timerFrameRef.current);
      if (transitionRef.current !== null) window.clearTimeout(transitionRef.current);
    };
  }, [activateRound]);

  const finishRound = useCallback(async (fontId: string | null) => {
    if (!round || submitting || submittedRef.current || reveal) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    if (timerFrameRef.current !== null) cancelAnimationFrame(timerFrameRef.current);
    try {
      let result: RevealPayload;
      try {
        result = await submitAnswer(fontId, round.round);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        if (fontId !== null && /expired|time/i.test(message)) {
          result = await submitAnswer(null, round.round);
        } else {
          throw cause;
        }
      }
      setReveal(result);
      setSubmitting(false);
      setRemainingMs(0);
      void journeyProgress(result.result.round);
      if (result.isComplete) void journeyEnd(result.totalScore);
      transitionRef.current = window.setTimeout(async () => {
        if (result.isComplete) {
          try {
            const completed = await syncGame();
            setGame(completed);
            setRound(null);
            setReveal(null);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not load your results.');
          }
        } else {
          await activateRound();
        }
      }, 2_500);
    } catch (cause) {
      setSubmitting(false);
      submittedRef.current = false;
      setError(cause instanceof Error ? cause.message : 'Your answer was not recorded.');
      try {
        const fresh = await loadGame();
        setGame(fresh);
        if (fresh.activeRound) await activateRound(fresh.activeRound);
      } catch {
        // Keep the error visible so the player can retry.
      }
    }
  }, [activateRound, reveal, round, submitting, syncGame]);

  useEffect(() => {
    if (!round || reveal || loading || submitting || !fontReady || submittedRef.current) return;
    const tick = () => {
      const next = Math.max(0, deadlineRef.current - performance.now());
      setRemainingMs(next);
      if (next <= 0) {
        void finishRound(null);
        return;
      }
      timerFrameRef.current = requestAnimationFrame(tick);
    };
    timerFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (timerFrameRef.current !== null) cancelAnimationFrame(timerFrameRef.current);
    };
  }, [finishRound, fontReady, loading, reveal, round, submitting]);

  if (game?.status === 'COMPLETED' && !round && !reveal) {
    return <ResultCard game={game} />;
  }

  const seconds = Math.max(0, remainingMs / 1_000);
  const timerState = seconds <= 1.5 ? 'timer-danger' : seconds <= 3 ? 'timer-warning' : '';
  const progressRound = reveal ? reveal.result.round : (round?.round ?? game?.currentRound ?? 1);

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="game-brand-row">
          <div className="wordmark">font<span>Wars</span></div>
          {!loading && round && (
            <button type="button" className="end-game-button" onClick={() => setShowEndConfirm(true)} disabled={submitting}>
              End game
            </button>
          )}
        </div>
        <div className="round-hud">
          <div
            className="round-progress"
            role="progressbar"
            aria-label="Game progress"
            aria-valuemin={1}
            aria-valuemax={5}
            aria-valuenow={progressRound}
            aria-valuetext={`Round ${progressRound} of 5`}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <span aria-hidden="true" key={index} className={index + 1 <= (reveal?.result.round ?? round?.round ?? 0) ? 'progress-done' : ''} />
            ))}
          </div>
          <div className={`timer ${timerState}`} role="timer" aria-live="off" aria-label={`${seconds.toFixed(1)} seconds remaining`}>
            <div className="timer-track"><i style={{ transform: `scaleX(${Math.max(0, remainingMs / ROUND_MS)})` }} /></div>
            <b>{seconds.toFixed(1)}s</b>
          </div>
        </div>
      </header>

      {loading && (
        <section className="loading-stage" role="status" aria-live="polite">
          <div className="loading-mark" aria-hidden="true">Aa</div>
          <p>Loading fonts…</p>
        </section>
      )}

      {!loading && round && (
        <>
          <p className="play-instruction" aria-live="polite">{ROUND_PROMPTS[round.round - 1] ?? 'Choose the matching font.'}</p>
          <SpecimenCanvas round={round} />
          {!reveal ? (
            <section className="foundry-options" aria-labelledby="options-heading">
              <h2 id="options-heading" className="options-title">Which font is it?</h2>
              <div className="option-grid">
                {round.options.map((option, index) => (
                  <button
                    className="font-option"
                    key={option.id}
                    onClick={() => void finishRound(option.id)}
                    disabled={submitting || remainingMs <= 0}
                    aria-label={`Choose ${option.name}`}
                  >
                    <span className="option-number" aria-hidden="true">{index + 1}</span>
                    <strong style={{ fontFamily: `"${option.renderFamily}", ${option.fallbackCss}`, fontWeight: option.assetWeight as React.CSSProperties['fontWeight'], fontStyle: option.assetStyle, fontSynthesis: 'none' }}>{option.name}</strong>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <RevealOverlay
              reveal={reveal}
              targetFamily={round.target.renderFamily}
              targetWeight={round.target.assetWeight}
              targetStyle={round.target.assetStyle}
              onNext={() => {
                if (transitionRef.current !== null) window.clearTimeout(transitionRef.current);
                if (reveal.isComplete) {
                  void syncGame().then((fresh) => {
                    setGame(fresh);
                    setRound(null);
                    setReveal(null);
                  });
                } else {
                  void activateRound();
                }
              }}
              lastRound={reveal.isComplete}
            />
          )}
        </>
      )}

      {!loading && !round && !reveal && game && game.status !== 'COMPLETED' && (
        <section className="loading-stage" role="status" aria-live="polite">
          <div className="loading-mark" aria-hidden="true">Aa</div>
          <p>No active round is available.</p>
          <button className="primary-button" onClick={() => void syncGame()}>Refresh game <span aria-hidden="true">↻</span></button>
        </section>
      )}

      {showEndConfirm && (
        <div className="end-game-backdrop">
          <section
            ref={endDialogRef}
            className="end-game-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-game-title"
            aria-describedby="end-game-description"
          >
            <h2 id="end-game-title">End this game?</h2>
            <p id="end-game-description">Completed rounds are saved. The current round will continue while you are away.</p>
            <div className="end-game-actions">
              <button type="button" className="text-button" onClick={() => setShowEndConfirm(false)}>Keep playing</button>
              <button type="button" className="end-game-confirm" onClick={leaveGame}>End game</button>
            </div>
          </section>
        </div>
      )}

      {error && <div className="game-error" role="alert">{error}<button onClick={() => void syncGame().then((fresh) => fresh.activeRound && activateRound(fresh.activeRound))}>Retry</button></div>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<GameApp />);
