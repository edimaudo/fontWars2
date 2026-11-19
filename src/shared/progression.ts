export interface RoundStudyGuide {
  stage: string;
  instruction: string;
  diagnosticNote: string;
}

/**
 * A five-step observation curriculum. It progressively changes what the player
 * should inspect; it does not claim to rank the supplied font files by visual
 * difficulty. That requires reviewing the actual user-provided typefaces.
 */
export const ROUND_STUDY_PLAN: readonly RoundStudyGuide[] = [
  {
    stage: 'FOUNDATION',
    instruction: 'Start with the silhouette: compare the overall width, height and shape of the word.',
    diagnosticNote: 'Start broad. Compare the word’s overall silhouette, proportions and visual density before focusing on individual letters.',
  },
  {
    stage: 'PROPORTION',
    instruction: 'Compare cap height, x-height and the proportions of rounded letters.',
    diagnosticNote: 'Look at proportion. Cap height, x-height and the width of rounded forms can make two typefaces feel very different.',
  },
  {
    stage: 'LETTERFORMS',
    instruction: 'Inspect distinctive forms, apertures and terminals across the specimen.',
    diagnosticNote: 'Inspect individual letterforms. Apertures, terminals and the construction of letters such as a, g, e and R are useful comparison points.',
  },
  {
    stage: 'STROKE CONTRAST',
    instruction: 'Compare thick and thin strokes, joins and changes in weight.',
    diagnosticNote: 'Compare stroke construction. Look for changes between thick and thin strokes, the shape of joins and the way curves transition into stems.',
  },
  {
    stage: 'SPACING & RHYTHM',
    instruction: 'Read the full line: compare spacing, kerning and the word’s visual rhythm.',
    diagnosticNote: 'Step back and read the whole specimen. Letter spacing, kerning and the rhythm of positive and negative space should support your final comparison.',
  },
] as const;

export function getRoundStudyGuide(roundNumber: number): RoundStudyGuide {
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > ROUND_STUDY_PLAN.length) {
    throw new Error(`Round study guide is not defined for round ${roundNumber}.`);
  }
  return ROUND_STUDY_PLAN[roundNumber - 1]!;
}
