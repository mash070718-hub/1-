import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTENTS,
  DECK_CATEGORIES,
  STORAGE_KEY,
  createCatalogLibrary,
  createDemoLibrary,
  createEntry,
  exportLibrary,
  loadLibrary,
  matchesDeckCategory,
  mergeCatalog,
  parseLibrary,
  resetCatalogEntry,
  saveLibrary,
  type LibraryData,
} from './library';
import { CATALOG, getCatalogRecord } from './catalog';
import { isGameTag } from './tags';

test('a new record has independent, unrated tiers for every content', () => {
  const first = createEntry('identity');
  const second = createEntry('deck');
  assert.notEqual(first.id, second.id);
  assert.equal(second.sinner, '');
  assert.deepEqual(first.contentIds, []);
  assert.deepEqual(second.contentIds, []);
  assert.deepEqual(Object.keys(first.tiers), CONTENTS.map(({ id }) => id));
  assert.ok(Object.values(first.tiers).every((tier) => tier === 'unrated'));
  first.tiers.story = 'S';
  assert.equal(second.tiers.story, 'unrated');
  assert.doesNotThrow(() => parseLibrary(JSON.stringify({ version: 1, entries: [first, second] })));
});

function legacyBackup(data: LibraryData): string {
  return JSON.stringify(data, (key, value: unknown) => key === 'contentIds' ? undefined : value);
}

test('legacy version 1 decks infer folders from evaluated content and preserve formation order and personal records', () => {
  const identities = Array.from({ length: 8 }, (_, index) => ({
    ...createEntry('identity'), id: `old-identity-${index + 1}`, name: `인격 ${index + 1}`,
  }));
  const ego = { ...createEntry('ego'), id: 'old-ego', name: '오감도 메모' };
  const deck = {
    ...createEntry('deck'), id: 'old-deck', name: '기존 편성',
    tags: ['내 태그', '검토 완료'], description: '개인 소개', strengths: '개인 장점',
    weaknesses: '개인 단점', operation: '기존 운영 메모\n두 번째 줄',
    memberIds: identities.map(({ id }) => id).reverse(), recommendedEgoIds: [ego.id],
    formationCode: '내 편성 코드', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-05-01T03:04:05.000Z',
  };
  deck.tiers.luxcavation = 'A';
  deck.tiers.railway2 = 'S';
  identities[0].deckIds = [deck.id];
  identities[0].recommendedEgoIds = [ego.id];
  identities[0].tiers.story = 'B';
  const original: LibraryData = { version: 1, entries: [...identities, ego, deck] };
  const json = legacyBackup(original);
  assert.ok(!json.includes('"contentIds"'));
  const parsed = parseLibrary(json);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.entries, original.entries.map((entry) => ({
    ...entry, contentIds: entry.kind === 'deck' ? ['luxcavation', 'railway2'] : [],
  })));
  const stored = new Map([[STORAGE_KEY, json]]);
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
  };
  const loaded = loadLibrary(storage);
  const migratedDeck = loaded.entries.find(({ id }) => id === deck.id)!;
  assert.equal(migratedDeck.memberIds.length, 8);
  assert.deepEqual(migratedDeck.memberIds, deck.memberIds);
  assert.deepEqual(migratedDeck.contentIds, ['luxcavation', 'railway2']);
  saveLibrary(loaded, storage);
  assert.equal(JSON.parse(stored.get(STORAGE_KEY)!).version, 1);
  assert.ok(JSON.parse(stored.get(STORAGE_KEY)!).entries.every((entry: object) => Object.hasOwn(entry, 'contentIds')));
  assert.deepEqual(loadLibrary(storage), loaded);
});

test('unrated legacy decks stay unfiled and explicit empty categories are never inferred again', () => {
  const deck = { ...createEntry('deck'), id: 'unfiled-deck', name: '폴더 미지정' };
  assert.deepEqual(parseLibrary(legacyBackup({ version: 1, entries: [deck] })).entries[0].contentIds, []);
  deck.tiers.story = 'S';
  const explicitlyUnfiled = parseLibrary(exportLibrary({ version: 1, entries: [deck] })).entries[0];
  assert.deepEqual(explicitlyUnfiled.contentIds, []);
  assert.equal(matchesDeckCategory(explicitlyUnfiled, 'story'), false);
});

test('current backups preserve independent folder selection and every formation position', () => {
  const identities = Array.from({ length: 7 }, (_, index) => ({
    ...createEntry('identity'), id: `slot-identity-${index + 1}`, name: `편성 ${index + 1}`,
  }));
  const deck = {
    ...createEntry('deck'), id: 'ordered-deck', name: '순서 지정 덱',
    memberIds: [identities[5].id, identities[0].id, identities[6].id, identities[2].id, identities[4].id, identities[1].id, identities[3].id],
    contentIds: ['railway6', 'luxcavation', 'story'] as const,
  };
  const data: LibraryData = { version: 1, entries: [...identities, { ...deck, contentIds: [...deck.contentIds] }] };
  const json = exportLibrary(data);
  const restored = parseLibrary(json);
  assert.deepEqual(restored, data);
  assert.deepEqual(restored.entries.at(-1)?.memberIds, deck.memberIds);
  assert.deepEqual(restored.entries.at(-1)?.contentIds, deck.contentIds);
  assert.ok(Object.values(restored.entries.at(-1)!.tiers).every((tier) => tier === 'unrated'));
});

test('deck folders group each railway and match selected contents independently of tier ratings', () => {
  assert.deepEqual(DECK_CATEGORIES.map(({ id, label }) => ({ id, label })), [
    { id: 'luxcavation', label: '채광' }, { id: 'railway', label: '거울굴절철도' },
    { id: 'mirror', label: '거울던전' }, { id: 'story', label: '스토리' },
  ]);
  const deck = createEntry('deck');
  deck.contentIds = ['luxcavation', 'mirror', 'story'];
  assert.ok(matchesDeckCategory(deck, 'luxcavation'));
  assert.ok(matchesDeckCategory(deck, 'mirror'));
  assert.ok(matchesDeckCategory(deck, 'story'));
  assert.equal(matchesDeckCategory(deck, 'railway'), false);
  for (const railway of ['railway1', 'railway2', 'railway6'] as const) {
    deck.contentIds = [railway];
    assert.ok(matchesDeckCategory(deck, 'railway'));
    assert.equal(matchesDeckCategory(deck, 'story'), false);
  }
  deck.contentIds = ['simulation'];
  assert.ok(DECK_CATEGORIES.every(({ id }) => !matchesDeckCategory(deck, id)));
  const identity = createEntry('identity');
  identity.contentIds = ['mirror'];
  assert.equal(matchesDeckCategory(identity, 'mirror'), false);
  assert.deepEqual(parseLibrary(exportLibrary({ version: 1, entries: [identity] })).entries[0].contentIds, ['mirror']);
});

test('legacy untouched seeds still migrate away after their content folders are inferred', () => {
  const old = parseLibrary(legacyBackup(createDemoLibrary()));
  assert.equal(mergeCatalog(old).entries.length, CATALOG.length);
  assert.ok(mergeCatalog(old).entries.every(({ id }) => !id.startsWith('demo-')));
});

test('fictional examples have valid links and are labelled as examples', () => {
  const data = createDemoLibrary();
  assert.equal(data.entries.filter(({ kind }) => kind === 'identity').length, 8);
  assert.equal(data.entries.filter(({ kind }) => kind === 'ego').length, 3);
  assert.equal(data.entries.filter(({ kind }) => kind === 'deck').length, 2);
  assert.ok(data.entries.every(({ name, subtitle }) => name.includes('예시') && subtitle.includes('실제 게임 정보가 아닙니다')));
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
});

test('the first load and empty old notebooks receive a fresh, unrated official catalog', () => {
  const first = loadLibrary({ getItem: () => null });
  assert.equal(first.entries.length, CATALOG.length);
  assert.ok(first.entries.every((entry) => entry.id.startsWith('catalog-')));
  assert.ok(first.entries.every((entry) => Object.values(entry.tiers).every((tier) => tier === 'unrated')));
  first.entries[0].name = '내가 바꾼 이름';
  assert.notEqual(loadLibrary({ getItem: () => null }).entries[0].name, '내가 바꾼 이름');
  assert.equal(loadLibrary({ getItem: () => '{"version":1,"entries":[]}' }).entries.length, CATALOG.length);
  assert.deepEqual(parseLibrary('{"version":1,"entries":[]}'), { version: 1, entries: [] });
});

test('new catalog defaults include game tags without treating E.G.O. rarity as tags, while saved tags remain intact', () => {
  const data = createCatalogLibrary();
  for (const entry of data.entries) {
    assert.deepEqual(entry.tags, getCatalogRecord(entry.id)!.tags.filter(isGameTag));
    assert.ok(entry.tags.every(isGameTag));
  }
  const ego = data.entries.find((entry) => entry.kind === 'ego')!;
  assert.deepEqual(ego.tags, []);
  ego.tags = ['HE', '개인적으로 작성한 태그', '충전'];
  ego.operation = '이전 태그와 함께 저장한 운용 메모';
  const migrated = mergeCatalog(data).entries.find(({ id }) => id === ego.id)!;
  assert.deepEqual(migrated.tags, ego.tags);
  assert.equal(migrated.operation, ego.operation);
  assert.deepEqual(parseLibrary(exportLibrary({ version: 1, entries: [migrated] })).entries[0].tags, ego.tags);
});

test('saving and reloading preserve Korean notes, content ratings, and cross links', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const data = createCatalogLibrary();
  const deck = { ...createEntry('deck'), name: '나의 편성', memberIds: [data.entries[0].id] };
  const ego = data.entries.find((entry) => entry.kind === 'ego')!;
  data.entries.push(deck);
  data.entries[0].recommendedEgoIds = [ego.id];
  data.entries[0].deckIds = [deck.id];
  data.entries[0].strengths = '첫 턴 메모\n두 번째 줄: 흐름을 확인한다. "인용"도 보존';
  data.entries[0].tiers.railway6 = 'D';
  saveLibrary(data, storage);
  assert.ok(values.has(STORAGE_KEY));
  assert.deepEqual(loadLibrary(storage), data);
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
});

test('catalog migration removes untouched fictional seeds and leaves the old input unchanged', () => {
  const old = createDemoLibrary();
  const before = exportLibrary(old);
  const migrated = mergeCatalog(old);
  assert.equal(migrated.entries.length, CATALOG.length);
  assert.ok(migrated.entries.every((entry) => !entry.id.startsWith('demo-')));
  assert.equal(exportLibrary(old), before);
  assert.doesNotThrow(() => parseLibrary(exportLibrary(migrated)));
});

test('an edited old example and every linked target survive catalog migration', () => {
  const old = createDemoLibrary();
  old.entries[0].operation = '내가 직접 작성한 운용법';
  old.entries[0].tiers.story = 'D';
  const migrated = mergeCatalog(old);
  const preserved = migrated.entries.find(({ id }) => id === old.entries[0].id);
  assert.deepEqual(preserved, old.entries[0]);
  assert.ok(old.entries[0].deckIds.every((id) => migrated.entries.some((entry) => entry.id === id)));
  assert.ok(old.entries[0].recommendedEgoIds.every((id) => migrated.entries.some((entry) => entry.id === id)));
  assert.doesNotThrow(() => parseLibrary(exportLibrary(migrated)));
});

test('catalog refresh restores official names but keeps personal evaluations, tags, and links', () => {
  const old = createCatalogLibrary();
  const target = old.entries[0];
  const original = getCatalogRecord(target.id)!;
  const deck = { ...createEntry('deck'), name: '진동 편성', memberIds: [target.id], formationCode: '나의 편성번호' };
  old.entries.push(deck);
  const ego = old.entries.find((entry) => entry.kind === 'ego')!;
  Object.assign(target, {
    name: '오래된 이름', sinner: '오래된 수감자 표기',
    strengths: '유용한 첫 턴', weaknesses: '자원 부족', operation: '직접 작성한 운영법',
    description: '나의 평가', subtitle: '다음에 재평가', affinity: '질투', tags: ['내가 단 태그'],
    deckIds: [deck.id], recommendedEgoIds: [ego.id], formationCode: '개별 메모 번호',
  });
  target.tiers.mirror = 'S';
  old.entries.splice(1, 1);
  const migrated = mergeCatalog(old);
  const updated = migrated.entries.find(({ id }) => id === target.id)!;
  assert.deepEqual(updated, { ...target, name: original.name, sinner: original.sinner });
  assert.equal(migrated.entries.length, CATALOG.length + 1);
  assert.deepEqual(migrated.entries.find(({ id }) => id === deck.id), deck);
  assert.deepEqual(mergeCatalog(migrated), migrated);
  assert.doesNotThrow(() => parseLibrary(exportLibrary(migrated)));
});

test('custom records with unknown demo-prefixed IDs are never mistaken for seeded examples', () => {
  const custom = { ...createEntry('deck'), id: 'demo-my-own-deck', name: '직접 만든 덱' };
  const migrated = mergeCatalog({ version: 1, entries: [custom] });
  assert.deepEqual(migrated.entries.find(({ id }) => id === custom.id), custom);
});

test('resetting a catalog evaluation restores defaults and preserves deck membership', () => {
  const data = createCatalogLibrary();
  const entry = data.entries[0];
  const record = getCatalogRecord(entry.id)!;
  entry.operation = '지울 메모';
  entry.tags = ['개인 태그'];
  entry.tiers.railway6 = 'S';
  entry.deckIds = ['my-deck'];
  const reset = resetCatalogEntry(entry);
  assert.equal(reset.operation, '');
  assert.ok(Object.values(reset.tiers).every((tier) => tier === 'unrated'));
  assert.equal(reset.name, record.name);
  assert.deepEqual(reset.tags, record.tags.filter(isGameTag));
  assert.deepEqual(reset.deckIds, ['my-deck']);
  assert.equal(reset.createdAt, entry.createdAt);
  assert.equal(entry.operation, '지울 메모');
  const custom = { ...createEntry('deck'), name: '내 덱', strengths: '내 메모' };
  assert.deepEqual(resetCatalogEntry(custom), custom);
});

test('corrupt stored data is reported and never replaced with examples', () => {
  let writes = 0;
  const storage = {
    getItem: () => '{broken',
    setItem: () => { writes += 1; },
  };
  assert.throws(() => loadLibrary(storage), /올바른 JSON/);
  assert.equal(writes, 0);
});

test('storage failures remain visible to the caller', () => {
  assert.throws(() => loadLibrary({ getItem: () => { throw new Error('denied'); } }), /denied/);
  assert.throws(() => saveLibrary(createDemoLibrary(), { setItem: () => { throw new Error('quota'); } }), /quota/);
});

test('invalid records do not overwrite an existing saved library', () => {
  let saved = 'existing backup';
  const data = createDemoLibrary();
  data.entries[0].recommendedEgoIds = ['missing-ego'];
  assert.throws(() => saveLibrary(data, { setItem: (_key, value) => { saved = value; } }), /연결한 기록/);
  assert.equal(saved, 'existing backup');
});

const invalidCases: { name: string; mutate: (data: LibraryData) => unknown }[] = [
  { name: 'unsupported versions', mutate: (data) => ({ ...data, version: 2 }) },
  { name: 'non-array entries', mutate: (data) => ({ ...data, entries: {} }) },
  { name: 'unknown fields', mutate: (data) => ({ ...data, unexpected: true }) },
  { name: 'unknown record fields', mutate: (data) => { Object.assign(data.entries[0], { unexpected: true }); return data; } },
  { name: 'missing fields', mutate: (data) => { delete (data.entries[0] as Partial<typeof data.entries[0]>).strengths; return data; } },
  { name: 'invalid entry kinds', mutate: (data) => { Object.assign(data.entries[0], { kind: 'weapon' }); return data; } },
  { name: 'malformed IDs', mutate: (data) => { data.entries[0].id = '../records'; return data; } },
  { name: 'duplicate record IDs', mutate: (data) => { data.entries.push(structuredClone(data.entries[0])); return data; } },
  { name: 'duplicate relation IDs', mutate: (data) => { data.entries[0].recommendedEgoIds = ['demo-ego-1', 'demo-ego-1']; return data; } },
  { name: 'missing relation targets', mutate: (data) => { data.entries[0].deckIds = ['does-not-exist']; return data; } },
  { name: 'wrong-kind relation targets', mutate: (data) => { data.entries[0].recommendedEgoIds = ['demo-deck-1']; return data; } },
  { name: 'self references', mutate: (data) => { data.entries[0].memberIds = [data.entries[0].id]; return data; } },
  { name: 'missing content tiers', mutate: (data) => { delete (data.entries[0].tiers as Partial<typeof data.entries[0]['tiers']>).railway6; return data; } },
  { name: 'unknown content tiers', mutate: (data) => { Object.assign(data.entries[0].tiers, { railway3: 'S' }); return data; } },
  { name: 'unsupported tier values', mutate: (data) => { Object.assign(data.entries[0].tiers, { story: 'SS' }); return data; } },
  { name: 'non-array content folders', mutate: (data) => { Object.assign(data.entries[0], { contentIds: 'story' }); return data; } },
  { name: 'duplicate content folders', mutate: (data) => { data.entries[0].contentIds = ['story', 'story']; return data; } },
  { name: 'unknown content folders', mutate: (data) => { Object.assign(data.entries[0], { contentIds: ['railway3'] }); return data; } },
  { name: 'non-string content folders', mutate: (data) => { Object.assign(data.entries[0], { contentIds: [1] }); return data; } },
  { name: 'non-string notes', mutate: (data) => { Object.assign(data.entries[0], { operation: ['memo'] }); return data; } },
  { name: 'oversized notes', mutate: (data) => { data.entries[0].description = '가'.repeat(30_001); return data; } },
  { name: 'invalid timestamps', mutate: (data) => { data.entries[0].updatedAt = '2026-02-30T00:00:00.000Z'; return data; } },
];

for (const { name, mutate } of invalidCases) {
  test(`import rejects ${name}`, () => {
    assert.throws(() => parseLibrary(JSON.stringify(mutate(createDemoLibrary()))), /라이브러리 파일을 읽을 수 없습니다/);
  });
}

test('import rejects invalid JSON and files larger than the supported limit', () => {
  assert.throws(() => parseLibrary('not json'), /올바른 JSON/);
  assert.throws(() => parseLibrary(' '.repeat(5_000_001)), /파일 크기/);
  assert.throws(() => parseLibrary('null'), /객체 형식/);
});

test('untrusted prototype keys cannot become fields on accepted records', () => {
  const json = exportLibrary(createDemoLibrary()).replace('"version": 1,', '"version": 1, "__proto__": {"polluted": true},');
  assert.throws(() => parseLibrary(json), /지원하지 않는 항목/);
  assert.equal(Object.hasOwn({}, 'polluted'), false);
});
