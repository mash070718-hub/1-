import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntry, createMirrorEvaluation, exportLibrary, mergeCatalog, parseLibrary, type Content, type LibraryData } from './library';
import { IDENTITY_SCORE_MAX, identityScoreTotal } from './identityScores';

function fixture(): LibraryData {
  const entry = { ...createEntry('identity'), id: 'scored-identity', name: '평가 인격',
    scores: { story: 16.5, luxcavation: 8, simulation: 27, railway1: 6, railway2: 7, railway6: 8.5, mirror: 99 },
  };
  return { version: 1, entries: [entry], mirrorArchive: {
    decks: [], evaluations: [{ ...createMirrorEvaluation(entry.id), score: 28 }],
  } };
}

test('existing scores remain exact across import, catalog merge, export and reload', () => {
  const original = fixture();
  original.entries[0].scores!.story = 0;
  original.entries[0].scores!.luxcavation = 1.125;
  original.entries[0].scores!.railway1 = null;
  const restored = mergeCatalog(parseLibrary(exportLibrary(mergeCatalog(original))));
  assert.deepEqual(restored.entries[0].scores, original.entries[0].scores);
  assert.deepEqual(restored.mirrorArchive, original.mirrorArchive);
});

test('total adds native points, counts only the selected railway and the independent mirror score', () => {
  const data = fixture();
  const entry = data.entries[0];
  const mirror = data.mirrorArchive!.evaluations[0];
  assert.deepEqual(identityScoreTotal(entry, mirror, 'railway6'), { score: 88, evaluated: 5, complete: true, invalid: 0 });
  assert.equal(identityScoreTotal(entry, mirror, 'railway1').score, 85.5);
  entry.scores = { ...IDENTITY_SCORE_MAX };
  mirror.score = 30;
  assert.equal(identityScoreTotal(entry, mirror, 'railway6').score, 100);
});

test('zero is evaluated, missing is incomplete and out-of-range legacy scores never inflate totals', () => {
  const data = fixture();
  const entry = data.entries[0];
  entry.scores = { story: 0, luxcavation: null };
  assert.deepEqual(identityScoreTotal(entry, undefined, 'railway6'), { score: 0, evaluated: 1, complete: false, invalid: 0 });
  entry.scores = { story: 90, mirror: 30 };
  assert.deepEqual(identityScoreTotal(entry, undefined, 'railway6'), { score: null, evaluated: 0, complete: false, invalid: 1 });
});

test('new identity scores enforce each content maximum while legacy scores and deck scales are retained', () => {
  const data = fixture();
  data.entries[0].scoreScale = 'content-v1';
  data.entries[0].scoreRailway = 'railway2';
  data.mirrorArchive!.evaluations[0].scoreScale = 'content-v1';
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
  for (const content of ['story', 'luxcavation', 'simulation', 'railway1', 'railway2', 'railway6'] as Content[]) {
    const invalid = structuredClone(data);
    invalid.entries[0].scores![content] = IDENTITY_SCORE_MAX[content] + 0.01;
    assert.throws(() => exportLibrary(invalid), /점수/);
    delete invalid.entries[0].scoreScale;
    assert.doesNotThrow(() => exportLibrary(invalid));
  }
  const invalidMirror = structuredClone(data);
  invalidMirror.mirrorArchive!.evaluations[0].score = 30.1;
  assert.throws(() => exportLibrary(invalidMirror), /0~30/);
  const deck = { ...createEntry('deck'), scores: { story: 99.5 } };
  data.entries.push(deck);
  assert.doesNotThrow(() => exportLibrary(data));
  data.entries[0].scoreRailway = 'mirror' as never;
  assert.throws(() => exportLibrary(data), /노선/);
});
