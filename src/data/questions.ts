import {QuizCategory, QuizQuestion} from '../types/app';
import {QUESTIONS_ARTS} from './questionsArts';
import {QUESTIONS_HISTORY} from './questionsHistory';
import {QUESTIONS_SPORTS} from './questionsSports';

export const BASE_QUESTIONS: QuizQuestion[] = [
  ...QUESTIONS_ARTS,
  ...QUESTIONS_HISTORY,
  ...QUESTIONS_SPORTS,
];

export function selectNonRepeatingRoundQuestions(
  allQuestions: QuizQuestion[],
  askedIds: string[],
  category: QuizCategory | 'all',
  roundSize = 10
): {selected: QuizQuestion[]; exhausted: boolean} {
  const askedSet = new Set(askedIds);
  const poolByCategory =
    category === 'all'
      ? allQuestions
      : allQuestions.filter((q) => q.category === category);

  const unseen = poolByCategory.filter((q) => !askedSet.has(q.id));
  if (unseen.length < roundSize) {
    return {selected: [], exhausted: true};
  }

  const shuffled = [...unseen];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    selected: shuffled.slice(0, roundSize),
    exhausted: false,
  };
}
