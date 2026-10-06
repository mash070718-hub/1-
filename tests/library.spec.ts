import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { CatalogRecord } from '../src/lib/catalog';
import type { LibraryData, LibraryEntry } from '../src/lib/library';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as {
  metadata: { counts: { identity: number; ego: number } };
  entries: CatalogRecord[];
};
const storageKey = 'library-of-limbus:v1';
const sinners = ['이상', '파우스트', '돈키호테', '료슈', '뫼르소', '홍루', '히스클리프', '이스마엘', '로쟈', '싱클레어', '오티스', '그레고르'];
const identityName = '테스트 인격';
const identityCard = (page: Page, name = identityName) => page.getByRole('button', { name: `${name} 상세 보기`, exact: true });
const catalogCard = (page: Page, record: CatalogRecord) => page.getByRole('button', { name: `${record.name} ${record.sinner} 상세 보기`, exact: true });
const search = (page: Page) => page.getByPlaceholder('이름, 수감자, 태그로 검색');
const kindTab = (page: Page, kind: 'identity' | 'ego' | 'deck') => page.getByRole('tab', {
  name: { identity: /^인격(?:\s*\d+)?$/, ego: /^E\.G\.O\.(?:\s*\d+)?$/, deck: /^덱(?:\s*\d+)?$/ }[kind],
});

function fixtureEntry(kind: LibraryEntry['kind'], id: string, name: string, changes: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id, kind, name, sinner: kind === 'deck' ? '' : '이상', subtitle: '', affinity: '', tags: [],
    description: '', strengths: '', weaknesses: '', operation: '', recommendedEgoIds: [], deckIds: [], memberIds: [], contentIds: [], mirrorPlan: null, formationCode: '',
    tiers: { story: 'unrated', luxcavation: 'unrated', mirror: 'unrated', simulation: 'unrated', railway1: 'unrated', railway2: 'unrated', railway6: 'unrated' },
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...changes,
  };
}

function legacyEntry(entry: LibraryEntry): Omit<LibraryEntry, 'contentIds' | 'mirrorPlan'> {
  const { contentIds: _contentIds, mirrorPlan: _mirrorPlan, ...legacy } = entry;
  return legacy;
}

async function setNotebook(page: Page, entries: (LibraryEntry | Omit<LibraryEntry, 'contentIds' | 'mirrorPlan'>)[]) {
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: storageKey, data: { version: 1, entries } });
  await page.reload();
}

async function storedNotebook(page: Page): Promise<LibraryData> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
}

async function createIdentity(page: Page, name = identityName) {
  await kindTab(page, 'identity').click();
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: '새 인격 기록', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill(name);
  await page.getByRole('combobox', { name: '수감자', exact: true }).selectOption({ label: '이상' });
  await page.getByRole('textbox', { name: '한 줄 소개', exact: true }).fill('개인 평가를 위한 기록');
  await page.getByRole('dialog').getByRole('region', { name: '게임 태그 선택', exact: true }).getByRole('button', { name: '참격', exact: true }).click();
  await page.getByRole('dialog').getByRole('region', { name: '게임 태그 선택', exact: true }).getByRole('button', { name: '화상', exact: true }).click();
  await page.getByRole('textbox', { name: '기록 요약', exact: true }).fill('콘텐츠마다 다른 티어를 저장한 기록입니다.');
  await page.getByRole('textbox', { name: '장점', exact: true }).fill('장점 기록');
  await page.getByRole('textbox', { name: '단점', exact: true }).fill('단점 기록');
  await page.getByRole('textbox', { name: '운용 방법', exact: true }).fill('운용 기록');
  await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('S');
  await expect(page.getByRole('combobox', { name: '거울던전 티어', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await search(page).fill(name);
  await expect(identityCard(page, name)).toBeVisible();
}

async function closeDialog(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
}

async function openTierArchive(page: Page) {
  await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: '티어리스트', exact: true }).click();
}

async function downloadNotebook(page: Page, path: string): Promise<LibraryData> {
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 다운로드', exact: true }).click();
  await (await downloadPromise).saveAs(path);
  const data: LibraryData = JSON.parse(await readFile(path, 'utf8'));
  await closeDialog(page);
  return data;
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('공식 목록은 인격 189개와 E.G.O 116개이며 모든 수감자의 이름과 이미지를 보여준다', async ({ page }) => {
  test.setTimeout(60_000);
  await expect(page.getByRole('heading', { name: 'Library of Limbus', exact: true })).toBeVisible();
  expect(catalog.metadata.counts).toEqual({ identity: 189, ego: 116 });
  expect(catalog.entries).toHaveLength(305);
  expect(new Set(catalog.entries.map(record => record.id)).size).toBe(305);
  await expect(kindTab(page, 'identity')).toContainText(String(catalog.metadata.counts.identity));
  await expect(kindTab(page, 'ego')).toContainText(String(catalog.metadata.counts.ego));
  const sinnerTabs = page.getByRole('tablist', { name: '수감자', exact: true });
  await expect(sinnerTabs.getByRole('tab')).toHaveCount(13);
  await expect(sinnerTabs.getByRole('tab', { name: '전체 수감자', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const kind of ['identity', 'ego'] as const) {
    await kindTab(page, kind).click();
    for (const sinner of sinners) {
      await sinnerTabs.getByRole('tab', { name: sinner, exact: true }).click();
      const records = catalog.entries.filter(record => record.kind === kind && record.sinner === sinner);
      expect(records.length).toBeGreaterThan(0);
      await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(records.length);
      for (const record of records) {
        const card = catalogCard(page, record);
        await expect(card).toHaveCount(1);
        await expect(card.locator('img')).toHaveAttribute('src', record.thumbnail);
      }
      const image = catalogCard(page, records[0]).locator('img');
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
  }
});

test('공식 인격을 평가하고 수정한 뒤 초기화해도 공식 목록과 덱 연결은 유지된다', async ({ page }) => {
  const record = catalog.entries.find(record => record.kind === 'identity' && record.sinner === '이상')!;
  const deckId = 'legacy-reset-deck';
  await setNotebook(page, [
    fixtureEntry('identity', record.id, record.name, { sinner: record.sinner, tags: record.tags, deckIds: [deckId] }),
    fixtureEntry('deck', deckId, '초기화 보존 덱', { memberIds: [record.id], formationCode: 'KEEP-DECK-01' }),
  ]);
  await search(page).fill(record.name);
  await catalogCard(page, record).click();
  await page.getByRole('button', { name: '평가 작성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '수정할 인격 기록', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^이름/ })).toHaveValue(record.name);
  await expect(page.getByRole('textbox', { name: /^이름/ })).toHaveAttribute('readonly', '');
  await page.getByRole('textbox', { name: '장점', exact: true }).fill('공식 인격에 대한 나의 장점 평가');
  await page.getByRole('textbox', { name: '단점', exact: true }).fill('공식 인격에 대한 주의점');
  await page.getByRole('textbox', { name: '운용 방법', exact: true }).fill('매 턴 자원을 확인한다');
  await page.getByRole('dialog').getByRole('region', { name: '게임 태그 선택', exact: true }).getByRole('button', { name: '분노', exact: true }).click();
  await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('S');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  await search(page).fill(record.name);
  await catalogCard(page, record).click();
  await expect(page.getByRole('dialog').getByText('공식 인격에 대한 나의 장점 평가', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('textbox', { name: '장점', exact: true }).fill('다시 검토한 장점 평가');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await catalogCard(page, record).click();
  await expect(page.getByRole('dialog').getByText('다시 검토한 장점 평가', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '평가 초기화', exact: true }).click();
  await expect(page.getByRole('button', { name: '초기화 확인', exact: true })).toBeVisible();
  expect((await storedNotebook(page)).entries.find(entry => entry.id === record.id)?.strengths).toBe('다시 검토한 장점 평가');
  await page.getByRole('button', { name: '초기화 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await expect(catalogCard(page, record)).toBeVisible();
  const reset = (await storedNotebook(page)).entries.find(entry => entry.id === record.id)!;
  expect(reset.strengths).toBe('');
  expect(reset.weaknesses).toBe('');
  expect(reset.operation).toBe('');
  expect(Object.values(reset.tiers)).toEqual(Array(7).fill('unrated'));
  expect(reset.deckIds).toEqual([deckId]);
  await page.reload();
  await search(page).fill(record.name);
  await catalogCard(page, record).click();
  await page.getByRole('dialog').getByRole('button', { name: /초기화 보존 덱/ }).click();
  await expect(page.getByRole('dialog').getByText('KEEP-DECK-01', { exact: true })).toBeVisible();
});

test('contentIds 없는 기존 v1 메모와 티어와 덱 편성 순서를 보존한다', async ({ page }, testInfo) => {
  const identityId = 'demo-identity-1';
  const deckId = 'legacy-my-deck';
  const secondId = 'legacy-second-identity';
  const thirdId = 'legacy-third-identity';
  const memberIds = [thirdId, identityId, secondId];
  const identity = fixtureEntry('identity', identityId, '이전 개인 인격', {
    strengths: '이전 버전에서 작성한 장점', tags: ['이전 자유 태그'], deckIds: [deckId],
    tiers: { story: 'A', luxcavation: 'unrated', mirror: 'S', simulation: 'unrated', railway1: 'B', railway2: 'unrated', railway6: 'unrated' },
  });
  const oldDeck = fixtureEntry('deck', deckId, '이전 개인 덱', {
    memberIds, formationCode: 'LEGACY-KEEP-01', strengths: '이전 덱의 장점 메모',
    tiers: { story: 'A', luxcavation: 'unrated', mirror: 'S', simulation: 'unrated', railway1: 'unrated', railway2: 'unrated', railway6: 'unrated' },
  });
  await setNotebook(page, [
    identity,
    fixtureEntry('identity', secondId, '이전 두 번째 인격', { deckIds: [deckId] }),
    fixtureEntry('identity', thirdId, '이전 세 번째 인격', { deckIds: [deckId] }),
    oldDeck,
  ].map(legacyEntry));
  await expect(kindTab(page, 'identity')).toContainText('192');
  await expect(kindTab(page, 'ego')).toContainText('116');
  await search(page).fill(identity.name);
  await openTierArchive(page);
  await expect(page.getByRole('region', { name: 'A 티어', exact: true }).getByRole('button', { name: `${identity.name} 상세 보기`, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '1호선', exact: true }).click();
  await expect(page.getByRole('region', { name: 'B 티어', exact: true }).getByRole('button', { name: `${identity.name} 상세 보기`, exact: true })).toBeVisible();
  await identityCard(page, identity.name).click();
  await expect(page.getByRole('dialog').getByText(identity.strengths, { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /이전 개인 덱/ }).click();
  await expect(page.getByRole('dialog').getByText('LEGACY-KEEP-01', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText(oldDeck.strengths, { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /이전 개인 인격/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: identity.name, exact: true })).toBeVisible();
  await closeDialog(page);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('이전 버전 기록을 보존했습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '예시 기록 지우기', exact: true })).toHaveCount(0);
  await closeDialog(page);
  await page.reload();
  await search(page).fill(identity.name);
  await identityCard(page, identity.name).click();
  await expect(page.getByRole('dialog').getByText(identity.strengths, { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /이전 개인 덱/ }).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  const order = page.getByRole('list', { name: '인격 편성 순서', exact: true });
  expect(await order.locator('li[data-entry-id]').evaluateAll(items => items.map(item => item.getAttribute('data-entry-id')))).toEqual(memberIds);
  await expect(page.getByRole('checkbox', { name: '스토리 덱으로 분류', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '거울던전 덱으로 분류', exact: true })).toHaveCount(0);
  await closeDialog(page);
  const backup = await downloadNotebook(page, testInfo.outputPath('migrated-v1-notebook.json'));
  expect(backup.entries.find(entry => entry.id === identityId)).toMatchObject({ strengths: identity.strengths, tags: identity.tags, tiers: identity.tiers });
  expect(backup.entries.find(entry => entry.id === deckId)).toMatchObject({ memberIds, strengths: oldDeck.strengths, formationCode: oldDeck.formationCode, contentIds: ['story', 'mirror'] });
  expect(backup.mirrorArchive?.decks.find(entry => entry.id === deckId)).toMatchObject({ memberIds, strengths: oldDeck.strengths, formationCode: oldDeck.formationCode, tier: 'S' });
  expect(backup.mirrorArchive?.evaluations.find(entry => entry.entryId === identityId)).toMatchObject({ tier: 'S', strengths: identity.strengths });
});

test('개인 인격 기록과 콘텐츠별 티어는 새로고침 뒤에도 유지된다', async ({ page }) => {
  await createIdentity(page);
  await openTierArchive(page);
  await expect(page.getByRole('region', { name: 'S 티어', exact: true }).getByRole('button', { name: `${identityName} 상세 보기`, exact: true })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '콘텐츠', exact: true }).getByRole('tab')).toHaveCount(6);
  await expect(page.getByRole('tab', { name: '거울던전', exact: true })).toHaveCount(0);
  await page.reload();
  await search(page).fill(identityName);
  await openTierArchive(page);
  await expect(page.getByRole('region', { name: 'S 티어', exact: true }).getByRole('button', { name: `${identityName} 상세 보기`, exact: true })).toBeVisible();
  await identityCard(page).click();
  for (const note of ['장점 기록', '단점 기록', '운용 기록']) await expect(page.getByRole('dialog').getByText(note, { exact: true })).toBeVisible();
});

test('개인 기록을 수정하고 삭제 확인 후에만 지울 수 있다', async ({ page }) => {
  await createIdentity(page);
  await identityCard(page).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('수정된 인격');
  await page.getByRole('textbox', { name: '장점', exact: true }).fill('수정된 장점 기록');
  await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('B');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await search(page).fill('수정된 인격');
  await expect(identityCard(page)).toHaveCount(0);
  await openTierArchive(page);
  await expect(page.getByRole('region', { name: 'B 티어', exact: true }).getByRole('button', { name: '수정된 인격 상세 보기', exact: true })).toBeVisible();
  await identityCard(page, '수정된 인격').click();
  await expect(page.getByRole('dialog').getByText('수정된 장점 기록', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click();
  await expect(page.getByRole('button', { name: '삭제 확인', exact: true })).toBeVisible();
  await expect(identityCard(page, '수정된 인격')).toHaveCount(1);
  await page.getByRole('button', { name: '삭제 확인', exact: true }).click();
  await expect(identityCard(page, '수정된 인격')).toHaveCount(0);
  await page.reload();
  await search(page).fill('수정된 인격');
  await expect(identityCard(page, '수정된 인격')).toHaveCount(0);
});

test('검색과 기록 종류와 여섯 일반 콘텐츠별 티어를 함께 적용한다', async ({ page }) => {
  await createIdentity(page);
  await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(1);
  await kindTab(page, 'ego').click();
  await expect(identityCard(page)).toHaveCount(0);
  await kindTab(page, 'deck').click();
  await expect(identityCard(page)).toHaveCount(0);
  await kindTab(page, 'identity').click();
  await search(page).fill('참격 화상');
  await expect(identityCard(page)).toBeVisible();
  await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(1);
  await search(page).fill('존재하지 않는 검색 결과');
  await expect(identityCard(page)).toHaveCount(0);
  await search(page).fill(identityName);
  await openTierArchive(page);
  for (const [content, tier] of [['스토리', 'S'], ['경험치 · 끈 채광', '미평가'], ['사영전투', '미평가'], ['1호선', '미평가'], ['2호선', '미평가'], ['6호선', '미평가']]) {
    await page.getByRole('tab', { name: content, exact: true }).click();
    await expect(page.getByRole('region', { name: `${tier} 티어`, exact: true }).getByRole('button', { name: `${identityName} 상세 보기`, exact: true })).toBeVisible();
  }
});

test('추천 E.G.O와 덱을 연결하고 편성번호와 연결 기록을 열 수 있다', async ({ page }) => {
  await createIdentity(page);
  await kindTab(page, 'ego').click();
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('테스트 E.G.O');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await search(page).fill('테스트 E.G.O');
  await expect(identityCard(page, '테스트 E.G.O')).toBeVisible();
  await kindTab(page, 'deck').click();
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('테스트 덱');
  await page.getByRole('checkbox', { name: identityName, exact: true }).check();
  await page.getByRole('checkbox', { name: '테스트 E.G.O', exact: true }).check();
  await page.getByRole('textbox', { name: /^편성번호/ }).fill('MY-FORMATION-01');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await kindTab(page, 'identity').click();
  await search(page).fill(identityName);
  await identityCard(page).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('checkbox', { name: '테스트 E.G.O', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '테스트 덱', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  await search(page).fill(identityName);
  await identityCard(page).click();
  await page.getByRole('dialog').getByRole('button', { name: /테스트 E\.G\.O/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '테스트 E.G.O', exact: true })).toBeVisible();
  await closeDialog(page);
  await identityCard(page).click();
  await page.getByRole('dialog').getByRole('button', { name: /테스트 덱/ }).click();
  await expect(page.getByRole('dialog').getByText('MY-FORMATION-01', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /테스트 인격/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: identityName, exact: true })).toBeVisible();
});

test('덱 편성은 사용 덱에 자동 연결되고 해제도 양쪽에 반영한다', async ({ page }) => {
  await createIdentity(page);
  await kindTab(page, 'deck').click();
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('자동 연결 덱');
  await page.getByRole('checkbox', { name: identityName, exact: true }).check();
  await page.getByRole('textbox', { name: /^편성번호/ }).fill('AUTO-FORMATION-02');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await kindTab(page, 'identity').click();
  await search(page).fill(identityName);
  await identityCard(page).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /자동 연결 덱/ })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('AUTO-FORMATION-02', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('checkbox', { name: '자동 연결 덱', exact: true }).uncheck();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await kindTab(page, 'deck').click();
  await page.getByRole('tab', { name: '전체 수감자', exact: true }).click();
  await identityCard(page, '자동 연결 덱').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /테스트 인격/ })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('편성 인격을 연결해 주세요.', { exact: true })).toBeVisible();
});

test('백업 복원은 확인 뒤 실행하고 잘못된 JSON은 기존 기록을 보존한다', async ({ page }, testInfo) => {
  await createIdentity(page);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 다운로드', exact: true }).click();
  const backupPath = testInfo.outputPath('library-backup.json');
  await (await downloadPromise).saveAs(backupPath);
  const backup: LibraryData = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.entries).toHaveLength(306);
  expect(backup.entries.some(entry => entry.name === identityName)).toBe(true);
  expect(backup.entries.filter(entry => entry.id.startsWith('catalog-'))).toHaveLength(305);
  await closeDialog(page);
  await createIdentity(page, '백업 이후의 기록');
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles(backupPath);
  await expect(page.getByRole('button', { name: '가져오기 확인', exact: true })).toBeVisible();
  expect((await storedNotebook(page)).entries.some(entry => entry.name === '백업 이후의 기록')).toBe(true);
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await search(page).fill(identityName);
  await expect(identityCard(page)).toBeVisible();
  expect((await storedNotebook(page)).entries.some(entry => entry.name === '백업 이후의 기록')).toBe(false);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid JSON') });
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '가져오기 확인', exact: true })).toHaveCount(0);
  await closeDialog(page);
  await page.reload();
  await search(page).fill(identityName);
  await expect(identityCard(page)).toBeVisible();
  expect((await storedNotebook(page)).entries).toHaveLength(306);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const oldBackup = { version: 1, entries: backup.entries.filter(entry => !entry.id.startsWith('catalog-')).map(legacyEntry) };
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles({
    name: 'legacy-v1-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldBackup)),
  });
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await expect(identityCard(page)).toBeVisible();
  expect((await storedNotebook(page)).entries.filter(entry => entry.id.startsWith('catalog-'))).toHaveLength(305);
});

test('손상된 저장소 원본을 보존하고 정상 백업으로 복구할 수 있다', async ({ page }, testInfo) => {
  await createIdentity(page);
  const validBackup = await page.evaluate(key => localStorage.getItem(key), storageKey);
  expect(validBackup).not.toBeNull();
  const corrupted = '{ damaged original library';
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: corrupted });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('원본은 그대로 보존했습니다');
  await expect(identityCard(page)).toHaveCount(0);
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('저장되면 안 되는 기록');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('원본 기록을 먼저 백업');
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(corrupted);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '저장하지 않고 닫기', exact: true }).click();
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const rawDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장소 원본 다운로드', exact: true }).click();
  const rawPath = testInfo.outputPath('damaged-original.json');
  await (await rawDownload).saveAs(rawPath);
  expect(await readFile(rawPath, 'utf8')).toBe(corrupted);
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles({ name: 'recovery.json', mimeType: 'application/json', buffer: Buffer.from(validBackup!) });
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await closeDialog(page);
  await search(page).fill(identityName);
  await expect(identityCard(page)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await search(page).fill(identityName);
  await expect(identityCard(page)).toBeVisible();
});

test('좁은 모바일 화면에서도 공식 목록과 기록 편집에 가로 넘침이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Library of Limbus', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await createIdentity(page);
  await identityCard(page).click();
  await expect(page.getByRole('dialog').getByText('장점 기록', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await closeDialog(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('작성 중 닫기 확인에서 계속 작성하거나 변경을 버릴 수 있다', async ({ page }) => {
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  const nameInput = page.getByRole('textbox', { name: '이름', exact: true });
  await nameInput.fill('저장하지 않은 인격');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  const continueButton = page.getByRole('button', { name: '계속 작성', exact: true });
  await expect(continueButton).toBeInViewport();
  await expect(page.getByText('작성 중인 내용을 닫을까요? 저장하지 않은 변경은 사라집니다.', { exact: true })).toBeVisible();
  await continueButton.click();
  await expect(nameInput).toHaveValue('저장하지 않은 인격');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  const discardButton = page.getByRole('button', { name: '저장하지 않고 닫기', exact: true });
  await expect(discardButton).toBeInViewport();
  await discardButton.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await search(page).fill('저장하지 않은 인격');
  await expect(identityCard(page, '저장하지 않은 인격')).toHaveCount(0);
});

test('게임 태그를 분류별로 선택하고 기타 두 태그와 기존 태그를 보존한다', async ({ page }) => {
  const name = '게임 태그 선택 테스트';
  await setNotebook(page, [fixtureEntry('identity', 'custom-tags-test', name, { tags: ['이전 자유 태그'] })]);
  await search(page).fill(name);
  await identityCard(page, name).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  const picker = page.getByRole('dialog').getByRole('region', { name: '게임 태그 선택', exact: true });
  await expect(page.getByRole('textbox', { name: /^태그/ })).toHaveCount(0);
  const existingTag = picker.getByRole('group', { name: '기존 태그', exact: true }).getByRole('button', { name: '이전 자유 태그', exact: true });
  await expect(existingTag).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('group', { name: '유형', exact: true }).getByRole('button', { name: '참격', exact: true }).click();
  await picker.getByRole('group', { name: '속성', exact: true }).getByRole('button', { name: '분노', exact: true }).click();
  await picker.getByRole('group', { name: '스킬키워드', exact: true }).getByRole('button', { name: '화상', exact: true }).click();
  const other = picker.getByRole('group', { name: '기타', exact: true });
  await expect(other.getByRole('button')).toHaveCount(35);
  expect((await other.getByRole('button').allTextContents()).slice(-2)).toEqual(['르루주', '르누아르']);
  await expect(other.getByRole('button', { name: '이전 자유 태그', exact: true })).toHaveCount(0);
  for (const name of ['르루주', '르누아르']) await other.getByRole('button', { name, exact: true }).click();
  await expect(picker.getByText('선택 6 / 최대 10개', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.reload();
  await search(page).fill(name);
  await identityCard(page, name).click();
  const tags = ['이전 자유 태그', '참격', '분노', '화상', '르루주', '르누아르'];
  for (const tag of tags) await expect(page.getByRole('dialog').getByText(tag, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  for (const tag of tags) await expect(picker.getByRole('button', { name: tag, exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await storedNotebook(page)).entries.find(entry => entry.name === name)?.tags).toEqual(tags);
});

test('공식 인격의 덱 편성 순서와 1번 표지는 저장과 새로고침과 백업에도 유지된다', async ({ page }, testInfo) => {
  const name = '공식 인격 순서 테스트 덱';
  const members = ['이상', '파우스트', '돈키호테'].map(sinner => catalog.entries.find(record => record.kind === 'identity' && record.sinner === sinner)!);
  const ordered = [members[2], members[0], members[1]];
  await kindTab(page, 'deck').click();
  await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill(name);
  for (const member of members) await page.getByRole('checkbox', { name: `${member.name} ${member.sinner}`, exact: true }).check();
  const order = page.getByRole('list', { name: '인격 편성 순서', exact: true });
  expect(await order.locator('li[data-entry-id]').evaluateAll(items => items.map(item => item.getAttribute('data-entry-id')))).toEqual(members.map(member => member.id));
  const moveForward = page.getByRole('button', { name: `${members[2].name} ${members[2].sinner} 앞으로 이동`, exact: true });
  await moveForward.click();
  await moveForward.click();
  await expect(order.locator('li[data-position="1"]')).toHaveAttribute('data-entry-id', members[2].id);
  await expect(order.locator('li[data-position="1"]').getByText('덱 표지', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '스토리 덱으로 분류', exact: true }).check();
  await page.getByRole('textbox', { name: /^편성번호/ }).fill('ORDER-KEEP-01');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const coverName = `${name} 덱 표지 · 1번 편성 ${members[2].sinner} ${members[2].name}`;
  await expect(identityCard(page, name).getByRole('img', { name: coverName, exact: true })).toHaveAttribute('src', members[2].thumbnail);
  expect((await storedNotebook(page)).entries.find(entry => entry.name === name)?.memberIds).toEqual(ordered.map(member => member.id));
  await page.reload();
  await kindTab(page, 'deck').click();
  await search(page).fill(name);
  await expect(identityCard(page, name).getByRole('img', { name: coverName, exact: true })).toHaveAttribute('src', members[2].thumbnail);
  await identityCard(page, name).click();
  await expect(page.getByRole('dialog').getByText('ORDER-KEEP-01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  expect(await order.locator('li[data-entry-id]').evaluateAll(items => items.map(item => item.getAttribute('data-entry-id')))).toEqual(ordered.map(member => member.id));
  await closeDialog(page);
  const backup = await downloadNotebook(page, testInfo.outputPath('deck-order-backup.json'));
  expect(backup.entries.find(entry => entry.name === name)).toMatchObject({ memberIds: ordered.map(member => member.id), contentIds: ['story'], formationCode: 'ORDER-KEEP-01' });
});

test('덱의 사용 콘텐츠를 선택하면 콘텐츠 분류와 철도 호선에 맞게 조회된다', async ({ page }) => {
  test.setTimeout(60_000);
  const decks = [
    { name: '채광 분류 덱', contents: ['경험치 · 끈 채광'] },
    { name: '스토리 분류 덱', contents: ['스토리'] },
    { name: '1호선 분류 덱', contents: ['1호선'] },
    { name: '2호선 분류 덱', contents: ['2호선'] },
    { name: '6호선 분류 덱', contents: ['6호선'] },
    { name: '중복 콘텐츠 덱', contents: ['스토리', '1호선'] },
  ];
  for (const deck of decks) {
    await kindTab(page, 'deck').click();
    await page.getByRole('button', { name: '새 기록', exact: true }).first().click();
    await page.getByRole('textbox', { name: '이름', exact: true }).fill(deck.name);
    const contents = page.getByRole('group', { name: '사용 콘텐츠', exact: true });
    for (const content of deck.contents) await contents.getByRole('checkbox', { name: `${content} 덱으로 분류`, exact: true }).check();
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    await expect(identityCard(page, deck.name)).toBeVisible();
  }
  const nav = page.getByRole('navigation', { name: '콘텐츠별 덱', exact: true });
  for (const [category, expectedNames] of [
    ['채광', ['채광 분류 덱']],
    ['스토리', ['스토리 분류 덱', '중복 콘텐츠 덱']],
    ['거울굴절철도', ['1호선 분류 덱', '2호선 분류 덱', '6호선 분류 덱', '중복 콘텐츠 덱']],
  ] as [string, string[]][]) {
    await nav.getByRole('button', { name: category, exact: true }).click();
    await expect(kindTab(page, 'deck')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(expectedNames.length);
    for (const name of expectedNames) await expect(identityCard(page, name)).toBeVisible();
  }
  const contentTabs = page.getByRole('tablist', { name: '콘텐츠', exact: true });
  await expect(contentTabs.getByRole('tab', { name: '전체 호선', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const [line, expectedNames] of [
    ['1호선', ['1호선 분류 덱', '중복 콘텐츠 덱']],
    ['2호선', ['2호선 분류 덱']],
    ['6호선', ['6호선 분류 덱']],
  ] as [string, string[]][]) {
    await contentTabs.getByRole('tab', { name: line, exact: true }).click();
    await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(expectedNames.length);
    for (const name of expectedNames) await expect(identityCard(page, name)).toBeVisible();
  }
  await contentTabs.getByRole('tab', { name: '전체 호선', exact: true }).click();
  await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(4);
  await page.reload();
  await nav.getByRole('button', { name: '채광', exact: true }).click();
  await expect(identityCard(page, '채광 분류 덱')).toBeVisible();
  await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(1);
});

test('철도 전체 호선의 평가 필터는 2호선과 6호선도 함께 확인한다', async ({ page }) => {
  const railway2 = fixtureEntry('deck', 'rated-railway2', '2호선 평가 덱', { contentIds: ['railway2'] });
  railway2.tiers.railway2 = 'S';
  const railway6 = fixtureEntry('deck', 'unrated-railway6', '6호선 미평가 덱', { contentIds: ['railway6'] });
  await setNotebook(page, [railway2, railway6]);
  await page.getByRole('navigation', { name: '콘텐츠별 덱' }).getByRole('button', { name: '거울굴절철도', exact: true }).click();
  await page.getByRole('combobox', { name: '기록 상태', exact: true }).selectOption('rated');
  await expect(identityCard(page, railway2.name)).toBeVisible();
  await expect(identityCard(page, railway6.name)).toHaveCount(0);
  await page.getByRole('combobox', { name: '기록 상태', exact: true }).selectOption('unrated');
  await expect(identityCard(page, railway2.name)).toHaveCount(0);
  await expect(identityCard(page, railway6.name)).toBeVisible();
});

test('기존 한쪽 덱 연결의 표지는 목록과 상세에서 같은 인격을 사용한다', async ({ page }) => {
  const member = catalog.entries.find(record => record.kind === 'identity')!;
  const deck = fixtureEntry('deck', 'one-sided-cover', '이전 한쪽 연결 덱', { contentIds: ['story'] });
  const identity = fixtureEntry('identity', member.id, member.name, { sinner: member.sinner, deckIds: [deck.id] });
  await setNotebook(page, [legacyEntry(identity), legacyEntry(deck)]);
  await kindTab(page, 'deck').click();
  const coverName = `${deck.name} 덱 표지 · 1번 편성 ${member.sinner} ${member.name}`;
  await expect(identityCard(page, deck.name).getByRole('img', { name: coverName, exact: true })).toHaveAttribute('src', member.thumbnail);
  await identityCard(page, deck.name).click();
  await expect(page.getByRole('dialog').getByRole('img', { name: coverName, exact: true })).toHaveAttribute('src', member.image);
});

test('덱과 인격 편집 양쪽에서 7명 편성의 신규 추가 제한이 적용된다', async ({ page }) => {
  const members = sinners.slice(0, 8).map(sinner => catalog.entries.find(record => record.kind === 'identity' && record.sinner === sinner)!);
  const deck = fixtureEntry('deck', 'full-seven-deck', '7명 편성 덱', { memberIds: members.slice(0, 7).map(member => member.id) });
  await setNotebook(page, [deck, ...members.map((member, index) => fixtureEntry('identity', member.id, member.name, { sinner: member.sinner, deckIds: index < 7 ? [deck.id] : [] }))]);
  await kindTab(page, 'deck').click();
  await identityCard(page, deck.name).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: `${members[7].name} ${members[7].sinner}`, exact: true })).toBeDisabled();
  await closeDialog(page);
  await closeDialog(page);
  await kindTab(page, 'identity').click();
  await search(page).fill(`${members[7].name} ${members[7].sinner}`);
  await catalogCard(page, members[7]).click();
  await page.getByRole('button', { name: '평가 작성', exact: true }).click();
  await page.getByRole('textbox', { name: '사용 덱 연결 검색', exact: true }).fill(deck.name);
  await expect(page.getByRole('checkbox', { name: deck.name, exact: true })).toBeDisabled();
  expect((await storedNotebook(page)).entries.find(entry => entry.id === deck.id)?.memberIds).toEqual(members.slice(0, 7).map(member => member.id));
});

test('게임 태그 필터는 선택한 태그를 모두 가진 덱을 찾는다', async ({ page }) => {
  const match = fixtureEntry('deck', 'tag-filter-match', '르루주 화상 덱', { tags: ['화상', '르루주'] });
  const other = fixtureEntry('deck', 'tag-filter-other', '다른 화상 덱', { tags: ['화상'] });
  await setNotebook(page, [match, other]);
  await kindTab(page, 'deck').click();
  await page.locator('.tag-filter-panel summary').click();
  const picker = page.locator('.tag-filter-panel').getByRole('region', { name: '게임 태그 선택', exact: true });
  await picker.getByRole('button', { name: '화상', exact: true }).click();
  await expect(identityCard(page, match.name)).toBeVisible();
  await expect(identityCard(page, other.name)).toBeVisible();
  await picker.getByRole('button', { name: '르루주', exact: true }).click();
  await expect(identityCard(page, match.name)).toBeVisible();
  await expect(identityCard(page, other.name)).toHaveCount(0);
  await page.getByRole('button', { name: '태그 필터 초기화', exact: true }).click();
  await expect(identityCard(page, other.name)).toBeVisible();
});
