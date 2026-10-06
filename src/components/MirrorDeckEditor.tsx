import { useId, useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import { AFFINITIES, TIERS, type LibraryEntry, type MirrorDeck, type Tier } from "../lib/library";
import DeckFormationEditor from "./DeckFormationEditor";
import MirrorPlanEditor from "./MirrorPlanEditor";
import { TagPicker } from "./TagPicker";
import "./mirror-dungeon.css";

export interface MirrorDeckEditorProps {
  deck: MirrorDeck;
  entries: LibraryEntry[];
  onChange: (deck: MirrorDeck) => void;
}

const displayName = (entry: LibraryEntry) =>
  getCatalogRecord(entry.id) ? `${entry.name} ${entry.sinner}` : entry.name;

/** The parent owns the form, submission, and draft lifecycle. */
export default function MirrorDeckEditor({ deck, entries, onChange }: MirrorDeckEditorProps) {
  const fieldId = useId();
  const [egoQuery, setEgoQuery] = useState("");
  const egoOptions = useMemo(() => {
    const tokens = egoQuery.trim().toLocaleLowerCase("ko-KR").split(/\s+/).filter(Boolean);
    return entries.filter((entry) => entry.kind === "ego" && tokens.every((token) =>
      `${entry.name} ${entry.sinner}`.toLocaleLowerCase("ko-KR").includes(token)));
  }, [egoQuery, entries]);

  const set = <K extends keyof MirrorDeck>(field: K, value: MirrorDeck[K]) => {
    onChange({ ...deck, [field]: value });
  };

  return (
    <div className="mirror-deck-editor">
      <div className="form-grid">
        <label className="form-field field-wide" htmlFor={`${fieldId}-name`}>
          <span className="field-label">이름 <span aria-hidden="true">*</span></span>
          <input
            id={`${fieldId}-name`}
            className="input"
            required
            aria-label="이름"
            maxLength={200}
            value={deck.name}
            onChange={(event) => set("name", event.currentTarget.value)}
            placeholder="거울던전 덱의 이름을 입력하세요"
          />
        </label>
        <label className="form-field field-wide" htmlFor={`${fieldId}-subtitle`}>
          <span className="field-label">거울던전 한 줄 소개</span>
          <input
            id={`${fieldId}-subtitle`}
            className="input"
            maxLength={300}
            value={deck.subtitle}
            onChange={(event) => set("subtitle", event.currentTarget.value)}
            placeholder="이 공략의 핵심을 한 문장으로 남겨 주세요"
          />
        </label>
        <label className="form-field" htmlFor={`${fieldId}-affinity`}>
          <span className="field-label">주요 죄악</span>
          <select id={`${fieldId}-affinity`} className="select" value={deck.affinity} onChange={(event) => set("affinity", event.currentTarget.value)}>
            <option value="">선택 안 함</option>
            {AFFINITIES.map((affinity) => <option key={affinity} value={affinity}>{affinity}</option>)}
          </select>
        </label>
        <label className="form-field" htmlFor={`${fieldId}-tier`}>
          <span className="field-label">거울던전 티어</span>
          <select id={`${fieldId}-tier`} className="select" value={deck.tier} onChange={(event) => set("tier", event.currentTarget.value as Tier)}>
            {TIERS.map((tier) => <option key={tier} value={tier}>{tier === "unrated" ? "미평가" : `${tier} 티어`}</option>)}
          </select>
        </label>

        <div className="field-wide">
          <DeckFormationEditor memberIds={deck.memberIds} entries={entries} maxMembers={12} onChange={(ids) => set("memberIds", ids)} />
          <TagPicker value={deck.tags} onChange={(tags) => set("tags", tags)} />
        </div>
        <div className="field-wide">
          <MirrorPlanEditor value={deck.plan} memberIds={deck.memberIds} entries={entries} onChange={(plan) => set("plan", plan)} />
        </div>

        <label className="form-field field-wide" htmlFor={`${fieldId}-description`}>
          <span className="field-label">거울던전 설명</span>
          <textarea id={`${fieldId}-description`} className="textarea" rows={3} maxLength={30000} value={deck.description} onChange={(event) => set("description", event.currentTarget.value)} placeholder="이 편성을 선택하는 이유와 공략의 목표를 기록하세요" />
        </label>
        <label className="form-field" htmlFor={`${fieldId}-strengths`}>
          <span className="field-label">거울던전 장점</span>
          <textarea id={`${fieldId}-strengths`} className="textarea" rows={4} maxLength={30000} value={deck.strengths} onChange={(event) => set("strengths", event.currentTarget.value)} placeholder="어떤 조건과 테마팩에서 강한가요?" />
        </label>
        <label className="form-field" htmlFor={`${fieldId}-weaknesses`}>
          <span className="field-label">거울던전 단점</span>
          <textarea id={`${fieldId}-weaknesses`} className="textarea" rows={4} maxLength={30000} value={deck.weaknesses} onChange={(event) => set("weaknesses", event.currentTarget.value)} placeholder="주의할 적과 피하고 싶은 조건을 기록하세요" />
        </label>
        <label className="form-field field-wide" htmlFor={`${fieldId}-operation`}>
          <span className="field-label">거울던전 운용 방법</span>
          <textarea id={`${fieldId}-operation`} className="textarea" rows={5} maxLength={30000} value={deck.operation} onChange={(event) => set("operation", event.currentTarget.value)} placeholder="스킬 순서, 자원 관리, 기프트를 얻은 뒤의 운영을 기록하세요" />
        </label>

        <section className="form-field field-wide mirror-deck-ego-picker" aria-label="거울던전 추천 E.G.O 선택">
          <div className="mirror-deck-picker-heading">
            <h3 className="field-label"><Sparkles size={16} /> 거울던전 추천 E.G.O 연결</h3>
            <span className="field-help">{deck.recommendedEgoIds.length}개 선택</span>
          </div>
          <div className="search-field relationship-search">
            <Search size={16} />
            <label className="sr-only" htmlFor={`${fieldId}-ego-search`}>거울던전 추천 E.G.O 검색</label>
            <input id={`${fieldId}-ego-search`} value={egoQuery} onChange={(event) => setEgoQuery(event.currentTarget.value)} placeholder="E.G.O 이름이나 수감자로 검색" />
            {egoQuery && <button type="button" className="icon-button" aria-label="거울던전 E.G.O 검색 지우기" onClick={() => setEgoQuery("")}><X size={14} /></button>}
          </div>
          <div className="checkbox-grid mirror-deck-ego-options">
            {egoOptions.map((entry) => (
              <label className="checkbox-option" key={entry.id}>
                <input
                  type="checkbox"
                  checked={deck.recommendedEgoIds.includes(entry.id)}
                  aria-label={displayName(entry)}
                  onChange={(event) => set("recommendedEgoIds", event.currentTarget.checked
                    ? [...deck.recommendedEgoIds, entry.id]
                    : deck.recommendedEgoIds.filter((id) => id !== entry.id))}
                />
                <span>{displayName(entry)}</span>
              </label>
            ))}
            {egoOptions.length === 0 && <p className="field-help field-wide">일치하는 E.G.O가 없습니다.</p>}
          </div>
        </section>

        <label className="form-field field-wide" htmlFor={`${fieldId}-code`}>
          <span className="field-label">거울던전 편성번호</span>
          <textarea id={`${fieldId}-code`} className="textarea" rows={2} maxLength={2000} value={deck.formationCode} onChange={(event) => set("formationCode", event.currentTarget.value)} placeholder="이 거울던전 덱의 편성번호나 편성 메모를 기록하세요" />
          <span className="field-help">입력한 번호를 그대로 보관합니다.</span>
        </label>
      </div>
    </div>
  );
}
