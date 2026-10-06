import { useId } from "react";
import { Gift, Layers3, SlidersHorizontal } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import type {
  LibraryEntry,
  MirrorFloor,
  MirrorPlan,
  MirrorSkillChange,
} from "../lib/library";
import "./mirror-dungeon.css";

export interface MirrorPlanEditorProps {
  value: MirrorPlan;
  memberIds: string[];
  entries: LibraryEntry[];
  onChange: (plan: MirrorPlan) => void;
}

const identityName = (entry: LibraryEntry | undefined, id: string) =>
  entry
    ? getCatalogRecord(entry.id)
      ? `${entry.name} ${entry.sinner}`
      : entry.name
    : `연결된 인격 (${id})`;

const emptySkillChange = (identityId: string): MirrorSkillChange => ({
  identityId,
  skill1: null,
  skill2: null,
  skill3: null,
  notes: "",
});

/** Skill recommendations stay attached to the identity when formation order changes. */
export default function MirrorPlanEditor({
  value,
  memberIds,
  entries,
  onChange,
}: MirrorPlanEditorProps) {
  const fieldId = useId();
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const changeById = new Map(value.skillChanges.map((change) => [change.identityId, change]));
  const activeIds = [...new Set(memberIds)];
  const activeSet = new Set(activeIds);
  const retainedChanges = value.skillChanges.filter((change) => !activeSet.has(change.identityId));
  const floors: MirrorFloor[] = Array.from({ length: 15 }, (_, index) =>
    value.floors.find((floor) => floor.floor === index + 1)
      ?? { floor: index + 1, themePack: "", notes: "" });

  const changeFloor = (floor: number, field: "themePack" | "notes", text: string) => {
    onChange({
      ...value,
      floors: floors.map((item) => item.floor === floor ? { ...item, [field]: text } : item),
    });
  };

  const changeSkill = (identityId: string, patch: Partial<MirrorSkillChange>) => {
    const current = changeById.get(identityId) ?? emptySkillChange(identityId);
    const next = { ...current, ...patch, identityId };
    onChange({
      ...value,
      skillChanges: changeById.has(identityId)
        ? value.skillChanges.map((item) => item.identityId === identityId ? next : item)
        : [...value.skillChanges, next],
    });
  };

  const renderSkillRow = (identityId: string, index: number, retained = false) => {
    const entry = entryById.get(identityId);
    const name = identityName(entry, identityId);
    const change = changeById.get(identityId) ?? emptySkillChange(identityId);
    const counts = [change.skill1, change.skill2, change.skill3];
    const total = counts.every((count) => count !== null)
      ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
      : null;
    return (
      <article className="mirror-skill-card" key={identityId} data-retained={retained}>
        <header className="mirror-skill-heading">
          <span className="mirror-member-number" aria-hidden="true">
            {retained ? "·" : String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h4>{name}</h4>
            <p>{retained ? "편성에서 제외됨 · 기록 보관 중" : `${index + 1}번 편성`}</p>
          </div>
          {total !== null && <span className="mirror-skill-total">합계 {total}개</span>}
        </header>
        <div className="mirror-skill-inputs">
          {(["skill1", "skill2", "skill3"] as const).map((field, skillIndex) => (
            <label className="mirror-field" key={field}>
              <span>{skillIndex + 1}스킬 개수</span>
              <input
                type="number"
                className="mirror-input mirror-count-input"
                min={0}
                max={99}
                step={1}
                inputMode="numeric"
                aria-label={`${name} ${skillIndex + 1}스킬 개수`}
                value={change[field] ?? ""}
                placeholder="미기록"
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  if (text === "") {
                    changeSkill(identityId, { [field]: null });
                    return;
                  }
                  const count = Number(text);
                  if (Number.isInteger(count)) {
                    changeSkill(identityId, { [field]: Math.min(99, Math.max(0, count)) });
                  } else {
                    event.currentTarget.value = String(change[field] ?? "");
                  }
                }}
              />
            </label>
          ))}
        </div>
        <label className="mirror-field mirror-skill-note">
          <span>변경 메모</span>
          <textarea
            className="mirror-input"
            rows={2}
            aria-label={`${name} 스킬 변경 메모`}
            value={change.notes}
            placeholder="스킬을 바꾸는 시점과 이유를 기록하세요"
            maxLength={30000}
            onChange={(event) => changeSkill(identityId, { notes: event.currentTarget.value })}
          />
        </label>
      </article>
    );
  };

  return (
    <section className="mirror-plan mirror-plan-editor" aria-label="거울던전 공략 작성">
      <div className="mirror-plan-intro">
        <span className="mirror-small-kicker">MIRROR DUNGEON / PLAN</span>
        <h3>거울던전 공략</h3>
        <p>시작 기프트, 층별 테마팩, 인격별 스킬 변경을 한 기록에 모아 두세요.</p>
      </div>

      <fieldset className="mirror-plan-section">
        <legend><Gift size={17} /> 시작 E.G.O 기프트</legend>
        <div className="mirror-gift-fields">
          <label className="mirror-field" htmlFor={`${fieldId}-gifts`}>
            <span>시작 E.G.O 기프트</span>
            <textarea
              id={`${fieldId}-gifts`}
              className="mirror-input"
              rows={3}
              value={value.startingGifts}
              placeholder="선택할 기프트를 직접 기록하세요"
              maxLength={5000}
              onChange={(event) => onChange({ ...value, startingGifts: event.currentTarget.value })}
            />
          </label>
          <label className="mirror-field" htmlFor={`${fieldId}-gift-notes`}>
            <span>시작 기프트 메모</span>
            <textarea
              id={`${fieldId}-gift-notes`}
              className="mirror-input"
              rows={3}
              value={value.startingGiftNotes}
              placeholder="선택 이유나 함께 챙길 조건을 기록하세요"
              maxLength={30000}
              onChange={(event) => onChange({ ...value, startingGiftNotes: event.currentTarget.value })}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="mirror-plan-section">
        <legend><Layers3 size={17} /> 1–15층 테마팩</legend>
        <p className="mirror-help">층마다 선택할 테마팩과 메모를 남겨 두세요. 빈칸은 미기록으로 보관됩니다.</p>
        <div className="mirror-floor-grid">
          {floors.map((floor) => (
            <div className="mirror-floor-editor" key={floor.floor}>
              <span className="mirror-floor-number" aria-hidden="true">{String(floor.floor).padStart(2, "0")}</span>
              <div className="mirror-floor-fields">
                <label className="mirror-field" htmlFor={`${fieldId}-floor-${floor.floor}`}>
                  <span>{floor.floor}층 테마팩</span>
                  <input
                    id={`${fieldId}-floor-${floor.floor}`}
                    className="mirror-input"
                    value={floor.themePack}
                    placeholder="테마팩 이름"
                    maxLength={2000}
                    onChange={(event) => changeFloor(floor.floor, "themePack", event.currentTarget.value)}
                  />
                </label>
                <label className="mirror-field" htmlFor={`${fieldId}-floor-${floor.floor}-notes`}>
                  <span>{floor.floor}층 메모</span>
                  <textarea
                    id={`${fieldId}-floor-${floor.floor}-notes`}
                    className="mirror-input"
                    rows={2}
                    value={floor.notes}
                    placeholder="선택 이유와 주의할 점"
                    maxLength={30000}
                    onChange={(event) => changeFloor(floor.floor, "notes", event.currentTarget.value)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="mirror-plan-section">
        <legend><SlidersHorizontal size={17} /> 인격별 스킬 변경</legend>
        <p className="mirror-help">추천하는 스킬 개수를 0–99 사이의 정수로 기록하세요. 빈칸은 미기록이며 합계는 제한하지 않습니다.</p>
        {activeIds.length > 0 ? (
          <div className="mirror-skill-list">{activeIds.map((id, index) => renderSkillRow(id, index))}</div>
        ) : (
          <p className="mirror-empty-note">덱 편성에 인격을 추가하면 스킬 개수를 기록할 수 있습니다.</p>
        )}
        {retainedChanges.length > 0 && (
          <details className="mirror-retained">
            <summary>편성에서 제외한 인격의 기록 <span>{retainedChanges.length}명</span></summary>
            <p className="mirror-help">저장한 스킬 변경 기록은 유지됩니다. 다시 편성하면 해당 인격의 기록이 이어집니다.</p>
            <div className="mirror-skill-list">
              {retainedChanges.map((change, index) => renderSkillRow(change.identityId, index, true))}
            </div>
          </details>
        )}
      </fieldset>
    </section>
  );
}
