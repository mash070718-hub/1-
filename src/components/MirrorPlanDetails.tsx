import { Gift, Layers3, SlidersHorizontal } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import type { LibraryEntry, MirrorPlan, MirrorSkillChange } from "../lib/library";
import "./mirror-dungeon.css";

export interface MirrorPlanDetailsProps {
  plan: MirrorPlan;
  memberIds: string[];
  entries: LibraryEntry[];
}

const hasSkillRecord = (change: MirrorSkillChange) =>
  change.skill1 !== null || change.skill2 !== null || change.skill3 !== null || Boolean(change.notes.trim());

export default function MirrorPlanDetails({ plan, memberIds, entries }: MirrorPlanDetailsProps) {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const changeById = new Map(plan.skillChanges.map((change) => [change.identityId, change]));
  const activeIds = [...new Set(memberIds)];
  const activeSet = new Set(activeIds);
  const retainedChanges = plan.skillChanges.filter((change) => !activeSet.has(change.identityId));
  const floorCount = plan.floors.filter((floor) => floor.themePack.trim() || floor.notes.trim()).length;

  const renderSkill = (identityId: string, index: number, retained = false) => {
    const entry = entryById.get(identityId);
    const name = entry
      ? getCatalogRecord(entry.id) ? `${entry.name} ${entry.sinner}` : entry.name
      : `연결된 인격 (${identityId})`;
    const change = changeById.get(identityId);
    const counts = [change?.skill1 ?? null, change?.skill2 ?? null, change?.skill3 ?? null];
    const total = counts.every((count) => count !== null)
      ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
      : null;
    return (
      <article className="mirror-skill-card" key={identityId} data-retained={retained}>
        <header className="mirror-skill-heading">
          <span className="mirror-member-number" aria-hidden="true">{retained ? "·" : String(index + 1).padStart(2, "0")}</span>
          <div>
            <h4>{name}</h4>
            <p>{retained ? "편성에서 제외됨 · 기록 보관 중" : `${index + 1}번 편성`}</p>
          </div>
          {total !== null && <span className="mirror-skill-total">합계 {total}개</span>}
          {(!change || !hasSkillRecord(change)) && <span className="mirror-state">미기록</span>}
        </header>
        <dl className="mirror-skill-counts">
          {counts.map((count, skillIndex) => (
            <div key={skillIndex}>
              <dt>{skillIndex + 1}스킬</dt>
              <dd>{count === null ? <span className="mirror-unrecorded">미기록</span> : `${count}개`}</dd>
            </div>
          ))}
        </dl>
        {change?.notes.trim() && <p className="mirror-record-text mirror-skill-detail-note">{change.notes}</p>}
      </article>
    );
  };

  return (
    <section className="mirror-plan mirror-plan-details" aria-label="거울던전 공략 기록">
      <div className="mirror-plan-intro">
        <span className="mirror-small-kicker">MIRROR DUNGEON / PLAN</span>
        <h3>거울던전 공략</h3>
        <p>테마팩 {floorCount} / 15층 · 스킬 변경 {plan.skillChanges.filter(hasSkillRecord).length}명</p>
      </div>

      <section className="mirror-plan-section" aria-label="시작 기프트 기록">
        <h4 className="mirror-section-title"><Gift size={17} /> 시작 E.G.O 기프트</h4>
        <p className={`mirror-record-text ${plan.startingGifts.trim() ? "" : "mirror-unrecorded"}`}>
          {plan.startingGifts.trim() ? plan.startingGifts : "시작 기프트 미기록"}
        </p>
        <div className="mirror-gift-detail-note">
          <h5>시작 기프트 메모</h5>
          <p className={`mirror-record-text ${plan.startingGiftNotes.trim() ? "" : "mirror-unrecorded"}`}>
            {plan.startingGiftNotes.trim() ? plan.startingGiftNotes : "미기록"}
          </p>
        </div>
      </section>

      <section className="mirror-plan-section" aria-label="층별 테마팩 기록">
        <h4 className="mirror-section-title"><Layers3 size={17} /> 1–15층 테마팩</h4>
        <ol className="mirror-floor-details">
          {Array.from({ length: 15 }, (_, index) => {
            const floor = plan.floors.find((item) => item.floor === index + 1);
            const recorded = Boolean(floor?.themePack.trim() || floor?.notes.trim());
            return (
              <li className="mirror-floor-detail" key={index + 1} data-recorded={recorded}>
                <span className="mirror-floor-label">{index + 1}층</span>
                <div className="mirror-floor-detail-copy">
                  <strong className={floor?.themePack.trim() ? "" : "mirror-unrecorded"}>
                    {floor?.themePack.trim() ? floor.themePack : "테마팩 미기록"}
                  </strong>
                  {floor?.notes.trim() && <p className="mirror-record-text">{floor.notes}</p>}
                </div>
                <span className="mirror-state" data-recorded={recorded}>{recorded ? "기록됨" : "미기록"}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mirror-plan-section" aria-label="인격별 스킬 변경 기록">
        <h4 className="mirror-section-title"><SlidersHorizontal size={17} /> 인격별 스킬 변경</h4>
        {activeIds.length > 0 ? (
          <div className="mirror-skill-list">{activeIds.map((id, index) => renderSkill(id, index))}</div>
        ) : (
          <p className="mirror-empty-note">편성된 인격이 없습니다.</p>
        )}
        {retainedChanges.length > 0 && (
          <details className="mirror-retained">
            <summary>편성에서 제외한 인격의 기록 <span>{retainedChanges.length}명</span></summary>
            <div className="mirror-skill-list">
              {retainedChanges.map((change, index) => renderSkill(change.identityId, index, true))}
            </div>
          </details>
        )}
      </section>
    </section>
  );
}
