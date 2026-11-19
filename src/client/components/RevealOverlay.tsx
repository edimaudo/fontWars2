import React from 'react';
import type { RevealPayload } from '../../shared/types';
import { AnatomyCallouts } from './AnatomyCallouts';
import { isWebPreview } from '../platform';

interface Props {
  reveal: RevealPayload;
  onNext: () => void;
  lastRound: boolean;
  targetFamily: string;
  targetWeight: string;
  targetStyle: 'normal' | 'italic' | 'oblique';
}

export function RevealOverlay({ reveal, onNext, lastRound, targetFamily, targetWeight, targetStyle }: Props) {
  const { result, correctFont, options, crowdPercentages } = reveal;
  return (
    <section className="reveal-panel" aria-live="polite">
      <div className={`reveal-verdict ${result.isCorrect ? 'is-correct' : 'is-missed'}`}>
        <strong>{result.isCorrect ? '✓ CORRECT' : '× MISSED'}</strong>
        <span>{result.roundScore.toLocaleString('en-US')} PTS</span>
      </div>
      <div className="reveal-answer">
        <strong>{correctFont.name}</strong>
        <span>{correctFont.file}</span>
      </div>
      <div className="option-grid option-grid-reveal" aria-label="Answer and subreddit crowd split">
        {options.map((option) => {
          const isCorrect = option.id === result.targetFontId;
          const isSelectedMiss = option.id === result.selectedFontId && !result.isCorrect;
          return (
            <div className={`font-option reveal-option ${isCorrect ? 'reveal-option-correct' : isSelectedMiss ? 'reveal-option-missed' : 'reveal-option-dim'}`} key={option.id}>
              <strong style={{ fontFamily: `"${option.renderFamily}", ${option.fallbackCss}`, fontWeight: option.assetWeight as React.CSSProperties['fontWeight'], fontStyle: option.assetStyle, fontSynthesis: 'none' }}>{option.name}</strong>
              <span className="option-meta">{option.assetFormat === 'opentype' ? 'OpenType · OTF' : 'TrueType · TTF'}</span>
              {!isWebPreview() && <div className="reveal-option-bar"><i style={{ width: `${crowdPercentages[option.id] ?? 0}%` }} /></div>}
              <span className="reveal-option-percent">{isWebPreview() ? 'Community split available in Devvit' : `${crowdPercentages[option.id] ?? 0}% picked`}</span>
              {isCorrect && <span className="answer-stamp">✓ MATCH</span>}
              {isSelectedMiss && <span className="answer-stamp">× YOUR PICK</span>}
            </div>
          );
        })}
      </div>
      <AnatomyCallouts family={targetFamily} weight={targetWeight} style={targetStyle} />
      <p className="reveal-diagnostic">{result.diagnosticNote}</p>
      {result.triviaTitle && <div className="trivia-note"><b>{result.triviaTitle}</b><p>{result.triviaNote}</p></div>}
      <button className="primary-button next-button" onClick={onNext}>
        {lastRound ? 'See your specimen sheet' : 'Next specimen'}<span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
