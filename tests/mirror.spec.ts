import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { CatalogRecord } from '../src/lib/catalog';
import type { LibraryData, LibraryEntry, MirrorPlan } from '../src/lib/library';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as { entries: CatalogRecord[] };
const members = ['이상', '파우스트'].map(sinner => catalog.entries.find(record => record.kind === 'identity' && record.sinner === sinner)!);
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

async function openMirror(page: Page) {
  await page.getByRole('navigation', { name: '거울던전 메뉴', exact: true }).getByRole('button', { name: '거울던전', exact: true }).click();
  await expect(page).toHaveURL(/#mirror-dungeon$/);
  await expect(page.getByRole('heading', { name: '거울던전', exact: true, level: 1 })).toBeVisible();
}

async function closeDialog(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
}

async function storedNotebook(page: Page): Promise<LibraryData> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
}

async function setNotebook(page: Page, entries: unknown[]) {
  await page.evaluate(({ key, entries }) => localStorage.setItem(key, JSON.stringify({ version: 1, entries })), { key: storageKey, entries });
  await page.reload();
}

async function editMirror(page: Page, name: string) {
  await mirrorCard(page, name).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
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
  await page.getByRole('textbox', { name: '이름', exact: true }).fill(name);
  for (const member of members) await page.getByRole('checkbox', { name: memberName(member), exact: true }).check();
  await fillPlan(page, plan);
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(mirrorCard(page, name)).toBeVisible();
  expect((await storedNotebook(page)).entries.find(entry => entry.name === name)).toMatchObject({ memberIds: members.map(member => member.id), contentIds: ['mirror'], mirrorPlan: plan });
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
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 다운로드', exact: true }).click();
  const backupPath = testInfo.outputPath('mirror-plan-backup.json');
  await (await downloadPromise).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as LibraryData;
  expect(backup.entries.find(entry => entry.name === name)?.mirrorPlan).toEqual(plan);
  await closeDialog(page);
  await editMirror(page, name);
  await page.getByRole('textbox', { name: '시작 E.G.O 기프트', exact: true }).fill('복원 전에 수정한 기프트');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles(backupPath);
  await expect(page.getByRole('button', { name: '가져오기 확인', exact: true })).toBeVisible();
  expect((await storedNotebook(page)).entries.find(entry => entry.name === name)?.mirrorPlan?.startingGifts).toBe('복원 전에 수정한 기프트');
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await page.reload();
  expect((await storedNotebook(page)).entries.find(entry => entry.name === name)?.mirrorPlan).toEqual(plan);
  await editMirror(page, name);
  await expectPlanInputs(page, plan);
});

test('편성 순서를 바꾸거나 인격을 제외했다가 다시 넣어도 인격별 스킬 기록과 일반 덱 메모를 유지한다', async ({ page }) => {
  const plan = mirrorPlan();
  const deck = deckFixture('mirror-membership', '인격별 스킬 보존 공략', { mirrorPlan: plan, description: '기존 덱 요약' });
  await setNotebook(page, [deck, ...memberFixtures()]);
  await openMirror(page);
  await editMirror(page, deck.name);
  await page.getByRole('button', { name: `${memberName(members[1])} 앞으로 이동`, exact: true }).click();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect((await storedNotebook(page)).entries.find(entry => entry.id === deck.id)).toMatchObject({ memberIds: [members[1].id, members[0].id], mirrorPlan: plan });
  await editMirror(page, deck.name);
  await page.getByRole('button', { name: `${memberName(members[0])} 편성에서 제외`, exact: true }).click();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  expect((await storedNotebook(page)).entries.find(entry => entry.id === deck.id)).toMatchObject({ memberIds: [members[1].id], mirrorPlan: plan });
  await editMirror(page, deck.name);
  await page.getByRole('checkbox', { name: memberName(members[0]), exact: true }).check();
  await expectPlanInputs(page, plan);
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: /^전체 기록/ }).click();
  await expect(page).not.toHaveURL(/#mirror-dungeon$/);
  await page.getByRole('tab', { name: /^덱(?:\s*\d+)?$/ }).click();
  await page.getByRole('button', { name: `${deck.name} 상세 보기`, exact: true }).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('textbox', { name: '기록 요약', exact: true }).fill('일반 덱 화면에서 수정한 요약');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  expect((await storedNotebook(page)).entries.find(entry => entry.id === deck.id)).toMatchObject({ description: '일반 덱 화면에서 수정한 요약', memberIds: [members[1].id, members[0].id], mirrorPlan: plan });
  await openMirror(page);
  await editMirror(page, deck.name);
  await expectPlanInputs(page, plan);
});

test('공략이 없는 기존 거울던전 덱의 메모와 편성을 보존하고 잘못된 공략 백업을 거부한다', async ({ page }) => {
  const deck = deckFixture('legacy-mirror-plan', '기존 거울던전 덱', {
    memberIds: [members[1].id, members[0].id], formationCode: 'LEGACY-MIRROR-01',
    description: '기존 거울던전 요약', strengths: '이전 덱의 장점', operation: '이전 덱의 운용 메모',
  });
  deck.tiers.mirror = 'S';
  const { mirrorPlan: _mirrorPlan, contentIds: _contentIds, ...legacy } = deck;
  await setNotebook(page, [legacy, ...memberFixtures()]);
  await openMirror(page);
  await mirrorCard(page, deck.name).click();
  for (const text of [deck.description, deck.strengths, deck.operation, deck.formationCode]) await expect(page.getByRole('dialog').getByText(text, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  const order = page.getByRole('list', { name: '인격 편성 순서', exact: true });
  expect(await order.locator('li[data-entry-id]').evaluateAll(items => items.map(item => item.getAttribute('data-entry-id')))).toEqual(deck.memberIds);
  await closeDialog(page);
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  const original = await page.evaluate(key => localStorage.getItem(key), storageKey);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const invalid = { version: 1, entries: [{ ...deck, mirrorPlan: { ...mirrorPlan(), floors: [{ floor: 1, themePack: '잘못된 층 구성', notes: '' }] } }, ...memberFixtures()] };
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles({ name: 'invalid-mirror-plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '가져오기 확인', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(original);
  await closeDialog(page);
  await page.reload();
  await expect(mirrorCard(page, deck.name)).toBeVisible();
  const preserved = (await storedNotebook(page)).entries.find(entry => entry.id === deck.id)!;
  expect(preserved).toMatchObject({ memberIds: deck.memberIds, description: deck.description, strengths: deck.strengths, operation: deck.operation, formationCode: deck.formationCode });
  expect(preserved.mirrorPlan ?? null).toBeNull();
});

test('390px 모바일 화면에서 거울던전 목록과 편집과 긴 공략 상세에 가로 넘침이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = '모바일 거울던전 기록';
  const longText = '긴공략기록'.repeat(35);
  const assertFits = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (await page.getByRole('dialog').count()) {
      expect(await page.getByRole('dialog').evaluate(element => element.getBoundingClientRect().right <= window.innerWidth && element.scrollWidth <= element.clientWidth)).toBe(true);
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
});
