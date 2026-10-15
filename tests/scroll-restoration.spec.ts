import { expect, test, type Locator, type Page } from '@playwright/test';
import { createCatalogLibrary, createMirrorEvaluation } from '../src/lib/library';
import { draftKey, mockCloud } from './mock-cloud';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  const data = createCatalogLibrary();
  const identities = data.entries.filter(entry => entry.kind === 'identity');
  identities.forEach((entry, index) => {
    entry.tiers.story = 'A'; entry.overallTier = 'A'; entry.scores = { story: 19.8 - index / 10 };
    entry.description = '스크롤 보존 평가';
  });
  data.mirrorArchive = { decks: [], evaluations: identities.map((entry, index) => ({
    ...createMirrorEvaluation(entry.id), tier: 'A', score: 29.7 - index / 10, description: '거울던전 스크롤 보존 평가',
  })) };
  await mockCloud(page.context(), { data, revision: 1 });
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({
    access_token: 'admin-test-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600,
  })));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
});

async function generalTierList(page: Page) {
  await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: '티어리스트', exact: true }).click();
  await page.locator('.tier-row[data-tier="A"] .show-more').click();
  await expect(page.locator('.tier-profile')).toHaveCount(96);
}

async function openAtCurrentPosition(page: Page, button: Locator) {
  await button.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(1000);
  await button.click();
  return y;
}

async function expectPosition(page: Page, y: number) {
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Let focus restoration, scroll anchoring and the next paint all settle.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y, 0);
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
}

for (const destination of ['S', 'B']) {
  test(`changing tier directly on a mobile list card to ${destination} preserves the viewport`, async ({ page }) => {
    await page.getByRole('navigation', { name: '도서관 메뉴', exact: true }).getByRole('button', { name: /^전체 기록/ }).click();
    await page.getByRole('button', { name: '다음 24개 보기', exact: true }).click();
    await expect(page.locator('.archive-grid .entry-card')).toHaveCount(48);
    const card = page.locator('.archive-grid .entry-card').nth(35);
    const tier = card.getByRole('combobox');
    const name = await tier.getAttribute('aria-label');
    await tier.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    // A native mobile picker keeps its select focused while the card is moved.
    await tier.focus();
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(1000);
    await tier.selectOption(destination);
    await expectPosition(page, y);
    await expect(page.locator('.archive-grid .entry-card')).toHaveCount(48);
    const moved = page.getByRole('combobox', { name: name!, exact: true });
    await expect(moved).not.toBeInViewport();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).entries, draftKey);
    expect(saved.filter((entry: { kind: string; overallTier: string }) =>
      entry.kind === 'identity' && entry.overallTier === destination)).toHaveLength(1);
    expect(saved.filter((entry: { kind: string; tiers: { story: string } }) =>
      entry.kind === 'identity').every((entry: { tiers: { story: string } }) => entry.tiers.story === 'A')).toBe(true);
    // Verify that the viewport remains usable after restoration.
    await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y + 100, 0);
  });
}

for (const destination of ['A', 'S']) {
  test(`saving a mobile identity keeps the list position after moving within/to tier ${destination}`, async ({ page }) => {
    await generalTierList(page);
    const original = page.locator('.tier-profile').nth(60);
    const name = await original.getAttribute('aria-label');
    const y = await openAtCurrentPosition(page, original);
    await page.getByRole('button', { name: '기록 수정', exact: true }).click();
    await page.getByRole('spinbutton', { name: '스토리 점수', exact: true }).fill('20');
    await page.getByRole('combobox', { name: '종합 티어', exact: true }).selectOption(destination);
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    await expect(page.getByPlaceholder('이름, 수감자, 태그로 검색')).toHaveValue('');
    await expect(page.getByRole('tab', { name: '전체 수감자', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.tier-row[data-tier="A"] .tier-profile')).toHaveCount(96);
    await expectPosition(page, y);
    const moved = page.getByRole('button', { name: name!, exact: true });
    await expect(moved).not.toBeInViewport();
    await expect(moved).toContainText('43.7 / 100점');
  });
}

test('detail close, editor cancel, discard and direct tier changes return to the same mobile viewport', async ({ page }) => {
  await generalTierList(page);
  const button = page.locator('.tier-profile').nth(60);
  const y = await openAtCurrentPosition(page, button);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await expectPosition(page, y);
  await button.click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await expectPosition(page, y);
  await button.click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('spinbutton', { name: '스토리 점수', exact: true }).fill('20');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '저장하지 않고 닫기', exact: true }).click();
  await page.keyboard.press('Escape');
  await expectPosition(page, y);
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBeNull();
  await button.click();
  await page.getByRole('combobox', { name: '종합 티어', exact: true }).selectOption('S');
  await page.keyboard.press('Escape');
  await expectPosition(page, y);
});

test('mirror evaluation saves without following the reordered identity or collapsing expanded records', async ({ page }) => {
  await page.getByRole('navigation', { name: '거울던전 메뉴', exact: true }).getByRole('button', { name: '거울던전', exact: true }).click();
  await page.getByRole('tab', { name: '인격', exact: true }).click();
  await page.getByRole('group', { name: '거울던전 인격 보기 방식', exact: true }).getByRole('button', { name: '티어리스트', exact: true }).click();
  await page.getByRole('button', { name: '인격 더 보기', exact: true }).click();
  await expect(page.locator('.tier-profile')).toHaveCount(96);
  const button = page.locator('.tier-profile').nth(60);
  const name = await button.getAttribute('aria-label');
  const y = await openAtCurrentPosition(page, button);
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('spinbutton', { name: '거울던전 점수', exact: true }).fill('30');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.locator('.tier-profile')).toHaveCount(96);
  await expectPosition(page, y);
  await expect(page.getByRole('button', { name: name!, exact: true })).not.toBeInViewport();
});
