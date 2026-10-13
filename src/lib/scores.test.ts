import assert from 'node:assert/strict';
import test from 'node:test';
import { compareScores, createCatalogLibrary, createMirrorDeck, createMirrorEvaluation, exportLibrary, mergeCatalog, parseLibrary } from './library';

test('scores preserve decimals, zero, blank, independent content and mirror archive through backup', () => {
  const data = mergeCatalog(createCatalogLibrary());
  const entry = data.entries.find((item) => item.kind === 'identity')!;
  entry.tiers.story = 'C'; entry.tiers.railway1 = 'S';
  entry.scores = { story: 0, luxcavation: 99.125, railway1: null };
  const deck = { ...createMirrorDeck(), score: 0, tier: 'B' as const };
  const evaluation = { ...createMirrorEvaluation(entry.id), tier: 'D' as const, score: 67.25 };
  data.mirrorArchive = { decks: [deck], evaluations: [evaluation] };
  const restored = parseLibrary(exportLibrary(data));
  assert.deepEqual(restored.entries.find(({ id }) => id === entry.id)?.scores, entry.scores);
  assert.equal(restored.entries.find(({ id }) => id === entry.id)?.tiers.story, 'C');
  assert.equal(restored.mirrorArchive?.decks[0].score, 0);
  assert.equal(restored.mirrorArchive?.evaluations[0].score, 67.25);
});

test('descending score puts zero before missing and preserves tie order', () => {
  const values = [null, 0, 99.5, undefined, 99.5, 14].map((score, index) => ({ score, index }));
  assert.deepEqual(values.sort((a, b) => compareScores(a.score, b.score)).map(({ index }) => index), [2, 4, 5, 1, 0, 3]);
});

test('rejects invalid scores in every archive and retains old backups', () => {
  const original = mergeCatalog(createCatalogLibrary());
  assert.doesNotThrow(() => parseLibrary(exportLibrary(original)));
  for (const score of [-1, 101, '50', false, {}, [1]]) {
    const data = structuredClone(original);
    (data.entries[0] as unknown as { scores: unknown }).scores = { story: score };
    assert.throws(() => parseLibrary(JSON.stringify(data)), /점수/);
    const mirror = { ...createMirrorDeck(), score };
    data.entries[0].scores = undefined;
    data.mirrorArchive = { decks: [mirror as never], evaluations: [] };
    assert.throws(() => parseLibrary(JSON.stringify(data)), /점수/);
  }
});

test('legacy mirror scores migrate once without changing general tiers or scores', () => {
  const data = createCatalogLibrary();
  data.entries[0].scores = { mirror: 0, story: 45.5 };
  const upgraded = mergeCatalog(data);
  assert.equal(upgraded.mirrorArchive?.evaluations[0].score, 0);
  assert.equal(upgraded.entries[0].scores?.story, 45.5);
  assert.deepEqual(mergeCatalog(upgraded).mirrorArchive, upgraded.mirrorArchive);
});
