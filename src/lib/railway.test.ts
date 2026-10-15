import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntry, exportLibrary, mergeCatalog, parseLibrary, type LibraryData } from './library';
import { unifyRailway } from './railway';

function legacyEntry() {
  const entry = createEntry('identity');
  delete (entry.tiers as Partial<typeof entry.tiers>).railway;
  entry.scores = { story: 18, railway1: 6, railway2: 7, railway6: 8.5 };
  entry.tiers.railway1 = 'C'; entry.tiers.railway2 = 'B'; entry.tiers.railway6 = 'A';
  entry.description = '원본 평가';
  return entry;
}

test('unifies the previous selected railway or defaults to line 6 without erasing any source data', () => {
  const original = legacyEntry();
  const entry = unifyRailway(original);
  assert.equal(entry.scores?.railway, 8.5);
  assert.equal(entry.tiers.railway, 'A');
  assert.deepEqual(original.scores, { story: 18, railway1: 6, railway2: 7, railway6: 8.5 });
  assert.equal(Object.hasOwn(original.tiers, 'railway'), false);
  assert.equal(entry.description, original.description);
  for (const route of ['railway1', 'railway2', 'railway6'] as const) {
    assert.equal(entry.scores?.[route], original.scores?.[route]);
    assert.equal(entry.tiers[route], original.tiers[route]);
  }
  original.scoreRailway = 'railway2';
  assert.equal(unifyRailway(original).scores?.railway, 7);
  assert.equal(unifyRailway(original).tiers.railway, 'B');
});

test('zero is retained and old deck membership joins the unified railway folder', () => {
  const entry = legacyEntry();
  entry.kind = 'deck'; entry.contentIds = ['story', 'railway1', 'railway2'];
  entry.scores = { railway2: 0 };
  const unified = unifyRailway(entry);
  assert.equal(unified.scores?.railway, 0);
  assert.equal(unified.tiers.railway, 'B');
  assert.deepEqual(unified.contentIds, ['story', 'railway1', 'railway2', 'railway']);
  entry.scores = {};
  entry.tiers.railway6 = 'unrated'; entry.tiers.railway1 = 'unrated';
  assert.equal(unifyRailway(entry).tiers.railway, 'B');
});

test('cleared unified scores, tiers and folder membership stay cleared after export and reload', () => {
  const original = legacyEntry();
  original.kind = 'deck'; original.contentIds = ['railway6'];
  delete original.overallTier;
  const unified = unifyRailway(original);
  unified.scores!.railway = null;
  unified.tiers.railway = 'unrated';
  unified.contentIds = unified.contentIds.filter(id => id !== 'railway');
  const data: LibraryData = { version: 1, entries: [unified], mirrorArchive: { decks: [], evaluations: [] } };
  const restored = mergeCatalog(parseLibrary(exportLibrary(data))).entries.find(entry => entry.id === original.id)!;
  assert.deepEqual(restored, unified);
  assert.equal(unifyRailway(restored).scores?.railway, null);
  assert.equal(restored.scores?.railway6, 8.5);
});
