import type { Content } from '../lib/library';
import './identity-score-guide.css';

type Criterion = { title: string; points: number; description: string };
type Guide = { label: string; weight: number; premise: string; criteria: Criterion[]; evidence: string };

const story: Guide = {
  label: '스토리', weight: 20,
  premise: '같은 레벨·동기화 단계와 정해진 스테이지에서 비교합니다.',
  criteria: [
    { title: '합 안정성', points: 6, description: '주요 적의 공격에 대한 합 승률과 합 패배 빈도를 확인합니다.' },
    { title: '클리어 기여', points: 6, description: '직접 피해와 아군 지원을 포함해 팀의 클리어 턴을 얼마나 줄이는지 봅니다.' },
    { title: '생존력', points: 4, description: '사망·흐트러짐 빈도와 회복·보호가 필요한 정도를 확인합니다.' },
    { title: '대응 범위', points: 4, description: '여러 스테이지와 적의 기믹에서 맡을 수 있는 역할을 평가합니다.' },
  ],
  evidence: '대상 스테이지, 사용 덱·E.G.O., 시작 조건, 클리어 턴, 합 패배·사망·흐트러짐 횟수',
};
const luxcavation: Guide = {
  label: '채광', weight: 10,
  premise: '참격·관통·타격 중 이 인격에 적합한 채광을 기준으로, 같은 공격 유형의 경쟁 인격과 동일한 스테이지에서 비교합니다. 다른 공격 유형의 채광에서 약하다는 이유로 감점하지 않습니다.',
  criteria: [
    { title: '파밍 속도', points: 6, description: '클리어 턴과 실제 소요 시간을 반복 측정합니다. 가장 빠른 한 번보다 중앙값을 기준으로 봅니다.' },
    { title: '자동 전투 안정성', points: 4, description: '정해진 자동 선택 방식으로 전투했을 때의 성공률과 사고 빈도를 확인합니다. 성공률 기준으로 채점하면 10회 중 9회 성공은 3.6 / 4점입니다.' },
  ],
  evidence: '참격·관통·타격 중 평가 유형, 채광 스테이지, 편성, 자동 선택 방식, 성공 횟수 / 시도 횟수, 중앙값 턴·소요 시간',
};
const simulation: Guide = {
  label: '사영전투', weight: 30,
  premise: '먼저 이 인격을 실제 출전시킨 덱으로 뇌횡을 12턴 이내에 클리어했는지 확인합니다. 성공한 덱 안에서 이 인격의 기여도를 평가하며, 성공 덱에 포함됐다는 사실만으로 높은 점수를 주지 않습니다. 직접 확인하지 못했다면 미검증으로 기록하고 점수는 비워 둡니다.',
  criteria: [
    { title: '클리어 성과에 대한 기여', points: 20, description: '팀 피해량·페이즈 진행·클리어 턴에 미치는 영향을 봅니다. 지원형도 아군 강화, 취약 부여, 키워드 유지로 높인 팀 성과를 포함합니다.' },
    { title: '클리어 안정성에 대한 기여', points: 10, description: '합, 기믹 처리, 탱킹, 회복, 자원 공급으로 12턴 클리어의 재현성을 얼마나 높이는지 확인합니다.' },
  ],
  evidence: '사용 덱, 난이도·시작 조건, 투입 편성 순서, 클리어 턴, 성공 횟수 / 시도 횟수, 같은 역할의 실제 경쟁 인격으로 교체하기 전후의 차이',
};
const railway: Guide = {
  label: '거굴철', weight: 10,
  premise: '평가할 노선과 구간, 시작 체력·정신력·E.G.O. 자원을 고정합니다. 1·2·6호선 기록은 각각 유지하며, 종합 배점의 거굴철 10점은 세 노선에 중복 가산하는 배점이 아닙니다.',
  criteria: [
    { title: '턴 단축 기여', points: 6, description: '이 인격을 편성했을 때 팀의 클리어 턴이 얼마나 줄어드는지 확인합니다.' },
    { title: '공략 재현성', points: 2, description: '같은 공략의 성공률과 재시도 횟수로 안정성을 평가합니다.' },
    { title: '연속 구간 자원 관리', points: 2, description: '다음 구간에 남기는 체력·정신력·E.G.O. 자원과 추가 회복 부담을 봅니다.' },
  ],
  evidence: '노선·구간, 사용 덱, 시작 자원, 클리어 턴, 재시도 횟수, 다음 구간에 남은 자원',
};
const mirror: Guide = {
  label: '거울던전', weight: 30,
  premise: '난이도, 층·테마팩, 기프트, 편성, 스킬 변경 조건을 기록합니다. 핵심 기프트를 얻기 전과 완성된 빌드에서의 성능을 구분합니다.',
  criteria: [
    { title: '기프트·덱 작동 기여', points: 10, description: '기프트 발동과 키워드 위력·횟수 유지 등 덱을 작동시키는 능력을 평가합니다.' },
    { title: '진행 속도', points: 8, description: '일반 전투의 턴과 실제 소요 시간을 확인합니다. 기프트 작동 능력과 같은 이유로 중복 가산하지 않습니다.' },
    { title: '고난도 전투 안정성', points: 8, description: '보스전 실패, 합 패배·사망 빈도, 수동 개입과 E.G.O. 의존도를 확인합니다.' },
    { title: '빌드 완성 전 성능', points: 4, description: '핵심 기프트를 얻기 전에도 맡은 역할을 수행하고 진행을 유지할 수 있는지 봅니다.' },
  ],
  evidence: '난이도, 층·테마팩, 사용 덱, 기프트, 스킬 변경, 일반 전투 시간, 보스전 성공률·E.G.O. 사용',
};

const guides: Record<Content, Guide> = {
  story, luxcavation, simulation, mirror, railway1: railway, railway2: railway, railway6: railway,
};

export function IdentityScoringOverview() {
  return (
    <aside className="identity-scoring-overview" aria-label="인격 종합평가 배점 안내">
      <strong>인격 평가 기준 · 종합 배점 100점</strong>
      <ul className="identity-scoring-weights" aria-label="콘텐츠별 배점">
        {[story, luxcavation, simulation, railway, mirror].map(({ label, weight }) => (
          <li key={label}>{label} <b>{weight}점</b></li>
        ))}
      </ul>
      <p>기준표에서 받은 점수를 <strong>그대로 입력</strong>합니다. 스토리는 20점, 채광은 10점 만점이며, 다섯 콘텐츠를 더한 종합점수만 100점 만점입니다.</p>
      <details className="identity-scoring-principles">
        <summary>공통 채점 원칙</summary>
        <ul>
          <li>레벨·동기화, 편성 순서, E.G.O., 시작 자원과 대상 스테이지를 맞춰 비교합니다.</li>
          <li>가능하면 5~10회 반복한 중앙값과 성공률을 남깁니다. 최고 기록만으로 평가하지 않습니다.</li>
          <li>개인 피해량뿐 아니라 지원·탱킹·기믹 처리로 높인 팀 성과도 평가합니다. 같은 장점의 중복 가산은 피합니다.</li>
          <li>직접 확인하지 않은 내용은 ‘추정’ 또는 ‘미검증’으로 기록합니다. 미평가는 0점과 구분해 점수를 비워 둡니다.</li>
        </ul>
      </details>
    </aside>
  );
}

export default function IdentityScoreGuide({ content, notesHint }: { content: Content; notesHint?: string }) {
  const guide = guides[content];
  const label = content.startsWith('railway') ? `거굴철 ${content.slice('railway'.length)}호선` : guide.label;
  return (
    <div className="identity-score-guide" data-content={content}>
      <details>
        <summary><span>{label} 평가 기준</span><span className="identity-score-weight">{guide.weight}점 배점</span></summary>
        <div className="identity-score-guide-body">
          <p className="identity-score-premise">{guide.premise}</p>
          <dl>
            {guide.criteria.map(({ title, points, description }) => (
              <div key={title}>
                <dt><span>{title}</span><b>{points}점</b></dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
          <p className="identity-score-formula">기준표의 점수를 더해 그대로 입력하세요. {guide.weight}점 만점입니다.</p>
          <p className="identity-score-evidence"><strong>평가 근거에 남길 내용</strong>{guide.evidence}</p>
          <p className="identity-score-notes">{notesHint ?? (content === 'mirror' ? '아래 ‘거울던전 설명’에 조건과 결과를 기록하세요.' : '아래 ‘기록 요약’에 조건과 결과를 기록하세요.')}</p>
        </div>
      </details>
    </div>
  );
}
