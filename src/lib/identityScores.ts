import type { Content, LibraryEntry, MirrorEvaluation } from './library';
import { unifyRailway } from './railway';

export const IDENTITY_SCORE_MAX: Record<Content, number> = {
  story: 20, luxcavation: 10, simulation: 30,
  railway: 10, railway1: 10, railway2: 10, railway6: 10, mirror: 30,
};

export function isIdentityScore(score: number | null | undefined, content: Content): score is number {
  return score != null && Number.isFinite(score) && score >= 0 && score <= IDENTITY_SCORE_MAX[content];
}

export type RailwayScoreContent = 'railway1' | 'railway2' | 'railway6';

/** Missing scores remain missing; a partial sum is never presented as a complete evaluation. */
export function identityScoreTotal(entry: LibraryEntry, mirror: MirrorEvaluation | undefined) {
  const parts = [
    { content: 'story', score: entry.scores?.story },
    { content: 'luxcavation', score: entry.scores?.luxcavation },
    { content: 'simulation', score: entry.scores?.simulation },
    { content: 'railway', score: unifyRailway(entry).scores?.railway },
    { content: 'mirror', score: mirror?.score },
  ] as const;
  const valid = parts.filter(({ content, score }) => isIdentityScore(score, content));
  return {
    score: valid.length ? Number(valid.reduce((sum, part) => sum + part.score!, 0).toFixed(6)) : null,
    evaluated: valid.length,
    complete: valid.length === parts.length,
    invalid: parts.filter(({ content, score }) => score != null && !isIdentityScore(score, content)).length,
  };
}

export type IdentityScoreTotal = ReturnType<typeof identityScoreTotal>;

export function identityScoreLabel(total: IdentityScoreTotal) {
  return total.score == null ? '점수 미입력' : `${total.complete ? '종합' : '합계'} ${total.score} / 100점`;
}
