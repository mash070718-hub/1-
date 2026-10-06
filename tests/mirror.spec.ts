import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { CatalogRecord } from '../src/lib/catalog';
import type { LibraryData, LibraryEntry, MirrorPlan } from '../src/lib/library';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as { entries: CatalogRecord[] };
const members = ['이상', '파우스트'].map(sinner => catalog.entries.find(record => record.kind === 'identity' && record.sinner === sinner)!);
const egos = catalog.entries.filter(record => record.kind === 'ego' && record.sinner === '이상').slice(0, 2);
const storageKey = 'library-of-limbus:v1';
const memberName = (member: CatalogRecord) => `${member.name} ${member.sinner}`;
const mirrorCard = (page: Page, name: string) => page.getByRole('button', { name: `${name} 거울던전 상세 보기`, exact: true });
const skillCount = (page: Page, member: CatalogRecord, skill: number) => page.getByRole('spinbutton', { name: `${memberName(member)} ${skill}스킬 개수`, exact: true });

function mirrorPlan(): MirrorPlan {
  return {
    startingGifts: '타오르는 지옥 · 녹슨 기념 주화',
    startingGiftNotes: '첫 상점까지 기프트를 유지한다.',
    floors: Array.from({ length: 15 }, (_, index) => ({ floor: index + 1, themePack: `${index + 1}층 선택 테마팩`, notes: `${index + 1}층의 경로와 보스 메모` })),
    skillChanges: [
      { identityId: members[0].id, skill1: 0, skill2: 2, skill3: null, notes: '첫 인격의 2스킬을 두 개 사용한다.' },
      { identityId: members[1].id, skill1: 3, skill2: null, skill3: 1, notes: '두 번째 인격의 3스킬을 유지한다.' },
    ],
  };
}

function deckFixture(id: string, name: string, changes: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id, kind: 'deck', name, sinner: '', subtitle: '', affinity: '', tags: [],
    description: '', strengths: '', weaknesses: '', operation: '', recommendedEgoIds: [], deckIds: [],
    memberIds: members.map(member => member.id), contentIds: ['mirror'], formationCode: '', mirrorPlan: null,
    tiers: { story: 'unrated', luxcavation: 'unrated', mirror: 'unrated', simulation: 'unrated', railway1: 'unrated', railway2: 'unrated', railway6: 'unrated' },
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...changes,
  };
}

function memberFixtures(): LibraryEntry[] {
  return members.map(member => ({
    ...deckFixture(member.id, member.name), kind: 'identity', sinner: member.sinner,
    tags: member.tags, memberIds: [], contentIds: [],
  }));
}

function egoFixtures(): LibraryEntry[] {
  return egos.map(ego => ({ ...deckFixture(ego.id, ego.name), kind: 'ego', sinner: ego.sinner, tags: ego.tags, memberIds: [], contentIds: [] }));
}

async function openMirror(page: Page) {
  await page.getByRole('navigation', { name: '거울던전 메뉴', exact: true }).getByRole('button', { name: '거울던전', exact: true }).click();
  await expect(page).toHaveURL(/#mirror-dungeon$/);
  await expect(page.getByRole('heading', { name: '거울던전', exact: true, level: 1 })).toBeVisible();
}

async function mirrorKind(page: Page, kind: '덱' | '인격' | 'E.G.O.') {
  await page.getByRole('tablist', { name: '거울던전 기록 종류', exact: true }).getByRole('tab', { name: kind, exact: true }).click();
}

async function openGeneral(page: Page, kind: '덱' | '인격' | 'E.G.O.') {
  await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: /^전체 기록/ }).click();
  await expect(page).not.toHaveURL(/#mirror-dungeon$/);
  const names = { '덱': /^덱(?:\s*\d+)?$/, '인격': /^인격(?:\s*\d+)?$/, 'E.G.O.': /^E\.G\.O\.(?:\s*\d+)?$/ };
  await page.getByRole('tab', { name: names[kind] }).click();
}

async function closeDialog(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
}

async function storedNotebook(page: Page): Promise<LibraryData> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
}

async function setNotebook(page: Page, entries: unknown[], mirrorArchive?: LibraryData['mirrorArchive']) {
  await page.evaluate(({ key, entries, mirrorArchive }) => localStorage.setItem(key, JSON.stringify({ version: 1, entries, ...(mirrorArchive ? { mirrorArchive } : {}) })), { key: storageKey, entries, mirrorArchive });
  await page.reload();
}

async function editMirror(page: Page, name: string) {
  await mirrorCard(page, name).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
}

async function downloadNotebook(page: Page, path: string): Promise<LibraryData> {
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 다운로드', exact: true }).click();
  await (await downloadPromise).saveAs(path);
  await closeDialog(page);
  return JSON.parse(await readFile(path, 'utf8')) as LibraryData;
}

async function fillPlan(page: Page, plan: MirrorPlan) {
  await page.getByRole('textbox', { name: '시작 E.G.O 기프트', exact: true }).fill(plan.startingGifts);
  await page.getByRole('textbox', { name: '시작 기프트 메모', exact: true }).fill(plan.startingGiftNotes);
  for (const row of plan.floors) {
    await page.getByRole('textbox', { name: `${row.floor}층 테마팩`, exact: true }).fill(row.themePack);
    await page.getByRole('textbox', { name: `${row.floor}층 메모`, exact: true }).fill(row.notes);
  }
  for (const change of plan.skillChanges) {
    const member = members.find(member => member.id === change.identityId)!;
    for (const skill of [1, 2, 3] as const) {
      const count = change[`skill${skill}`];
      await skillCount(page, member, skill).fill(count === null ? '' : String(count));
    }
    await page.getByRole('textbox', { name: `${memberName(member)} 스킬 변경 메모`, exact: true }).fill(change.notes);
  }
}

async function expectPlanInputs(page: Page, plan: MirrorPlan) {
  await expect(page.getByRole('textbox', { name: '시작 E.G.O 기프트', exact: true })).toHaveValue(plan.startingGifts);
  await expect(page.getByRole('textbox', { name: '시작 기프트 메모', exact: true })).toHaveValue(plan.startingGiftNotes);
  for (const row of plan.floors) {
    await expect(page.getByRole('textbox', { name: `${row.floor}층 테마팩`, exact: true })).toHaveValue(row.themePack);
    await expect(page.getByRole('textbox', { name: `${row.floor}층 메모`, exact: true })).toHaveValue(row.notes);
  }
  for (const change of plan.skillChanges) {
    const member = members.find(member => member.id === change.identityId)!;
    for (const skill of [1, 2, 3] as const) {
      const count = change[`skill${skill}`];
      await expect(skillCount(page, member, skill)).toHaveValue(count === null ? '' : String(count));
    }
    await expect(page.getByRole('textbox', { name: `${memberName(member)} 스킬 변경 메모`, exact: true })).toHaveValue(change.notes);
  }
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('전용 거울던전 화면에서 편성과 기프트와 1~15층 공략 및 스킬 개수를 저장하고 백업으로 복원한다', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const name = '15층 거울던전 공략';
  const plan = mirrorPlan();
  await openMirror(page);
  await page.getByRole('button', { name: '새 거울던전 기록', exact: true }).click();
  await expect(page.getByRole('heading', { name: '새 거울던전 덱 기록', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill(name);
  await expect(page.getByRole('combobox', { name: '스토리 티어', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '거울던전 덱으로 분류', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: '거울던전 티어', exact: true }).selectOption('S');
  for (const member of members) await page.getByRole('checkbox', { name: memberName(member), exact: true }).check();
  await fillPlan(page, plan);
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(mirrorCard(page, name)).toBeVisible();
  expect((await storedNotebook(page)).entries.some(entry => entry.name === name)).toBe(false);
  expect((await storedNotebook(page)).mirrorArchive?.decks.find(entry => entry.name === name)).toMatchObject({ memberIds: members.map(member => member.id), tier: 'S', plan });
  await page.reload();
  await expect(page).toHaveURL(/#mirror-dungeon$/);
  await mirrorCard(page, name).click();
  for (const text of [plan.startingGifts, plan.startingGiftNotes, plan.floors[0].themePack, plan.floors[0].notes, plan.floors[14].themePack, plan.floors[14].notes, ...plan.skillChanges.map(change => change.notes)]) {
    await expect(page.getByRole('dialog').getByText(text, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expectPlanInputs(page, plan);
  await closeDialog(page);
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  const backupPath = testInfo.outputPath('mirror-plan-backup.json');
  const backup = await downloadNotebook(page, backupPath);
  expect(backup.mirrorArchive?.decks.find(entry => entry.name === name)?.plan).toEqual(plan);
  await editMirror(page, name);
  await page.getByRole('textbox', { name: '시작 E.G.O 기프트', exact: true }).fill('복원 전에 수정한 기프트');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles(backupPath);
  await expect(page.getByRole('button', { name: '가져오기 확인', exact: true })).toBeVisible();
  expect((await storedNotebook(page)).mirrorArchive?.decks.find(entry => entry.name === name)?.plan.startingGifts).toBe('복원 전에 수정한 기프트');
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await page.reload();
  expect((await storedNotebook(page)).mirrorArchive?.decks.find(entry => entry.name === name)?.plan).toEqual(plan);
  await editMirror(page, name);
  await expectPlanInputs(page, plan);
});

test('기존 겸용 덱을 별도 거울던전 기록으로 옮긴 뒤 편성과 메모와 티어와 추천을 양쪽에서 독립적으로 편집한다', async ({ page }) => {
  test.setTimeout(60_000);
  const plan = mirrorPlan();
  const deck = deckFixture('mirror-membership', '인격별 스킬 보존 공략', { contentIds: ['story', 'mirror'], mirrorPlan: plan, description: '기존 겸용 덱 요약', recommendedEgoIds: [egos[0].id] });
  deck.tiers.story = 'A';
  deck.tiers.mirror = 'B';
  await setNotebook(page, [deck, ...memberFixtures(), ...egoFixtures()]);
  await openMirror(page);
  await editMirror(page, deck.name);
  await expect(page.getByRole('textbox', { name: '거울던전 설명', exact: true })).toHaveValue(deck.description);
  await expect(page.getByRole('combobox', { name: '거울던전 티어', exact: true })).toHaveValue('B');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const generalBefore = (await storedNotebook(page)).entries;
  await editMirror(page, deck.name);
  await page.getByRole('textbox', { name: '거울던전 설명', exact: true }).fill('거울던전에서만 바꾼 요약');
  await page.getByRole('combobox', { name: '거울던전 티어', exact: true }).selectOption('S');
  await page.getByRole('checkbox', { name: memberName(egos[0]), exact: true }).uncheck();
  await page.getByRole('checkbox', { name: memberName(egos[1]), exact: true }).check();
  await page.getByRole('button', { name: `${memberName(members[1])} 앞으로 이동`, exact: true }).click();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect((await storedNotebook(page)).entries).toEqual(generalBefore);
  expect((await storedNotebook(page)).mirrorArchive?.decks.find(entry => entry.id === deck.id)).toMatchObject({ memberIds: [members[1].id, members[0].id], description: '거울던전에서만 바꾼 요약', tier: 'S', recommendedEgoIds: [egos[1].id], plan });
  await editMirror(page, deck.name);
  await page.getByRole('button', { name: `${memberName(members[0])} 편성에서 제외`, exact: true }).click();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  expect((await storedNotebook(page)).entries).toEqual(generalBefore);
  expect((await storedNotebook(page)).mirrorArchive?.decks.find(entry => entry.id === deck.id)).toMatchObject({ memberIds: [members[1].id], plan });
  await editMirror(page, deck.name);
  await page.getByRole('checkbox', { name: memberName(members[0]), exact: true }).check();
  await expectPlanInputs(page, plan);
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const mirrorBefore = (await storedNotebook(page)).mirrorArchive;
  await openGeneral(page, '덱');
  await page.getByRole('button', { name: `${deck.name} 상세 보기`, exact: true }).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '시작 E.G.O 기프트', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '거울던전 티어', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '기록 요약', exact: true })).toHaveValue(deck.description);
  await page.getByRole('textbox', { name: '기록 요약', exact: true }).fill('일반 덱 화면에서 수정한 요약');
  await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('C');
  await page.getByRole('button', { name: `${memberName(members[1])} 편성에서 제외`, exact: true }).click();
  await page.getByRole('checkbox', { name: memberName(egos[0]), exact: true }).uncheck();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  expect((await storedNotebook(page)).entries.find(entry => entry.id === deck.id)).toMatchObject({ description: '일반 덱 화면에서 수정한 요약', memberIds: [members[0].id], recommendedEgoIds: [], tiers: { story: 'C' } });
  expect((await storedNotebook(page)).mirrorArchive).toEqual(mirrorBefore);
  await openMirror(page);
  await editMirror(page, deck.name);
  await expectPlanInputs(page, plan);
  await closeDialog(page);
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await page.getByRole('button', { name: '일반 덱에서 복사', exact: true }).click();
  await page.getByRole('button', { name: `${deck.name} 편성 가져오기`, exact: true }).click();
  await expect(page.getByRole('textbox', { name: '거울던전 설명', exact: true })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: '거울던전 티어', exact: true })).toHaveValue('unrated');
  const order = page.getByRole('list', { name: '인격 편성 순서', exact: true });
  expect(await order.locator('li[data-entry-id]').evaluateAll(items => items.map(item => item.getAttribute('data-entry-id')))).toEqual([members[0].id]);
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('일반 편성의 독립 복사');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect((await storedNotebook(page)).mirrorArchive?.decks.find(entry => entry.name === '일반 편성의 독립 복사')).toMatchObject({ memberIds: [members[0].id], description: '', tier: 'unrated' });
});

test('기존 거울던전 전용 덱과 평가를 한 번만 옮기고 잘못된 공략 백업을 거부한다', async ({ page }, testInfo) => {
  const deck = deckFixture('legacy-mirror-plan', '기존 거울던전 덱', {
    memberIds: [members[1].id, members[0].id], formationCode: 'LEGACY-MIRROR-01',
    description: '기존 거울던전 요약', strengths: '이전 덱의 장점', operation: '이전 덱의 운용 메모',
  });
  deck.tiers.mirror = 'S';
  const { mirrorPlan: _mirrorPlan, contentIds: _contentIds, ...legacy } = deck;
  const identities = memberFixtures();
  identities[0].tiers.mirror = 'A';
  identities[0].strengths = '이전 거울던전 평가의 장점';
  await setNotebook(page, [legacy, ...identities]);
  await openMirror(page);
  await mirrorCard(page, deck.name).click();
  for (const text of [deck.description, deck.strengths, deck.operation, deck.formationCode]) await expect(page.getByRole('dialog').getByText(text, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  const order = page.getByRole('list', { name: '인격 편성 순서', exact: true });
  expect(await order.locator('li[data-entry-id]').evaluateAll(items => items.map(item => item.getAttribute('data-entry-id')))).toEqual(deck.memberIds);
  await closeDialog(page);
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  const backupPath = testInfo.outputPath('migrated-mirror-archive.json');
  const migrated = await downloadNotebook(page, backupPath);
  expect(migrated.entries.some(entry => entry.id === deck.id)).toBe(false);
  expect(migrated.mirrorArchive?.decks).toHaveLength(1);
  expect(migrated.mirrorArchive?.decks[0]).toMatchObject({ id: deck.id, memberIds: deck.memberIds, description: deck.description, strengths: deck.strengths, operation: deck.operation, formationCode: deck.formationCode, tier: 'S' });
  expect(migrated.mirrorArchive?.decks[0].plan.floors).toHaveLength(15);
  expect(migrated.mirrorArchive?.decks[0].plan.floors.every(row => row.themePack === '' && row.notes === '')).toBe(true);
  expect(migrated.mirrorArchive?.evaluations).toEqual([expect.objectContaining({ entryId: members[0].id, tier: 'A', strengths: identities[0].strengths })]);
  const original = await page.evaluate(key => localStorage.getItem(key), storageKey);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const invalid = structuredClone(migrated);
  invalid.mirrorArchive!.decks[0].plan.floors = [{ floor: 1, themePack: '잘못된 층 구성', notes: '' }];
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles({ name: 'invalid-mirror-plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '가져오기 확인', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(original);
  await closeDialog(page);
  await page.reload();
  await expect(mirrorCard(page, deck.name)).toBeVisible();
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await page.reload();
  const preserved = await storedNotebook(page);
  expect(preserved.entries.some(entry => entry.id === deck.id)).toBe(false);
  expect(preserved.mirrorArchive?.decks).toHaveLength(1);
  expect(preserved.mirrorArchive?.evaluations).toHaveLength(1);
  expect(preserved.mirrorArchive).toEqual(migrated.mirrorArchive);
});

test('인격과 E.G.O.의 거울던전 평가와 추천을 일반 평가와 양방향으로 분리한다', async ({ page }) => {
  test.setTimeout(60_000);
  const entries = [...memberFixtures(), ...egoFixtures()];
  await setNotebook(page, entries, { decks: [], evaluations: [] });
  for (const [record, kind] of [[members[0], '인격'], [egos[0], 'E.G.O.']] as const) {
    await openMirror(page);
    await mirrorKind(page, kind);
    await page.getByRole('button', { name: `${memberName(record)} 거울던전 평가 작성/수정`, exact: true }).click();
    for (const label of ['한 줄 소개', '설명', '장점', '단점', '운용 방법']) {
      await page.getByRole('textbox', { name: `거울던전 ${label}`, exact: true }).fill(`${kind} 거울던전 ${label} 기록`);
    }
    await page.getByRole('combobox', { name: '거울던전 티어', exact: true }).selectOption('S');
    if (kind === '인격') await page.getByRole('checkbox', { name: memberName(egos[1]), exact: true }).check();
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    const afterMirror = await storedNotebook(page);
    expect(afterMirror.entries.find(entry => entry.id === record.id)).toEqual(entries.find(entry => entry.id === record.id));
    expect(afterMirror.mirrorArchive?.evaluations.find(evaluation => evaluation.entryId === record.id)).toMatchObject({ tier: 'S', subtitle: `${kind} 거울던전 한 줄 소개 기록`, description: `${kind} 거울던전 설명 기록`, strengths: `${kind} 거울던전 장점 기록`, weaknesses: `${kind} 거울던전 단점 기록`, operation: `${kind} 거울던전 운용 방법 기록`, ...(kind === '인격' ? { recommendedEgoIds: [egos[1].id] } : {}) });
    const mirrorBefore = afterMirror.mirrorArchive;
    await openGeneral(page, kind);
    await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(memberName(record));
    await page.getByRole('button', { name: `${memberName(record)} 상세 보기`, exact: true }).click();
    await page.getByRole('button', { name: '평가 작성', exact: true }).click();
    await expect(page.getByRole('combobox', { name: '거울던전 티어', exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '장점', exact: true })).toHaveValue('');
    await page.getByRole('textbox', { name: '장점', exact: true }).fill(`${kind} 일반 평가의 장점`);
    await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('C');
    if (kind === '인격') await page.getByRole('checkbox', { name: memberName(egos[0]), exact: true }).check();
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    await page.reload();
    expect((await storedNotebook(page)).mirrorArchive).toEqual(mirrorBefore);
    expect((await storedNotebook(page)).entries.find(entry => entry.id === record.id)).toMatchObject({ strengths: `${kind} 일반 평가의 장점`, tiers: { story: 'C', mirror: 'unrated' }, ...(kind === '인격' ? { recommendedEgoIds: [egos[0].id] } : {}) });
    await openMirror(page);
    await mirrorKind(page, kind);
    await mirrorCard(page, memberName(record)).click();
    await expect(page.getByRole('dialog').getByText(`${kind} 거울던전 장점 기록`, { exact: true })).toBeVisible();
    await closeDialog(page);
  }
});

test('390px 모바일 화면에서 거울던전 목록과 편집과 긴 공략 상세에 가로 넘침이 없다', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const name = '모바일 거울던전 기록';
  const longText = '긴공략기록'.repeat(35);
  const assertFits = async () => {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (await page.getByRole('dialog').count()) {
      await expect.poll(() => page.getByRole('dialog').evaluate(element => element.getBoundingClientRect().right <= window.innerWidth && element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  };
  await openMirror(page);
  await assertFits();
  await page.getByRole('button', { name: '새 거울던전 기록', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill(name);
  for (const member of members) await page.getByRole('checkbox', { name: memberName(member), exact: true }).check();
  await page.getByRole('textbox', { name: '시작 E.G.O 기프트', exact: true }).fill(longText);
  await page.getByRole('textbox', { name: '15층 테마팩', exact: true }).fill(longText);
  await page.getByRole('textbox', { name: '15층 메모', exact: true }).fill(longText);
  await skillCount(page, members[0], 1).fill('0');
  await assertFits();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await assertFits();
  await mirrorCard(page, name).click();
  await expect(page.getByRole('dialog').getByText(longText, { exact: true }).first()).toBeVisible();
  await assertFits();
  await closeDialog(page);
  for (const [record, kind] of [[members[0], '인격'], [egos[0], 'E.G.O.']] as const) {
    await mirrorKind(page, kind);
    await assertFits();
    await page.getByRole('button', { name: `${memberName(record)} 거울던전 평가 작성/수정`, exact: true }).click();
    for (const label of ['한 줄 소개', '설명', '장점']) {
      await page.getByRole('textbox', { name: `거울던전 ${label}`, exact: true }).fill(longText);
    }
    await page.getByRole('combobox', { name: '거울던전 티어', exact: true }).selectOption('S');
    await assertFits();
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    await assertFits();
    const views = page.getByRole('group', { name: /^거울던전 (?:인격|E\.G\.O) 보기 방식$/ });
    await views.getByRole('button', { name: '티어리스트', exact: true }).click();
    await assertFits();
    await views.getByRole('button', { name: '전체 기록', exact: true }).click();
    await assertFits();
    await mirrorCard(page, memberName(record)).click();
    await expect(page.getByRole('dialog').getByText(longText, { exact: true }).first()).toBeVisible();
    await assertFits();
    await closeDialog(page);
  }
});
