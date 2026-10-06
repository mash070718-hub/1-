import { CATALOG, getCatalogRecord, type CatalogRecord } from './catalog';

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

export const CONTENTS: { id: Content; label: string; shortLabel: string }[] = [
  { id: 'story', label: '스토리', shortLabel: '스토리' },
  { id: 'luxcavation', label: '경험치 · 끈 채광', shortLabel: '채광' },
  { id: 'mirror', label: '거울던전', shortLabel: '거울던전' },
  { id: 'simulation', label: '사영전투', shortLabel: '사영전투' },
  { id: 'railway1', label: '1호선', shortLabel: '1호선' },
  { id: 'railway2', label: '2호선', shortLabel: '2호선' },
  { id: 'railway6', label: '6호선', shortLabel: '6호선' },
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
  memberIds: string[];
  formationCode: string;
  tiers: Record<Content, Tier>;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryData {
  version: 1;
  entries: LibraryEntry[];
}

const MAX_JSON_LENGTH = 5_000_000;
const MAX_ENTRIES = 5_000;
const MAX_NOTE_LENGTH = 30_000;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const ENTRY_KEYS = [
  'id', 'kind', 'name', 'sinner', 'subtitle', 'affinity', 'tags',
  'description', 'strengths', 'weaknesses', 'operation',
  'recommendedEgoIds', 'deckIds', 'memberIds', 'formationCode',
  'tiers', 'createdAt', 'updatedAt',
];

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
    formationCode: '',
    tiers: emptyTiers(),
    createdAt: now,
    updatedAt: now,
  };
}

function createCatalogEntry(record: CatalogRecord): LibraryEntry {
  return {
    ...createEntry(record.kind),
    id: record.id,
    name: record.name,
    sinner: record.sinner,
    affinity: record.affinity ?? '',
    tags: [...record.tags],
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
    tiers: { ...entry.tiers },
  };
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
  const pending = [...keep];
  while (pending.length) {
    const entry = original.get(pending.pop()!);
    if (!entry) continue;
    for (const id of [...entry.recommendedEgoIds, ...entry.deckIds, ...entry.memberIds]) {
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
  return { version: 1, entries };
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
  requireKeys(data, ['version', 'entries'], '파일');
  if (data.version !== 1) invalid('version', '지원하지 않는 백업 버전입니다.');
  if (!Array.isArray(data.entries) || data.entries.length > MAX_ENTRIES) {
    invalid('entries', `최대 ${MAX_ENTRIES.toLocaleString('ko-KR')}개 기록의 배열이 필요합니다.`);
  }
  const entries = data.entries.map((value, index) => {
    const path = `entries[${index}]`;
    const entry = requireObject(value, path);
    requireKeys(entry, ENTRY_KEYS, path);
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
    requireTimestamp(entry.createdAt, `${path}.createdAt`);
    requireTimestamp(entry.updatedAt, `${path}.updatedAt`);
    return entry as unknown as LibraryEntry;
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
  });
  return { version: 1, entries };
}

function browserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function loadLibrary(storage?: Pick<Storage, 'getItem'>): LibraryData {
  const source = storage ?? browserStorage();
  const json = source?.getItem(STORAGE_KEY);
  return json === null || json === undefined ? createCatalogLibrary() : mergeCatalog(parseLibrary(json));
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
