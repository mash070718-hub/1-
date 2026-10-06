import { useMemo, useState } from "react";
import { ArrowRight, BookMarked, Compass, Gift, Layers3, PenLine, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import { isMirrorDeck, type LibraryEntry, type MirrorSkillChange } from "../lib/library";
import { TagPicker } from "./TagPicker";
import "./mirror-dungeon.css";

export interface MirrorDungeonPageProps {
  entries: LibraryEntry[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}

const hasSkillRecord = (change: MirrorSkillChange) =>
  change.skill1 !== null || change.skill2 !== null || change.skill3 !== null || Boolean(change.notes.trim());

const hasPlanRecord = (entry: LibraryEntry) => Boolean(
  entry.mirrorPlan?.startingGifts.trim()
  || entry.mirrorPlan?.startingGiftNotes.trim()
  || entry.mirrorPlan?.floors.some((floor) => floor.themePack.trim() || floor.notes.trim())
  || entry.mirrorPlan?.skillChanges.some(hasSkillRecord)
  || entry.description.trim() || entry.strengths.trim() || entry.weaknesses.trim()
  || entry.operation.trim() || entry.subtitle.trim(),
);

function MirrorCover({ entry, entries }: { entry: LibraryEntry; entries: LibraryEntry[] }) {
  const cover = entries.find((item) => item.id === entry.memberIds[0]);
  const image = cover ? getCatalogRecord(cover.id)?.thumbnail : undefined;
  const [failedImage, setFailedImage] = useState<string | undefined>();
  return (
    <span className="mirror-card-cover">
      {image && failedImage !== image ? (
        <img
          src={image}
          alt={`${entry.name} 덱 표지 · 1번 편성 ${cover?.sinner} ${cover?.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedImage(image)}
        />
      ) : (
        <span className="mirror-cover-placeholder" aria-hidden="true"><BookMarked size={34} /></span>
      )}
    </span>
  );
}

export default function MirrorDungeonPage({ entries, onNew, onOpen, onEdit }: MirrorDungeonPageProps) {
  const [query, setQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const mirrorEntries = useMemo(() => entries.filter(isMirrorDeck), [entries]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    return mirrorEntries.filter((entry) => {
      if (!filterTags.every((tag) => entry.tags.includes(tag) || entry.affinity === tag)) return false;
      if (recordFilter === "noted" && !hasPlanRecord(entry)) return false;
      if (recordFilter === "rated" && entry.tiers.mirror === "unrated") return false;
      if (recordFilter === "unrated" && entry.tiers.mirror !== "unrated") return false;
      if (!needle) return true;
      const plan = entry.mirrorPlan;
      const searchable = [
        entry.name, entry.subtitle, entry.description, entry.strengths, entry.weaknesses,
        entry.operation, entry.formationCode, entry.affinity, ...entry.tags,
        ...entry.memberIds.map((id) => {
          const member = entryById.get(id);
          return member ? `${member.name} ${member.sinner}` : "";
        }),
        plan?.startingGifts ?? "", plan?.startingGiftNotes ?? "",
        ...(plan?.floors.flatMap((floor) => [floor.themePack, floor.notes]) ?? []),
        ...(plan?.skillChanges.map((change) => {
          const member = entryById.get(change.identityId);
          return `${member?.name ?? ""} ${member?.sinner ?? ""} ${change.notes}`;
        }) ?? []),
      ].join(" ").toLocaleLowerCase("ko-KR");
      return searchable.includes(needle);
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [entries, mirrorEntries, query, recordFilter, filterTags]);
  const giftCount = mirrorEntries.filter((entry) =>
    entry.mirrorPlan?.startingGifts.trim() || entry.mirrorPlan?.startingGiftNotes.trim()).length;
  const recordedFloorCount = mirrorEntries.reduce((sum, entry) => sum + (
    entry.mirrorPlan?.floors.filter((floor) => floor.themePack.trim() || floor.notes.trim()).length ?? 0
  ), 0);

  return (
    <div className="mirror-dungeon-page">
      <section className="mirror-hero">
        <div className="mirror-hero-copy">
          <p className="eyebrow">MIRROR DUNGEON / 거울던전 공략</p>
          <h1>거울던전</h1>
          <p className="mirror-hero-lead">다음 층으로 향하기 전,<br /><em>선택의 순서</em>를 기록하다.</p>
          <p className="mirror-hero-caption">시작 E.G.O 기프트부터 15층 테마팩까지.<br />편성과 스킬 변경을 함께 정리하는 거울던전 공략 서가.</p>
        </div>
        <div className="mirror-hero-art" aria-hidden="true">
          <div className="mirror-hero-frame"><Compass size={64} strokeWidth={1} /><span>I — XV</span></div>
          <p>THE CHOICE OF A PATH</p>
        </div>
      </section>

      <div className="mirror-overview" aria-label="거울던전 기록 현황">
        <div><BookMarked size={21} /><span>공략 기록<strong>{mirrorEntries.length}<small>개</small></strong></span></div>
        <div><Layers3 size={21} /><span>층별 선택 기록<strong>{recordedFloorCount}<small>층</small></strong></span></div>
        <div><Gift size={21} /><span>시작 기프트 기록<strong>{giftCount}<small>개 덱</small></strong></span></div>
      </div>

      <section className="mirror-archive" aria-labelledby="mirror-archive-title">
        <div className="mirror-archive-heading">
          <div>
            <p className="eyebrow">STRATEGY ARCHIVE</p>
            <h2 id="mirror-archive-title">거울던전 공략</h2>
            <p>덱별로 시작 기프트와 층별 경로를 쌓아 두세요.</p>
          </div>
          <button className="primary-button" onClick={onNew}><Plus size={16} /> 새 거울던전 기록</button>
        </div>

        <div className="mirror-filter-bar">
          <label className="search-field mirror-search">
            <Search size={17} />
            <span className="sr-only">거울던전 공략 검색</span>
            <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="덱, 테마팩, 기프트, 메모로 검색" />
            {query && <button type="button" className="icon-button" aria-label="거울던전 검색 지우기" onClick={() => setQuery("")}><X size={14} /></button>}
          </label>
          <div className="mirror-filter-meta">
            <select className="record-filter" aria-label="거울던전 기록 상태" value={recordFilter} onChange={(event) => setRecordFilter(event.currentTarget.value)}>
              <option value="all">모든 기록</option>
              <option value="noted">공략 작성됨</option>
              <option value="rated">티어 평가됨</option>
              <option value="unrated">미평가</option>
            </select>
            <span><strong>{filtered.length}</strong>개의 공략</span>
          </div>
        </div>

        <details className="tag-filter-panel" aria-label="거울던전 게임 태그 필터">
          <summary>게임 태그로 찾기 {filterTags.length > 0 && `· ${filterTags.length}개 선택`}</summary>
          <p className="deck-category-help">선택한 태그를 모두 가진 기록을 보여줍니다.</p>
          <TagPicker value={filterTags} onChange={setFilterTags} />
          {filterTags.length > 0 && <button className="secondary-button" onClick={() => setFilterTags([])}>태그 필터 초기화</button>}
        </details>

        {filtered.length > 0 ? (
          <div className="mirror-card-grid">
            {filtered.map((entry) => {
              const plan = entry.mirrorPlan;
              const floorCount = plan?.floors.filter((floor) => floor.themePack.trim() || floor.notes.trim()).length ?? 0;
              const skillCount = plan?.skillChanges.filter(hasSkillRecord).length ?? 0;
              const giftRecorded = Boolean(plan?.startingGifts.trim() || plan?.startingGiftNotes.trim());
              return (
                <article className="mirror-card" key={entry.id}>
                  <button className="mirror-card-main" onClick={() => onOpen(entry.id)} aria-label={`${entry.name} 거울던전 상세 보기`}>
                    <MirrorCover entry={entry} entries={entries} />
                    <span className="mirror-card-copy">
                      <span className="mirror-card-kicker">MIRROR DUNGEON <span>{entry.tiers.mirror === "unrated" ? "미평가" : `${entry.tiers.mirror} 티어`}</span></span>
                      <strong className="mirror-card-title">{entry.name}</strong>
                      <span className="mirror-card-subtitle">{entry.subtitle.trim() || `${entry.memberIds.length}명 편성 · 거울던전 공략 기록`}</span>
                      <span className="mirror-card-progress" aria-label={`${floorCount} / 15층 기록됨`}>
                        {Array.from({ length: 15 }, (_, index) => {
                          const floor = plan?.floors.find((item) => item.floor === index + 1);
                          return <i key={index} data-recorded={Boolean(floor?.themePack.trim() || floor?.notes.trim())} aria-hidden="true" />;
                        })}
                      </span>
                      <span className="mirror-card-floor-count">{floorCount} / 15층 <ArrowRight size={14} /></span>
                    </span>
                  </button>
                  <div className="mirror-card-summary">
                    <span data-recorded={giftRecorded}><Gift size={13} />{giftRecorded ? "기프트 기록" : "기프트 미기록"}</span>
                    <span data-recorded={skillCount > 0}><SlidersHorizontal size={13} />스킬 변경 {skillCount}명</span>
                  </div>
                  <button className="mirror-card-edit" onClick={() => onEdit(entry.id)} aria-label={`${entry.name} 거울던전 공략 작성/수정`}><PenLine size={14} /> 공략 작성/수정 <ArrowRight size={13} /></button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mirror-empty-state">
            <Compass size={36} strokeWidth={1.2} />
            <h3>{mirrorEntries.length ? "일치하는 공략이 없습니다" : "첫 번째 경로를 남겨 주세요"}</h3>
            <p>{mirrorEntries.length ? "검색어, 기록 상태, 태그를 바꾸어 보세요." : "시작 기프트와 층별 선택을 기록하면 다음 탐험의 길잡이가 됩니다."}</p>
            {mirrorEntries.length > 0 && (query || recordFilter !== "all" || filterTags.length > 0) ? (
              <button className="secondary-button" onClick={() => { setQuery(""); setRecordFilter("all"); setFilterTags([]); }}>검색 조건 초기화</button>
            ) : null}
          </div>
        )}
      </section>
      <footer className="mirror-page-footer"><Compass size={13} /><span>선택한 경로는 나의 기록으로 남습니다.</span><span>1 — 15 FLOOR ARCHIVE</span></footer>
    </div>
  );
}
