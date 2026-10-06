import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookMarked, ChevronRight, PenLine, Search, Sparkles, X } from 'lucide-react';
import { getCatalogRecord } from '../lib/catalog';
import {
  createMirrorEvaluation, SINNERS, TIERS,
  type LibraryEntry, type MirrorEvaluation, type Tier,
} from '../lib/library';
import { TagPicker } from './TagPicker';
import './mirror-evaluation-collection.css';

export interface MirrorEvaluationCollectionProps {
  kind: 'identity' | 'ego';
  entries: LibraryEntry[];
  evaluations: MirrorEvaluation[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}

type EvaluationView = 'all' | 'tiers';
const PAGE_SIZE = 24;
const tierLabel = (tier: Tier) => tier === 'unrated' ? '미평가' : `${tier} 티어`;
const hasNotes = (evaluation: MirrorEvaluation) => Boolean(
  evaluation.subtitle.trim() || evaluation.description.trim()
  || evaluation.strengths.trim() || evaluation.weaknesses.trim()
  || evaluation.operation.trim() || evaluation.recommendedEgoIds.length,
);

function EvaluationArt({ entry }: { entry: LibraryEntry }) {
  const catalog = getCatalogRecord(entry.id);
  const image = catalog?.thumbnail;
  const [failedImage, setFailedImage] = useState<string>();
  const Icon = entry.kind === 'identity' ? BookMarked : Sparkles;
  return (
    <span className="entry-art" data-kind={entry.kind}>
      {image && failedImage !== image ? (
        <img
          src={image}
          alt={`${catalog?.sinner} ${catalog?.name} 공식 게임 이미지`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedImage(image)}
        />
      ) : <span className="entry-art-placeholder" aria-hidden="true"><Icon size={26} strokeWidth={1.2} /></span>}
    </span>
  );
}

function EvaluationCard({ entry, evaluation, onOpen, onEdit }: {
  entry: LibraryEntry;
  evaluation: MirrorEvaluation;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const catalog = getCatalogRecord(entry.id);
  const name = catalog?.name ?? entry.name;
  const sinner = catalog?.sinner ?? entry.sinner;
  const displayName = catalog ? `${name} ${sinner}` : name;
  const tags = catalog?.tags ?? entry.tags;
  const affinity = catalog?.affinity ?? (catalog ? '' : entry.affinity);
  const noted = hasNotes(evaluation);
  return (
    <article className="entry-card mirror-evaluation-card" data-kind={entry.kind} data-catalog={Boolean(catalog)}>
      <button
        className="entry-card-button"
        onClick={() => onOpen(entry.id)}
        aria-label={`${displayName} 거울던전 상세 보기`}
      >
        <EvaluationArt entry={entry} />
        <span className="entry-body">
          <span className="entry-kicker">{sinner}{catalog && <span className="badge">{catalog.rarity}</span>}</span>
          <span className="entry-title">{name}</span>
          <span className="entry-subtitle">
            {evaluation.subtitle.trim() || (noted
              ? '거울던전 평가가 기록되어 있습니다.'
              : '거울던전에서의 첫 평가를 남겨보세요.')}
          </span>
        </span>
        <ChevronRight size={16} className="entry-arrow" />
      </button>
      <div className="card-footer">
        <span className="entry-tags">
          {tags.slice(0, 2).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          {!tags.length && <span className="subtle-text">{affinity || '거울던전 평가'}</span>}
        </span>
        <span className="mirror-evaluation-card-tier" data-tier={evaluation.tier}>{tierLabel(evaluation.tier)}</span>
      </div>
      <button
        className="mirror-evaluation-edit"
        onClick={() => onEdit(entry.id)}
        aria-label={`${displayName} 거울던전 평가 작성/수정`}
      >
        <PenLine size={13} /> 평가 작성/수정 <ArrowRight size={13} />
      </button>
    </article>
  );
}

export default function MirrorEvaluationCollection({ kind, entries, evaluations, onOpen, onEdit }: MirrorEvaluationCollectionProps) {
  const [query, setQuery] = useState('');
  const [sinner, setSinner] = useState('전체');
  const [recordFilter, setRecordFilter] = useState('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [view, setView] = useState<EvaluationView>('all');
  const [visibleCounts, setVisibleCounts] = useState({ all: PAGE_SIZE, tiers: PAGE_SIZE });
  const kindLabel = kind === 'identity' ? '인격' : 'E.G.O';

  useEffect(() => {
    setVisibleCounts({ all: PAGE_SIZE, tiers: PAGE_SIZE });
  }, [kind, query, sinner, recordFilter, filterTags]);

  const records = useMemo(() => {
    const evaluationById = new Map(evaluations.map((evaluation) => [evaluation.entryId, evaluation]));
    return entries.filter((entry) => entry.kind === kind).map((entry) => ({
      entry,
      evaluation: evaluationById.get(entry.id) ?? createMirrorEvaluation(entry.id),
      catalog: getCatalogRecord(entry.id),
    }));
  }, [kind, entries, evaluations]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ko-KR');
    return records.filter(({ entry, evaluation, catalog }) => {
      if (sinner !== '전체' && (catalog?.sinner ?? entry.sinner) !== sinner) return false;
      const tags = catalog?.tags ?? entry.tags;
      const affinity = catalog?.affinity ?? (catalog ? '' : entry.affinity);
      if (!filterTags.every((tag) => tags.includes(tag) || affinity === tag)) return false;
      if (recordFilter === 'noted' && !hasNotes(evaluation)) return false;
      if (recordFilter === 'rated' && evaluation.tier === 'unrated') return false;
      if (recordFilter === 'unrated' && evaluation.tier !== 'unrated') return false;
      if (!needle) return true;
      const searchable = [
        catalog?.name ?? entry.name, catalog?.sinner ?? entry.sinner,
        evaluation.subtitle, evaluation.description, evaluation.strengths,
        evaluation.weaknesses, evaluation.operation,
        ...evaluation.recommendedEgoIds.map((id) => {
          const recommended = getCatalogRecord(id) ?? entries.find((item) => item.id === id);
          return recommended ? `${recommended.name} ${recommended.sinner}` : '';
        }),
      ].join(' ').toLocaleLowerCase('ko-KR');
      return searchable.includes(needle);
    });
  }, [records, entries, query, sinner, recordFilter, filterTags]);

  const ordered = view === 'tiers'
    ? [...filtered].sort((left, right) => TIERS.indexOf(left.evaluation.tier) - TIERS.indexOf(right.evaluation.tier))
    : filtered;
  const visible = ordered.slice(0, visibleCounts[view]);
  const ratedCount = records.filter(({ evaluation }) => evaluation.tier !== 'unrated').length;
  const notedCount = records.filter(({ evaluation }) => hasNotes(evaluation)).length;
  const card = ({ entry, evaluation }: typeof records[number]) => (
    <EvaluationCard key={entry.id} entry={entry} evaluation={evaluation} onOpen={onOpen} onEdit={onEdit} />
  );

  return (
    <div className="mirror-evaluation-collection" data-kind={kind}>
      <div className="mirror-evaluation-topline">
        <p>거울던전에서의 성능과 운용을 기록하세요.<span>티어 {ratedCount}개 · 평가 {notedCount}개 작성</span></p>
        <div className="mirror-evaluation-views" role="group" aria-label={`거울던전 ${kindLabel} 보기 방식`}>
          <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>전체 기록</button>
          <button type="button" aria-pressed={view === 'tiers'} onClick={() => setView('tiers')}>티어리스트</button>
        </div>
      </div>

      <div className="sinner-tabs mirror-evaluation-sinners" role="group" aria-label="거울던전 수감자 필터">
        {['전체', ...SINNERS].map((name, index) => (
          <button
            type="button"
            key={name}
            className={`sinner-tab ${sinner === name ? 'active' : ''}`}
            aria-label={name === '전체' ? '전체 수감자' : name}
            aria-pressed={sinner === name}
            onClick={() => setSinner(name)}
          >
            {name !== '전체' && <span className="sinner-number">{String(index).padStart(2, '0')}</span>}
            <span>{name === '전체' ? '모든 수감자' : name}</span>
          </button>
        ))}
      </div>

      <div className="mirror-filter-bar mirror-evaluation-filters">
        <label className="search-field mirror-search">
          <Search size={17} />
          <span className="sr-only">거울던전 {kindLabel} 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="이름, 수감자, 거울던전 메모로 검색"
          />
          {query && <button type="button" className="icon-button" aria-label="거울던전 검색 지우기" onClick={() => setQuery('')}><X size={14} /></button>}
        </label>
        <div className="mirror-filter-meta">
          <select
            className="record-filter"
            aria-label={`거울던전 ${kindLabel} 기록 상태`}
            value={recordFilter}
            onChange={(event) => setRecordFilter(event.currentTarget.value)}
          >
            <option value="all">모든 기록</option>
            <option value="noted">평가 작성됨</option>
            <option value="rated">티어 평가됨</option>
            <option value="unrated">미평가</option>
          </select>
          <span aria-live="polite"><strong>{filtered.length}</strong>개의 {kindLabel} 기록</span>
        </div>
      </div>

      <details className="tag-filter-panel" aria-label={`거울던전 ${kindLabel} 게임 태그 필터`}>
        <summary>게임 태그로 찾기 {filterTags.length > 0 && `· ${filterTags.length}개 선택`}</summary>
        <p className="deck-category-help">선택한 태그를 모두 가진 {kindLabel}을 보여줍니다.</p>
        <TagPicker value={filterTags} onChange={setFilterTags} />
        {filterTags.length > 0 && <button className="secondary-button" onClick={() => setFilterTags([])}>태그 필터 초기화</button>}
      </details>

      {filtered.length > 0 ? (
        view === 'tiers' ? (
          <div className="tier-board mirror-evaluation-board" aria-label={`거울던전 ${kindLabel} 티어 목록`}>
            {TIERS.map((tier) => {
              const tierRecords = filtered.filter(({ evaluation }) => evaluation.tier === tier);
              const visibleTierRecords = visible.filter(({ evaluation }) => evaluation.tier === tier);
              return (
                <section className="tier-row" data-tier={tier} key={tier} aria-label={tier === 'unrated' ? '미평가 티어' : tierLabel(tier)}>
                  <div className="tier-label" data-tier={tier}>
                    <strong className="tier-letter">{tier === 'unrated' ? '—' : tier}</strong>
                    <span className="tier-name">{tier === 'unrated' ? '미평가' : 'TIER'}<span>{tierRecords.length}</span></span>
                  </div>
                  <div className="tier-items">
                    {visibleTierRecords.map(card)}
                    {!tierRecords.length && <p className="empty-tier">이 티어의 기록이 없습니다.</p>}
                    {tierRecords.length > visibleTierRecords.length && (
                      <p className="mirror-evaluation-hidden">더 보기로 {tierRecords.length - visibleTierRecords.length}개의 기록을 펼칠 수 있습니다.</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : <div className="mirror-evaluation-grid">{visible.map(card)}</div>
      ) : (
        <div className="mirror-empty-state">
          <Search size={32} strokeWidth={1.2} />
          <h3>일치하는 {kindLabel} 기록이 없습니다.</h3>
          <p>검색어와 수감자, 기록 상태, 게임 태그를 확인해 주세요.</p>
        </div>
      )}

      {filtered.length > visible.length && (
        <div className="load-more mirror-evaluation-more">
          <span>{visible.length} / {filtered.length}개 표시</span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setVisibleCounts((previous) => ({ ...previous, [view]: previous[view] + PAGE_SIZE }))}
          >{kindLabel} 더 보기 <ArrowRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
