import { useState } from "react";
import { BookMarked, Search, Sparkles, X } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import { TIERS, type LibraryEntry, type MirrorEvaluation, type Tier } from "../lib/library";
import "./mirror-evaluation.css";

export interface MirrorEvaluationEditorProps {
  entry: LibraryEntry;
  value: MirrorEvaluation;
  entries: LibraryEntry[];
  onChange: (evaluation: MirrorEvaluation) => void;
}

const tierLabel = (tier: Tier) => tier === "unrated" ? "미평가" : `${tier} 티어`;
const displayName = (entry: LibraryEntry) => {
  const catalog = getCatalogRecord(entry.id);
  return catalog ? `${catalog.name} ${catalog.sinner}` : `${entry.name} ${entry.sinner}`.trim();
};

export default function MirrorEvaluationEditor({ entry, value, entries, onChange }: MirrorEvaluationEditorProps) {
  const catalog = getCatalogRecord(entry.id);
  const name = catalog?.name ?? entry.name;
  const sinner = catalog?.sinner ?? entry.sinner;
  const [query, setQuery] = useState("");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = catalog?.thumbnail;
  const Icon = entry.kind === "ego" ? Sparkles : BookMarked;
  const egoEntries = entries.filter((item) => item.kind === "ego");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const choices = egoEntries.filter((item) => !normalizedQuery || displayName(item).toLocaleLowerCase().includes(normalizedQuery));
  const egoIds = new Set(egoEntries.map((item) => item.id));
  const retainedIds = value.recommendedEgoIds.filter((id) => !egoIds.has(id));
  const set = <K extends keyof MirrorEvaluation>(key: K, next: MirrorEvaluation[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="mirror-evaluation mirror-evaluation-editor" data-entry-id={entry.id}>
      <div className="mirror-evaluation-metadata" aria-label="인격 및 E.G.O 기본 정보">
        <span className="mirror-evaluation-thumbnail" aria-hidden="true">
          {image && failedImage !== image ? (
            <img src={image} alt="" decoding="async" onError={() => setFailedImage(image)} />
          ) : <Icon size={27} />}
        </span>
        <div>
          <span className="mirror-evaluation-kicker">MIRROR DUNGEON / {entry.kind === "ego" ? "E.G.O" : "IDENTITY"}</span>
          <strong>{name}</strong>
          <p>{sinner || "수감자 미지정"}</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span className="field-label">거울던전 티어</span>
          <select className="select" value={value.tier} onChange={(event) => set("tier", event.target.value as Tier)}>
            {TIERS.map((tier) => <option key={tier} value={tier}>{tierLabel(tier)}</option>)}
          </select>
        </label>
        <label className="form-field field-wide">
          <span className="field-label">거울던전 한 줄 소개</span>
          <input className="input" maxLength={300} value={value.subtitle}
            onChange={(event) => set("subtitle", event.target.value)}
            placeholder="거울던전에서의 역할을 한 문장으로 기록하세요." />
        </label>
        <label className="form-field field-wide">
          <span className="field-label">거울던전 설명</span>
          <textarea className="textarea" rows={3} maxLength={10000} value={value.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="기프트와 테마팩에 따른 평가를 기록하세요." />
        </label>
        <label className="form-field">
          <span className="field-label">거울던전 장점</span>
          <textarea className="textarea" rows={4} maxLength={10000} value={value.strengths}
            onChange={(event) => set("strengths", event.target.value)}
            placeholder="거울던전에서 강한 상황은 무엇인가요?" />
        </label>
        <label className="form-field">
          <span className="field-label">거울던전 단점</span>
          <textarea className="textarea" rows={4} maxLength={10000} value={value.weaknesses}
            onChange={(event) => set("weaknesses", event.target.value)}
            placeholder="주의할 테마팩과 필요한 조건을 기록하세요." />
        </label>
        <label className="form-field field-wide">
          <span className="field-label">거울던전 운용 방법</span>
          <textarea className="textarea" rows={5} maxLength={10000} value={value.operation}
            onChange={(event) => set("operation", event.target.value)}
            placeholder="기프트, 스킬 변경, 자원 관리에 따른 운용을 기록하세요." />
        </label>

        {entry.kind === "identity" && (
          <fieldset className="form-field field-wide mirror-evaluation-ego-picker">
            <legend className="field-label"><Sparkles size={16} /> 거울던전 추천 E.G.O</legend>
            <label className="search-field relationship-search">
              <Search size={16} />
              <input aria-label="거울던전 추천 E.G.O 검색" placeholder="이름 또는 수감자로 찾기"
                value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <p className="field-help" aria-live="polite">
              {value.recommendedEgoIds.length}개 선택됨 · 검색해도 선택한 추천은 유지됩니다.
            </p>
            <div className="checkbox-grid">
              {choices.map((item) => (
                <label className="checkbox-option" key={item.id}>
                  <input type="checkbox" aria-label={displayName(item)} checked={value.recommendedEgoIds.includes(item.id)}
                    onChange={(event) => set("recommendedEgoIds", event.target.checked
                      ? [...new Set([...value.recommendedEgoIds, item.id])]
                      : value.recommendedEgoIds.filter((id) => id !== item.id))} />
                  <span>{displayName(item)}</span>
                </label>
              ))}
            </div>
            {choices.length === 0 && <p className="field-help">{egoEntries.length ? "검색 결과가 없습니다." : "추천할 E.G.O가 없습니다."}</p>}
            {retainedIds.length > 0 && (
              <div className="mirror-evaluation-retained">
                <p className="field-help">현재 도감에서 찾을 수 없는 추천도 보관합니다.</p>
                {retainedIds.map((id) => (
                  <button className="mirror-evaluation-retained-link" type="button" key={id}
                    aria-label={`거울던전 추천 E.G.O ${id} 해제`}
                    onClick={() => set("recommendedEgoIds", value.recommendedEgoIds.filter((selected) => selected !== id))}>
                    <span>{id}</span><X size={13} />
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}
