import React from 'react';
import type { ActiveRoundPayload } from '../../shared/types';

interface Props {
  round: ActiveRoundPayload;
}

export function SpecimenCanvas({ round }: Props) {
  const target = round.target;
  return (
    <section className="specimen-canvas" aria-label="Sample text to match">
      <div
        className="specimen-phrase"
        style={{
          fontFamily: `"${target.renderFamily}", ${target.fallbackCss}`,
          fontWeight: target.assetWeight as React.CSSProperties['fontWeight'],
          fontStyle: target.assetStyle,
          fontSynthesis: 'none',
        }}
      >
        {round.phrase}
      </div>
    </section>
  );
}
