export interface RoundStudyGuide {
  stage: string;
  instruction: string;
  diagnosticNote: string;
}

/** Short prompts for the five font-identification rounds. */
export const ROUND_STUDY_PLAN: readonly RoundStudyGuide[] = [
  {
    stage: 'SHAPE',
    instruction: 'Compare the overall shape of the word.',
    diagnosticNote: 'Look at the word as a whole: its width, proportions and overall shape.',
  },
  {
    stage: 'PROPORTION',
    instruction: 'Compare the height and width of the letters.',
    diagnosticNote: 'Compare tall and rounded letters, including their relative height and width.',
  },
  {
    stage: 'DETAIL',
    instruction: 'Look closely at distinctive letter shapes.',
    diagnosticNote: 'Notice the details that distinguish letters such as a, g, e and R.',
  },
  {
    stage: 'STROKE',
    instruction: 'Compare thick and thin strokes.',
    diagnosticNote: 'Look for differences between thick and thin strokes and how curves meet stems.',
  },
  {
    stage: 'SPACING',
    instruction: 'Look at the spacing between letters.',
    diagnosticNote: 'Read the word as a whole and compare its spacing and rhythm.',
  },
] as const;

export function getRoundStudyGuide(roundNumber: number): RoundStudyGuide {
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > ROUND_STUDY_PLAN.length) {
    throw new Error(`Round guide is not defined for round ${roundNumber}.`);
  }
  return ROUND_STUDY_PLAN[roundNumber - 1]!;
}
