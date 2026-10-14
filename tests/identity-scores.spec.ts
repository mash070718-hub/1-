import { expect, test, type Page } from '@playwright/test';
import { createCatalogLibrary, createMirrorEvaluation, type LibraryData } from '../src/lib/library';
import { draftKey, mockCloud } from './mock-cloud';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

function fixture() {
  const data = createCatalogLibrary();
  const identity = data.entries.find(entry => entry.kind === 'identity')!;
  identity.description = '기존 평가 보존';
  identity.tiers.story = 'A';
  identity.scores = { story: 16.5, luxcavation: 8, simulation: 27, railway1: 6, railway2: 7, railway6: 8.5, mirror: 99 };
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

test('native content limits, existing points and selected railway survive save, reload and public reading', async ({ page, browser }) => {
  const { data, identity, name } = fixture();
  const store = await setup(page, data);
  await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
  await page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).click();
  await expect(total(page)).toContainText('종합점수: 88 / 100점');
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.getByText(/배점 환산|100점으로 환산|÷/)).toHaveCount(0);
  for (const [label, max, value] of [
    ['스토리', 20, 16.5], ['경험치 · 끈 채광', 10, 8], ['사영전투', 30, 27],
    ['1호선', 10, 6], ['2호선', 10, 7], ['6호선', 10, 8.5],
  ] as const) {
    const input = page.getByRole('spinbutton', { name: `${label} 점수`, exact: true });
    await expect(input).toHaveAttribute('max', String(max));
    await expect(input).toHaveValue(String(value));
  }
  await page.getByRole('combobox', { name: '종합점수에 사용할 거굴철 노선', exact: true }).selectOption('railway1');
  await expect(total(page)).toContainText('종합점수: 85.5 / 100점');
  const story = page.getByRole('spinbutton', { name: '스토리 점수', exact: true });
  await story.fill('20.1');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(await story.evaluate((element: HTMLInputElement) => element.validity.rangeOverflow)).toBe(true);
  await story.fill('16.5');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const stored = await saved(page);
  const storedIdentity = stored.entries.find(entry => entry.id === identity.id)!;
  expect(storedIdentity.scores).toEqual(identity.scores);
  expect(storedIdentity.scoreRailway).toBe('railway1');
  expect(storedIdentity.tiers.story).toBe('A');
  expect(stored.mirrorArchive).toEqual(data.mirrorArchive);
  await page.reload();
  await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
  await page.getByRole('button', { name: `${name} 상세 보기`, exact: true }).click();
  await expect(total(page)).toContainText('종합점수: 85.5 / 100점');
  await expect(total(page)).toContainText('거굴철 1호선 기준');
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
  await expect(total(visitor)).toContainText('종합점수: 85.5 / 100점');
  await expect(total(visitor)).toContainText('거굴철 1호선 기준');
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
  await expect(total(page)).toContainText('4 / 5개 콘텐츠 평가 완료');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const stored = await saved(page);
  expect(stored.entries.find(entry => entry.id === identity.id)).toEqual(identity);
  expect(stored.mirrorArchive?.evaluations[0]).toMatchObject({ score: null, tier: 'B', description: '거울던전 메모 보존' });
});
