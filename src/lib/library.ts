import { CATALOG, getCatalogRecord, type CatalogRecord } from './catalog';
import { isGameTag } from './tags';

export type Kind = 'identity' | 'ego' | 'deck';
export type Content =
  | 'story'
  | 'luxcavation'
  | 'mirror'
  | 'simulation'
  | 'railway1'
  | 'railway2'
  | 'railway6';
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'unrated';
export type DeckCategory = 'luxcavation' | 'railway' | 'mirror' | 'story';

export const CONTENTS: { id: Content; label: string; shortLabel: string }[] = [
  { id: 'story', label: '스토리', shortLabel: '스토리' },
  { id: 'luxcavation', label: '경험치 · 끈 채광', shortLabel: '채광' },
  { id: 'mirror', label: '거울던전', shortLabel: '거울던전' },
  { id: 'simulation', label: '사영전투', shortLabel: '사영전투' },
  { id: 'railway1', label: '1호선', shortLabel: '1호선' },
  { id: 'railway2', label: '2호선', shortLabel: '2호선' },
  { id: 'railway6', label: '6호선', shortLabel: '6호선' },
];

export const DECK_CATEGORIES: { id: DeckCategory; label: string; contents: Content[] }[] = [
  { id: 'luxcavation', label: '채광', contents: ['luxcavation'] },
  { id: 'railway', label: '거울굴절철도', contents: ['railway1', 'railway2', 'railway6'] },
  { id: 'mirror', label: '거울던전', contents: ['mirror'] },
  { id: 'story', label: '스토리', contents: ['story'] },
];

export const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D', 'unrated'];
export const KINDS: { id: Kind; label: string }[] = [
  { id: 'identity', label: '인격' },
  { id: 'ego', label: 'E.G.O.' },
  { id: 'deck', label: '덱' },
];
export const SINNERS = [
  '이상', '파우스트', '돈키호테', '료슈', '뫼르소', '홍루',
  '히스클리프', '이스마엘', '로쟈', '싱클레어', '오티스', '그레고르',
];
export const AFFINITIES = ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투'];
export const STORAGE_KEY = 'library-of-limbus:v1';

export interface MirrorFloor {
  floor: number;
  themePack: string;
  notes: string;
}

export interface MirrorSkillChange {
  identityId: string;
  skill1: number | null;
  skill2: number | null;
  skill3: number | null;
  notes: string;
}

export interface MirrorPlan {
  startingGifts: string;
  startingGiftNotes: string;
  floors: MirrorFloor[];
  skillChanges: MirrorSkillChange[];
}

export interface MirrorDeck {
  id: string;
  name: string;
  subtitle: string;
  affinity: string;
  tags: string[];
  tier: Tier;
  description: string;
  strengths: string;
  weaknesses: string;
  operation: string;
  recommendedEgoIds: string[];
  memberIds: string[];
  formationCode: string;
  plan: MirrorPlan;
  createdAt: string;
  updatedAt: string;
}

export interface MirrorEvaluation {
  entryId: string;
  tier: Tier;
  subtitle: string;
  description: string;
  strengths: string;
  weaknesses: string;
  operation: string;
  recommendedEgoIds: string[];
}

export interface MirrorArchive {
  decks: MirrorDeck[];
  evaluations: MirrorEvaluation[];
}

export interface LibraryEntry {
  id: string;
  kind: Kind;
  name: string;
  sinner: string;
  subtitle: string;
  affinity: string;
  tags: string[];
  description: string;
  strengths: string;
  weaknesses: string;
  operation: string;
  recommendedEgoIds: string[];
  deckIds: string[];
  /** Member array order is the saved formation order; legacy large decks stay intact. */
  memberIds: string[];
  contentIds: Content[];
  mirrorPlan: MirrorPlan | null;
  formationCode: string;
  tiers: Record<Content, Tier>;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryData {
  version: 1;
  entries: LibraryEntry[];
  mirrorArchive?: MirrorArchive;
}

const MAX_JSON_LENGTH = 5_000_000;
const MAX_ENTRIES = 5_000;
const MAX_NOTE_LENGTH = 30_000;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const ENTRY_KEYS = [
  'id', 'kind', 'name', 'sinner', 'subtitle', 'affinity', 'tags',
  'description', 'strengths', 'weaknesses', 'operation',
  'recommendedEgoIds', 'deckIds', 'memberIds', 'formationCode',
  'contentIds', 'mirrorPlan', 'tiers', 'createdAt', 'updatedAt',
];

export function createMirrorPlan(): MirrorPlan {
  return {
    startingGifts: '',
    startingGiftNotes: '',
    floors: Array.from({ length: 15 }, (_, index) => ({ floor: index + 1, themePack: '', notes: '' })),
    skillChanges: [],
  };
}

export function isMirrorDeck(entry: LibraryEntry): boolean {
  return entry.kind === 'deck' && (entry.contentIds.includes('mirror') || entry.mirrorPlan !== null);
}

export function matchesDeckCategory(entry: LibraryEntry, category: DeckCategory): boolean {
  return entry.kind === 'deck' && DECK_CATEGORIES.some(({ id, contents }) =>
    id === category && contents.some((content) => entry.contentIds.includes(content)));
}

function emptyTiers(): Record<Content, Tier> {
  return Object.fromEntries(CONTENTS.map(({ id }) => [id, 'unrated'])) as Record<Content, Tier>;
}

export function createEntry(kind: Kind): LibraryEntry {
  const now = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return {
    id: `${kind}-${id}`,
    kind,
    name: '',
    sinner: kind === 'deck' ? '' : '이상',
    subtitle: '',
    affinity: '',
    tags: [],
    description: '',
    strengths: '',
    weaknesses: '',
    operation: '',
    recommendedEgoIds: [],
    deckIds: [],
    memberIds: [],
    contentIds: [],
    mirrorPlan: null,
    formationCode: '',
    tiers: emptyTiers(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createMirrorDeck(): MirrorDeck {
  const entry = createEntry('deck');
  return {
    id: `mirror-${entry.id}`,
    name: '',
    subtitle: '',
    affinity: '',
    tags: [],
    tier: 'unrated',
    description: '',
    strengths: '',
    weaknesses: '',
    operation: '',
    recommendedEgoIds: [],
    memberIds: [],
    formationCode: '',
    plan: createMirrorPlan(),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function createMirrorEvaluation(entryId: string): MirrorEvaluation {
  return {
    entryId,
    tier: 'unrated',
    subtitle: '',
    description: '',
    strengths: '',
    weaknesses: '',
    operation: '',
    recommendedEgoIds: [],
  };
}

export function getMirrorArchive(data: LibraryData): MirrorArchive {
  return data.mirrorArchive ?? { decks: [], evaluations: [] };
}

function createCatalogEntry(record: CatalogRecord): LibraryEntry {
  return {
    ...createEntry(record.kind),
    id: record.id,
    name: record.name,
    sinner: record.sinner,
    affinity: record.affinity ?? '',
    tags: record.tags.filter(isGameTag),
  };
}

/** Every shipped identity and E.G.O. starts with personal notes and tiers empty. */
export function createCatalogLibrary(): LibraryData {
  return { version: 1, entries: CATALOG.map(createCatalogEntry) };
}

function cloneEntry(entry: LibraryEntry): LibraryEntry {
  return {
    ...entry,
    tags: [...entry.tags],
    recommendedEgoIds: [...entry.recommendedEgoIds],
    deckIds: [...entry.deckIds],
    memberIds: [...entry.memberIds],
    contentIds: [...entry.contentIds],
    mirrorPlan: entry.mirrorPlan == null ? null : cloneMirrorPlan(entry.mirrorPlan),
    tiers: { ...entry.tiers },
  };
}

function cloneMirrorPlan(plan: MirrorPlan): MirrorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => ({ ...floor })),
    skillChanges: plan.skillChanges.map((change) => ({ ...change })),
  };
}

function cloneMirrorArchive(archive: MirrorArchive): MirrorArchive {
  return {
    decks: archive.decks.map((deck) => ({
      ...deck,
      tags: [...deck.tags],
      recommendedEgoIds: [...deck.recommendedEgoIds],
      memberIds: [...deck.memberIds],
      plan: cloneMirrorPlan(deck.plan),
    })),
    evaluations: archive.evaluations.map((evaluation) => ({
      ...evaluation, recommendedEgoIds: [...evaluation.recommendedEgoIds],
    })),
  };
}

/** Separate legacy mirror records once while preserving their general-content originals. */
export function migrateMirrorArchive(data: LibraryData): LibraryData {
  if (data.mirrorArchive !== undefined) {
    return { version: 1, entries: data.entries.map(cloneEntry), mirrorArchive: cloneMirrorArchive(data.mirrorArchive) };
  }
  const isLegacyMirrorDeck = (entry: LibraryEntry) => entry.kind === 'deck' &&
    (isMirrorDeck(entry) || entry.tiers.mirror !== 'unrated');
  const decks: MirrorDeck[] = data.entries.filter(isLegacyMirrorDeck).map((entry) => ({
    id: entry.id,
    name: entry.name,
    subtitle: entry.subtitle,
    affinity: entry.affinity,
    tags: [...entry.tags],
    tier: entry.tiers.mirror,
    description: entry.description,
    strengths: entry.strengths,
    weaknesses: entry.weaknesses,
    operation: entry.operation,
    recommendedEgoIds: [...new Set([
      ...entry.recommendedEgoIds,
      ...data.entries.filter((ego) => ego.kind === 'ego' && ego.deckIds.includes(entry.id)).map(({ id }) => id),
    ])],
    memberIds: [...new Set([
      ...entry.memberIds,
      ...data.entries.filter((identity) => identity.kind === 'identity' && identity.deckIds.includes(entry.id)).map(({ id }) => id),
    ])],
    formationCode: entry.formationCode,
    plan: entry.mirrorPlan ? cloneMirrorPlan(entry.mirrorPlan) : createMirrorPlan(),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
  const evaluations: MirrorEvaluation[] = data.entries
    .filter((entry) => entry.kind !== 'deck' && entry.tiers.mirror !== 'unrated')
    .map((entry) => ({
      entryId: entry.id,
      tier: entry.tiers.mirror,
      subtitle: entry.subtitle,
      description: entry.description,
      strengths: entry.strengths,
      weaknesses: entry.weaknesses,
      operation: entry.operation,
      recommendedEgoIds: [...entry.recommendedEgoIds],
    }));
  const movedIds = new Set(data.entries
    .filter((entry) => isLegacyMirrorDeck(entry)
      && !entry.contentIds.some((content) => content !== 'mirror')
      && !CONTENTS.some(({ id }) => id !== 'mirror' && entry.tiers[id] !== 'unrated'))
    .map(({ id }) => id));
  const entries = data.entries.filter(({ id }) => !movedIds.has(id)).map((entry) => ({
    ...cloneEntry(entry), deckIds: entry.deckIds.filter((id) => !movedIds.has(id)),
  }));
  return { version: 1, entries, mirrorArchive: { decks, evaluations } };
}

/** Clear a catalog record's evaluation while keeping existing deck connections. */
export function resetCatalogEntry(entry: LibraryEntry): LibraryEntry {
  const record = getCatalogRecord(entry.id);
  if (!record) return cloneEntry(entry);
  return {
    ...createCatalogEntry(record),
    recommendedEgoIds: [...entry.recommendedEgoIds],
    deckIds: [...entry.deckIds],
    memberIds: [...entry.memberIds],
    createdAt: entry.createdAt,
  };
}

function matchesDemo(entry: LibraryEntry, example: LibraryEntry): boolean {
  return ENTRY_KEYS.every((key) => key === 'tiers'
    ? CONTENTS.every(({ id }) => entry.tiers[id] === example.tiers[id])
    : key === 'mirrorPlan'
      ? (entry.mirrorPlan ?? null) === example.mirrorPlan
      : JSON.stringify(entry[key as keyof LibraryEntry]) === JSON.stringify(example[key as keyof LibraryEntry]));
}

/**
 * Upgrade old notebooks without changing the backup schema or personal notes.
 * Only untouched fictional seeds are discarded; a retained record's links keep
 * their targets, even when those targets are untouched examples themselves.
 */
export function mergeCatalog(data: LibraryData): LibraryData {
  const demos = new Map(createDemoLibrary().entries.map((entry) => [entry.id, entry]));
  const original = new Map(data.entries.map((entry) => [entry.id, entry]));
  const keep = new Set(data.entries.filter((entry) => {
    const example = demos.get(entry.id);
    return !example || !matchesDemo(entry, example);
  }).map((entry) => entry.id));
  for (const id of [
    ...(data.mirrorArchive?.decks.flatMap((deck) => [
      ...deck.memberIds, ...deck.recommendedEgoIds,
      ...deck.plan.skillChanges.map(({ identityId }) => identityId),
    ]) ?? []),
    ...(data.mirrorArchive?.evaluations.flatMap((evaluation) => [evaluation.entryId, ...evaluation.recommendedEgoIds]) ?? []),
  ]) {
    if (original.has(id)) keep.add(id);
  }
  const pending = [...keep];
  while (pending.length) {
    const entry = original.get(pending.pop()!);
    if (!entry) continue;
    for (const id of [
      ...entry.recommendedEgoIds, ...entry.deckIds, ...entry.memberIds,
      ...(entry.mirrorPlan?.skillChanges.map(({ identityId }) => identityId) ?? []),
    ]) {
      if (!keep.has(id) && original.has(id)) {
        keep.add(id);
        pending.push(id);
      }
    }
  }
  const entries = data.entries.filter(({ id }) => keep.has(id)).map((entry) => {
    const record = getCatalogRecord(entry.id);
    const retained = cloneEntry(entry);
    return record ? { ...retained, kind: record.kind, name: record.name, sinner: record.sinner } : retained;
  });
  const existingIds = new Set(entries.map(({ id }) => id));
  for (const record of CATALOG) {
    if (!existingIds.has(record.id)) entries.push(createCatalogEntry(record));
  }
  return migrateMirrorArchive({ version: 1, entries,
    ...(data.mirrorArchive === undefined ? {} : { mirrorArchive: data.mirrorArchive }) });
}

/** These fictional examples demonstrate the notebook, not actual game evaluations. */
export function createDemoLibrary(): LibraryData {
  const demoDate = '2026-10-06T00:00:00.000Z';
  const identityNames = ['검은 서가', '새벽의 사서', '종이의 기사', '붉은 책갈피', '고요한 기록', '유리의 문장', '잿빛 독자', '파도의 각주'];
  const egoNames = ['종이별', '잉크의 정원', '마지막 페이지'];
  const tierPatterns: Tier[][] = [
    ['S', 'A', 'S', 'B', 'A', 'B', 'S'],
    ['A', 'S', 'A', 'S', 'B', 'A', 'A'],
    ['B', 'A', 'S', 'A', 'C', 'S', 'B'],
    ['A', 'B', 'B', 'A', 'S', 'A', 'C'],
    ['C', 'A', 'A', 'B', 'B', 'C', 'A'],
    ['B', 'B', 'C', 'S', 'A', 'B', 'B'],
    ['D', 'C', 'B', 'C', 'B', 'A', 'C'],
    ['unrated', 'B', 'A', 'B', 'C', 'B', 'unrated'],
  ];
  const makeDemo = (kind: Kind, id: string, name: string, index: number): LibraryEntry => ({
    ...createEntry(kind),
    id,
    name,
    subtitle: '직접 작성할 기록의 예시 · 실제 게임 정보가 아닙니다',
    description: '도서관의 기능을 살펴보기 위한 가상 예시입니다. 이름, 티어, 설명을 직접 작성한 정보로 바꿔 보세요.',
    strengths: '예시 장점: 어떤 상황에서 선택할 만한지, 다른 기록과 비교한 장점을 적어 두세요.',
    weaknesses: '예시 단점: 주의할 점과 활용하기 어려운 상황을 적어 두세요.',
    operation: '예시 운영 메모: 첫 턴의 판단, 필요한 자원, 팀 안에서의 역할을 직접 정리해 보세요.',
    tiers: Object.fromEntries(CONTENTS.map(({ id: content }, position) => [content, tierPatterns[index % tierPatterns.length][position]])) as Record<Content, Tier>,
    contentIds: kind === 'deck'
      ? CONTENTS.filter((_, position) => tierPatterns[index % tierPatterns.length][position] !== 'unrated').map(({ id }) => id)
      : [],
    createdAt: demoDate,
    updatedAt: demoDate,
  });
  const identities = identityNames.map((name, index): LibraryEntry => ({
    ...makeDemo('identity', `demo-identity-${index + 1}`, `${name} · 예시 인격`, index),
    sinner: SINNERS[index],
    affinity: AFFINITIES[index % AFFINITIES.length],
    tags: index % 2 === 0 ? ['예시', '기록 중'] : ['예시', '검토 예정'],
    recommendedEgoIds: [`demo-ego-${(index % egoNames.length) + 1}`],
    deckIds: index < 4 ? ['demo-deck-1'] : index < 6 ? ['demo-deck-1', 'demo-deck-2'] : ['demo-deck-2'],
  }));
  const egos = egoNames.map((name, index): LibraryEntry => ({
    ...makeDemo('ego', `demo-ego-${index + 1}`, `${name} · 예시 E.G.O.`, index + 2),
    sinner: SINNERS[index],
    affinity: AFFINITIES[index + 2],
    tags: ['예시', '자원 메모'],
    deckIds: index === 0 ? ['demo-deck-1'] : index === 1 ? ['demo-deck-1', 'demo-deck-2'] : ['demo-deck-2'],
  }));
  const decks: LibraryEntry[] = [
    {
      ...makeDemo('deck', 'demo-deck-1', '첫 번째 서가 · 예시 덱', 0),
      sinner: '',
      affinity: '오만',
      tags: ['예시', '편성 기록'],
      memberIds: identities.slice(0, 6).map(({ id }) => id),
      recommendedEgoIds: ['demo-ego-1', 'demo-ego-2'],
      formationCode: 'EXAMPLE-01',
    },
    {
      ...makeDemo('deck', 'demo-deck-2', '두 번째 서가 · 예시 덱', 1),
      sinner: '',
      affinity: '우울',
      tags: ['예시', '검토 예정'],
      memberIds: identities.slice(4).map(({ id }) => id),
      recommendedEgoIds: ['demo-ego-2', 'demo-ego-3'],
      formationCode: 'EXAMPLE-02',
    },
  ];
  return { version: 1, entries: [...identities, ...egos, ...decks] };
}

function invalid(path: string, reason: string): never {
  throw new Error(`라이브러리 파일을 읽을 수 없습니다. ${path}: ${reason}`);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, '객체 형식이 필요합니다.');
  }
  return value as Record<string, unknown>;
}

function requireKeys(value: Record<string, unknown>, keys: string[], path: string): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    invalid(path, '필수 항목이 없거나 지원하지 않는 항목이 있습니다.');
  }
}

function requireString(value: unknown, path: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || value.length > maxLength) {
    invalid(path, `${maxLength.toLocaleString('ko-KR')}자 이하의 문자열이 필요합니다.`);
  }
}

function requireId(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    invalid(path, 'ID는 영문, 숫자, 하이픈, 밑줄로 된 1~100자 문자열이어야 합니다.');
  }
}

function requireList(value: unknown, path: string, maxCount: number, maxLength: number, ids = false): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maxCount) invalid(path, `최대 ${maxCount}개의 항목을 가진 배열이 필요합니다.`);
  value.forEach((item, index) => {
    if (ids) requireId(item, `${path}[${index}]`);
    else requireString(item, `${path}[${index}]`, maxLength);
  });
  if (new Set(value).size !== value.length) invalid(path, '중복된 항목은 허용되지 않습니다.');
}

function requireTimestamp(value: unknown, path: string): void {
  requireString(value, path, 24);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    invalid(path, '유효한 ISO 날짜가 필요합니다.');
  }
}

function requireMirrorPlan(value: unknown, path: string): MirrorPlan {
  const plan = requireObject(value, path);
  requireKeys(plan, ['startingGifts', 'startingGiftNotes', 'floors', 'skillChanges'], path);
  requireString(plan.startingGifts, `${path}.startingGifts`, 5_000);
  requireString(plan.startingGiftNotes, `${path}.startingGiftNotes`, MAX_NOTE_LENGTH);
  if (!Array.isArray(plan.floors) || plan.floors.length !== 15) {
    invalid(`${path}.floors`, '1층부터 15층까지 모두 기록한 배열이 필요합니다.');
  }
  const seenFloors = new Set<number>();
  const floors = plan.floors.map((value, index): MirrorFloor => {
    const floorPath = `${path}.floors[${index}]`;
    const floor = requireObject(value, floorPath);
    requireKeys(floor, ['floor', 'themePack', 'notes'], floorPath);
    if (typeof floor.floor !== 'number' || !Number.isInteger(floor.floor) || floor.floor < 1 || floor.floor > 15) {
      invalid(`${floorPath}.floor`, '층 번호는 1~15의 정수여야 합니다.');
    }
    if (seenFloors.has(floor.floor)) invalid(`${path}.floors`, '중복된 층 번호는 허용되지 않습니다.');
    seenFloors.add(floor.floor);
    requireString(floor.themePack, `${floorPath}.themePack`, 2_000);
    requireString(floor.notes, `${floorPath}.notes`, MAX_NOTE_LENGTH);
    return { floor: floor.floor, themePack: floor.themePack, notes: floor.notes };
  }).sort((first, second) => first.floor - second.floor);
  if (!Array.isArray(plan.skillChanges) || plan.skillChanges.length > MAX_ENTRIES) {
    invalid(`${path}.skillChanges`, `최대 ${MAX_ENTRIES.toLocaleString('ko-KR')}개 기록의 배열이 필요합니다.`);
  }
  const seenIdentities = new Set<string>();
  const skillChanges = plan.skillChanges.map((value, index): MirrorSkillChange => {
    const skillPath = `${path}.skillChanges[${index}]`;
    const change = requireObject(value, skillPath);
    requireKeys(change, ['identityId', 'skill1', 'skill2', 'skill3', 'notes'], skillPath);
    requireId(change.identityId, `${skillPath}.identityId`);
    if (seenIdentities.has(change.identityId)) invalid(`${path}.skillChanges`, '중복된 인격 기록은 허용되지 않습니다.');
    seenIdentities.add(change.identityId);
    for (const skill of ['skill1', 'skill2', 'skill3']) {
      const count = change[skill];
      if (count !== null && (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 99)) {
        invalid(`${skillPath}.${skill}`, '스킬 수는 0~99의 정수 또는 미지정 값이어야 합니다.');
      }
    }
    requireString(change.notes, `${skillPath}.notes`, MAX_NOTE_LENGTH);
    return {
      identityId: change.identityId,
      skill1: change.skill1 as number | null,
      skill2: change.skill2 as number | null,
      skill3: change.skill3 as number | null,
      notes: change.notes,
    };
  });
  return { startingGifts: plan.startingGifts, startingGiftNotes: plan.startingGiftNotes, floors, skillChanges };
}

function requireMirrorArchive(value: unknown, byId: Map<string, LibraryEntry>): MirrorArchive {
  const archive = requireObject(value, 'mirrorArchive');
  requireKeys(archive, ['decks', 'evaluations'], 'mirrorArchive');
  for (const field of ['decks', 'evaluations']) {
    if (!Array.isArray(archive[field]) || archive[field].length > MAX_ENTRIES) {
      invalid(`mirrorArchive.${field}`, `최대 ${MAX_ENTRIES.toLocaleString('ko-KR')}개 기록의 배열이 필요합니다.`);
    }
  }
  const requireTarget = (id: string, kind: 'identity' | 'ego', path: string) => {
    if (byId.get(id)?.kind !== kind) invalid(path, '연결한 기록이 없거나 종류가 올바르지 않습니다.');
  };
  const requireRecommendations = (record: Record<string, unknown>, path: string) => {
    requireList(record.recommendedEgoIds, `${path}.recommendedEgoIds`, MAX_ENTRIES, 100, true);
    for (const id of record.recommendedEgoIds) requireTarget(id, 'ego', `${path}.recommendedEgoIds`);
    return record.recommendedEgoIds;
  };
  const requireNotes = (record: Record<string, unknown>, path: string) => {
    requireString(record.subtitle, `${path}.subtitle`, 300);
    for (const field of ['description', 'strengths', 'weaknesses', 'operation']) {
      requireString(record[field], `${path}.${field}`, MAX_NOTE_LENGTH);
    }
    if (!TIERS.includes(record.tier as Tier)) invalid(`${path}.tier`, '지원하지 않는 티어입니다.');
  };
  const seenDecks = new Set<string>();
  const decks = (archive.decks as unknown[]).map((value, index): MirrorDeck => {
    const path = `mirrorArchive.decks[${index}]`;
    const deck = requireObject(value, path);
    requireKeys(deck, [
      'id', 'name', 'subtitle', 'affinity', 'tags', 'tier', 'description', 'strengths',
      'weaknesses', 'operation', 'recommendedEgoIds', 'memberIds', 'formationCode', 'plan', 'createdAt', 'updatedAt',
    ], path);
    requireId(deck.id, `${path}.id`);
    if (seenDecks.has(deck.id)) invalid('mirrorArchive.decks', '중복된 거울던전 덱 ID가 있습니다.');
    seenDecks.add(deck.id);
    requireString(deck.name, `${path}.name`, 200);
    requireString(deck.affinity, `${path}.affinity`, 100);
    requireString(deck.formationCode, `${path}.formationCode`, 2_000);
    requireNotes(deck, path);
    requireList(deck.tags, `${path}.tags`, 50, 100);
    requireList(deck.memberIds, `${path}.memberIds`, MAX_ENTRIES, 100, true);
    for (const id of deck.memberIds) requireTarget(id, 'identity', `${path}.memberIds`);
    requireRecommendations(deck, path);
    const plan = requireMirrorPlan(deck.plan, `${path}.plan`);
    plan.skillChanges.forEach(({ identityId }, skillIndex) =>
      requireTarget(identityId, 'identity', `${path}.plan.skillChanges[${skillIndex}].identityId`));
    requireTimestamp(deck.createdAt, `${path}.createdAt`);
    requireTimestamp(deck.updatedAt, `${path}.updatedAt`);
    return { ...deck, plan } as unknown as MirrorDeck;
  });
  const seenEvaluations = new Set<string>();
  const evaluations = (archive.evaluations as unknown[]).map((value, index): MirrorEvaluation => {
    const path = `mirrorArchive.evaluations[${index}]`;
    const evaluation = requireObject(value, path);
    requireKeys(evaluation, ['entryId', 'tier', 'subtitle', 'description', 'strengths', 'weaknesses', 'operation', 'recommendedEgoIds'], path);
    requireId(evaluation.entryId, `${path}.entryId`);
    if (seenEvaluations.has(evaluation.entryId)) invalid('mirrorArchive.evaluations', '중복된 거울던전 평가 기록이 있습니다.');
    seenEvaluations.add(evaluation.entryId);
    const target = byId.get(evaluation.entryId);
    if (!target || target.kind === 'deck') invalid(`${path}.entryId`, '평가할 인격 또는 E.G.O. 기록이 없습니다.');
    requireNotes(evaluation, path);
    requireRecommendations(evaluation, path);
    return { ...evaluation } as unknown as MirrorEvaluation;
  });
  return { decks, evaluations };
}

/** Validate the entire import before replacing any locally stored records. */
export function parseLibrary(json: string): LibraryData {
  if (typeof json !== 'string' || json.length > MAX_JSON_LENGTH) invalid('파일', '파일 크기가 허용 범위를 넘었습니다.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    invalid('파일', '올바른 JSON 파일이 아닙니다.');
  }
  const data = requireObject(parsed, '파일');
  const hasMirrorArchive = Object.hasOwn(data, 'mirrorArchive');
  requireKeys(data, hasMirrorArchive ? ['version', 'entries', 'mirrorArchive'] : ['version', 'entries'], '파일');
  if (data.version !== 1) invalid('version', '지원하지 않는 백업 버전입니다.');
  if (!Array.isArray(data.entries) || data.entries.length > MAX_ENTRIES) {
    invalid('entries', `최대 ${MAX_ENTRIES.toLocaleString('ko-KR')}개 기록의 배열이 필요합니다.`);
  }
  const entries = data.entries.map((value, index) => {
    const path = `entries[${index}]`;
    const entry = requireObject(value, path);
    const hasContentIds = Object.hasOwn(entry, 'contentIds');
    const hasMirrorPlan = Object.hasOwn(entry, 'mirrorPlan');
    requireKeys(entry, ENTRY_KEYS.filter((key) =>
      (key !== 'contentIds' || hasContentIds) && (key !== 'mirrorPlan' || hasMirrorPlan)), path);
    requireId(entry.id, `${path}.id`);
    if (!KINDS.some(({ id }) => id === entry.kind)) invalid(`${path}.kind`, '인격, E.G.O., 덱 중 하나여야 합니다.');
    requireString(entry.name, `${path}.name`, 200);
    requireString(entry.sinner, `${path}.sinner`, 100);
    requireString(entry.subtitle, `${path}.subtitle`, 300);
    requireString(entry.affinity, `${path}.affinity`, 100);
    requireString(entry.formationCode, `${path}.formationCode`, 2_000);
    for (const field of ['description', 'strengths', 'weaknesses', 'operation']) {
      requireString(entry[field], `${path}.${field}`, MAX_NOTE_LENGTH);
    }
    requireList(entry.tags, `${path}.tags`, 50, 100);
    for (const field of ['recommendedEgoIds', 'deckIds', 'memberIds']) {
      requireList(entry[field], `${path}.${field}`, MAX_ENTRIES, 100, true);
    }
    const tiers = requireObject(entry.tiers, `${path}.tiers`);
    requireKeys(tiers, CONTENTS.map(({ id }) => id), `${path}.tiers`);
    for (const { id } of CONTENTS) {
      if (!TIERS.includes(tiers[id] as Tier)) invalid(`${path}.tiers.${id}`, '지원하지 않는 티어입니다.');
    }
    let contentIds: Content[];
    if (hasContentIds) {
      requireList(entry.contentIds, `${path}.contentIds`, CONTENTS.length, 100);
      for (const id of entry.contentIds) {
        if (!CONTENTS.some((content) => content.id === id)) {
          invalid(`${path}.contentIds`, '지원하지 않는 콘텐츠입니다.');
        }
      }
      contentIds = entry.contentIds as Content[];
    } else {
      // Older version 1 notebooks had only content tiers. Preserve those hints
      // without assigning unrated decks or non-deck entries to any folders.
      contentIds = entry.kind === 'deck'
        ? CONTENTS.filter(({ id }) => tiers[id] !== 'unrated').map(({ id }) => id)
        : [];
    }
    let mirrorPlan: MirrorPlan | null = null;
    if (hasMirrorPlan && entry.mirrorPlan !== null) {
      if (entry.kind !== 'deck') invalid(`${path}.mirrorPlan`, '거울던전 운영 계획은 덱에만 기록할 수 있습니다.');
      mirrorPlan = requireMirrorPlan(entry.mirrorPlan, `${path}.mirrorPlan`);
    }
    requireTimestamp(entry.createdAt, `${path}.createdAt`);
    requireTimestamp(entry.updatedAt, `${path}.updatedAt`);
    return { ...entry, contentIds, mirrorPlan } as unknown as LibraryEntry;
  });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  if (byId.size !== entries.length) invalid('entries', '중복된 기록 ID가 있습니다.');
  const relations: { field: 'recommendedEgoIds' | 'deckIds' | 'memberIds'; kind: Kind }[] = [
    { field: 'recommendedEgoIds', kind: 'ego' },
    { field: 'deckIds', kind: 'deck' },
    { field: 'memberIds', kind: 'identity' },
  ];
  entries.forEach((entry, index) => {
    for (const { field, kind } of relations) {
      for (const id of entry[field]) {
        if (id === entry.id) invalid(`entries[${index}].${field}`, '기록은 자신을 연결할 수 없습니다.');
        const target = byId.get(id);
        if (!target || target.kind !== kind) invalid(`entries[${index}].${field}`, '연결한 기록이 없거나 종류가 올바르지 않습니다.');
      }
    }
    for (const [skillIndex, change] of (entry.mirrorPlan?.skillChanges ?? []).entries()) {
      const target = byId.get(change.identityId);
      if (!target || target.kind !== 'identity') {
        invalid(`entries[${index}].mirrorPlan.skillChanges[${skillIndex}].identityId`, '연결한 인격 기록이 없거나 종류가 올바르지 않습니다.');
      }
    }
  });
  return { version: 1, entries,
    ...(hasMirrorArchive ? { mirrorArchive: requireMirrorArchive(data.mirrorArchive, byId) } : {}) };
}

function browserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function loadLibrary(storage?: Pick<Storage, 'getItem'>): LibraryData {
  const source = storage ?? browserStorage();
  const json = source?.getItem(STORAGE_KEY);
  return json === null || json === undefined ? migrateMirrorArchive(createCatalogLibrary()) : mergeCatalog(parseLibrary(json));
}

export function exportLibrary(data: LibraryData): string {
  const validated = parseLibrary(JSON.stringify(data));
  const json = JSON.stringify(validated, null, 2);
  if (json.length > MAX_JSON_LENGTH) invalid('파일', '파일 크기가 허용 범위를 넘었습니다.');
  return json;
}

export function saveLibrary(data: LibraryData, storage?: Pick<Storage, 'setItem'>): void {
  const target = storage ?? browserStorage();
  if (!target) throw new Error('브라우저 저장소를 사용할 수 없습니다. JSON 백업을 다운로드해 주세요.');
  target.setItem(STORAGE_KEY, exportLibrary(data));
}
