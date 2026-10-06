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
    description: '', strengths: '', weaknesses: '', operation: '', recommendedEgoIds: [], deckIds: [], memberIds: [], formationCode: '',
    tiers: { story: 'unrated', luxcavation: 'unrated', mirror: 'unrated', simulation: 'unrated', railway1: 'unrated', railway2: 'unrated', railway6: 'unrated' },
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...changes,
  };
}

async function setNotebook(page: Page, entries: LibraryEntry[]) {
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
  await page.getByRole('textbox', { name: /^태그/ }).fill('개인 테스트, 조합 검토');
  await page.getByRole('textbox', { name: '기록 요약', exact: true }).fill('콘텐츠마다 다른 티어를 저장한 기록입니다.');
  await page.getByRole('textbox', { name: '장점', exact: true }).fill('장점 기록');
  await page.getByRole('textbox', { name: '단점', exact: true }).fill('단점 기록');
  await page.getByRole('textbox', { name: '운용 방법', exact: true }).fill('운용 기록');
  await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('S');
  await page.getByRole('combobox', { name: '거울던전 티어', exact: true }).selectOption('C');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await search(page).fill(name);
  await expect(identityCard(page, name)).toBeVisible();
}

async function closeDialog(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
}

async function openTierArchive(page: Page) {
  await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: '티어 아카이브', exact: true }).click();
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
  await page.getByRole('textbox', { name: /^태그/ }).fill('개인 공식 평가');
  await page.getByRole('combobox', { name: '스토리 티어', exact: true }).selectOption('S');
  await page.getByRole('combobox', { name: '거울던전 티어', exact: true }).selectOption('B');
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

test('기존 v1 개인 메모와 티어와 덱 연결을 보존하면서 공식 목록을 추가한다', async ({ page }) => {
  const identityId = 'demo-identity-1';
  const deckId = 'legacy-my-deck';
  const identity = fixtureEntry('identity', identityId, '이전 개인 인격', {
    strengths: '이전 버전에서 작성한 장점', deckIds: [deckId],
    tiers: { story: 'A', luxcavation: 'unrated', mirror: 'S', simulation: 'unrated', railway1: 'B', railway2: 'unrated', railway6: 'unrated' },
  });
  await setNotebook(page, [identity, fixtureEntry('deck', deckId, '이전 개인 덱', { memberIds: [identityId], formationCode: 'LEGACY-KEEP-01' })]);
  await expect(kindTab(page, 'identity')).toContainText('190');
  await expect(kindTab(page, 'ego')).toContainText('116');
  await search(page).fill(identity.name);
  await openTierArchive(page);
  await expect(page.getByRole('region', { name: 'A 티어', exact: true }).getByRole('button', { name: `${identity.name} 상세 보기`, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '거울던전', exact: true }).click();
  await expect(page.getByRole('region', { name: 'S 티어', exact: true }).getByRole('button', { name: `${identity.name} 상세 보기`, exact: true })).toBeVisible();
  await identityCard(page, identity.name).click();
  await expect(page.getByRole('dialog').getByText(identity.strengths, { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /이전 개인 덱/ }).click();
  await expect(page.getByRole('dialog').getByText('LEGACY-KEEP-01', { exact: true })).toBeVisible();
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
});

test('개인 인격 기록과 콘텐츠별 티어는 새로고침 뒤에도 유지된다', async ({ page }) => {
  await createIdentity(page);
  await openTierArchive(page);
  await expect(page.getByRole('region', { name: 'S 티어', exact: true }).getByRole('button', { name: `${identityName} 상세 보기`, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '거울던전', exact: true }).click();
  await expect(page.getByRole('region', { name: 'C 티어', exact: true }).getByRole('button', { name: `${identityName} 상세 보기`, exact: true })).toBeVisible();
  await page.reload();
  await search(page).fill(identityName);
  await openTierArchive(page);
  await page.getByRole('tab', { name: '거울던전', exact: true }).click();
  await expect(page.getByRole('region', { name: 'C 티어', exact: true }).getByRole('button', { name: `${identityName} 상세 보기`, exact: true })).toBeVisible();
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

test('검색과 기록 종류와 일곱 콘텐츠별 티어를 함께 적용한다', async ({ page }) => {
  await createIdentity(page);
  await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(1);
  await kindTab(page, 'ego').click();
  await expect(identityCard(page)).toHaveCount(0);
  await kindTab(page, 'deck').click();
  await expect(identityCard(page)).toHaveCount(0);
  await kindTab(page, 'identity').click();
  await search(page).fill('개인 테스트');
  await expect(identityCard(page)).toBeVisible();
  await expect(page.getByRole('button', { name: / 상세 보기$/ })).toHaveCount(1);
  await search(page).fill('존재하지 않는 검색 결과');
  await expect(identityCard(page)).toHaveCount(0);
  await search(page).fill(identityName);
  await openTierArchive(page);
  for (const [content, tier] of [['스토리', 'S'], ['경험치 · 끈 채광', '미평가'], ['거울던전', 'C'], ['사영전투', '미평가'], ['1호선', '미평가'], ['2호선', '미평가'], ['6호선', '미평가']]) {
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
  const oldBackup: LibraryData = { version: 1, entries: backup.entries.filter(entry => !entry.id.startsWith('catalog-')) };
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
