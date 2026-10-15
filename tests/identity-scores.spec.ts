import { expect, test, type Page } from '@playwright/test';
import { createCatalogLibrary, createMirrorEvaluation, type LibraryData } from '../src/lib/library';
import { draftKey, mockCloud } from './mock-cloud';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

function fixture() {
  const data = createCatalogLibrary();
  const identity = data.entries.find(entry => entry.kind === 'identity')!;
  identity.description = '기존 평가 보존';
  identity.tiers.story = 'A';
  identity.overallTier = 'A';
  identity.scores = { story: 16.5, luxcavation: 8, simulation: 27, railway1: 6, railway2: 7, railway6: 8.5, railway: 8.5, mirror: 99 };
  data.mirrorArchive = { decks: [], evaluations: [{ ...createMirrorEvaluation(identity.id), score: 28, tier: 'B', description: '거울던전 메모 보존' }] };
  return { data, identity, name: `${identity.name} ${identity.sinner}` };
}

async function setup(page: Page, data: LibraryData) {
  const store = { data, revision: 1 };
  await mockCloud(page.context(), store);
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({
    access_token: 'admin-test-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600,
  })));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  return store;
}

const total = (page: Page) => page.getByRole('region', { name: '인격 종합점수', exact: true });
const saved = (page: Page): Promise<LibraryData> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), draftKey);

test('native content limits, existing points and unified railway survive save, reload and public reading', async ({ page, browser }) => {
  const { data, identity, name } = fixture();
  delete (identity.tiers as Partial<typeof identity.tiers>).railway;
  delete identity.scores!.railway;
  identity.tiers.railway6 = 'A';
  identity.scores!.railway1 = 80;
  const store = await setup(page, data);
  await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
  await page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).click();
  await expect(total(page)).toContainText('종합점수: 88 / 100점');
  await expect(total(page)).not.toContainText(/호선|선택한 노선/);
  const tierStrip = page.locator('.detail-tier-strip');
  await expect(tierStrip.locator('.detail-tier-cell > span')).toHaveText(['스토리', '채광', '사영전투', '거굴철']);
  await expect(tierStrip.locator('.detail-tier-cell').last()).toContainText('A');
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.getByText(/배점 환산|100점으로 환산|÷/)).toHaveCount(0);
  for (const [label, max, value] of [
    ['스토리', 20, 16.5], ['경험치 · 끈 채광', 10, 8], ['사영전투', 30, 27],
    ['거울굴절철도', 10, 8.5],
    ['거울던전', 30, 28],
  ] as const) {
    const input = page.getByRole('spinbutton', { name: `${label} 점수`, exact: true });
    await expect(input).toHaveAttribute('max', String(max));
    await expect(input).toHaveValue(String(value));
  }
  await expect(page.getByRole('combobox', { name: '종합점수에 사용할 거굴철 노선', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: /[126]호선 점수/ })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '거울굴절철도 티어', exact: true })).toHaveValue('A');
  await page.getByRole('spinbutton', { name: '거울굴절철도 점수', exact: true }).fill('6');
  await expect(total(page)).toContainText('종합점수: 85.5 / 100점');
  const story = page.getByRole('spinbutton', { name: '스토리 점수', exact: true });
  await story.fill('20.1');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(await story.evaluate((element: HTMLInputElement) => element.validity.rangeOverflow)).toBe(true);
  await story.fill('16.5');
  const mirrorScore = page.getByRole('spinbutton', { name: '거울던전 점수', exact: true });
  await mirrorScore.fill('30.01');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(await mirrorScore.evaluate((element: HTMLInputElement) => element.validity.rangeOverflow)).toBe(true);
  await mirrorScore.fill('27.25');
  await expect(total(page)).toContainText('종합점수: 84.75 / 100점');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const stored = await saved(page);
  const storedIdentity = stored.entries.find(entry => entry.id === identity.id)!;
  expect(storedIdentity.scores).toEqual({ ...identity.scores, railway: 6 });
  expect(storedIdentity.tiers.story).toBe('A');
  expect(storedIdentity.tiers).toEqual({ ...identity.tiers, railway: 'A' });
  expect(stored.mirrorArchive?.evaluations[0]).toEqual({ ...data.mirrorArchive!.evaluations[0], score: 27.25, scoreScale: 'content-v1' });
  await expect(page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).locator('.score-label')).toHaveText('종합 84.75 / 100점');
  await page.reload();
  await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
  await page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).click();
  await expect(total(page)).toContainText('종합점수: 84.75 / 100점');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '공개 게시 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '게시하기', exact: true })).toBeDisabled();
  const visitorContext = await browser.newContext();
  await mockCloud(visitorContext, store);
  const visitor = await visitorContext.newPage();
  await visitor.goto('/');
  await visitor.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
  await visitor.getByRole('button', { name: `${name} 상세 보기`, exact: true }).click();
  await expect(total(visitor)).toContainText('종합점수: 84.75 / 100점');
  await expect(visitor.getByRole('button', { name: '기록 수정', exact: true })).toHaveCount(0);
  await visitorContext.close();
});

test('mirror accepts native points and keeps zero, blank, general scores and tier independent', async ({ page }) => {
  const { data, identity, name } = fixture();
  await setup(page, data);
  await page.getByRole('navigation', { name: '거울던전 메뉴', exact: true }).getByRole('button', { name: '거울던전', exact: true }).click();
  await page.getByRole('tab', { name: '인격', exact: true }).click();
  const edit = page.getByRole('button', { name: `${name} 거울던전 평가 작성/수정`, exact: true });
  await edit.click();
  const score = page.getByRole('spinbutton', { name: '거울던전 점수', exact: true });
  await expect(score).toHaveAttribute('max', '30');
  await expect(score).toHaveValue('28');
  await score.fill('30.5');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(await score.evaluate((element: HTMLInputElement) => element.validity.rangeOverflow)).toBe(true);
  await score.fill('0');
  await expect(total(page)).toContainText('종합점수: 60 / 100점');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect((await saved(page)).mirrorArchive?.evaluations[0].score).toBe(0);
  await edit.click();
  await score.fill('');
  await expect(total(page)).toContainText('입력한 점수 합계: 60 / 100점');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const stored = await saved(page);
  expect(stored.entries.find(entry => entry.id === identity.id)).toEqual(identity);
  expect(stored.mirrorArchive?.evaluations[0]).toMatchObject({ score: null, tier: 'B', description: '거울던전 메모 보존' });
});

test('general cards and compact tiers display and sort totals instead of the selected content score', async ({ page }, testInfo) => {
  const { data, identity, name } = fixture();
  const other = data.entries.filter(entry => entry.kind === 'identity' && entry.id !== identity.id).slice(0, 4);
  const [lowerTotal, zero, blank, tied] = other;
  other.forEach(entry => { entry.tiers.story = 'A'; entry.overallTier = 'A'; });
  lowerTotal.scores = { story: 20 }; // Better story score, lower total than the first identity's 88.
  zero.scores = { story: 0 };
  tied.scores = { story: 20 };
  await setup(page, data);
  const expectedNames = [identity, lowerTotal, tied, zero, blank].map(entry => entry.name);
  await expect(page.locator('.archive-grid .entry-title').first()).toHaveText(identity.name);
  expect((await page.locator('.archive-grid .entry-title').allTextContents()).slice(0, 5)).toEqual(expectedNames);
  await expect(page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).locator('.score-label')).toHaveText('종합 88 / 100점');
  await expect(page.getByRole('button', { name: `${lowerTotal.name} ${lowerTotal.sinner} 상세 보기`, exact: true }).locator('.score-label')).toHaveText('합계 20 / 100점');
  await page.locator('.archive-grid .entry-card').first().screenshot({ path: testInfo.outputPath('total-card.png') });
  await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: '티어리스트', exact: true }).click();
  const profiles = page.locator('.tier-row[data-tier="A"] .tier-profile');
  expect(await profiles.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))).toEqual(
    [identity, lowerTotal, tied, zero, blank].map(entry => `${entry.name} ${entry.sinner} 상세 보기`));
  await expect(profiles.first()).toHaveText('88 / 100점');
  await expect(profiles.nth(3)).toContainText('0 / 100점');
  await expect(profiles.nth(4)).toHaveText('미입력');
  await page.locator('.tier-row[data-tier="A"]').screenshot({ path: testInfo.outputPath('total-tier.png') });
});

test('mirror-only changes in the general editor can be discarded and a new mirror score is shared both ways', async ({ page }) => {
  const { data, identity, name } = fixture();
  data.mirrorArchive!.evaluations = [];
  await setup(page, data);
  const openGeneral = async () => {
    await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: /^전체 기록/ }).click();
    await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
    await page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).click();
    await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  };
  await openGeneral();
  const mirrorScore = page.getByRole('spinbutton', { name: '거울던전 점수', exact: true });
  await expect(mirrorScore).toHaveValue('');
  await mirrorScore.fill('25');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장하지 않고 닫기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '저장하지 않고 닫기', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBeNull();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(mirrorScore).toHaveValue('');
  await mirrorScore.fill('0');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect((await saved(page)).mirrorArchive!.evaluations).toEqual([{ ...createMirrorEvaluation(identity.id), score: 0, scoreScale: 'content-v1' }]);
  await page.getByRole('navigation', { name: '거울던전 메뉴', exact: true }).getByRole('button', { name: '거울던전', exact: true }).click();
  await page.getByRole('tab', { name: '인격', exact: true }).click();
  await page.getByRole('button', { name: `${name} 거울던전 평가 작성/수정`, exact: true }).click();
  await expect(mirrorScore).toHaveValue('0');
  await mirrorScore.fill('24.5');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await openGeneral();
  await expect(mirrorScore).toHaveValue('24.5');
  await mirrorScore.fill('');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const restored = await saved(page);
  expect(restored.mirrorArchive?.evaluations[0].score).toBeNull();
  expect(restored.entries.find(entry => entry.id === identity.id)?.scores).toEqual(identity.scores);
});
