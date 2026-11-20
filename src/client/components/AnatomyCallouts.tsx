import React, { useEffect, useState } from 'react';
import { getAnatomyGuidePositions } from '../../shared/anatomy';

type AnatomyData = {
  capX: number;
  xX: number;
  descenderX: number;
  guides: ReturnType<typeof getAnatomyGuidePositions>;
};

interface Props {
  family: string;
  weight: string;
  style: 'normal' | 'italic' | 'oblique';
}

const SVG_WIDTH = 420;
const BASELINE = 86;
const FONT_SIZE = 66;

export function AnatomyCallouts({ family, weight, style }: Props) {
  const [data, setData] = useState<AnatomyData | null>(null);

  useEffect(() => {
    setData(null);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    context.font = `${style} ${weight} ${FONT_SIZE}px "${family}"`;
    const cap = context.measureText('H');
    const xHeight = context.measureText('x');
    const descender = context.measureText('p');
    const run = context.measureText('Hxp');
    const hx = context.measureText('Hx');

    const capAscent = cap.actualBoundingBoxAscent;
    const xAscent = xHeight.actualBoundingBoxAscent;
    const descenderDescent = descender.actualBoundingBoxDescent;
    if (![capAscent, xAscent, descenderDescent, run.width, cap.width, xHeight.width, descender.width, hx.width].every(Number.isFinite)
      || capAscent <= 0 || xAscent <= 0 || run.width <= 0) {
      return;
    }

    try {
      setData({
        capX: (SVG_WIDTH - run.width) / 2 + cap.width / 2,
        xX: (SVG_WIDTH - run.width) / 2 + cap.width + xHeight.width / 2,
        descenderX: (SVG_WIDTH - run.width) / 2 + hx.width + descender.width * 0.65,
        guides: getAnatomyGuidePositions({ capAscent, xAscent, descenderDescent }, BASELINE),
      });
    } catch {
      setData(null);
    }
  }, [family, style, weight]);

  return (
    <section className="anatomy-block" aria-label="Font details">
      <div className="anatomy-heading">
        <b>FONT DETAILS</b>
        <span>MEASURED FROM THIS FONT</span>
      </div>
      {data ? (
        <svg className="anatomy-diagram" viewBox={`0 0 ${SVG_WIDTH} 124`} role="img" aria-label="Cap height, x-height, baseline and descender measured using the target font">
          <g className="anatomy-guide anatomy-guide--cap">
            <line x1="88" x2="408" y1={data.guides.capHeight} y2={data.guides.capHeight} />
            <circle cx={data.capX} cy={data.guides.capHeight} r="4" />
            <text x="10" y={data.guides.capHeight + 3}>CAP HEIGHT</text>
          </g>
          <g className="anatomy-guide anatomy-guide--xheight">
            <line x1="88" x2="408" y1={data.guides.xHeight} y2={data.guides.xHeight} />
            <circle cx={data.xX} cy={data.guides.xHeight} r="4" />
            <text x="10" y={data.guides.xHeight + 3}>X-HEIGHT</text>
          </g>
          <g className="anatomy-guide anatomy-guide--baseline">
            <line x1="88" x2="408" y1={data.guides.baseline} y2={data.guides.baseline} />
            <circle cx={data.descenderX} cy={data.guides.baseline} r="4" />
            <text x="10" y={data.guides.baseline + 3}>BASELINE</text>
          </g>
          <g className="anatomy-guide anatomy-guide--descender">
            <line x1={data.descenderX} x2={data.descenderX} y1={data.guides.baseline} y2={data.guides.descender} />
            <circle cx={data.descenderX} cy={data.guides.descender} r="3" />
            <text x={Math.min(data.descenderX + 8, 350)} y={Math.min(data.guides.descender + 12, 119)}>DESCENDER</text>
          </g>
          <text className="anatomy-glyph" x={SVG_WIDTH / 2} y={BASELINE} textAnchor="middle" fontFamily={`"${family}", sans-serif`} fontSize={FONT_SIZE} fontWeight={weight} fontStyle={style}>Hxp</text>
        </svg>
      ) : (
        <p className="anatomy-unavailable">Font measurements are unavailable in this browser.</p>
      )}
      <p className="anatomy-caption">H marks cap height · x marks lowercase height · p marks the descender</p>
    </section>
  );
}
