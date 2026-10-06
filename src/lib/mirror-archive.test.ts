import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORAGE_KEY,
  createDemoLibrary,
  createEntry,
  createMirrorDeck,
  createMirrorEvaluation,
  createMirrorPlan,
  exportLibrary,
  getMirrorArchive,
  loadLibrary,
  mergeCatalog,
  migrateMirrorArchive,
  parseLibrary,
  saveLibrary,
  type LibraryData,
  type LibraryEntry,
  type MirrorDeck,
  type MirrorEvaluation,
} from './library';

type MirrorArchive = NonNullable<LibraryData['mirrorArchive']>;

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-05-01T03:04:05.000Z';

function personalEntry(kind: LibraryEntry['kind'], id: string): LibraryEntry {
  return {
    ...createEntry(kind), id, name: `개인 기록 ${id}`, subtitle: `부제 ${id}`,
    affinity: '오만', tags: ['직접 적은 태그', '검토 완료'],
    description: `소개 ${id}`, strengths: `장점 ${id}`, weaknesses: `단점 ${id}`,
    operation: `운영 ${id}\n두 번째 줄과 "인용"`,
    createdAt: CREATED_AT, updatedAt: UPDATED_AT,
  };
}

function legacyLibrary(): LibraryData {
  const identities = Array.from({ length: 3 }, (_, index) => personalEntry('identity', `custom-identity-${index + 1}`));
  const egos = Array.from({ length: 2 }, (_, index) => personalEntry('ego', `custom-ego-${index + 1}`));
  const pure = personalEntry('deck', 'custom-pure-deck');
  pure.contentIds = ['mirror'];
  pure.tiers.mirror = 'A';
  pure.memberIds = [identities[1].id, identities[0].id];
  pure.recommendedEgoIds = [egos[0].id];
  pure.formationCode = '개인 거울 편성';
  const mixed = personalEntry('deck', 'custom-mixed-deck');
  mixed.contentIds = ['story', 'mirror', 'railway6'];
  mixed.tiers.story = 'S';
  mixed.tiers.mirror = 'B';
  mixed.memberIds = [identities[0].id];
  mixed.recommendedEgoIds = [egos[1].id];
  mixed.formationCode = '일반과 거울에서 함께 사용';
  mixed.mirrorPlan = createMirrorPlan();
  mixed.mirrorPlan.startingGifts = '시작 선물\n두 번째 선물';
  mixed.mirrorPlan.startingGiftNotes = '거울에서 선물을 고르는 이유';
  mixed.mirrorPlan.floors[0].themePack = '1층 테마팩';
  mixed.mirrorPlan.floors[14].notes = '15층 운영 메모';
  mixed.mirrorPlan.skillChanges = [{ identityId: identities[2].id, skill1: 0, skill2: 99, skill3: null, notes: '편성 밖 이전 추천도 보존' }];
  const ordinary = personalEntry('deck', 'custom-story-deck');
  ordinary.contentIds = ['story'];
  ordinary.tiers.story = 'C';
  ordinary.memberIds = [identities[2].id];
  identities[0].tiers.mirror = 'S';
  identities[0].tiers.story = 'B';
  identities[0].recommendedEgoIds = [egos[1].id];
  identities[0].deckIds = [pure.id, mixed.id, ordinary.id];
  identities[1].deckIds = [pure.id];
  identities[2].deckIds = [pure.id];
  egos[0].tiers.mirror = 'D';
  egos[0].recommendedEgoIds = [egos[1].id];
  egos[0].deckIds = [pure.id, mixed.id];
  return { version: 1, entries: [...identities, ...egos, pure, mixed, ordinary] };
}

function fullArchiveLibrary(): LibraryData {
  const data = legacyLibrary();
  const deck: MirrorDeck = {
    ...createMirrorDeck(), id: 'custom-mixed-deck', name: '독립된 거울 덱',
    subtitle: '거울 전용 부제', affinity: '우울', tags: ['거울 태그', '독립 편성'], tier: 'S',
    description: '거울 전용 소개', strengths: '거울 전용 장점', weaknesses: '거울 전용 단점',
    operation: '거울 전용 운영\n"인용"도 보존',
    recommendedEgoIds: ['custom-ego-2'], memberIds: ['custom-identity-2', 'custom-identity-1'],
    formationCode: '거울 편성 코드', createdAt: CREATED_AT, updatedAt: UPDATED_AT,
  };
  deck.plan.startingGifts = '시작 선물 이름\n다음 선물';
  deck.plan.startingGiftNotes = '시작 선물의 이유';
  deck.plan.floors = deck.plan.floors.map((floor) => ({
    ...floor, themePack: `${floor.floor}층 테마팩`, notes: `${floor.floor}층 운영\n두 번째 줄`,
  }));
  deck.plan.skillChanges = [
    { identityId: 'custom-identity-1', skill1: 0, skill2: 99, skill3: null, notes: '배치 인격' },
    { identityId: 'custom-identity-3', skill1: null, skill2: 2, skill3: 3, notes: '현재 배치 밖 인격' },
  ];
  const identity: MirrorEvaluation = {
    ...createMirrorEvaluation('custom-identity-1'), tier: 'C', subtitle: '거울 인격 평가',
    description: '거울 인격 소개', strengths: '거울 인격 장점', weaknesses: '거울 인격 단점',
    operation: '거울 인격 운용\n원래 일반 메모와 다름', recommendedEgoIds: ['custom-ego-2'],
  };
  const ego: MirrorEvaluation = {
    ...createMirrorEvaluation('custom-ego-1'), tier: 'A', subtitle: '거울 E.G.O. 평가',
    description: '거울 E.G.O. 소개', strengths: '거울 E.G.O. 장점', weaknesses: '거울 E.G.O. 단점',
    operation: '거울 E.G.O. 운용', recommendedEgoIds: ['custom-ego-2'],
  };
  data.mirrorArchive = { decks: [deck], evaluations: [identity, ego] };
  return data;
}

function archive(data: LibraryData): MirrorArchive {
  assert.ok(data.mirrorArchive);
  return data.mirrorArchive;
}

function expectedEvaluation(entry: LibraryEntry): MirrorEvaluation {
  return {
    entryId: entry.id, tier: entry.tiers.mirror, subtitle: entry.subtitle,
    description: entry.description, strengths: entry.strengths, weaknesses: entry.weaknesses,
    operation: entry.operation, recommendedEgoIds: [...entry.recommendedEgoIds],
  };
}

function expectedDeck(entry: LibraryEntry, memberIds = entry.memberIds, recommendedEgoIds = entry.recommendedEgoIds): MirrorDeck {
  return {
    id: entry.id, name: entry.name, subtitle: entry.subtitle, affinity: entry.affinity,
    tags: [...entry.tags], tier: entry.tiers.mirror, description: entry.description,
    strengths: entry.strengths, weaknesses: entry.weaknesses, operation: entry.operation,
    recommendedEgoIds: [...recommendedEgoIds], memberIds: [...memberIds],
    formationCode: entry.formationCode, plan: entry.mirrorPlan ?? createMirrorPlan(),
    createdAt: entry.createdAt, updatedAt: entry.updatedAt,
  };
}

test('mirror factories create independent unrated decks, evaluations, and fifteen blank floors', () => {
  const first = createMirrorDeck();
  const second = createMirrorDeck();
  assert.notEqual(first.id, second.id);
  assert.equal(first.tier, 'unrated');
  for (const field of ['name', 'subtitle', 'affinity', 'description', 'strengths', 'weaknesses', 'operation', 'formationCode'] as const) {
    assert.equal(first[field], '');
  }
  assert.equal(first.tags.length, 0);
  assert.equal(first.memberIds.length, 0);
  assert.equal(first.recommendedEgoIds.length, 0);
  assert.deepEqual(first.plan, createMirrorPlan());
  first.tags.push('첫 사본');
  first.plan.floors[0].notes = '첫 사본의 메모';
  assert.deepEqual(second.tags, []);
  assert.equal(second.plan.floors[0].notes, '');
  assert.equal(first.plan.floors[1].notes, '');
  const evaluation = createMirrorEvaluation('custom-identity-1');
  assert.deepEqual(evaluation, {
    entryId: 'custom-identity-1', tier: 'unrated', subtitle: '', description: '',
    strengths: '', weaknesses: '', operation: '', recommendedEgoIds: [],
  });
  evaluation.recommendedEgoIds.push('custom-ego-1');
  assert.deepEqual(createMirrorEvaluation('custom-identity-2').recommendedEgoIds, []);
});

test('the parser leaves absent archives absent and an empty archive accessor does not mutate old data', () => {
  const data = legacyLibrary();
  const parsed = parseLibrary(JSON.stringify(data));
  assert.deepEqual(parsed, data);
  assert.equal(Object.hasOwn(parsed, 'mirrorArchive'), false);
  const first = getMirrorArchive(parsed);
  const second = getMirrorArchive(parsed);
  assert.equal(first.decks.length, 0);
  assert.equal(first.evaluations.length, 0);
  first.decks.push(createMirrorDeck());
  assert.deepEqual(second, { decks: [], evaluations: [] });
  assert.equal(Object.hasOwn(parsed, 'mirrorArchive'), false);
});

test('actual old backups without content folders or plans migrate rated mirror-only decks without losing personal fields', () => {
  const data = legacyLibrary();
  const pure = data.entries.find(({ id }) => id === 'custom-pure-deck')!;
  const json = JSON.stringify(data, (key, value: unknown) => ['contentIds', 'mirrorPlan'].includes(key) ? undefined : value);
  assert.equal(json.includes('"contentIds"'), false);
  assert.equal(json.includes('"mirrorPlan"'), false);
  const parsed = parseLibrary(json);
  assert.deepEqual(parsed.entries.find(({ id }) => id === pure.id)!.contentIds, ['mirror']);
  const before = JSON.stringify(parsed);
  const migrated = migrateMirrorArchive(parsed);
  assert.equal(JSON.stringify(parsed), before);
  assert.equal(migrated.version, 1);
  assert.equal(migrated.entries.some(({ id }) => id === pure.id), false);
  assert.deepEqual(archive(migrated).decks.find(({ id }) => id === pure.id), expectedDeck(pure, [
    'custom-identity-2', 'custom-identity-1', 'custom-identity-3',
  ]));
  assert.deepEqual(migrated.entries.find(({ id }) => id === 'custom-identity-1')!.deckIds, ['custom-mixed-deck', 'custom-story-deck']);
  assert.deepEqual(migrated.entries.find(({ id }) => id === 'custom-identity-2')!.deckIds, []);
  assert.deepEqual(migrated.entries.find(({ id }) => id === 'custom-ego-1')!.deckIds, ['custom-mixed-deck']);
  assert.doesNotThrow(() => parseLibrary(exportLibrary(migrated)));
});

test('migration copies mixed deck plans while preserving every general field and ordinary deck', () => {
  const data = legacyLibrary();
  const mixed = data.entries.find(({ id }) => id === 'custom-mixed-deck')!;
  const ordinary = data.entries.find(({ id }) => id === 'custom-story-deck')!;
  const migrated = migrateMirrorArchive(data);
  assert.deepEqual(migrated.entries.find(({ id }) => id === mixed.id), mixed);
  assert.deepEqual(migrated.entries.find(({ id }) => id === ordinary.id), ordinary);
  assert.deepEqual(archive(migrated).decks.find(({ id }) => id === mixed.id), expectedDeck(mixed, mixed.memberIds, ['custom-ego-2', 'custom-ego-1']));
  assert.equal(archive(migrated).decks.some(({ id }) => id === ordinary.id), false);
  assert.deepEqual(data.entries.find(({ id }) => id === 'custom-identity-1')!.deckIds, ['custom-pure-deck', 'custom-mixed-deck', 'custom-story-deck']);
});

test('migration preserves reverse-only E.G.O. deck links in recommendation order without creating evaluations', () => {
  const egos = Array.from({ length: 4 }, (_, index) => personalEntry('ego', `reverse-ego-${index + 1}`));
  const pure = personalEntry('deck', 'reverse-pure-mirror-deck');
  pure.contentIds = ['mirror'];
  pure.recommendedEgoIds = [egos[2].id, egos[0].id];
  const mixed = personalEntry('deck', 'reverse-mixed-mirror-deck');
  mixed.contentIds = ['story', 'mirror'];
  mixed.recommendedEgoIds = [egos[3].id];
  egos[0].deckIds = [pure.id, mixed.id];
  egos[1].deckIds = [pure.id, mixed.id];
  egos[2].deckIds = [pure.id];
  egos[3].deckIds = [mixed.id];
  const data: LibraryData = { version: 1, entries: [...egos, pure, mixed] };
  const before = JSON.stringify(data);
  const migrated = migrateMirrorArchive(parseLibrary(before));
  const expectedPure = [egos[2].id, egos[0].id, egos[1].id];
  const expectedMixed = [egos[3].id, egos[0].id, egos[1].id];
  assert.deepEqual(archive(migrated).decks.find(({ id }) => id === pure.id)!.recommendedEgoIds, expectedPure);
  assert.deepEqual(archive(migrated).decks.find(({ id }) => id === mixed.id)!.recommendedEgoIds, expectedMixed);
  assert.equal(migrated.entries.some(({ id }) => id === pure.id), false);
  assert.deepEqual(migrated.entries.find(({ id }) => id === egos[1].id)!.deckIds, [mixed.id]);
  assert.deepEqual(migrated.entries.find(({ id }) => id === mixed.id), mixed);
  assert.deepEqual(archive(migrated).evaluations, []);
  assert.deepEqual(archive(migrated).decks.filter((deck) => deck.recommendedEgoIds.includes(egos[1].id)).map(({ id }) => id), [pure.id, mixed.id]);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(parseLibrary(exportLibrary(migrated)), migrated);
  assert.deepEqual(archive(loadLibrary({ getItem: () => before })).decks, archive(migrated).decks);
  archive(migrated).decks.find(({ id }) => id === pure.id)!.recommendedEgoIds = [egos[2].id];
  assert.deepEqual(archive(migrateMirrorArchive(migrated)).decks, archive(migrated).decks);
});

test('nonnull plans classify unfiled decks as mirror records and retain plans on decks with other content', () => {
  const unfiled = personalEntry('deck', 'unfiled-plan-deck');
  unfiled.mirrorPlan = createMirrorPlan();
  unfiled.mirrorPlan.startingGifts = '분류 없이 적어 둔 선물';
  const story = personalEntry('deck', 'story-plan-deck');
  story.contentIds = ['story'];
  story.mirrorPlan = createMirrorPlan();
  story.mirrorPlan.floors[8].notes = '스토리 덱에 함께 보관한 거울 메모';
  const migrated = migrateMirrorArchive({ version: 1, entries: [unfiled, story] });
  assert.deepEqual(migrated.entries, [story]);
  assert.deepEqual(archive(migrated).decks, [expectedDeck(unfiled), expectedDeck(story)]);
  assert.ok(archive(migrated).decks.every(({ tier }) => tier === 'unrated'));
});

test('mirror ratings migrate unfiled decks while ratings for other content preserve their general records', () => {
  const ratingOnly = personalEntry('deck', 'rating-only-mirror-deck');
  ratingOnly.tiers.mirror = 'S';
  const storyRated = personalEntry('deck', 'mirror-selected-story-rated-deck');
  storyRated.contentIds = ['mirror'];
  storyRated.tiers.story = 'A';
  storyRated.tiers.mirror = 'B';
  const otherRated = personalEntry('deck', 'unfiled-multi-rated-deck');
  otherRated.tiers.mirror = 'C';
  otherRated.tiers.railway2 = 'D';
  const migrated = migrateMirrorArchive({ version: 1, entries: [ratingOnly, storyRated, otherRated] });
  assert.deepEqual(migrated.entries, [storyRated, otherRated]);
  assert.deepEqual(archive(migrated).decks, [expectedDeck(ratingOnly), expectedDeck(storyRated), expectedDeck(otherRated)]);
});

test('migration seeds only rated identity and E.G.O. evaluations without changing general tiers or notes', () => {
  const data = legacyLibrary();
  const ratedIdentity = data.entries.find(({ id }) => id === 'custom-identity-1')!;
  const ratedEgo = data.entries.find(({ id }) => id === 'custom-ego-1')!;
  const migrated = migrateMirrorArchive(data);
  assert.deepEqual(archive(migrated).evaluations, [expectedEvaluation(ratedIdentity), expectedEvaluation(ratedEgo)]);
  for (const original of data.entries.filter(({ kind }) => kind !== 'deck')) {
    const retained = migrated.entries.find(({ id }) => id === original.id)!;
    assert.deepEqual(retained.tiers, original.tiers);
    assert.equal(retained.subtitle, original.subtitle);
    assert.equal(retained.description, original.description);
    assert.equal(retained.operation, original.operation);
    assert.deepEqual(retained.recommendedEgoIds, original.recommendedEgoIds);
  }
  assert.equal(archive(migrated).evaluations.some(({ entryId }) => entryId === 'custom-identity-2'), false);
});

test('existing archives suppress all reseeding and repeated migration produces independent copies', () => {
  const data = fullArchiveLibrary();
  const before = JSON.stringify(data);
  const migrated = migrateMirrorArchive(data);
  const again = migrateMirrorArchive(migrated);
  assert.deepEqual(migrated, data);
  assert.deepEqual(again, migrated);
  assert.equal(JSON.stringify(data), before);
  assert.equal(migrated.entries.some(({ id }) => id === 'custom-pure-deck'), true);
  assert.equal(archive(migrated).decks.length, 1);
  assert.equal(archive(migrated).evaluations[0].tier, 'C');
  assert.equal(migrated.entries[0].tiers.mirror, 'S');
  for (const copy of [migrated, again]) {
    assert.notEqual(copy.entries, data.entries);
    assert.notEqual(copy.entries[0], data.entries[0]);
    assert.notEqual(copy.entries[0].tiers, data.entries[0].tiers);
    assert.notEqual(archive(copy), archive(data));
    assert.notEqual(archive(copy).decks, archive(data).decks);
    assert.notEqual(archive(copy).decks[0], archive(data).decks[0]);
    assert.notEqual(archive(copy).decks[0].tags, archive(data).decks[0].tags);
    assert.notEqual(archive(copy).decks[0].memberIds, archive(data).decks[0].memberIds);
    assert.notEqual(archive(copy).decks[0].recommendedEgoIds, archive(data).decks[0].recommendedEgoIds);
    assert.notEqual(archive(copy).decks[0].plan, archive(data).decks[0].plan);
    assert.notEqual(archive(copy).decks[0].plan.floors[0], archive(data).decks[0].plan.floors[0]);
    assert.notEqual(archive(copy).decks[0].plan.skillChanges[0], archive(data).decks[0].plan.skillChanges[0]);
    assert.notEqual(archive(copy).evaluations[0], archive(data).evaluations[0]);
    assert.notEqual(archive(copy).evaluations[0].recommendedEgoIds, archive(data).evaluations[0].recommendedEgoIds);
  }
  archive(migrated).decks[0].plan.floors[0].notes = '이 사본만 변경';
  archive(migrated).decks[0].plan.skillChanges[0].skill1 = 5;
  archive(migrated).evaluations[0].operation = '독립 평가만 수정';
  migrated.entries[0].operation = '일반 사본만 수정';
  assert.equal(JSON.stringify(data), before);
  assert.equal(archive(again).decks[0].plan.floors[0].notes, '1층 운영\n두 번째 줄');
});

test('newly migrated mirror records and general mixed records share no writable nested data', () => {
  const data = legacyLibrary();
  const before = JSON.stringify(data);
  const migrated = migrateMirrorArchive(data);
  const mirror = archive(migrated).decks.find(({ id }) => id === 'custom-mixed-deck')!;
  const general = migrated.entries.find(({ id }) => id === mirror.id)!;
  assert.notEqual(mirror.plan, general.mirrorPlan);
  assert.notEqual(mirror.plan.floors, general.mirrorPlan!.floors);
  assert.notEqual(mirror.plan.skillChanges, general.mirrorPlan!.skillChanges);
  assert.notEqual(mirror.tags, general.tags);
  assert.notEqual(mirror.memberIds, general.memberIds);
  assert.notEqual(mirror.recommendedEgoIds, general.recommendedEgoIds);
  mirror.plan.floors[0].notes = '거울 사본만 변경';
  mirror.plan.skillChanges[0].skill2 = 3;
  mirror.tags.push('거울 태그만 추가');
  mirror.memberIds.reverse();
  archive(migrated).evaluations[0].recommendedEgoIds.length = 0;
  assert.deepEqual(general, data.entries.find(({ id }) => id === general.id));
  assert.deepEqual(migrated.entries[0].recommendedEgoIds, ['custom-ego-2']);
  assert.equal(JSON.stringify(data), before);
});

test('archive decks and evaluations round trip with ordered formations and independent general records', () => {
  const data = fullArchiveLibrary();
  assert.equal(data.entries.find(({ id }) => id === 'custom-mixed-deck')!.kind, 'deck');
  const mirror = archive(data).decks[0];
  assert.equal(mirror.id, 'custom-mixed-deck');
  assert.equal(mirror.memberIds.includes(mirror.plan.skillChanges[1].identityId), false);
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
  const stored = new Map<string, string>();
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
  };
  saveLibrary(data, storage);
  assert.equal(JSON.parse(stored.get(STORAGE_KEY)!).version, 1);
  const loaded = loadLibrary(storage);
  assert.deepEqual(archive(loaded), archive(data));
  for (const entry of data.entries) assert.deepEqual(loaded.entries.find(({ id }) => id === entry.id), entry);
  saveLibrary(loaded, storage);
  assert.deepEqual(loadLibrary(storage), loaded);
});

test('archive plans normalize floor ordering without changing source plans or saved member order', () => {
  const data = fullArchiveLibrary();
  const mirror = archive(data).decks[0];
  mirror.plan.floors.reverse();
  const before = JSON.stringify(data);
  const parsed = parseLibrary(exportLibrary(data));
  assert.deepEqual(archive(parsed).decks[0].plan.floors.map(({ floor }) => floor), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.equal(archive(parsed).decks[0].plan.floors[0].themePack, '1층 테마팩');
  assert.equal(archive(parsed).decks[0].plan.floors[14].notes, '15층 운영\n두 번째 줄');
  assert.deepEqual(archive(parsed).decks[0].memberIds, mirror.memberIds);
  assert.equal(JSON.stringify(data), before);
});

test('loading and catalog merging migrate old custom records while retaining their linked targets', () => {
  const data = legacyLibrary();
  const merged = mergeCatalog(data);
  const loaded = loadLibrary({ getItem: () => JSON.stringify(data) });
  assert.deepEqual(archive(merged), archive(loaded));
  assert.equal(merged.entries.some(({ id }) => id === 'custom-pure-deck'), false);
  assert.deepEqual(archive(merged).decks[0].memberIds, ['custom-identity-2', 'custom-identity-1', 'custom-identity-3']);
  for (const entry of data.entries.filter(({ kind }) => kind !== 'deck')) {
    assert.ok(merged.entries.some(({ id }) => id === entry.id));
  }
  assert.doesNotThrow(() => parseLibrary(exportLibrary(merged)));
});

test('existing archives preserve otherwise untouched demo targets during catalog cleanup', () => {
  const data = createDemoLibrary();
  const deck: MirrorDeck = {
    ...createMirrorDeck(), id: 'custom-demo-reference', name: '예시 대상이 연결된 개인 덱',
    memberIds: ['demo-identity-4'], recommendedEgoIds: ['demo-ego-2'],
  };
  deck.plan.skillChanges = [{ identityId: 'demo-identity-8', skill1: 2, skill2: null, skill3: null, notes: '배치 밖 추천도 남긴다' }];
  data.mirrorArchive = { decks: [deck], evaluations: [createMirrorEvaluation('demo-ego-3')] };
  const before = JSON.stringify(data);
  const merged = mergeCatalog(data);
  for (const id of ['demo-identity-4', 'demo-identity-8', 'demo-ego-2', 'demo-ego-3']) {
    assert.ok(merged.entries.some((entry) => entry.id === id), `${id} must survive archive references`);
  }
  assert.deepEqual(archive(merged), archive(data));
  assert.notEqual(archive(merged).decks[0].plan, deck.plan);
  assert.equal(JSON.stringify(data), before);
  assert.doesNotThrow(() => parseLibrary(exportLibrary(merged)));
});

test('empty archives are valid explicit data and suppress legacy mirror reseeding', () => {
  const data = legacyLibrary();
  data.mirrorArchive = { decks: [], evaluations: [] };
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
  const migrated = migrateMirrorArchive(data);
  assert.deepEqual(migrated, data);
  assert.deepEqual(getMirrorArchive(migrated), { decks: [], evaluations: [] });
});

test('archive strings accept their existing field limits and skill counts accept zero and ninety-nine', () => {
  const data = fullArchiveLibrary();
  const deck = archive(data).decks[0];
  const evaluation = archive(data).evaluations[0];
  deck.name = '가'.repeat(200);
  deck.subtitle = '나'.repeat(300);
  deck.affinity = '다'.repeat(100);
  deck.formationCode = '라'.repeat(2_000);
  deck.tags = Array.from({ length: 50 }, (_, index) => `${index}`.padEnd(100, '마'));
  for (const field of ['description', 'strengths', 'weaknesses', 'operation'] as const) {
    deck[field] = '바'.repeat(30_000);
    evaluation[field] = '사'.repeat(30_000);
  }
  deck.plan.startingGifts = '아'.repeat(5_000);
  deck.plan.startingGiftNotes = '자'.repeat(30_000);
  deck.plan.floors[0].themePack = '차'.repeat(2_000);
  deck.plan.floors[0].notes = '카'.repeat(30_000);
  deck.plan.skillChanges[0].notes = '타'.repeat(30_000);
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
});

const invalidArchives: { name: string; mutate: (data: LibraryData) => void }[] = [
  { name: 'null root archive', mutate: (data) => { Object.assign(data, { mirrorArchive: null }); } },
  { name: 'array root archive', mutate: (data) => { Object.assign(data, { mirrorArchive: [] }); } },
  { name: 'unknown archive fields', mutate: (data) => { Object.assign(archive(data), { unknown: true }); } },
  { name: 'missing archive decks', mutate: (data) => { delete (archive(data) as Partial<MirrorArchive>).decks; } },
  { name: 'missing archive evaluations', mutate: (data) => { delete (archive(data) as Partial<MirrorArchive>).evaluations; } },
  { name: 'non-array deck list', mutate: (data) => { Object.assign(archive(data), { decks: {} }); } },
  { name: 'non-array evaluation list', mutate: (data) => { Object.assign(archive(data), { evaluations: {} }); } },
  { name: 'null deck records', mutate: (data) => { Object.assign(archive(data), { decks: [null] }); } },
  { name: 'unknown deck fields', mutate: (data) => { Object.assign(archive(data).decks[0], { contentIds: ['mirror'] }); } },
  { name: 'missing deck plans', mutate: (data) => { delete (archive(data).decks[0] as Partial<MirrorDeck>).plan; } },
  { name: 'null deck plans', mutate: (data) => { Object.assign(archive(data).decks[0], { plan: null }); } },
  { name: 'malformed deck IDs', mutate: (data) => { archive(data).decks[0].id = '../mirror-deck'; } },
  { name: 'duplicate deck IDs', mutate: (data) => { archive(data).decks.push({ ...archive(data).decks[0] }); } },
  { name: 'unsupported deck tiers', mutate: (data) => { Object.assign(archive(data).decks[0], { tier: 'SS' }); } },
  { name: 'non-string deck notes', mutate: (data) => { Object.assign(archive(data).decks[0], { operation: null }); } },
  { name: 'oversized deck names', mutate: (data) => { archive(data).decks[0].name = '가'.repeat(201); } },
  { name: 'oversized deck notes', mutate: (data) => { archive(data).decks[0].description = '가'.repeat(30_001); } },
  { name: 'duplicate deck tags', mutate: (data) => { archive(data).decks[0].tags = ['중복', '중복']; } },
  { name: 'invalid deck timestamps', mutate: (data) => { archive(data).decks[0].updatedAt = 'not-a-date'; } },
  { name: 'missing member targets', mutate: (data) => { archive(data).decks[0].memberIds = ['missing-identity']; } },
  { name: 'wrong-kind member targets', mutate: (data) => { archive(data).decks[0].memberIds = ['custom-ego-1']; } },
  { name: 'duplicate member targets', mutate: (data) => { archive(data).decks[0].memberIds = ['custom-identity-1', 'custom-identity-1']; } },
  { name: 'missing deck E.G.O. targets', mutate: (data) => { archive(data).decks[0].recommendedEgoIds = ['missing-ego']; } },
  { name: 'wrong-kind deck E.G.O. targets', mutate: (data) => { archive(data).decks[0].recommendedEgoIds = ['custom-identity-1']; } },
  { name: 'missing plan identity targets', mutate: (data) => { archive(data).decks[0].plan.skillChanges[0].identityId = 'missing-identity'; } },
  { name: 'wrong-kind plan identity targets', mutate: (data) => { archive(data).decks[0].plan.skillChanges[0].identityId = 'custom-ego-1'; } },
  { name: 'duplicate plan identity targets', mutate: (data) => { archive(data).decks[0].plan.skillChanges.push({ ...archive(data).decks[0].plan.skillChanges[0] }); } },
  { name: 'incomplete archive plan floors', mutate: (data) => { archive(data).decks[0].plan.floors.pop(); } },
  { name: 'invalid archive plan skill counts', mutate: (data) => { archive(data).decks[0].plan.skillChanges[0].skill1 = -1; } },
  { name: 'null evaluation records', mutate: (data) => { Object.assign(archive(data), { evaluations: [null] }); } },
  { name: 'unknown evaluation fields', mutate: (data) => { Object.assign(archive(data).evaluations[0], { tags: [] }); } },
  { name: 'missing evaluation fields', mutate: (data) => { delete (archive(data).evaluations[0] as Partial<MirrorEvaluation>).strengths; } },
  { name: 'duplicate evaluation targets', mutate: (data) => { archive(data).evaluations.push({ ...archive(data).evaluations[0] }); } },
  { name: 'malformed evaluation targets', mutate: (data) => { archive(data).evaluations[0].entryId = '../identity'; } },
  { name: 'missing evaluation targets', mutate: (data) => { archive(data).evaluations[0].entryId = 'missing-identity'; } },
  { name: 'deck evaluation targets', mutate: (data) => { archive(data).evaluations[0].entryId = 'custom-story-deck'; } },
  { name: 'archive-only evaluation targets', mutate: (data) => { archive(data).decks[0].id = 'mirror-only-id'; archive(data).evaluations[0].entryId = 'mirror-only-id'; } },
  { name: 'unsupported evaluation tiers', mutate: (data) => { Object.assign(archive(data).evaluations[0], { tier: 3 }); } },
  { name: 'non-string evaluation notes', mutate: (data) => { Object.assign(archive(data).evaluations[0], { weaknesses: [] }); } },
  { name: 'oversized evaluation notes', mutate: (data) => { archive(data).evaluations[0].operation = '가'.repeat(30_001); } },
  { name: 'missing evaluation E.G.O. targets', mutate: (data) => { archive(data).evaluations[0].recommendedEgoIds = ['missing-ego']; } },
  { name: 'wrong-kind evaluation E.G.O. targets', mutate: (data) => { archive(data).evaluations[0].recommendedEgoIds = ['custom-story-deck']; } },
  { name: 'duplicate evaluation E.G.O. targets', mutate: (data) => { archive(data).evaluations[0].recommendedEgoIds = ['custom-ego-2', 'custom-ego-2']; } },
];

for (const { name, mutate } of invalidArchives) {
  test(`invalid mirror archive ${name} are rejected before saved data is overwritten`, () => {
    const data = fullArchiveLibrary();
    mutate(data);
    let saved = 'existing personal backup';
    let writes = 0;
    const storage = { setItem: (_key: string, value: string) => { writes += 1; saved = value; } };
    assert.throws(() => parseLibrary(JSON.stringify(data)), /라이브러리 파일을 읽을 수 없습니다/);
    assert.throws(() => exportLibrary(data), /라이브러리 파일을 읽을 수 없습니다/);
    assert.throws(() => saveLibrary(data, storage), /라이브러리 파일을 읽을 수 없습니다/);
    assert.equal(writes, 0);
    assert.equal(saved, 'existing personal backup');
  });
}
