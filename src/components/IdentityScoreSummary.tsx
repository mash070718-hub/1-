import type { LibraryEntry, MirrorEvaluation } from '../lib/library';
import { identityScoreTotal, type RailwayScoreContent } from '../lib/identityScores';
import './identity-score-guide.css';

export default function IdentityScoreSummary({ entry, mirror, onRailwayChange }: {
  entry: LibraryEntry;
  mirror?: MirrorEvaluation;
  onRailwayChange?: (railway: RailwayScoreContent) => void;
}) {
  const railway = entry.scoreRailway ?? 'railway6';
  const total = identityScoreTotal(entry, mirror, railway);
  return <section className="identity-score-summary" aria-label="인격 종합점수">
    <p aria-live="polite"><strong>{total.complete ? '종합점수' : '입력한 점수 합계'}: {total.score == null ? '미입력' : `${total.score} / 100점`}</strong></p>
    {!total.complete && <p>{total.evaluated} / 5개 콘텐츠 평가 완료 · 미입력은 0점으로 평가하지 않습니다.</p>}
    {total.invalid > 0 && <p role="alert">만점을 초과한 기존 점수 {total.invalid}개는 합계에서 제외했습니다. 해당 기록에서 점수를 확인해 주세요.</p>}
    {onRailwayChange ? <label className="form-field">
      <span className="field-label">종합점수에 사용할 거굴철 노선</span>
      <select className="select" value={railway} onChange={event => onRailwayChange(event.target.value as RailwayScoreContent)}>
        <option value="railway1">1호선</option><option value="railway2">2호선</option><option value="railway6">6호선</option>
      </select>
    </label> : <p>거굴철 {railway.slice('railway'.length)}호선 기준</p>}
    <p>스토리 20 + 채광 10 + 사영전투 30 + 거굴철 10 + 거울던전 30</p>
    <p>거굴철은 선택한 노선 하나만 합산합니다. 거울던전 점수는 일반 인격 편집과 거울던전 전용 화면에서 함께 사용합니다.</p>
  </section>;
}
