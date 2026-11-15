import React from 'react';
import type { ActiveRoundPayload } from '../../shared/types';

interface Props {
  round: ActiveRoundPayload;
  loupe: boolean;
  revealed?: boolean;
  diagnostic?: string;
}

export function SpecimenCanvas({ round, loupe, revealed = false, diagnostic }: Props) {
  const target = round.target;
  return (
    <section className={`specimen-canvas ${loupe ? 'has-loupe' : ''}`} aria-label="Target type specimen">
      <div className="specimen-canvas__meta">
        <span>SPECIMEN {String(round.round).padStart(2, '0')} / {round.category.toUpperCase()}</span>
        <span>{round.difficulty.toUpperCase()}</span>
      </div>
      <div className="specimen-measure specimen-measure--cap"><span>CAP</span></div>
      <div className="specimen-measure specimen-measure--x"><span>X-HEIGHT</span></div>
      <div className="specimen-measure specimen-measure--base"><span>BASELINE</span></div>
      <div className="specimen-phrase" style={{ fontFamily: `"${target.renderFamily}", ${target.fallbackCss}`, fontWeight: target.assetWeight as React.CSSProperties['fontWeight'], fontStyle: target.assetStyle, fontSynthesis: 'none' }}>
        {round.phrase}
      </div>
      <div className="specimen-canvas__bottom">
        <span>THE LETTERFORM STUDY</span>
        <span>{revealed ? 'ANATOMY REVEALED' : 'OBSERVE · COMPARE · IDENTIFY'}</span>
      </div>
      {diagnostic && <div className="diagnostic-note"><b>THE TELL</b>{diagnostic}</div>}
    </section>
  );
}
