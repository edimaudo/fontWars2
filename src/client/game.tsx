import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ActiveRoundPayload, InitPayload, RevealPayload } from '../shared/types';
import { formatEdition, formatScore, formatUtcDate } from '../shared/format';
import { appReady, journeyEnd, journeyProgress } from './telemetry';
import { loadGame, registerFontFaces, startRound, submitAnswer } from './api';
import { SpecimenCanvas } from './components/SpecimenCanvas';
import { RevealOverlay } from './components/RevealOverlay';
import { ResultCard } from './components/ResultCard';
import './styles.css';

const ROUND_MS = 12_000;

function GameApp() {
  const [game, setGame] = useState<InitPayload | null>(null);
  const [round, setRound] = useState<ActiveRoundPayload | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loupe, setLoupe] = useState(false);
  const [error, setError] = useState('');
  const [fontReady, setFontReady] = useState(false);
  const deadlineRef = useRef(0);
  const submittedRef = useRef(false);
  const timerFrameRef = useRef<number | null>(null);
  const transitionRef = useRef<number | null>(null);

  const syncGame = useCallback(async () => {
    const fresh = await loadGame();
    setGame(fresh);
    return fresh;
  }, []);

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
          throw new Error('No active specimen was returned. Refresh the game to continue.');
        }

        setFontReady(false);
        await registerFontFaces(prepared);
        setFontReady(true);

        // A resumed round's server timer continued while the page and fonts loaded.
        // Refresh its remaining time after preload so client rendering adds no grace time.
        if (prepared.startedAt !== null) {
          fresh = await loadGame();
          setGame(fresh);
          if (fresh.status === 'COMPLETED' || !fresh.activeRound) {
            setRound(null);
            setLoading(false);
            return;
          }
          if (fresh.activeRound.round !== prepared.round) {
            // The server may have timed out this round during font loading. Load the
            // next specimen's five faces before starting its clock.
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

      throw new Error('The round changed repeatedly while its fonts were loading. Refresh to continue.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The next specimen could not be prepared.');
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
        result = await submitAnswer(fontId);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        if (fontId !== null && /expired|time/i.test(message)) {
          result = await submitAnswer(null);
        } else {
          throw cause;
        }
      }
      setReveal(result);
      setSubmitting(false);
      setRemainingMs(0);
      // Analytics must never hold the reveal transition or interrupt a round.
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
            setError(cause instanceof Error ? cause.message : 'Could not load your result sheet.');
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
        // The error text remains visible; the user can retry with Refresh.
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
    return <ResultCard game={game} onRefresh={syncGame} />;
  }

  const seconds = Math.max(0, remainingMs / 1_000);
  const timerState = seconds <= 1.5 ? 'timer-danger' : seconds <= 3 ? 'timer-warning' : '';
  const progressRound = reveal ? reveal.result.round : (round?.round ?? game?.currentRound ?? 1);

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="game-brand-row">
          <div className="wordmark">font<span>Wars</span></div>
          <span className="edition-tag">VOL. {formatEdition(game?.editionNumber ?? 14)}</span>
          <span className="game-date">{game ? formatUtcDate(game.date) : 'UTC DAILY DUEL'}</span>
        </div>
        <div className="round-hud">
          <div className="round-progress" aria-label={`Round ${progressRound} of 5`}>
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className={index + 1 <= (reveal?.result.round ?? round?.round ?? 0) ? 'progress-done' : ''} />
            ))}
          </div>
          <div className={`timer ${timerState}`} aria-label={`${seconds.toFixed(1)} seconds remaining`}>
            <div className="timer-track"><i style={{ transform: `scaleX(${Math.max(0, remainingMs / ROUND_MS)})` }} /></div>
            <b>{seconds.toFixed(1)}s</b>
          </div>
          <button className={`loupe-button ${loupe ? 'loupe-active' : ''}`} onClick={() => setLoupe((value) => !value)} aria-pressed={loupe}>
            Loupe <span aria-hidden="true">⌕</span>
          </button>
        </div>
      </header>

      {loading && (
        <section className="loading-stage">
          <div className="loading-mark">Aa</div>
          <p>{fontReady ? 'Preparing the foundry…' : 'Loading the five typefaces…'}</p>
        </section>
      )}
      {!loading && round && (
        <>
          <div className="play-instruction">
            <span>IDENTIFY THE TYPEFACE</span>
            <b>{round.instruction}</b>
          </div>
          <SpecimenCanvas round={round} loupe={loupe} revealed={Boolean(reveal)} diagnostic={reveal?.result.diagnosticNote} />
          {!reveal ? (
            <section className="foundry-options" aria-label="Choose the matching typeface">
              <div className="options-heading"><span>THE FOUNDRY / SELECT ONE</span><small>ONE TAP LOCKS YOUR ANSWER</small></div>
              <div className="option-grid">
                {round.options.map((option, index) => (
                  <button
                    className="font-option"
                    key={option.id}
                    onClick={() => void finishRound(option.id)}
                    disabled={submitting || remainingMs <= 0}
                  >
                    <span className="option-number">0{index + 1}</span>
                    <strong style={{ fontFamily: `"${option.renderFamily}", ${option.fallbackCss}`, fontWeight: option.assetWeight as React.CSSProperties['fontWeight'], fontStyle: option.assetStyle, fontSynthesis: 'none' }}>{option.name}</strong>
                    <span className="option-meta">{option.assetFormat === 'opentype' ? 'OTF' : 'TTF'}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <RevealOverlay
              reveal={reveal}
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
        <section className="loading-stage">
          <div className="loading-mark">Aa</div>
          <p>All specimens are accounted for.</p>
          <button className="primary-button" onClick={() => void syncGame()}>Refresh game ↻</button>
        </section>
      )}

      {error && <div className="game-error" role="alert">{error}<button onClick={() => void syncGame().then((fresh) => fresh.activeRound && activateRound(fresh.activeRound))}>Retry</button></div>}
      <footer className="game-footer"><span>fontWars / TYPE FOUNDRY</span><span>{formatScore(game?.totalScore ?? 0)} PTS</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<GameApp />);
