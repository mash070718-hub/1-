import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORAGE_KEY,
  createCatalogLibrary,
  createDemoLibrary,
  createEntry,
  createMirrorPlan,
  exportLibrary,
  isMirrorDeck,
  loadLibrary,
  mergeCatalog,
  parseLibrary,
  resetCatalogEntry,
  saveLibrary,
  type LibraryData,
  type MirrorPlan,
} from './library';

function personalLibrary(): LibraryData {
  const identities = Array.from({ length: 9 }, (_, index) => ({
    ...createEntry('identity'), id: `personal-identity-${index + 1}`, name: `내 인격 ${index + 1}`,
    operation: `인격 ${index + 1}의 운영 메모`,
  }));
  const ego = { ...createEntry('ego'), id: 'personal-ego', name: '내 E.G.O.' };
  const deck = {
    ...createEntry('deck'), id: 'personal-deck', name: '기존 편성',
    description: '소개를 그대로 보존', strengths: '개인 장점', weaknesses: '개인 단점',
    operation: '운영 메모\n두 번째 줄과 "인용"', tags: ['직접 적은 태그'],
    memberIds: [5, 0, 7, 2, 4, 1, 6, 3].map((index) => identities[index].id),
    recommendedEgoIds: [ego.id], formationCode: '내 편성 코드',
    contentIds: ['railway6', 'mirror', 'story'] as const,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-05-01T03:04:05.000Z',
  };
  deck.tiers.story = 'S';
  deck.tiers.luxcavation = 'A';
  identities[0].deckIds = [deck.id];
  identities[0].recommendedEgoIds = [ego.id];
  return { version: 1, entries: [...identities, ego, { ...deck, contentIds: [...deck.contentIds] }] };
}

function filledLibrary(): LibraryData {
  const data = personalLibrary();
  const plan = createMirrorPlan();
  plan.startingGifts = '시작 선물 하나\n시작 선물 둘';
  plan.startingGiftNotes = '선물을 고른 이유와 "인용"';
  plan.floors = plan.floors.map((floor) => ({
    ...floor, themePack: `${floor.floor}층 테마팩`, notes: `${floor.floor}층 메모\n진행 순서`,
  }));
  plan.skillChanges = [
    { identityId: data.entries[5].id, skill1: 0, skill2: 99, skill3: null, notes: '첫 번째 인격의 스킬 교체' },
    { identityId: data.entries[8].id, skill1: null, skill2: 2, skill3: 3, notes: '편성에서 빠진 이전 추천도 유지' },
  ];
  data.entries.at(-1)!.mirrorPlan = plan;
  return data;
}

function mirrorPlan(data: LibraryData): MirrorPlan {
  return data.entries.at(-1)!.mirrorPlan!;
}

function omitFields(data: LibraryData, fields: string[]): string {
  return JSON.stringify(data, (key, value: unknown) => fields.includes(key) ? undefined : value);
}

test('mirror plans start with fifteen independent blank floors and are available only on decks', () => {
  const first = createMirrorPlan();
  const second = createMirrorPlan();
  assert.equal(first.startingGifts, '');
  assert.equal(first.startingGiftNotes, '');
  assert.deepEqual(first.skillChanges, []);
  assert.deepEqual(first.floors, Array.from({ length: 15 }, (_, index) => ({ floor: index + 1, themePack: '', notes: '' })));
  first.floors[0].notes = '독립 메모';
  assert.equal(second.floors[0].notes, '');
  assert.equal(first.floors[1].notes, '');
  for (const kind of ['identity', 'ego', 'deck'] as const) assert.equal(createEntry(kind).mirrorPlan, null);
  assert.ok(createCatalogLibrary().entries.every((entry) => entry.mirrorPlan === null));
  const deck = createEntry('deck');
  assert.equal(isMirrorDeck(deck), false);
  deck.contentIds = ['mirror'];
  assert.equal(isMirrorDeck(deck), true);
  deck.contentIds = [];
  deck.mirrorPlan = second;
  assert.equal(isMirrorDeck(deck), true);
  const identity = { ...createEntry('identity'), contentIds: ['mirror'] as const, mirrorPlan: second };
  assert.equal(isMirrorDeck({ ...identity, contentIds: [...identity.contentIds] }), false);
});

for (const missing of [[], ['mirrorPlan'], ['contentIds'], ['contentIds', 'mirrorPlan']]) {
  test(`version 1 backups normalize independently missing ${missing.join(' and ') || 'neither optional field'}`, () => {
    const original = personalLibrary();
    const json = omitFields(original, missing);
    for (const field of missing) assert.ok(!json.includes(`"${field}"`));
    const restored = parseLibrary(json);
    const expected = original.entries.map((entry) => ({
      ...entry,
      contentIds: missing.includes('contentIds') ? (entry.kind === 'deck' ? ['story', 'luxcavation'] : []) : entry.contentIds,
      mirrorPlan: null,
    }));
    assert.equal(restored.version, 1);
    assert.deepEqual(restored.entries, expected);
    assert.deepEqual(restored.entries.at(-1)!.memberIds, original.entries.at(-1)!.memberIds);
    assert.equal(restored.entries.at(-1)!.operation, original.entries.at(-1)!.operation);
  });
}

test('actual pre-mirror backups preserve all personal notes and formation positions after loading and saving', () => {
  for (const missing of [['mirrorPlan'], ['contentIds', 'mirrorPlan']]) {
    const original = personalLibrary();
    const saved = new Map([[STORAGE_KEY, omitFields(original, missing)]]);
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value); },
    };
    const loaded = loadLibrary(storage);
    for (const entry of original.entries) {
      const retained = loaded.entries.find(({ id }) => id === entry.id)!;
      assert.equal(retained.operation, entry.operation);
      assert.deepEqual(retained.memberIds, entry.memberIds);
      assert.equal(retained.mirrorPlan, null);
    }
    saveLibrary(loaded, storage);
    assert.equal(STORAGE_KEY, 'library-of-limbus:v1');
    assert.equal(JSON.parse(saved.get(STORAGE_KEY)!).version, 1);
    assert.ok(JSON.parse(saved.get(STORAGE_KEY)!).entries.every((entry: object) => Object.hasOwn(entry, 'mirrorPlan')));
    assert.deepEqual(loadLibrary(storage), loaded);
  }
});

test('every filled mirror plan field round trips, including recommendations outside the current formation', () => {
  const data = filledLibrary();
  const deck = data.entries.at(-1)!;
  assert.ok(!deck.memberIds.includes(mirrorPlan(data).skillChanges[1].identityId));
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
  };
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
  saveLibrary(data, storage);
  const loaded = loadLibrary(storage);
  assert.deepEqual(loaded.entries.find(({ id }) => id === deck.id), deck);
  assert.deepEqual(parseLibrary(omitFields(data, ['contentIds'])).entries.at(-1)!.mirrorPlan, deck.mirrorPlan);
});

test('mirror floors are normalized by number without changing the source plan or formation order', () => {
  const data = filledLibrary();
  const plan = mirrorPlan(data);
  plan.floors.reverse();
  const originalOrder = plan.floors.map(({ floor }) => floor);
  const memberIds = [...data.entries.at(-1)!.memberIds];
  const restored = parseLibrary(exportLibrary(data));
  assert.deepEqual(mirrorPlan(restored).floors.map(({ floor }) => floor), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.equal(mirrorPlan(restored).floors[0].themePack, '1층 테마팩');
  assert.equal(mirrorPlan(restored).floors[14].notes, '15층 메모\n진행 순서');
  assert.deepEqual(plan.floors.map(({ floor }) => floor), originalOrder);
  assert.deepEqual(restored.entries.at(-1)!.memberIds, memberIds);
});

test('catalog migration and custom reset clone every nested mirror plan row', () => {
  const data = filledLibrary();
  const deck = data.entries.at(-1)!;
  const migrated = mergeCatalog(data).entries.find(({ id }) => id === deck.id)!;
  const reset = resetCatalogEntry(deck);
  assert.deepEqual(migrated, deck);
  assert.deepEqual(reset, deck);
  for (const copy of [migrated, reset]) {
    assert.notEqual(copy.mirrorPlan, deck.mirrorPlan);
    assert.notEqual(copy.mirrorPlan!.floors, deck.mirrorPlan!.floors);
    assert.notEqual(copy.mirrorPlan!.floors[0], deck.mirrorPlan!.floors[0]);
    assert.notEqual(copy.mirrorPlan!.skillChanges, deck.mirrorPlan!.skillChanges);
    assert.notEqual(copy.mirrorPlan!.skillChanges[0], deck.mirrorPlan!.skillChanges[0]);
    copy.mirrorPlan!.floors[0].notes = '사본만 수정';
    copy.mirrorPlan!.skillChanges[0].skill1 = 7;
  }
  assert.equal(deck.mirrorPlan!.floors[0].notes, '1층 메모\n진행 순서');
  assert.equal(deck.mirrorPlan!.skillChanges[0].skill1, 0);
  const catalog = createCatalogLibrary().entries[0];
  assert.equal(resetCatalogEntry(catalog).mirrorPlan, null);
});

test('old and new untouched demo seeds disappear while a plan and its recommended identities survive', () => {
  for (const missing of [[], ['mirrorPlan'], ['contentIds', 'mirrorPlan']]) {
    const migrated = mergeCatalog(parseLibrary(omitFields(createDemoLibrary(), missing)));
    assert.ok(migrated.entries.every(({ id }) => !id.startsWith('demo-')));
  }
  const data = createDemoLibrary();
  const deck = data.entries.find(({ kind }) => kind === 'deck')!;
  deck.memberIds = [];
  deck.recommendedEgoIds = [];
  deck.mirrorPlan = createMirrorPlan();
  deck.mirrorPlan.skillChanges.push({ identityId: 'demo-identity-8', skill1: null, skill2: 0, skill3: 99, notes: '과거 추천' });
  const migrated = mergeCatalog(data);
  assert.deepEqual(migrated.entries.find(({ id }) => id === deck.id), deck);
  assert.ok(migrated.entries.some(({ id }) => id === 'demo-identity-8'));
  assert.doesNotThrow(() => parseLibrary(exportLibrary(migrated)));
});

test('mirror plans accept their documented string limits and inclusive count boundaries', () => {
  const data = filledLibrary();
  const plan = mirrorPlan(data);
  plan.startingGifts = '가'.repeat(5_000);
  plan.startingGiftNotes = '나'.repeat(30_000);
  plan.floors[0].themePack = '다'.repeat(2_000);
  plan.floors[0].notes = '라'.repeat(30_000);
  plan.skillChanges[0].notes = '마'.repeat(30_000);
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
});

const invalidPlans: { name: string; mutate: (data: LibraryData) => void }[] = [
  { name: 'plans on identities', mutate: (data) => { data.entries[0].mirrorPlan = createMirrorPlan(); } },
  { name: 'plans on E.G.O.', mutate: (data) => { data.entries.at(-2)!.mirrorPlan = createMirrorPlan(); } },
  { name: 'non-object plans', mutate: (data) => { Object.assign(data.entries.at(-1)!, { mirrorPlan: [] }); } },
  { name: 'unknown plan fields', mutate: (data) => { Object.assign(mirrorPlan(data), { unknown: true }); } },
  { name: 'missing plan fields', mutate: (data) => { delete (mirrorPlan(data) as Partial<MirrorPlan>).startingGifts; } },
  { name: 'missing floors', mutate: (data) => { mirrorPlan(data).floors.pop(); } },
  { name: 'extra floors', mutate: (data) => { mirrorPlan(data).floors.push({ floor: 16, themePack: '', notes: '' }); } },
  { name: 'duplicate floors', mutate: (data) => { mirrorPlan(data).floors[1].floor = 1; } },
  { name: 'floor zero', mutate: (data) => { mirrorPlan(data).floors[0].floor = 0; } },
  { name: 'floor sixteen', mutate: (data) => { mirrorPlan(data).floors[0].floor = 16; } },
  { name: 'fractional floors', mutate: (data) => { mirrorPlan(data).floors[0].floor = 1.5; } },
  { name: 'string floors', mutate: (data) => { Object.assign(mirrorPlan(data).floors[0], { floor: '1' }); } },
  { name: 'unknown floor fields', mutate: (data) => { Object.assign(mirrorPlan(data).floors[0], { unknown: true }); } },
  { name: 'missing floor fields', mutate: (data) => { delete (mirrorPlan(data).floors[0] as Partial<MirrorPlan['floors'][number]>).notes; } },
  { name: 'non-string gift names', mutate: (data) => { Object.assign(mirrorPlan(data), { startingGifts: null }); } },
  { name: 'oversized gift names', mutate: (data) => { mirrorPlan(data).startingGifts = '가'.repeat(5_001); } },
  { name: 'oversized gift notes', mutate: (data) => { mirrorPlan(data).startingGiftNotes = '가'.repeat(30_001); } },
  { name: 'oversized theme packs', mutate: (data) => { mirrorPlan(data).floors[0].themePack = '가'.repeat(2_001); } },
  { name: 'oversized floor notes', mutate: (data) => { mirrorPlan(data).floors[0].notes = '가'.repeat(30_001); } },
  { name: 'non-array skill changes', mutate: (data) => { Object.assign(mirrorPlan(data), { skillChanges: {} }); } },
  { name: 'unknown skill fields', mutate: (data) => { Object.assign(mirrorPlan(data).skillChanges[0], { unknown: true }); } },
  { name: 'missing skill fields', mutate: (data) => { delete (mirrorPlan(data).skillChanges[0] as Partial<MirrorPlan['skillChanges'][number]>).skill3; } },
  { name: 'malformed identity IDs', mutate: (data) => { mirrorPlan(data).skillChanges[0].identityId = '../identity'; } },
  { name: 'missing identity references', mutate: (data) => { mirrorPlan(data).skillChanges[0].identityId = 'missing-identity'; } },
  { name: 'wrong-kind identity references', mutate: (data) => { mirrorPlan(data).skillChanges[0].identityId = 'personal-ego'; } },
  { name: 'duplicate identity rows', mutate: (data) => { mirrorPlan(data).skillChanges.push({ ...mirrorPlan(data).skillChanges[0] }); } },
  { name: 'negative skill counts', mutate: (data) => { mirrorPlan(data).skillChanges[0].skill1 = -1; } },
  { name: 'skill counts above 99', mutate: (data) => { mirrorPlan(data).skillChanges[0].skill2 = 100; } },
  { name: 'fractional skill counts', mutate: (data) => { mirrorPlan(data).skillChanges[0].skill3 = 1.5; } },
  { name: 'string skill counts', mutate: (data) => { Object.assign(mirrorPlan(data).skillChanges[0], { skill1: '2' }); } },
  { name: 'boolean skill counts', mutate: (data) => { Object.assign(mirrorPlan(data).skillChanges[0], { skill2: false }); } },
  { name: 'oversized skill notes', mutate: (data) => { mirrorPlan(data).skillChanges[0].notes = '가'.repeat(30_001); } },
];

for (const { name, mutate } of invalidPlans) {
  test(`invalid mirror ${name} are rejected before saved records can be overwritten`, () => {
    const data = filledLibrary();
    mutate(data);
    let saved = 'existing personal backup';
    assert.throws(() => parseLibrary(JSON.stringify(data)), /라이브러리 파일을 읽을 수 없습니다/);
    assert.throws(() => saveLibrary(data, { setItem: (_key, value) => { saved = value; } }), /라이브러리 파일을 읽을 수 없습니다/);
    assert.equal(saved, 'existing personal backup');
  });
}
