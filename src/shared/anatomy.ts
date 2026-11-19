export interface GlyphAnatomyMetrics {
  capAscent: number;
  xAscent: number;
  descenderDescent: number;
}

export interface AnatomyGuidePositions {
  capHeight: number;
  xHeight: number;
  baseline: number;
  descender: number;
}

/** Convert canvas glyph metrics into SVG y-coordinates measured from the top. */
export function getAnatomyGuidePositions(
  metrics: GlyphAnatomyMetrics,
  baseline = 86,
): AnatomyGuidePositions {
  const values = [metrics.capAscent, metrics.xAscent, metrics.descenderDescent, baseline];
  if (values.some((value) => !Number.isFinite(value)) || metrics.capAscent <= 0 || metrics.xAscent <= 0 || metrics.descenderDescent < 0 || baseline <= 0) {
    throw new Error('Valid cap, x-height and descender measurements are required.');
  }

  return {
    capHeight: baseline - metrics.capAscent,
    xHeight: baseline - metrics.xAscent,
    baseline,
    descender: baseline + metrics.descenderDescent,
  };
}
