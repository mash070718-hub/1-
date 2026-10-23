import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { CATALOG } from '../src/lib/catalog';
import { createCatalogLibrary, createEntry, createMirrorDeck, createMirrorEvaluation, type LibraryData } from '../src/lib/library';
import { draftKey, mockCloud } from './mock-cloud';

const record = CATALOG.find(entry => entry.kind === 'identity' && entry.rarity !== '0')!;
const name = `${record.name} ${record.sinner}`;
const card = (page: Page) => page.getByRole('button', { name: `${name} 상세 보기`, exact: true });
const close = (page: Page) => page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
const nav = (page: Page) => page.getByRole('navigation', { name: '도서관 메뉴', exact: true });
const search = (page: Page) => page.getByPlaceholder('이름, 수감자, 태그로 검색');

function fixture() {
  const data = createCatalogLibrary();
  const entry = data.entries.find(entry => entry.id === record.id)!;
  entry.description = '기존 평가 보존'; entry.overallTier = 'A'; entry.tiers.story = 'S';
  entry.scores = { story: 18.25, luxcavation: 0 };
  const deck = { ...createEntry('deck'), name: '일반 표지 확인', memberIds: [entry.id], contentIds: ['story' as const] };
  data.entries.push(deck); entry.deckIds = [deck.id];
  const mirror = { ...createMirrorDeck(), name: '거울 표지 확인', memberIds: [entry.id], tier: 'S' as const, score: 95 };
  data.mirrorArchive = { decks: [mirror], evaluations: [{ ...createMirrorEvaluation(entry.id), tier: 'B', score: 27, description: '독립된 거울던전 평가' }] };
  return { data, entry, deck, mirror };
}

async function adminSession(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({
    access_token: 'admin-test-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600,
  })));
}

async function edit(page: Page) {
  await search(page).fill(name);
  await card(page).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
}

test('artwork choice supports cancel, save, backup, publication and a separate mobile visitor without changing evaluations', async ({ page, browser }, testInfo) => {
  test.setTimeout(60_000);
  const { data, entry } = fixture();
  const store = { data: structuredClone(data), revision: 4 };
  await mockCloud(page.context(), store); await adminSession(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await edit(page);
  await expect(page.getByRole('radio', { name: '3동기화 일러스트', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: '1동기화 일러스트', exact: true }).check();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '저장하지 않고 닫기', exact: true }).click();
  await expect(page.locator('.detail-art img')).toHaveAttribute('src', record.image);
  await close(page);
  await edit(page);
  await page.getByRole('radio', { name: '1동기화 일러스트', exact: true }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  const picker = page.getByRole('group', { name: '인격 일러스트', exact: true });
  await picker.scrollIntoViewIfNeeded();
  await expect.poll(() => picker.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await picker.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('artwork-picker-mobile.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(card(page).locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await card(page).click();
  await expect(page.locator('.detail-art img')).toHaveAttribute('src', record.artworks!.uptie1.image);
  await expect(page.locator('.detail-overall-tier')).toContainText('A 티어');
  await expect(page.locator('.detail-tier-cell strong')).toHaveText(['S', '—', '—', '—']);
  await close(page);

  const saved: LibraryData = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), draftKey);
  expect(saved.entries.find(item => item.id === entry.id)).toMatchObject({ artwork: 'uptie1', scores: entry.scores, tiers: entry.tiers, overallTier: 'A', description: entry.description, deckIds: entry.deckIds });
  expect(saved.mirrorArchive).toEqual(data.mirrorArchive);
  expect(store.data).toEqual(data);
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 다운로드', exact: true }).click();
  const backupPath = testInfo.outputPath('artwork-backup.json');
  await (await downloadPromise).saveAs(backupPath);
  const backup: LibraryData = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.entries.find(item => item.id === entry.id)?.artwork).toBe('uptie1');
  await page.getByLabel('백업 파일 선택', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  if (await page.getByRole('dialog').count()) await close(page);
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '공개 게시 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '게시하기', exact: true })).toBeDisabled();
  expect(store.data.entries.find(item => item.id === entry.id)?.artwork).toBe('uptie1');

  const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockCloud(visitorContext, store);
  const visitor = await visitorContext.newPage();
  await visitor.goto('/');
  await search(visitor).fill(name);
  await expect(card(visitor).locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await card(visitor).click();
  await expect(visitor.locator('.detail-art img')).toHaveAttribute('src', record.artworks!.uptie1.image);
  await expect(visitor.getByRole('button', { name: '기록 수정', exact: true })).toHaveCount(0);
  await expect(visitor.getByRole('group', { name: '인격 일러스트', exact: true })).toHaveCount(0);

  await edit(page);
  await expect(page.getByRole('radio', { name: '1동기화 일러스트', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: '3동기화 일러스트', exact: true }).check();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '공개 게시 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '게시하기', exact: true })).toBeDisabled();
  await visitor.reload();
  await search(visitor).fill(name);
  await expect(card(visitor).locator('img')).toHaveAttribute('src', record.artworks!.uptie3.thumbnail);
  expect(store.data.entries.find(item => item.id === entry.id)).toMatchObject({ scores: entry.scores, tiers: entry.tiers, overallTier: 'A' });
  expect(store.data.mirrorArchive).toEqual(data.mirrorArchive);
  await visitorContext.close();
});

test('saved artwork is shared by tier profiles, general formations and mirror decks and evaluations', async ({ page }) => {
  const { data, entry, deck, mirror } = fixture();
  entry.artwork = 'uptie1';
  await mockCloud(page.context(), { data, revision: 1 }); await adminSession(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await nav(page).getByRole('button', { name: '티어리스트', exact: true }).click();
  await search(page).fill(name);
  await expect(card(page).locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await nav(page).getByRole('button', { name: /^전체 기록/ }).click();
  await page.getByRole('tab', { name: /^덱/ }).click();
  await search(page).fill(deck.name);
  const deckCard = page.getByRole('button', { name: `${deck.name} 상세 보기`, exact: true });
  await expect(deckCard.locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await deckCard.click();
  await expect(page.locator('.detail-art img')).toHaveAttribute('src', record.artworks!.uptie1.image);
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.locator('.deck-formation-slots img').first()).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await expect(page.getByRole('group', { name: '인격 일러스트', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await close(page);
  await page.getByRole('navigation', { name: '거울던전 메뉴', exact: true }).getByRole('button', { name: '거울던전', exact: true }).click();
  const mirrorCard = page.getByRole('button', { name: `${mirror.name} 거울던전 상세 보기`, exact: true });
  await expect(mirrorCard.locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await mirrorCard.click();
  await expect(page.locator('.mirror-deck-detail-cover img')).toHaveAttribute('src', record.artworks!.uptie1.image);
  await expect(page.locator('.mirror-deck-member-art img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.locator('.deck-formation-slots img').first()).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await close(page);
  await page.getByRole('tab', { name: '인격', exact: true }).click();
  const evaluationCard = page.getByRole('button', { name: `${name} 거울던전 상세 보기`, exact: true });
  await expect(evaluationCard.locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await page.getByRole('group', { name: '거울던전 인격 보기 방식' }).getByRole('button', { name: '티어리스트', exact: true }).click();
  await expect(evaluationCard.locator('img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
  await evaluationCard.click();
  await expect(page.locator('.detail-art img')).toHaveAttribute('src', record.artworks!.uptie1.image);
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await expect(page.locator('.mirror-evaluation-thumbnail img')).toHaveAttribute('src', record.artworks!.uptie1.thumbnail);
});

test('base identities explain their shared artwork while E.G.O keeps its existing editor', async ({ page }) => {
  await mockCloud(page.context(), { data: createCatalogLibrary(), revision: 1 }); await adminSession(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  const base = CATALOG.find(entry => entry.kind === 'identity' && entry.rarity === '0')!;
  await search(page).fill(`${base.name} ${base.sinner}`);
  await page.getByRole('button', { name: `${base.name} ${base.sinner} 상세 보기`, exact: true }).click();
  await page.getByRole('button', { name: /평가 작성|기록 수정/, exact: true }).click();
  await expect(page.getByRole('radio', { name: '1동기화 일러스트', exact: true })).toBeChecked();
  await expect(page.getByRole('group', { name: '인격 일러스트', exact: true })).toContainText('같은 이미지가 표시됩니다');
  await page.getByRole('button', { name: '취소', exact: true }).click(); await close(page);
  await page.getByRole('tab', { name: /^E\.G\.O\./ }).click();
  const ego = CATALOG.find(entry => entry.kind === 'ego')!;
  await search(page).fill(`${ego.name} ${ego.sinner}`);
  await page.getByRole('button', { name: `${ego.name} ${ego.sinner} 상세 보기`, exact: true }).click();
  await expect(page.locator('.detail-art img')).toHaveAttribute('src', ego.image);
  await page.getByRole('button', { name: /평가 작성|기록 수정/, exact: true }).click();
  await expect(page.getByRole('group', { name: '인격 일러스트', exact: true })).toHaveCount(0);
});
