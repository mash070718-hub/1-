import { expect, test, type Page } from '@playwright/test';
import { createCatalogLibrary, createEntry, createMirrorDeck, createMirrorEvaluation, mergeCatalog, STORAGE_KEY } from '../src/lib/library';
import { draftKey, mockCloud, type MockStore } from './mock-cloud';

async function signIn(page: Page, email = 'admin@example.test') {
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click();
  await page.getByRole('textbox', { name: '이메일', exact: true }).fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
}
async function publish(page: Page) {
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '공개 게시 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '게시하기', exact: true })).toBeDisabled();
}
const newDeck = (id: string, name: string, score?: number | null) => {
  const entry = { ...createEntry('deck'), id, name, scores: { story: score ?? null } };
  entry.tiers.story = 'A'; entry.contentIds = ['story']; return entry;
};

test('visitors ignore legacy local data, nonadmins cannot edit, original backup remains', async ({ page }) => {
  const legacy = JSON.stringify({ version: 1, entries: [newDeck('legacy-deck', 'PC 전용 원본', 0)] });
  await mockCloud(page.context());
  await page.addInitScript(({ key, legacy }) => localStorage.setItem(key, legacy), { key: STORAGE_KEY, legacy });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '관리자 로그인', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '새 기록', exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: '거울던전', exact: true }).click();
  await expect(page.getByRole('button', { name: '새 거울던전 기록', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '인격', exact: true }).click();
  await expect(page.getByRole('button', { name: /평가 작성\/수정/ })).toHaveCount(0);
  await signIn(page, 'reader@example.test');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('관리자 편집 권한이 없습니다');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await expect(page.getByLabel('백업 파일 선택')).toHaveCount(0);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장소 원본 다운로드', exact: true }).click();
  const download = await downloadEvent;
  const { readFile } = await import('node:fs/promises');
  expect(await readFile((await download.path())!, 'utf8')).toBe(legacy);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(legacy);
});

test('admin imports old backup, scores persist and sort independently, publishes to a separate visitor device', async ({ browser }) => {
  const store: MockStore = { data: null, revision: 0 };
  const adminContext = await browser.newContext(); const readerContext = await browser.newContext();
  await mockCloud(adminContext, store); await mockCloud(readerContext, store);
  const admin = await adminContext.newPage(); const reader = await readerContext.newPage();
  await admin.goto('/'); await signIn(admin);
  await expect(admin.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  const old = createCatalogLibrary();
  const identity = old.entries.find(({ kind }) => kind === 'identity')!;
  identity.strengths = '기존 장점'; identity.tiers.story = 'D';
  const identityId = identity.id;
  const decks = [newDeck('blank', '미입력 덱'), newDeck('zero', '영점 덱', 0), newDeck('tie1', '동점 첫 덱', 98.25), newDeck('tie2', '동점 둘 덱', 98.25)];
  old.entries.push(...decks);
  // Legacy entries have no scores field, proving backward compatibility separately.
  delete identity.scores;
  await admin.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await admin.getByLabel('백업 파일 선택').setInputFiles({ name: 'old-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await admin.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  await admin.getByRole('tab', { name: /^인격/ }).click();
  await admin.getByPlaceholder('이름, 수감자, 태그로 검색').fill(identity.name);
  await admin.getByRole('button', { name: `${identity.name} ${identity.sinner} 상세 보기`, exact: true }).click();
  await admin.getByRole('button', { name: '기록 수정', exact: true }).click();
  await admin.getByRole('spinbutton', { name: '스토리 점수', exact: true }).fill('87.125');
  await admin.getByRole('spinbutton', { name: '경험치 · 끈 채광 점수', exact: true }).fill('0');
  await admin.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  await admin.reload();
  await expect(admin.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  const saved = JSON.parse((await admin.evaluate(key => localStorage.getItem(key), draftKey))!);
  expect(saved.entries.find((e: { id: string }) => e.id === identityId).scores).toEqual({ story: 87.125, luxcavation: 0 });
  expect(saved.entries.find((e: { id: string }) => e.id === identityId).tiers.story).toBe('D');
  // Mirror scores and plans travel in the same publication with no overwrite.
  const mirrorDecks = [createMirrorDeck(), createMirrorDeck(), createMirrorDeck()];
  mirrorDecks.forEach((deck, i) => { deck.id = `mirror-${i}`; deck.name = `거울 덱 ${i}`; deck.tier = 'S'; });
  mirrorDecks[0].score = null; mirrorDecks[1].score = 0; mirrorDecks[2].score = 99.5;
  mirrorDecks[2].plan.floors[14].themePack = '15층 보존';
  mirrorDecks[2].plan.skillChanges = [{ identityId, skill1: 0, skill2: 2, skill3: 3, notes: '기술 보존' }];
  saved.mirrorArchive = { decks: mirrorDecks, evaluations: [{ ...createMirrorEvaluation(identityId), tier: 'S', score: 12.5 }] };
  await admin.getByRole('button', { name: '백업과 복원', exact: true }).click();
  await admin.getByLabel('백업 파일 선택').setInputFiles({ name: 'scored.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await admin.getByRole('button', { name: '가져오기 확인', exact: true }).click();
  await reader.goto('/');
  await reader.getByRole('tab', { name: /^덱/ }).click();
  await expect(reader.getByRole('button', { name: '영점 덱 상세 보기', exact: true })).toHaveCount(0);
  await publish(admin);
  await reader.reload();
  await reader.getByRole('tab', { name: /^덱/ }).click();
  await reader.getByRole('navigation').getByRole('button', { name: '티어리스트', exact: true }).click();
  const names = reader.locator('.tier-row[data-tier="A"] .entry-title');
  await expect(names).toHaveText(['동점 첫 덱', '동점 둘 덱', '영점 덱', '미입력 덱']);
  await expect(reader.locator('.tier-row[data-tier="A"] .score-label')).toHaveText(['98.25점', '98.25점', '0점', '점수 미입력']);
  await reader.getByRole('navigation').getByRole('button', { name: '거울던전', exact: true }).click();
  await expect(reader.locator('.mirror-deck-tier[data-tier="S"] .mirror-card-title')).toHaveText(['거울 덱 2', '거울 덱 1', '거울 덱 0']);
  expect(store.data?.mirrorArchive?.decks[2].plan.floors[14].themePack).toBe('15층 보존');
  expect(store.data?.entries.find(({ id }) => id === identityId)?.scores?.story).toBe(87.125);
  await admin.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(admin.getByRole('button', { name: '게시하기', exact: true })).toHaveCount(0);
  await adminContext.close(); await readerContext.close();
});

test('conflicting publication refuses overwrite and keeps administrator draft', async ({ page }) => {
  const store: MockStore = { data: mergeCatalog(createCatalogLibrary()), revision: 1 };
  await mockCloud(page.context(), store); await page.goto('/'); await signIn(page);
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 기록', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('충돌 보존');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  store.revision = 2;
  await page.reload();
  await expect(page.getByRole("button", { name: "로그아웃", exact: true })).toBeVisible();
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '공개 게시 확인', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('다른 화면에서 이미 게시');
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toContain('충돌 보존');
  expect(store.data?.entries.some(({ name }) => name === '충돌 보존')).toBe(false);
});

test('an expired admin session does not prevent public reading or a fresh login', async ({ page }) => {
  await mockCloud(page.context());
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({ access_token: 'expired', refresh_token: 'expired', expires_at: 1 })));
  await page.goto('/');
  await expect(page.getByRole('tab', { name: /^인격/ })).toBeVisible();
  await signIn(page);
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
});
