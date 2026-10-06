import { useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookMarked, Search, X } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import { SINNERS, type LibraryEntry } from "../lib/library";
import "./deck-formation.css";

export interface DeckFormationEditorProps {
  memberIds: string[];
  entries: LibraryEntry[];
  onChange: (ids: string[]) => void;
}

const MAX_FORMATION_SIZE = 7;
const identityName = (entry: LibraryEntry) =>
  getCatalogRecord(entry.id) ? `${entry.name} ${entry.sinner}` : entry.name;

function FormationArt({ entry }: { entry: LibraryEntry | undefined }) {
  const record = entry ? getCatalogRecord(entry.id) : undefined;
  const [failedImage, setFailedImage] = useState<string | undefined>();
  return (
    <span className="deck-formation-art" aria-hidden="true">
      {record && failedImage !== record.thumbnail ? (
        <img
          src={record.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedImage(record.thumbnail)}
        />
      ) : (
        <BookMarked size={22} />
      )}
    </span>
  );
}

/** The memberIds array is the saved formation order; the first entry is its cover. */
export default function DeckFormationEditor({
  memberIds,
  entries,
  onChange,
}: DeckFormationEditorProps) {
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const [sinner, setSinner] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );
  const selectedIds = new Set(memberIds);
  const searchTokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const options = entries.filter((entry) => {
    if (entry.kind !== "identity") return false;
    if (sinner && entry.sinner !== sinner) return false;
    const searchable = `${entry.name} ${entry.sinner} ${entry.tags.join(" ")}`.toLocaleLowerCase();
    return searchTokens.every((token) => searchable.includes(token));
  });
  const isFull = memberIds.length >= MAX_FORMATION_SIZE;
  const formationSize = Math.max(MAX_FORMATION_SIZE, memberIds.length);

  const remove = (id: string) => {
    const entry = entriesById.get(id);
    onChange(memberIds.filter((memberId) => memberId !== id));
    setAnnouncement(`${entry ? identityName(entry) : "인격"}을 편성에서 제외했습니다.`);
  };
  const move = (position: number, direction: -1 | 1) => {
    const target = position + direction;
    if (target < 0 || target >= memberIds.length) return;
    const reordered = [...memberIds];
    [reordered[position], reordered[target]] = [reordered[target], reordered[position]];
    onChange(reordered);
    const entry = entriesById.get(memberIds[position]);
    setAnnouncement(
      `${entry ? identityName(entry) : "인격"}이 ${target + 1}번 편성으로 이동했습니다.${target === 0 ? " 덱 표지가 변경되었습니다." : ""}`,
    );
  };

  return (
    <section
      className="form-field field-wide deck-formation-editor"
      aria-labelledby={`${fieldId}-title`}
    >
      <div className="deck-formation-heading">
        <span className="field-label" id={`${fieldId}-title`}>
          편성 인격 연결
        </span>
        <span className="deck-formation-count">
          {memberIds.length} / {MAX_FORMATION_SIZE}명
        </span>
      </div>
      <p className="field-help" id={`${fieldId}-help`}>
        1~7번 편성 순서로 저장됩니다. 1번 인격의 이미지가 덱 표지가 됩니다.
        화살표 버튼으로 순서를 바꾸세요.
      </p>
      {memberIds.length > MAX_FORMATION_SIZE && (
        <p className="deck-formation-notice" role="status">
          기존에 저장한 {memberIds.length}명의 편성을 유지했습니다. 새 인격을 추가하려면 7명 미만으로 줄여 주세요.
        </p>
      )}

      <ol className="deck-formation-slots" aria-label="인격 편성 순서">
        {Array.from({ length: formationSize }, (_, position) => {
          const id = memberIds[position];
          const entry = id ? entriesById.get(id) : undefined;
          const name = entry ? identityName(entry) : "연결된 인격";
          return (
            <li
              className={`deck-formation-slot${!id ? " is-empty" : ""}`}
              key={id ?? `empty-${position}`}
              data-position={position + 1}
              data-entry-id={id ?? undefined}
              data-cover={position === 0 && Boolean(id) ? "true" : undefined}
            >
              <div className="deck-formation-position">
                <strong>{position + 1}번 편성</strong>
                {position === 0 ? (
                  <span className="deck-formation-cover-label">덱 표지</span>
                ) : position >= MAX_FORMATION_SIZE ? (
                  <span className="deck-formation-legacy-label">기존 추가 편성</span>
                ) : null}
              </div>
              {id ? (
                <>
                  <div className="deck-formation-member">
                    <FormationArt entry={entry} />
                    <div className="deck-formation-member-copy">
                      <strong>{entry?.name ?? "연결된 인격"}</strong>
                      <span>{entry?.sinner ?? "기존 인격 연결"}</span>
                    </div>
                  </div>
                  <div className="deck-formation-actions">
                    <button
                      type="button"
                      aria-label={`${name} 앞으로 이동`}
                      title="이전 순서로"
                      disabled={position === 0}
                      onClick={() => move(position, -1)}
                    >
                      <ArrowUp size={15} />
                      <span>앞으로</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${name} 뒤로 이동`}
                      title="다음 순서로"
                      disabled={position === memberIds.length - 1}
                      onClick={() => move(position, 1)}
                    >
                      <ArrowDown size={15} />
                      <span>뒤로</span>
                    </button>
                    <button
                      type="button"
                      className="deck-formation-remove"
                      aria-label={`${name} 편성에서 제외`}
                      title="편성에서 제외"
                      onClick={() => remove(id)}
                    >
                      <X size={15} />
                      <span>제외</span>
                    </button>
                  </div>
                </>
              ) : (
                <p className="deck-formation-empty">아래에서 인격을 선택하세요.</p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="deck-formation-filters">
        <label className="deck-formation-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="편성 인격 연결 검색"
            placeholder="이름, 수감자, 태그로 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          className="select deck-formation-sinner"
          aria-label="편성 수감자"
          value={sinner}
          onChange={(event) => setSinner(event.target.value)}
        >
          <option value="">전체 수감자</option>
          {SINNERS.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <p className="field-help" id={`${fieldId}-limit`}>
        {isFull
          ? "최대 7명까지 추가할 수 있습니다. 선택을 해제하면 다른 인격을 추가할 수 있습니다."
          : "인격을 선택하면 마지막 순서에 추가됩니다. 검색해도 편성은 유지됩니다."}
      </p>
      <div className="deck-formation-options" aria-label="편성할 인격 선택">
        {options.map((entry) => {
          const selected = selectedIds.has(entry.id);
          const position = memberIds.indexOf(entry.id) + 1;
          return (
            <label
              className="deck-formation-option"
              key={entry.id}
              data-selected={selected ? "true" : undefined}
              data-disabled={!selected && isFull ? "true" : undefined}
            >
              <input
                type="checkbox"
                aria-label={identityName(entry)}
                aria-describedby={`${fieldId}-limit`}
                checked={selected}
                disabled={!selected && isFull}
                onChange={(event) => {
                  if (!event.target.checked) {
                    remove(entry.id);
                  } else if (!selectedIds.has(entry.id) && memberIds.length < MAX_FORMATION_SIZE) {
                    onChange([...memberIds, entry.id]);
                    setAnnouncement(`${identityName(entry)}이 ${memberIds.length + 1}번 편성에 추가되었습니다.`);
                  }
                }}
              />
              <FormationArt entry={entry} />
              <span className="deck-formation-option-copy">
                <strong>{entry.name}</strong>
                <span>{entry.sinner}</span>
              </span>
              {selected && <span className="deck-formation-option-order">{position}번</span>}
            </label>
          );
        })}
        {!options.length && <p className="deck-formation-no-results">검색 조건에 맞는 인격이 없습니다.</p>}
      </div>
      <span className="deck-formation-announcement" role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
