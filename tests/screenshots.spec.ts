import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createCatalogLibrary, type LibraryData } from '../src/lib/library';
import { SCREENSHOT_BUCKET } from '../src/lib/screenshots';
import { draftKey, mockCloud, type MockStore } from './mock-cloud';

interface ImageStore { files: Map<string, Buffer>; failUpload?: boolean; missing?: boolean; uploads: number }
async function storageRoutes(context: BrowserContext, store: MockStore, images: ImageStore) {
  await context.route('https://limbus-test.supabase.co/storage/v1/**', async route => {
    const req = route.request();
    const admin = req.headers().authorization === 'Bearer admin-test-token';
    const path = new URL(req.url()).pathname.split(`${SCREENSHOT_BUCKET}/`)[1];
    if (images.missing) return route.fulfill({ status: 400, json: { statusCode: '404', message: 'Bucket not found' } });
    if (req.method() === 'POST') {
      images.uploads++;
      await new Promise(resolve => setTimeout(resolve, 150));
      if (images.failUpload) return route.fulfill({ status: 503, json: {} });
      if (!admin || req.headers()['x-upsert'] !== 'false') return route.fulfill({ status: 403, json: {} });
      expect(req.headers()['content-type']).toBe('image/webp');
      const bytes = req.postDataBuffer()!;
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      images.files.set(path, bytes);
      return route.fulfill({ json: { Key: `${SCREENSHOT_BUCKET}/${path}` } });
    }
    const published = store.data?.mirrorArchive?.decks.some(deck => deck.screenshots?.some(image => image.path === path));
    if (!admin && !published) return route.fulfill({ status: 403, json: {} });
    const bytes = images.files.get(path);
    return bytes ? route.fulfill({ contentType: 'image/webp', body: bytes }) : route.fulfill({ status: 404, json: {} });
  });
}
async function setupAdmin(page: Page, store: MockStore, images: ImageStore) {
  await mockCloud(page.context(), store); await storageRoutes(page.context(), store, images);
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({
    access_token: 'admin-test-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600,
  })));
  await page.goto('/#mirror-dungeon');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 거울던전 기록', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('고점 데미지 검증 덱');
}
async function screenshotFile(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 3000; canvas.height = 1600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#171410'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e6c689'; ctx.font = '70px sans-serif'; ctx.fillText('MIRROR DUNGEON / DAMAGE RESULT', 100, 160);
    for (let i = 0; i < 6; i++) { ctx.fillRect(100, 280 + i * 170, 2000 - i * 200, 40); ctx.fillText(`${i + 1}  /  ${'1,234,567'}`, 100, 380 + i * 170); }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'damage.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
}
async function publish(page: Page) {
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '공개 게시 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '게시하기', exact: true })).toBeDisabled();
}
const openDeck = (page: Page) => page.getByRole('button', { name: '고점 데미지 검증 덱 거울던전 상세 보기', exact: true }).click();
const saved = (page: Page): Promise<LibraryData> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), draftKey);

test('three real images survive draft, reload and backup; publication exposes them on a separate mobile visitor without edit access', async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const store: MockStore = { data: null, revision: 0 };
  const images: ImageStore = { files: new Map(), uploads: 0 };
  await setupAdmin(page, store, images);
  const file = await screenshotFile(page);
  const input = page.getByLabel('스크린샷 파일 선택', { exact: true });
  await input.setInputFiles([file, file, file, file]);
  await expect(page.getByRole('alert')).toContainText('최대 3장');
  expect(images.uploads).toBe(0);
  await input.setInputFiles([file, file, file]);
  await expect(page.getByRole('button', { name: '사진 업로드 중…', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '거울던전 장점', exact: true }).fill('사진을 올리면서 적은 장점도 보존');
  await expect(input).toBeDisabled();
  await expect(page.getByRole('button', { name: '기록 저장', exact: true })).toBeEnabled();
  await expect(page.locator('.screenshot-editor .screenshot-preview img')).toHaveCount(3);
  await page.getByRole('textbox', { name: '사진 1 설명', exact: true }).fill('15층 · 출혈 기프트 완성 · 총 피해량 1234만');
  await page.getByRole('spinbutton', { name: '거울던전 점수', exact: true }).fill('93.5');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect(store.data).toBeNull();
  const draft = await saved(page); const photos = draft.mirrorArchive!.decks[0].screenshots!;
  expect(photos).toHaveLength(3); expect(photos[0].width).toBe(2560);
  expect(draft.mirrorArchive!.decks[0]).toMatchObject({ score: 93.5, strengths: '사진을 올리면서 적은 장점도 보존' });
  await page.reload(); await openDeck(page);
  await expect(page.getByRole('region', { name: '거울던전 데미지 기록' }).locator('.screenshot-preview img')).toHaveCount(3);
  await page.getByRole('button', { name: '데미지 스크린샷 1 크게 보기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '데미지 스크린샷 1 확대', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '고점 데미지 검증 덱', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 다운로드', exact: true }).click();
  const backup = await readFile((await (await downloading).path())!, 'utf8');
  expect(JSON.parse(backup).mirrorArchive.decks[0].screenshots).toEqual(photos);
  await page.getByLabel('백업 파일 선택').setInputFiles({ name: 'photos.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mockCloud(context, store); await storageRoutes(context, store, images);
  const reader = await context.newPage();
  await reader.goto('/#mirror-dungeon');
  const photoUrl = `https://limbus-test.supabase.co/storage/v1/object/authenticated/${SCREENSHOT_BUCKET}/${photos[0].path}`;
  expect(await reader.evaluate(async url => (await fetch(url)).status, photoUrl)).toBe(403);
  await publish(page); await reader.reload(); await openDeck(reader);
  const gallery = reader.getByRole('region', { name: '거울던전 데미지 기록' });
  await expect(gallery.locator('.screenshot-preview img')).toHaveCount(3);
  await expect.poll(() => gallery.locator('.screenshot-preview img').evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(gallery).toContainText(photos[0].caption);
  await expect(reader.getByRole('button', { name: '기록 수정', exact: true })).toHaveCount(0);
  await expect(reader.getByLabel('스크린샷 파일 선택')).toHaveCount(0);
  await reader.getByRole('button', { name: '데미지 스크린샷 1 크게 보기', exact: true }).click();
  await reader.getByRole('button', { name: '사진 크기로 확대', exact: true }).click();
  await reader.getByRole('dialog', { name: '데미지 스크린샷 1 확대', exact: true }).screenshot({ path: testInfo.outputPath('damage-mobile-expanded.png') });
  await reader.getByRole('button', { name: '사진 닫기', exact: true }).click();
  await gallery.screenshot({ path: testInfo.outputPath('damage-mobile-gallery.png') });
  expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Removing a draft attachment must not break the existing public photo or the backup file.
  await openDeck(page); await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('button', { name: '사진 1 첨부 제거', exact: true }).click();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect(store.data?.mirrorArchive?.decks[0].screenshots).toHaveLength(3);
  expect(await reader.evaluate(async url => (await fetch(url)).status, photoUrl)).toBe(200);
  await publish(page);
  expect(await reader.evaluate(async url => (await fetch(url)).status, photoUrl)).toBe(403);
  expect(images.files.has(photos[0].path)).toBe(true);
  await context.close();
});

test('invalid files, missing storage and failed uploads leave notes and existing attachments intact, with an actionable setup link', async ({ page }) => {
  const store: MockStore = { data: null, revision: 0 };
  const images: ImageStore = { files: new Map(), uploads: 0, missing: true };
  await setupAdmin(page, store, images);
  await page.getByRole('textbox', { name: '거울던전 설명', exact: true }).fill('실패해도 남아야 할 작성 중 평가');
  const input = page.getByLabel('스크린샷 파일 선택', { exact: true });
  await input.setInputFiles({ name: 'fake.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('PNG, JPG 또는 WebP');
  const file = await screenshotFile(page);
  await input.setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('사진 저장소 설정이 아직 필요');
  await expect(page.getByRole('alert').getByRole('link')).toHaveAttribute('href', './SCREENSHOT_SETUP.html');
  images.missing = false;
  await input.setInputFiles(file);
  await expect(page.getByRole('textbox', { name: '사진 1 설명', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: '사진 1 설명', exact: true }).fill('성공한 첫 번째 사진');
  images.failUpload = true;
  await input.setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('업로드에 실패');
  await expect(page.getByRole('textbox', { name: '사진 1 설명', exact: true })).toHaveValue('성공한 첫 번째 사진');
  await expect(page.getByRole('textbox', { name: '거울던전 설명', exact: true })).toHaveValue('실패해도 남아야 할 작성 중 평가');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  expect((await saved(page)).mirrorArchive!.decks[0].screenshots).toHaveLength(1);
});

test('Korean composition and moving between assessment fields retain the same focused DOM nodes and all text', async ({ page }) => {
  const data = createCatalogLibrary(); const identity = data.entries[0];
  identity.description = '기존 평가를 이어서 작성';
  await mockCloud(page.context(), { data, revision: 1 });
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({ access_token: 'admin-test-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600 })));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await page.getByPlaceholder('이름, 수감자, 태그로 검색').fill(`${identity.name} ${identity.sinner}`);
  await page.getByRole('button', { name: `${identity.name} ${identity.sinner} 상세 보기`, exact: true }).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  const fields = ['장점', '단점', '운용 방법'].map(name => page.getByRole('textbox', { name, exact: true }));
  const originals = await Promise.all(fields.map(field => field.elementHandle()));
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]; await field.focus();
    await field.dispatchEvent('compositionstart', { data: '' });
    await field.fill(`한글 평가 ${i + 1}`);
    await field.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true, keyCode: 229 });
    await expect(field).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await field.dispatchEvent('compositionend', { data: `한글 평가 ${i + 1}` });
    expect(await field.evaluate((node, original) => node === original, originals[i])).toBe(true);
    if (i < fields.length - 1) { await page.keyboard.press('Tab'); await expect(fields[i + 1]).toBeFocused(); }
  }
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const entry = (await saved(page)).entries.find(entry => entry.id === identity.id)!;
  expect([entry.strengths, entry.weaknesses, entry.operation]).toEqual(['한글 평가 1', '한글 평가 2', '한글 평가 3']);
});
