export interface RoundStudyGuide {
  stage: string;
  instruction: string;
  feedback: string;
  diagnosticNote: string;
}

/** Plain-language cues used during each round and in the answer explanation. */
export const ROUND_STUDY_PLAN: readonly RoundStudyGuide[] = [
  {
    stage: 'OVERALL LOOK',
    instruction: 'Match the sample text to the font that looks most like it.',
    feedback: 'Compare the width and overall shape of the sample. Do not focus on just one letter.',
    diagnosticNote: 'Compare the width and overall shape of the sample. Do not focus on just one letter.',
  },
  {
    stage: 'LETTER SIZE',
    instruction: 'Compare the height and width of the letters.',
    feedback: 'Notice whether the letters are tall or short, and wide or narrow.',
    diagnosticNote: 'Notice whether the letters are tall or short, and wide or narrow.',
  },
  {
    stage: 'LETTER SHAPES',
    instruction: 'Compare individual letters. Look at their shapes.',
    feedback: 'Look at curves, straight lines and the open spaces inside letters.',
    diagnosticNote: 'Look at curves, straight lines and the open spaces inside letters.',
  },
  {
    stage: 'LINE THICKNESS',
    instruction: 'Compare the thickness of the lines that form each letter.',
    feedback: 'Some fonts use strokes that are mostly even; others have clearly thicker and thinner parts.',
    diagnosticNote: 'Some fonts use strokes that are mostly even; others have clearly thicker and thinner parts.',
  },
  {
    stage: 'LETTER SPACING',
    instruction: 'Compare the gaps between letters. Which option has similar spacing?',
    feedback: 'Look for letters that sit close together or have more space between them.',
    diagnosticNote: 'Look for letters that sit close together or have more space between them.',
  },
] as const;

export function getRoundStudyGuide(roundNumber: number): RoundStudyGuide {
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > ROUND_STUDY_PLAN.length) {
    throw new Error(`Round guide is not defined for round ${roundNumber}.`);
  }
  return ROUND_STUDY_PLAN[roundNumber - 1]!;
}
