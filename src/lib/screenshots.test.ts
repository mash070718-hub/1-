import assert from 'node:assert/strict';
import test from 'node:test';
import { createMirrorDeck, exportLibrary, mergeCatalog, parseLibrary, type LibraryData } from './library';
import { isScreenshotPath, type DeckScreenshot } from './screenshots';

const photo = (index: number): DeckScreenshot => ({
  path: `mirror-decks/mirror-deck-test/11111111-1111-4111-8111-11111111111${index}.webp`,
  caption: `15층 · 피해량 ${index}00만`, width: 2560, height: 1440,
});
const notebook = (): LibraryData => ({ version: 1, entries: [], mirrorArchive: {
  decks: [{ ...createMirrorDeck(), name: '직접 플레이한 거던 덱', screenshots: [photo(1), photo(2), photo(3)] }], evaluations: [],
} });

test('three screenshots and their Korean captions survive save, import and catalog updates without sharing mutable objects', () => {
  const original = notebook();
  const restored = parseLibrary(exportLibrary(original));
  assert.deepEqual(restored, original);
  const merged = mergeCatalog(restored);
  assert.deepEqual(merged.mirrorArchive, original.mirrorArchive);
  merged.mirrorArchive!.decks[0].screenshots![0].caption = '변경';
  assert.notEqual(original.mirrorArchive!.decks[0].screenshots![0].caption, '변경');
  assert.notEqual(restored.mirrorArchive!.decks[0].screenshots![0].caption, '변경');
});

test('older mirror decks without screenshots still import unchanged', () => {
  const old = notebook(); delete old.mirrorArchive!.decks[0].screenshots;
  assert.deepEqual(parseLibrary(exportLibrary(old)), old);
});

test('invalid, duplicate, oversized lists, unsafe paths and unknown screenshot fields reject the entire import', () => {
  for (const invalid of [
    null, {}, [photo(1), photo(2), photo(3), photo(4)], [photo(1), photo(1)],
    [{ ...photo(1), caption: 'x'.repeat(301) }], [{ ...photo(1), width: 0 }], [{ ...photo(1), height: 9000 }],
    [{ ...photo(1), width: 1.5 }], [{ ...photo(1), url: 'https://example.test/' }],
    ...['https://evil.test/photo.webp', 'javascript:alert(1)', 'data:image/svg+xml,svg', '../secret.webp', photo(1).path.replace('.webp', '.svg'), photo(1).path.replace('/mirror-deck-test/', '/%2e%2e/')].map(path => [{ ...photo(1), path }]),
  ]) {
    const value = notebook();
    (value.mirrorArchive!.decks[0] as unknown as Record<string, unknown>).screenshots = invalid;
    assert.throws(() => parseLibrary(JSON.stringify(value)), /라이브러리 파일을 읽을 수 없습니다/);
  }
  assert.equal(isScreenshotPath(photo(1).path), true);
  assert.equal(isScreenshotPath(undefined), false);
});
