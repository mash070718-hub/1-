import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookMarked,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  Feather,
  FileText,
  Layers3,
  Library,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  X,
} from "lucide-react";
import {
  AFFINITIES,
  CONTENTS,
  DECK_CATEGORIES,
  KINDS,
  SINNERS,
  STORAGE_KEY,
  TIERS,
  createCatalogLibrary,
  createEntry,
  exportLibrary,
  loadLibrary,
  parseLibrary,
  mergeCatalog,
  matchesDeckCategory,
  resetCatalogEntry,
  saveLibrary,
  type Content,
  type DeckCategory,
  type Kind,
  type LibraryData,
  type LibraryEntry,
  type Tier,
} from "./lib/library";
import { CATALOG, CATALOG_METADATA, getCatalogRecord } from "./lib/catalog";
import DeckFormationEditor from "./components/DeckFormationEditor";
import { TagPicker } from "./components/TagPicker";

const kindIcon = { identity: BookMarked, ego: Sparkles, deck: Layers3 };
const kindLabel = { identity: "인격", ego: "E.G.O", deck: "덱" };
const tierLabel = (tier: Tier) =>
  tier === "unrated" ? "미평가" : `${tier} 티어`;
const hasNotes = (entry: LibraryEntry) =>
  Boolean(
    entry.description ||
      entry.strengths ||
      entry.weaknesses ||
      entry.operation ||
      entry.subtitle,
  );
const displayName = (entry: LibraryEntry) =>
  getCatalogRecord(entry.id) ? `${entry.name} ${entry.sinner}` : entry.name;

function EntryArt({
  entry,
  entries = [],
  large = false,
}: {
  entry: LibraryEntry;
  entries?: LibraryEntry[];
  large?: boolean;
}) {
  const cover = entry.kind === "deck"
    ? entries.find((item) => item.id === entry.memberIds[0])
    : entry;
  const record = getCatalogRecord(cover?.id ?? entry.id);
  const [failed, setFailed] = useState(false);
  const Icon = kindIcon[entry.kind];
  const image = large ? record?.image : record?.thumbnail;
  useEffect(() => setFailed(false), [image]);
  return (
    <span className={large ? "detail-art" : "entry-art"} data-kind={entry.kind}>
      {image && !failed ? (
        <img
          src={image}
          alt={entry.kind === "deck" && cover
            ? `${entry.name} 덱 표지 · 1번 편성 ${cover.sinner} ${cover.name}`
            : `${entry.sinner} ${entry.name} 공식 게임 이미지`}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="entry-art-placeholder">
          <Icon size={large ? 38 : 26} />
          {failed && <span>이미지 없음</span>}
        </span>
      )}
    </span>
  );
}
// Also display older imported links recorded on only one side of a deck.
function withMembership(
  entry: LibraryEntry,
  entries: LibraryEntry[],
): LibraryEntry {
  if (entry.kind === "identity")
    return {
      ...entry,
      deckIds: [
        ...new Set([
          ...entry.deckIds,
          ...entries
            .filter(
              (item) =>
                item.kind === "deck" && item.memberIds.includes(entry.id),
            )
            .map((item) => item.id),
        ]),
      ],
    };
  if (entry.kind === "deck")
    return {
      ...entry,
      memberIds: [
        ...new Set([
          ...entry.memberIds,
          ...entries
            .filter(
              (item) =>
                item.kind === "identity" && item.deckIds.includes(entry.id),
            )
            .map((item) => item.id),
        ]),
      ],
    };
  return entry;
}
function navigateTabs(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}
const initialLibrary = () => {
  try {
    return { data: loadLibrary(), error: "" };
  } catch {
    return {
      data: { version: 1, entries: [] } as LibraryData,
      error:
        "저장된 기록을 읽지 못했습니다. 원본은 그대로 보존했습니다. 백업과 복원에서 원본을 내려받거나 정상 백업을 불러와 주세요.",
    };
  }
};

function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  footer,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>("button, input, select, textarea")
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !ref.current) return;
      const nodes = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h2 id="modal-title" className="modal-title">
              {title}
            </h2>
          </div>
          <button
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  entries,
  content,
  showTier = true,
  onOpen,
  onTier,
}: {
  entry: LibraryEntry;
  entries: LibraryEntry[];
  content: Content;
  showTier?: boolean;
  onOpen: (id: string) => void;
  onTier: (id: string, tier: Tier) => void;
}) {
  const catalog = getCatalogRecord(entry.id);
  return (
    <article
      className="entry-card"
      data-kind={entry.kind}
      data-catalog={Boolean(catalog)}
    >
      <button
        className="entry-card-button"
        onClick={() => onOpen(entry.id)}
        aria-label={`${displayName(entry)} 상세 보기`}
      >
        <EntryArt entry={withMembership(entry, entries)} entries={entries} />
        <span className="entry-body">
          <span className="entry-kicker">
            {entry.kind === "deck"
              ? "DECK ARCHIVE"
              : entry.sinner || kindLabel[entry.kind]}
            {catalog && <span className="badge">{catalog.rarity}</span>}
          </span>
          <span className="entry-title">{entry.name}</span>
          <span className="entry-subtitle">
            {entry.subtitle ||
              (hasNotes(entry)
                ? "개인 평가가 기록되어 있습니다."
                : catalog
                  ? "이 기록의 첫 평가를 남겨보세요."
                  : "아직 한 줄 소개가 없습니다.")}
          </span>
        </span>
        <ChevronRight size={16} className="entry-arrow" />
      </button>
      {entry.kind === "deck" && entry.contentIds.length > 0 && (
        <div className="deck-content-chips" aria-label="덱 사용 콘텐츠">
          {CONTENTS.filter((item) => entry.contentIds.includes(item.id)).map((item) => (
            <span className="deck-content-chip" key={item.id}>{item.shortLabel}</span>
          ))}
        </div>
      )}
      <div className="card-footer">
        <span className="entry-tags">
          {entry.tags.slice(0, 2).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
          {!entry.tags.length && (
            <span className="subtle-text">{entry.affinity || "개인 기록"}</span>
          )}
        </span>
        {showTier && <select
          className="card-tier-select"
          aria-label={`${displayName(entry)} ${CONTENTS.find((item) => item.id === content)?.label} 티어`}
          value={entry.tiers[content]}
          onChange={(event) => onTier(entry.id, event.target.value as Tier)}
        >
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tierLabel(tier)}
            </option>
          ))}
        </select>}
      </div>
    </article>
  );
}

function Detail({
  entry,
  entries,
  content,
  onClose,
  onEdit,
  onDelete,
  onOpen,
  onTier,
}: {
  entry: LibraryEntry;
  entries: LibraryEntry[];
  content: Content;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: (id: string) => void;
  onTier: (id: string, tier: Tier) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const catalog = getCatalogRecord(entry.id);
  const linked = (ids: string[], empty: string) =>
    ids.length ? (
      <div className="linked-list">
        {ids.map((id) => {
          const item = entries.find((record) => record.id === id);
          return (
            item && (
              <button
                className="linked-card"
                key={id}
                onClick={() => onOpen(id)}
              >
                <span>
                  <span className="entry-kicker">
                    {kindLabel[item.kind]} · {item.sinner || "편성 기록"}
                  </span>
                  <strong>{item.name}</strong>
                  {item.kind === "deck" && item.formationCode && (
                    <span className="linked-formation">
                      편성번호 <code>{item.formationCode}</code>
                    </span>
                  )}
                </span>
                <ArrowRight size={17} />
              </button>
            )
          );
        })}
      </div>
    ) : (
      <p className="detail-empty">{empty}</p>
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.formationCode);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };
  return (
    <Modal
      title={entry.name}
      eyebrow={`${kindLabel[entry.kind]} / COLLECTION RECORD`}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="subtle-text">
            수정일{" "}
            {new Intl.DateTimeFormat("ko-KR").format(new Date(entry.updatedAt))}
          </span>
          <button className="secondary-button" onClick={onEdit}>
            <Pencil size={15} />
            {catalog && !hasNotes(entry) ? "평가 작성" : "기록 수정"}
          </button>
        </>
      }
    >
      <div className="detail-heading">
        <EntryArt entry={entry} entries={entries} large />
        <div className="detail-heading-copy">
          <p className="detail-meta">
            {entry.sinner || "편성 기록"}
            {entry.affinity && ` · ${entry.affinity}`}
          </p>
          <p>{entry.subtitle || "나만의 평가를 남겨보세요."}</p>
          {catalog && (
            <div className="catalog-detail-meta">
              <span className="badge">{catalog.rarity}</span>
              <span>출시 {catalog.releaseDate}</span>
              <a
                className="catalog-source"
                href={catalog.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                이름·이미지 출처 <ArrowRight size={12} />
              </a>
            </div>
          )}
          <div className="entry-tags">
            {entry.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="detail-tier-strip">
        {CONTENTS.map((item) => (
          <div
            className="detail-tier-cell"
            key={item.id}
            data-active={item.id === content}
          >
            <span>{item.shortLabel}</span>
            <strong>
              {entry.tiers[item.id] === "unrated" ? "—" : entry.tiers[item.id]}
            </strong>
          </div>
        ))}
      </div>
      <div className="detail-toolbar">
        <label className="field-label" htmlFor="detail-tier">
          {CONTENTS.find((item) => item.id === content)?.label} 티어
        </label>
        <select
          id="detail-tier"
          className="select"
          value={entry.tiers[content]}
          onChange={(event) => onTier(entry.id, event.target.value as Tier)}
        >
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tierLabel(tier)}
            </option>
          ))}
        </select>
      </div>
      {entry.description && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <FileText size={17} />
            평가 노트
          </h3>
          <p className="prose">{entry.description}</p>
        </section>
      )}
      <div className="two-column">
        <section className="detail-section">
          <h3 className="detail-section-title">장점</h3>
          <p className="prose">{entry.strengths || "장점을 기록해 주세요."}</p>
        </section>
        <section className="detail-section">
          <h3 className="detail-section-title">단점</h3>
          <p className="prose">{entry.weaknesses || "단점을 기록해 주세요."}</p>
        </section>
      </div>
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Swords size={17} />
          운용 방법
        </h3>
        <p className="prose">
          {entry.operation ||
            "스킬 순서, 자원 관리 등 나만의 운용 방법을 남겨보세요."}
        </p>
      </section>
      {entry.kind !== "ego" && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <Sparkles size={17} />
            추천 E.G.O
          </h3>
          {linked(
            entry.recommendedEgoIds,
            "연결된 E.G.O가 없습니다. 기록 수정에서 선택할 수 있습니다.",
          )}
        </section>
      )}
      {entry.kind === "deck" ? (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <BookMarked size={17} />
            편성 인격
          </h3>
          {entry.memberIds.length ? (
            <ol className="detail-formation-list" aria-label="덱 편성 순서">
              {entry.memberIds.map((id, index) => {
                const member = entries.find((item) => item.id === id);
                return member && (
                  <li className="detail-formation-member" key={id}>
                    <button className="linked-card" onClick={() => onOpen(id)}>
                      <span className="formation-number">{index + 1}</span>
                      <EntryArt entry={member} />
                      <span className="formation-name">
                        <strong>{displayName(member)}</strong>
                        {index === 0 && <small className="formation-cover-marker">덱 표지</small>}
                        {index >= 7 && <small>기존 추가 편성</small>}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : <p className="detail-empty">편성 인격을 연결해 주세요.</p>}
          {entry.contentIds.length > 0 && (
            <div className="deck-content-chips" aria-label="덱 사용 콘텐츠">
              {CONTENTS.filter((item) => entry.contentIds.includes(item.id)).map((item) => (
                <span className="deck-content-chip" key={item.id}>{item.label}</span>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <Layers3 size={17} />
            사용 덱
          </h3>
          {linked(
            entry.deckIds,
            "연결된 덱이 없습니다. 먼저 덱을 등록한 뒤 연결해 주세요.",
          )}
        </section>
      )}
      <section className="detail-section">
        <h3 className="detail-section-title">편성번호</h3>
        {entry.formationCode ? (
          <div className="formation-code">
            <code>{entry.formationCode}</code>
            <button
              className="icon-button"
              onClick={copy}
              aria-label="편성번호 복사"
            >
              {copied ? <Check size={16} /> : <FileText size={16} />}
            </button>
          </div>
        ) : (
          <p className="detail-empty">등록한 편성번호가 없습니다.</p>
        )}
      </section>
      {copyError && (
        <p className="field-help" role="status">
          자동 복사를 사용할 수 없습니다. 편성번호를 선택해 직접 복사해 주세요.
        </p>
      )}
      <div className="detail-toolbar">
        {confirmDelete ? (
          <div className="confirm-box">
            <span>
              {catalog
                ? "이 항목의 개인 평가와 티어를 초기화할까요? 도감과 덱 연결은 유지됩니다."
                : "이 기록을 삭제할까요? 연결된 기록에서도 해제됩니다."}
            </span>
            <button className="danger-button" onClick={onDelete}>
              {catalog ? "초기화 확인" : "삭제 확인"}
            </button>
            <button
              className="secondary-button"
              onClick={() => setConfirmDelete(false)}
            >
              취소
            </button>
          </div>
        ) : (
          <button
            className="danger-button"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
            {catalog ? "평가 초기화" : "기록 삭제"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function Editor({
  entry,
  entries,
  isNew,
  onClose,
  onSave,
}: {
  entry: LibraryEntry;
  entries: LibraryEntry[];
  isNew: boolean;
  onClose: () => void;
  onSave: (entry: LibraryEntry) => void;
}) {
  const catalog = getCatalogRecord(entry.id);
  const [relationQueries, setRelationQueries] = useState<
    Record<string, string>
  >({});
  const [draft, setDraft] = useState<LibraryEntry>(() =>
    structuredClone(entry),
  );
  const [confirmClose, setConfirmClose] = useState(false);
  const set = <K extends keyof LibraryEntry>(key: K, value: LibraryEntry[K]) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const close = () => {
    if (JSON.stringify(draft) !== JSON.stringify(entry))
      setConfirmClose(true);
    else onClose();
  };
  const relationships = (
    title: string,
    kind: Kind,
    field: "recommendedEgoIds" | "deckIds" | "memberIds",
  ) => (
    <div className="form-field field-wide">
      <span className="field-label">{title}</span>
      <label className="search-field relationship-search">
        <Search size={16} />
        <input
          aria-label={`${title} 검색`}
          placeholder="이름 또는 수감자로 찾기"
          value={relationQueries[field] || ""}
          onChange={(event) =>
            setRelationQueries((old) => ({
              ...old,
              [field]: event.target.value,
            }))
          }
        />
      </label>
      <span className="field-help">
        {draft[field].length}개 선택됨 · 검색해도 선택한 연결은 유지됩니다.
      </span>
      {kind === "deck" && <span className="field-help">이미 7명이 편성된 덱에는 새 인격을 추가할 수 없습니다.</span>}
      <div className="checkbox-grid">
        {entries
          .filter(
            (item) =>
              item.kind === kind &&
              item.id !== entry.id &&
              (!relationQueries[field] ||
                `${item.name} ${item.sinner}`
                  .toLocaleLowerCase()
                  .includes(relationQueries[field].trim().toLocaleLowerCase())),
          )
          .map((item) => (
            <label className="checkbox-option" key={item.id}>
              <input
                type="checkbox"
                aria-label={displayName(item)}
                checked={draft[field].includes(item.id)}
                disabled={kind === "deck" && !draft[field].includes(item.id) &&
                  withMembership(item, entries).memberIds.length >= 7 &&
                  !withMembership(item, entries).memberIds.includes(entry.id)}
                onChange={(event) =>
                  set(
                    field,
                    event.target.checked
                      ? [...draft[field], item.id]
                      : draft[field].filter((id) => id !== item.id),
                  )
                }
              />
              <span>{displayName(item)}</span>
            </label>
          ))}
      </div>
      {!entries.some((item) => item.kind === kind && item.id !== entry.id) && (
        <p className="field-help">
          먼저 {kindLabel[kind]} 기록을 추가해 주세요.
        </p>
      )}
    </div>
  );
  return (
    <Modal
      title={`${isNew ? "새" : "수정할"} ${kindLabel[entry.kind]} 기록`}
      eyebrow="WRITE YOUR OWN CHAPTER"
      onClose={close}
      wide
      footer={
        confirmClose ? (
          <div className="confirm-box editor-close-confirm" role="alert">
            <span>
              작성 중인 내용을 닫을까요? 저장하지 않은 변경은 사라집니다.
            </span>
            <div>
              <button
                className="secondary-button"
                autoFocus
                onClick={() => setConfirmClose(false)}
              >
                계속 작성
              </button>
              <button className="danger-button" onClick={onClose}>
                저장하지 않고 닫기
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="subtle-text">* 이름은 필수입니다.</span>
            <button className="secondary-button" onClick={close}>
              취소
            </button>
            <button type="submit" form="record-form" className="primary-button">
              <Check size={16} />
              기록 저장
            </button>
          </>
        )
      }
    >
      <form
        id="record-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          onSave({
            ...draft,
            name: draft.name.trim(),
            tags: [...new Set(draft.tags)],
            updatedAt: new Date().toISOString(),
          });
        }}
      >
        <div className="form-grid">
          <label className="form-field field-wide">
            <span className="field-label" id="record-name-label">
              이름 <span aria-hidden="true">*</span>
            </span>
            <input
              className="input"
              required
              readOnly={Boolean(catalog)}
              aria-labelledby="record-name-label"
              aria-describedby={catalog ? "catalog-name-help" : undefined}
              maxLength={200}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder={`${kindLabel[entry.kind]}의 이름을 입력하세요`}
            />
            {catalog && (
              <span className="field-help" id="catalog-name-help">
                공식 한국어 이름은 유지됩니다. 아래에 개인 평가와 소개를
                작성하세요.
              </span>
            )}
          </label>
          {entry.kind !== "deck" && (
            <label className="form-field">
              <span className="field-label">수감자</span>
              <select
                className="select"
                disabled={Boolean(catalog)}
                value={draft.sinner}
                onChange={(event) => set("sinner", event.target.value)}
              >
                <option value="">선택 안 함</option>
                {SINNERS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form-field">
            <span className="field-label">주요 죄악</span>
            <select
              className="select"
              value={draft.affinity}
              onChange={(event) => set("affinity", event.target.value)}
            >
              <option value="">선택 안 함</option>
              {AFFINITIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field field-wide">
            <span className="field-label">한 줄 소개</span>
            <input
              className="input"
              maxLength={300}
              value={draft.subtitle}
              onChange={(event) => set("subtitle", event.target.value)}
              placeholder="이 기록을 한 문장으로 표현한다면?"
            />
          </label>
          <div className="form-field field-wide">
            {entry.kind === "deck" && (
              <DeckFormationEditor memberIds={draft.memberIds} entries={entries} onChange={(ids) => set("memberIds", ids)} />
            )}
            <TagPicker value={draft.tags} onChange={(tags) => set("tags", tags)} />
          </div>
          {entry.kind === "deck" && (
            <fieldset className="form-field field-wide deck-content-picker">
              <legend className="field-label">사용 콘텐츠</legend>
              <p className="field-help">여러 콘텐츠를 선택할 수 있습니다. 왼쪽 콘텐츠 메뉴에서 이 덱을 바로 찾을 수 있어요.</p>
              <div className="deck-content-options">
                {CONTENTS.map((item) => (
                  <label className="deck-content-option" key={item.id}>
                    <input type="checkbox"
                      checked={draft.contentIds.includes(item.id)}
                      onChange={(event) => set("contentIds", event.target.checked
                        ? [...draft.contentIds, item.id]
                        : draft.contentIds.filter((id) => id !== item.id))}
                    />
                    <span>{item.label} 덱으로 분류</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="form-field field-wide">
            <h3 className="detail-section-title">콘텐츠별 티어</h3>
            <div className="form-grid">
              {CONTENTS.map((item) => (
                <label className="form-field" key={item.id}>
                  <span className="field-label">{item.label} 티어</span>
                  <select
                    className="select"
                    value={draft.tiers[item.id]}
                    onChange={(event) =>
                      set("tiers", {
                        ...draft.tiers,
                        [item.id]: event.target.value as Tier,
                      })
                    }
                  >
                    {TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tierLabel(tier)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <label className="form-field field-wide">
            <span className="field-label">기록 요약</span>
            <textarea
              className="textarea"
              rows={3}
              maxLength={10000}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="평가 기준, 플레이 경험, 참고할 점을 자유롭게 기록하세요."
            />
          </label>
          <label className="form-field">
            <span className="field-label">장점</span>
            <textarea
              className="textarea"
              rows={4}
              maxLength={10000}
              value={draft.strengths}
              onChange={(event) => set("strengths", event.target.value)}
              placeholder="어떤 상황에서 강한가요?"
            />
          </label>
          <label className="form-field">
            <span className="field-label">단점</span>
            <textarea
              className="textarea"
              rows={4}
              maxLength={10000}
              value={draft.weaknesses}
              onChange={(event) => set("weaknesses", event.target.value)}
              placeholder="아쉬운 점과 주의할 상황은 무엇인가요?"
            />
          </label>
          <label className="form-field field-wide">
            <span className="field-label">운용 방법</span>
            <textarea
              className="textarea"
              rows={5}
              maxLength={10000}
              value={draft.operation}
              onChange={(event) => set("operation", event.target.value)}
              placeholder="스킬 순서, 자원 관리, 다른 인격과의 시너지를 기록하세요."
            />
          </label>
          {entry.kind !== "ego" &&
            relationships("추천 E.G.O 연결", "ego", "recommendedEgoIds")}
          {entry.kind !== "deck" && relationships("사용 덱 연결", "deck", "deckIds")}
          <label className="form-field field-wide">
            <span className="field-label">편성번호</span>
            <textarea
              className="textarea"
              rows={2}
              maxLength={2000}
              value={draft.formationCode}
              onChange={(event) => set("formationCode", event.target.value)}
              placeholder="복사해 둔 편성번호나 개인 편성 메모를 입력하세요."
            />
            <span className="field-help">입력한 번호를 그대로 보관합니다.</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}

function Backup({
  data,
  onClose,
  onImport,
  storageError,
}: {
  data: LibraryData;
  onClose: () => void;
  onImport: (data: LibraryData) => void;
  storageError: boolean;
}) {
  const [pending, setPending] = useState<LibraryData | null>(null);
  const [error, setError] = useState("");
  const download = (raw = false) => {
    let text = exportLibrary(data);
    if (raw) {
      try {
        text = localStorage.getItem(STORAGE_KEY) || text;
      } catch {
        setError(
          "브라우저 저장소에 접근할 수 없습니다. 현재 기록 백업을 이용해 주세요.",
        );
        return;
      }
    }
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `library-of-limbus${raw ? "-original" : ""}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async (file?: File) => {
    setError("");
    setPending(null);
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("백업 파일은 10MB 이하로 선택해 주세요.");
      setPending(parseLibrary(await file.text()));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "올바른 백업 파일이 아닙니다.",
      );
    }
  };
  return (
    <Modal
      title="기록을 안전하게 보관하세요"
      eyebrow="BACKUP & RESTORE"
      onClose={onClose}
    >
      <p className="prose">
        기록은 현재 브라우저에 저장됩니다. 다른 브라우저나 기기로 옮기려면 백업
        파일을 내려받아 가져오세요. 브라우저 데이터를 삭제하기 전에도 백업해
        주세요.
      </p>
      <div className="backup-options">
        <section className="backup-card">
          <ArrowDownToLine size={24} />
          <h3>나의 도서관 백업</h3>
          <p>
            {data.entries.length}개의 기록과 모든 콘텐츠별 티어를 JSON 파일로
            보관합니다.
          </p>
          <button className="secondary-button" onClick={() => download()}>
            백업 다운로드
          </button>
          {storageError && (
            <button className="secondary-button" onClick={() => download(true)}>
              저장소 원본 다운로드
            </button>
          )}
        </section>
        <section className="backup-card">
          <ArrowUpFromLine size={24} />
          <h3>백업 가져오기</h3>
          <p>
            파일 내용을 검사한 뒤 확인을 누르면 현재 기록을 교체합니다. 먼저
            현재 기록을 백업해 주세요.
          </p>
          <label className="field-label" htmlFor="backup-file">
            백업 파일 선택
          </label>
          <input
            id="backup-file"
            className="file-input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </section>
      </div>
      {error && (
        <p className="warning-banner" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="confirm-box">
          <span>
            {pending.entries.length}개의 기록을 가져옵니다. 현재 기록을
            교체할까요?
          </span>
          <button className="primary-button" onClick={() => onImport(pending)}>
            가져오기 확인
          </button>
          <button className="secondary-button" onClick={() => setPending(null)}>
            취소
          </button>
        </div>
      )}
      {data.entries.some((entry) => entry.id.startsWith("demo-")) && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            이전 버전 기록을 보존했습니다
          </h3>
          <p className="prose">
            이전 버전에서 수정하거나 다른 기록과 연결한 항목은 그대로 남겨
            두었습니다. 필요 없는 기록은 해당 카드의 상세 화면에서 개별적으로
            삭제할 수 있습니다.
          </p>
        </section>
      )}
    </Modal>
  );
}

export default function App() {
  const [initial] = useState(initialLibrary);
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [recoveryRequired, setRecoveryRequired] = useState(
    Boolean(initial.error),
  );
  const [kind, setKind] = useState<Kind>("identity");
  const [content, setContent] = useState<Content>("story");
  const [view, setView] = useState<"tiers" | "all">("all");
  const [deckCategory, setDeckCategory] = useState<DeckCategory | null>(null);
  const [railwayRoute, setRailwayRoute] = useState<Content | "all">("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [sinner, setSinner] = useState("전체");
  const [recordFilter, setRecordFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(24);
  const [tierLimits, setTierLimits] = useState<Partial<Record<Tier, number>>>(
    {},
  );
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    entry: LibraryEntry;
    isNew: boolean;
  } | null>(null);
  const [backup, setBackup] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<"initial" | "saved" | "error">(
    initial.error ? "error" : "initial",
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setVisibleCount(24);
    setTierLimits({});
  }, [kind, sinner, query, recordFilter, deckCategory, railwayRoute, filterTags]);
  const persist = (
    next: LibraryData,
    message: string,
    allowRecovery = false,
  ) => {
    if (recoveryRequired && !allowRecovery) {
      setToast("원본 기록을 먼저 백업한 뒤 정상 백업을 가져와 주세요.");
      return false;
    }
    try {
      saveLibrary(next);
      setData(next);
      setStorageError("");
      setRecoveryRequired(false);
      setSaveState("saved");
      setToast(message);
      return true;
    } catch (caught) {
      setSaveState("error");
      setStorageError(
        caught instanceof Error
          ? `브라우저 저장 실패: ${caught.message}`
          : "브라우저 저장에 실패했습니다.",
      );
      setToast("저장하지 못했습니다. 기존 기록은 그대로 유지됩니다.");
      return false;
    }
  };
  const putEntry = (
    entry: LibraryEntry,
    message: string,
    syncMembership: boolean,
  ) => {
    const existing = data.entries.some((item) => item.id === entry.id);
    // An edited example becomes a personal record and survives "clear examples".
    const saved = entry.id.startsWith("demo-")
      ? { ...entry, id: createEntry(entry.kind).id }
      : entry;
    if (syncMembership && saved.kind === "identity") {
      const fullDeck = data.entries.find((item) => item.kind === "deck" && saved.deckIds.includes(item.id) &&
        !withMembership(item, data.entries).memberIds.includes(entry.id) &&
        withMembership(item, data.entries).memberIds.length >= 7);
      if (fullDeck) {
        setToast(`${fullDeck.name}에는 이미 7명 이상이 편성되어 있습니다. 덱에서 편성을 조정한 뒤 추가해 주세요.`);
        return false;
      }
    }
    const remap = (ids: string[]) =>
      ids.map((id) => (id === entry.id ? saved.id : id));
    let entries = (
      existing
        ? data.entries.map((item) => (item.id === entry.id ? saved : item))
        : [...data.entries, saved]
    ).map((item) => ({
      ...item,
      recommendedEgoIds: remap(item.recommendedEgoIds),
      deckIds: remap(item.deckIds),
      memberIds: remap(item.memberIds),
    }));
    if (syncMembership && saved.kind === "deck")
      entries = entries.map((item) =>
        item.kind !== "identity"
          ? item
          : {
              ...item,
              deckIds: saved.memberIds.includes(item.id)
                ? [...new Set([...item.deckIds, saved.id])]
                : item.deckIds.filter((id) => id !== saved.id),
            },
      );
    if (syncMembership && saved.kind === "identity")
      entries = entries.map((item) =>
        item.kind !== "deck"
          ? item
          : {
              ...item,
              memberIds: saved.deckIds.includes(item.id)
                ? [...new Set([...item.memberIds, saved.id])]
                : item.memberIds.filter((id) => id !== saved.id),
            },
      );
    if (persist({ ...data, entries }, message)) {
      if (selected === entry.id) setSelected(saved.id);
      return true;
    }
    return false;
  };
  const changeTier = (id: string, tier: Tier) => {
    const entry = data.entries.find((item) => item.id === id);
    if (entry)
      putEntry(
        {
          ...entry,
          tiers: { ...entry.tiers, [content]: tier },
          updatedAt: new Date().toISOString(),
        },
        "티어를 저장했습니다.",
        false,
      );
  };
  const saveEntry = (entry: LibraryEntry) => {
    if (putEntry(entry, "기록을 저장했습니다.", true)) {
      setEditing(null);
      setSelected(null);
      setKind(entry.kind);
      setQuery(entry.name);
      setSinner(entry.kind === "deck" ? "전체" : entry.sinner || "전체");
      setFilterTags([]);
      if (entry.kind !== "deck" ||
          (deckCategory && !matchesDeckCategory(entry, deckCategory)) ||
          (deckCategory === "railway" && railwayRoute !== "all" && !entry.contentIds.includes(railwayRoute))) {
        setDeckCategory(null);
        setRailwayRoute("all");
      }
    }
  };
  const removeEntries = (ids: string[], message: string) => {
    const deleted = ids.filter((id) => !getCatalogRecord(id));
    const next = {
      ...data,
      entries: data.entries
        .filter((entry) => !deleted.includes(entry.id))
        .map((entry) => ({
          ...(ids.includes(entry.id) && getCatalogRecord(entry.id)
            ? resetCatalogEntry(entry)
            : entry),
          recommendedEgoIds: entry.recommendedEgoIds.filter(
            (id) => !deleted.includes(id),
          ),
          deckIds: entry.deckIds.filter((id) => !deleted.includes(id)),
          memberIds: entry.memberIds.filter((id) => !deleted.includes(id)),
        })),
    };
    if (persist(next, message)) {
      setSelected(null);
      setBackup(false);
    }
  };
  const isRated = (entry: LibraryEntry) => deckCategory === "railway" && railwayRoute === "all"
    ? ["railway1", "railway2", "railway6"].some((route) => entry.tiers[route as Content] !== "unrated")
    : entry.tiers[content] !== "unrated";
  const filtered = data.entries.filter(
    (entry) =>
      entry.kind === kind &&
      (!deckCategory || matchesDeckCategory(entry, deckCategory)) &&
      (deckCategory !== "railway" || railwayRoute === "all" || entry.contentIds.includes(railwayRoute)) &&
      filterTags.every((tag) => entry.tags.includes(tag) || entry.affinity === tag) &&
      (sinner === "전체" ||
        (entry.kind === "deck"
          ? withMembership(entry, data.entries).memberIds.some(
              (id) =>
                data.entries.find((member) => member.id === id)?.sinner ===
                sinner,
            )
          : entry.sinner === sinner)) &&
      (recordFilter === "all" ||
        (recordFilter === "noted"
          ? hasNotes(entry)
          : recordFilter === "rated"
            ? isRated(entry)
            : !isRated(entry))) &&
      (!query.trim() ||
        `${entry.name} ${entry.sinner} ${entry.subtitle} ${entry.tags.join(" ")}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())),
  );
  const rawCurrent = data.entries.find((entry) => entry.id === selected);
  const current = rawCurrent && withMembership(rawCurrent, data.entries);
  const contentLabel = CONTENTS.find((item) => item.id === content)!.label;
  const category = DECK_CATEGORIES.find((item) => item.id === deckCategory);
  const allRailways = deckCategory === "railway" && railwayRoute === "all";
  const visibleContents = category
    ? CONTENTS.filter((item) => category.contents.includes(item.id))
    : CONTENTS;
  const hasDemo = data.entries.some((entry) => entry.id.startsWith("demo-"));
  const rated = filtered.filter(isRated).length;
  const selectKind = (next: Kind) => {
    setKind(next);
    setQuery("");
    setRecordFilter("all");
    setDeckCategory(null);
    setRailwayRoute("all");
    setFilterTags([]);
  };
  const selectCategory = (next: DeckCategory) => {
    const selectedCategory = DECK_CATEGORIES.find((item) => item.id === next)!;
    setDeckCategory(next);
    setKind("deck");
    setView("all");
    setSinner("전체");
    setQuery("");
    setFilterTags([]);
    setRecordFilter("all");
    setRailwayRoute("all");
    setContent(selectedCategory.contents[0]);
  };
  const newEntry = () => {
    const entry = createEntry(kind);
    if (sinner !== "전체" && kind !== "deck") entry.sinner = sinner;
    if (kind === "deck" && category) {
      entry.contentIds = deckCategory === "railway" && railwayRoute !== "all"
        ? [railwayRoute]
        : [...category.contents];
    }
    return entry;
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => {
            setView("all");
            selectKind("identity");
            setSinner("전체");
          }}
          aria-label="Library of Limbus 홈"
        >
          <span className="brand-mark">
            <BookOpen size={25} />
          </span>
          <span>
            <span className="brand-name">
              Library <br />
              of Limbus<span>.</span>
            </span>
            <span className="brand-subtitle">나만의 림버스 도서관</span>
          </span>
        </button>
        <div className="sidebar-section-label">MY LIBRARY</div>
        <nav aria-label="도서관 메뉴">
          <button
            className={`nav-item ${view === "tiers" && !deckCategory ? "active" : ""}`}
            onClick={() => { setView("tiers"); setDeckCategory(null); setRailwayRoute("all"); }}
          >
            <Library size={18} className="nav-icon" />
            <span>티어리스트</span>
            <ChevronRight size={14} />
          </button>
          <button
            className={`nav-item ${view === "all" && !deckCategory ? "active" : ""}`}
            onClick={() => { setView("all"); setDeckCategory(null); setRailwayRoute("all"); }}
          >
            <FileText size={18} className="nav-icon" />
            <span>전체 기록</span>
            <span className="nav-count">{data.entries.length}</span>
          </button>
        </nav>
        <div className="sidebar-section-label">COLLECTIONS</div>
        <nav aria-label="기록 분류">
          {KINDS.map((item) => {
            const Icon = kindIcon[item.id];
            return (
              <button
                className={`nav-item ${kind === item.id ? "collection-active" : ""}`}
                key={item.id}
                onClick={() => selectKind(item.id)}
              >
                <Icon size={17} className="nav-icon" />
                <span>{item.label}</span>
                <span className="nav-count">
                  {
                    data.entries.filter((entry) => entry.kind === item.id)
                      .length
                  }
                </span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-section-label">CONTENTS</div>
        <nav className="deck-content-nav" aria-label="콘텐츠별 덱">
          {DECK_CATEGORIES.map((item) => (
            <button
              key={item.id}
              className={`nav-item deck-content-link ${deckCategory === item.id ? "active" : ""}`}
              aria-label={item.label}
              aria-current={deckCategory === item.id ? "page" : undefined}
              onClick={() => selectCategory(item.id)}
            >
              <Swords size={17} className="nav-icon" />
              <span>{item.label}</span>
              <span className="nav-count">{data.entries.filter((entry) => matchesDeckCategory(entry, item.id)).length}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Feather size={23} />
          <p>
            모든 여정에는
            <br />
            기록할 이야기가 있다.
          </p>
          <span>YOUR OWN LIVING ARCHIVE</span>
        </div>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            <span>도서관 이용 안내</span>
          </button>
          <div className="sync-status">
            <span className="sync-dot" data-error={saveState === "error"} />
            <span>
              {saveState === "error"
                ? "저장 상태 확인 필요"
                : saveState === "saved"
                  ? "이 브라우저에 저장됨"
                  : "개인 브라우저 저장소"}
            </span>
            <ShieldCheck size={15} />
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-wordmark">Library of Limbus</span>
            <span>나의 도서관</span>
            <ChevronRight size={13} />
            <strong>{category ? `${category.label} 덱` : view === "tiers" ? "티어리스트" : "전체 기록"}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setBackup(true)}
              aria-label="백업과 복원"
              title="백업과 복원"
            >
              <ArrowDownToLine size={19} />
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setSelected(null);
                const entry = newEntry();
                setEditing({ entry, isNew: true });
              }}
            >
              <Plus size={17} />새 기록
            </button>
          </div>
        </header>
        {storageError && (
          <div className="warning-banner" role="alert">
            {storageError}
            <button
              className="secondary-button"
              onClick={() => setBackup(true)}
            >
              백업과 복원 열기
            </button>
          </div>
        )}
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              THE PRIVATE LIBRARY · XII SINNERS
            </p>
            <h1 className="hero-title">
              Library of
              <br />
              <em>Limbus</em>
            </h1>
            <p className="hero-subtitle">
              열두 수감자의 가능성을 기록하는, 당신만의 도서관.
              <br />
              인격과 E.G.O를 펼치고, 당신의 평가로 서가를 채워보세요.
            </p>
          </div>
          <div className="hero-emblem" aria-hidden="true">
            <span>LIBRARY OF LIMBUS</span>
            <BookOpen size={65} strokeWidth={1} />
            <span className="hero-emblem-caption">
              PRIVATE COLLECTION
              <br />
              EST. 2026
            </span>
          </div>
        </section>
        <div className="catalog-banner">
          <div>
            <span className="catalog-status">공식 한국어 도감</span>
            <span>
              인격 {CATALOG_METADATA.counts.identity} · E.G.O{" "}
              {CATALOG_METADATA.counts.ego} · {CATALOG_METADATA.asOf} 자료 기준
            </span>
          </div>
          <button
            className="catalog-source"
            onClick={() => setSourcesOpen(true)}
          >
            자료 출처와 수록 범위 <ArrowRight size={14} />
          </button>
        </div>
        <section className="stat-grid" aria-label="도서관 현황">
          {KINDS.map((item) => {
            const Icon = kindIcon[item.id];
            return (
              <button
                className="stat-card"
                key={item.id}
                onClick={() => selectKind(item.id)}
              >
                <span className="stat-icon">
                  <Icon size={20} strokeWidth={1.5} />
                </span>
                <div>
                  <span className="stat-label">{item.label} 기록</span>
                  <strong className="stat-value">
                    {String(
                      data.entries.filter((entry) => entry.kind === item.id)
                        .length,
                    ).padStart(2, "0")}
                    <span>권</span>
                  </strong>
                </div>
                <ArrowRight size={16} />
              </button>
            );
          })}
          <div className="stat-card">
            <span className="stat-icon">
              <Library size={20} strokeWidth={1.5} />
            </span>
            <div>
              <span className="stat-label">콘텐츠별 분류</span>
              <strong className="stat-value">
                07<span>개</span>
              </strong>
            </div>
            <span className="stat-hint">나만의 기준</span>
          </div>
        </section>
        <section className="archive-section">
          <header className="section-heading">
            <div>
              <p className="eyebrow">THE COLLECTION</p>
              <h2 className="section-title">
                {category ? `${category.label} 덱` : view === "tiers" ? "티어리스트" : "나의 모든 기록"}
                <span className="section-caption">
                  {category
                    ? "콘텐츠에 맞춰 보관한 덱과 편성 순서를 바로 살펴보세요."
                    : view === "tiers"
                    ? "같은 인격, 다른 무대. 콘텐츠마다 달라지는 나의 평가."
                    : "차곡차곡 모아 둔 평가와 운용 노트를 살펴보세요."}
                </span>
              </h2>
            </div>
            <span className="record-state">
              {data.entries.filter(hasNotes).length}개의 개인 평가
            </span>
          </header>
          {category && (
            <div className="deck-category-heading">
              <span className="deck-category-help">기록 수정의 ‘사용 콘텐츠’에서 이 덱을 여러 분류에 등록할 수 있습니다.</span>
              <button className="deck-category-reset" onClick={() => selectKind("deck")}>모든 덱 보기</button>
            </div>
          )}
          <div
            className="tabs kind-tabs"
            role="tablist"
            aria-label="기록 종류"
            onKeyDown={navigateTabs}
          >
            {KINDS.map((item) => (
              <button
                key={item.id}
                className={`tab ${kind === item.id ? "active" : ""}`}
                role="tab"
                aria-label={item.label}
                aria-selected={kind === item.id}
                tabIndex={kind === item.id ? 0 : -1}
                onClick={() => selectKind(item.id)}
              >
                {item.label}
                <span className="tab-count">
                  {
                    data.entries.filter((entry) => entry.kind === item.id)
                      .length
                  }
                </span>
              </button>
            ))}
          </div>
          <div
            className="sinner-tabs"
            role="tablist"
            aria-label="수감자"
            onKeyDown={navigateTabs}
          >
            {["전체", ...SINNERS].map((name, index) => (
              <button
                key={name}
                className={`sinner-tab ${sinner === name ? "active" : ""}`}
                role="tab"
                aria-label={name === "전체" ? "전체 수감자" : name}
                aria-selected={sinner === name}
                tabIndex={sinner === name ? 0 : -1}
                onClick={() => setSinner(name)}
              >
                {name !== "전체" && (
                  <span className="sinner-number">
                    {String(index).padStart(2, "0")}
                  </span>
                )}
                <span>{name === "전체" ? "모든 수감자" : name}</span>
              </button>
            ))}
          </div>
          <div
            className="content-tabs"
            role="tablist"
            aria-label="콘텐츠"
            onKeyDown={navigateTabs}
          >
            {deckCategory === "railway" && (
              <button className={`content-tab ${allRailways ? "active" : ""}`}
                role="tab" aria-selected={allRailways} tabIndex={allRailways ? 0 : -1}
                onClick={() => setRailwayRoute("all")}>전체 호선</button>
            )}
            {visibleContents.map((item) => (
              <button
                key={item.id}
                className={`content-tab ${content === item.id && !allRailways ? "active" : ""}`}
                role="tab"
                aria-selected={content === item.id && !allRailways}
                tabIndex={content === item.id && !allRailways ? 0 : -1}
                onClick={() => { setContent(item.id); if (deckCategory === "railway") setRailwayRoute(item.id); }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="filter-bar">
            <label className="search-field">
              <Search size={17} />
              <span className="sr-only">기록 검색</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름, 수감자, 태그로 검색"
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="검색 지우기"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="filter-meta">
              <select
                className="record-filter"
                aria-label="기록 상태"
                value={recordFilter}
                onChange={(event) => setRecordFilter(event.target.value)}
              >
                <option value="all">모든 기록</option>
                <option value="noted">평가 작성됨</option>
                <option value="rated">티어 평가됨</option>
                <option value="unrated">미평가</option>
              </select>
              <span>
                <strong>{filtered.length}</strong>개의 {kindLabel[kind]} 기록
              </span>
              <span className="view-label">
                {allRailways ? "1 · 2 · 6호선 전체 덱" : `${contentLabel} 기준 · ${rated}개 평가`}
              </span>
            </div>
          </div>
          <details className="tag-filter-panel">
            <summary>게임 태그로 찾기 {filterTags.length > 0 && `· ${filterTags.length}개 선택`}</summary>
            <p className="deck-category-help">선택한 태그를 모두 가진 기록을 보여줍니다.</p>
            <TagPicker value={filterTags} onChange={setFilterTags} />
            {filterTags.length > 0 && <button className="secondary-button" onClick={() => setFilterTags([])}>태그 필터 초기화</button>}
          </details>
          {view === "tiers" ? (
            <div
              className="tier-board"
              aria-label={`${contentLabel} ${kindLabel[kind]} 티어 목록`}
            >
              {TIERS.map((tier) => {
                const records = filtered.filter(
                  (entry) => entry.tiers[content] === tier,
                );
                return (
                  <section
                    className="tier-row"
                    data-tier={tier}
                    key={tier}
                    aria-label={
                      tier === "unrated" ? "미평가 티어" : tierLabel(tier)
                    }
                  >
                    <div className="tier-label" data-tier={tier}>
                      <strong className="tier-letter">
                        {tier === "unrated" ? "—" : tier}
                      </strong>
                      <span className="tier-name">
                        {tier === "unrated" ? "미평가" : "TIER"}
                        <span>{records.length}</span>
                      </span>
                    </div>
                    <div className="tier-items">
                      {records.slice(0, tierLimits[tier] || 12).map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          entries={data.entries}
                          content={content}
                          onOpen={setSelected}
                          onTier={changeTier}
                        />
                      ))}
                      {records.length > (tierLimits[tier] || 12) && (
                        <button
                          className="secondary-button show-more"
                          onClick={() =>
                            setTierLimits((old) => ({
                              ...old,
                              [tier]: (old[tier] || 12) + 24,
                            }))
                          }
                        >
                          {records.length - (tierLimits[tier] || 12)}개 더 보기{" "}
                          <ChevronRight size={15} />
                        </button>
                      )}
                      {!records.length && (
                        <div className="empty-tier">
                          <span>
                            {query
                              ? "검색 결과가 없습니다."
                              : tier === "unrated"
                                ? "모든 기록의 티어를 평가했습니다."
                                : "아직 이 티어에 기록이 없습니다."}
                          </span>
                          <span className="subtle-text">
                            {!query &&
                              "카드의 티어 선택으로 기록을 옮길 수 있어요."}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : filtered.length ? (
            <>
              <div className="archive-grid">
                {filtered.slice(0, visibleCount).map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    entries={data.entries}
                    content={content}
                    showTier={!allRailways}
                    onOpen={setSelected}
                    onTier={changeTier}
                  />
                ))}
              </div>
              {filtered.length > visibleCount && (
                <div className="load-more">
                  <span>
                    {filtered.length}개 중{" "}
                    {Math.min(visibleCount, filtered.length)}개 표시
                  </span>
                  <button
                    className="secondary-button"
                    onClick={() => setVisibleCount((old) => old + 24)}
                  >
                    다음 {Math.min(24, filtered.length - visibleCount)}개 보기{" "}
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <BookOpen size={35} />
              <h3>
                {query
                  ? "검색한 기록이 없습니다."
                  : "첫 번째 기록을 남겨보세요."}
              </h3>
              <p>
                {query
                  ? "다른 이름이나 태그로 검색해 보세요."
                  : "새 기록에서 나만의 평가와 운용 노트를 작성할 수 있어요."}
              </p>
              {!query && (
                <button
                  className="primary-button"
                  onClick={() =>
                    setEditing({ entry: newEntry(), isNew: true })
                  }
                >
                  <Plus size={16} />새 기록
                </button>
              )}
            </div>
          )}
          <p className="section-caption archive-hint">
            <Feather size={13} />
            {hasDemo
              ? "이전 버전의 예시 기록 중 수정하거나 연결한 기록은 보존했습니다."
              : "기본 도감은 모두 미평가로 시작합니다. 당신의 경험이 이 도서관의 기준입니다."}
          </p>
        </section>
        <footer className="library-footer">
          <span>
            LIBRARY OF LIMBUS<span> · </span>나의 여정을 위한 기록
          </span>
          <span>개인 팬 아카이브 · Project Moon 공식 사이트가 아닙니다.</span>
        </footer>
      </main>
      {current && !editing && (
        <Detail
          key={current.id}
          entry={current}
          entries={data.entries}
          content={content}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing({ entry: current, isNew: false })}
          onDelete={() =>
            removeEntries(
              [current.id],
              getCatalogRecord(current.id)
                ? "평가를 초기화했습니다."
                : "기록을 삭제했습니다.",
            )
          }
          onOpen={setSelected}
          onTier={changeTier}
        />
      )}
      {editing && (
        <Editor
          key={editing.entry.id}
          entry={editing.entry}
          entries={data.entries}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={saveEntry}
        />
      )}
      {backup && (
        <Backup
          data={data}
          onClose={() => setBackup(false)}
          storageError={Boolean(storageError)}
          onImport={(next) => {
            if (persist(mergeCatalog(next), "백업을 가져왔습니다.", true)) {
              setBackup(false);
              setSelected(null);
              setEditing(null);
            }
          }}
        />
      )}
      {help && (
        <Modal
          title="나만의 도서관을 만드는 방법"
          eyebrow="A SMALL GUIDE FOR THE LIBRARIAN"
          onClose={() => setHelp(false)}
        >
          <div className="detail-section">
            <h3 className="detail-section-title">01. 기록을 모으기</h3>
            <p className="prose">
              수감자와 인격·E.G.O 분류를 선택해 공식 도감을 둘러보세요. 카드를
              누르고 ‘평가 작성’에서 장점, 단점, 운용 방법을 남길 수 있습니다.
              ‘새 기록’에서는 나만의 덱이나 추가 기록을 만들 수 있습니다.
            </p>
          </div>
          <div className="detail-section">
            <h3 className="detail-section-title">02. 무대마다 평가하기</h3>
            <p className="prose">
              콘텐츠 탭을 바꾸면 해당 콘텐츠의 티어가 보입니다. 카드 오른쪽
              아래에서 티어를 바꾸거나, 기록 수정에서 모든 티어를 한 번에
              입력하세요. 티어는 S, A, B, C, D와 미평가로 구분합니다.
            </p>
          </div>
          <div className="detail-section">
            <h3 className="detail-section-title">03. 기록을 연결하기</h3>
            <p className="prose">
              인격의 평가 화면에서 추천 E.G.O를 검색해 연결하세요. 새 덱을
              만들고 편성 인격과 편성번호를 기록하면 해당 인격의 사용 덱에도
              자동으로 반영됩니다. 연결된 기록은 상세 화면에서 바로 열 수
              있습니다.
            </p>
          </div>
          <div className="detail-section">
            <h3 className="detail-section-title">04. 오래 보관하기</h3>
            <p className="prose">
              현재 버전은 이 브라우저에만 저장하며 계정이나 서버로 전송하지
              않습니다. 백업과 복원에서 JSON 파일로 보관해 주세요. 정적 사이트를
              배포하면 누구나 화면을 열 수 있으며 기록은 각자의 브라우저에 따로
              저장됩니다. 로그인과 기기 간 동기화는 다음 단계로 추가할 수
              있습니다.
            </p>
          </div>
          {!data.entries.length && (
            <button
              className="secondary-button"
              onClick={() => {
                if (
                  persist(createCatalogLibrary(), "기본 도감을 불러왔습니다.")
                )
                  setHelp(false);
              }}
            >
              기본 도감 불러오기
            </button>
          )}
        </Modal>
      )}
      {sourcesOpen && (
        <Modal
          title="도감의 출처와 수록 범위"
          eyebrow="CATALOG · PROVENANCE"
          onClose={() => setSourcesOpen(false)}
        >
          <p className="prose">
            {CATALOG_METADATA.asOf} 기준으로 출시 목록을 대조한 인격{" "}
            {CATALOG_METADATA.counts.identity}개, E.G.O{" "}
            {CATALOG_METADATA.counts.ego}개를 수록했습니다. 한국어 게임 데이터
            버전은 {CATALOG_METADATA.gameVersion}, 최신 수록 출시일은{" "}
            {CATALOG_METADATA.latestReleaseDate}입니다.
          </p>
          <section className="detail-section">
            <h3 className="detail-section-title">공식 게임 이름과 이미지</h3>
            <p className="prose">
              게임의 공식 한국어 문자열과 원화를 공개 커뮤니티 미러에서
              대조했습니다. 이미지 {CATALOG.length * 2}개는 원화와 썸네일로
              사이트에 함께 저장되어 있습니다. 독립 HTML 파일은 용량을 줄인 공식
              썸네일을 포함합니다. {CATALOG_METADATA.copyright}
            </p>
          </section>
          <section className="detail-section">
            <h3 className="detail-section-title">확인한 자료</h3>
            <div className="linked-list">
              {CATALOG_METADATA.sources.map((source) => (
                <a
                  className="linked-card"
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.label}
                  <ArrowRight size={15} />
                </a>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h3 className="detail-section-title">수감자별 수록 수</h3>
            <table className="catalog-counts">
              <thead>
                <tr>
                  <th>수감자</th>
                  <th>인격</th>
                  <th>E.G.O</th>
                </tr>
              </thead>
              <tbody>
                {CATALOG_METADATA.sinnerCounts.map((item) => (
                  <tr key={item.sinner}>
                    <td>{item.sinner}</td>
                    <td>{item.identity}</td>
                    <td>{item.ego}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="detail-section">
            <h3 className="detail-section-title">개인 평가를 위한 서가</h3>
            <p className="prose">
              미출시 인격, 적·테스트·스토리 전용 데이터는 제외했습니다. 과거
              시즌과 한정 출시 항목은 포함합니다. 티어와 평가 노트는 추정해 넣지
              않으며 직접 작성한 내용만 저장합니다. 기본 도감은 지워지지 않고
              개인 평가만 초기화할 수 있습니다.
            </p>
          </section>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Database size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
