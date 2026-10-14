import type { LibraryEntry, MirrorEvaluation } from '../lib/library';
import { identityScoreTotal } from '../lib/identityScores';
import './identity-score-guide.css';

export default function IdentityScoreSummary({ entry, mirror }: {
  entry: LibraryEntry;
  mirror?: MirrorEvaluation;
}) {
  const total = identityScoreTotal(entry, mirror);
  return <section className="identity-score-summary" aria-label="인격 종합점수">
    <p aria-live="polite"><strong>{total.complete ? '종합점수' : '입력한 점수 합계'}: {total.score == null ? '미입력' : `${total.score} / 100점`}</strong></p>
    {total.invalid > 0 && <p role="alert">만점을 초과한 기존 점수 {total.invalid}개는 합계에서 제외했습니다. 해당 기록에서 점수를 확인해 주세요.</p>}
    <p>스토리 20 + 채광 10 + 사영전투 30 + 거굴철 10 + 거울던전 30</p>
    <p>거울굴절철도는 10점 만점의 통합 평가입니다. 거울던전 점수는 일반 인격 편집과 거울던전 전용 화면에서 함께 사용합니다.</p>
  </section>;
}
