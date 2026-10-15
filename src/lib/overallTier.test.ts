import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoLibrary, createEntry, createMirrorEvaluation, exportLibrary, mergeCatalog, parseLibrary, type LibraryData } from './library';

test('old identities inherit their previous default classification once without changing any content evaluations', () => {
  const identity = createEntry('identity');
  delete identity.overallTier;
  identity.tiers.story = 'A'; identity.tiers.railway = 'S';
  identity.scores = { story: 18, railway: 8 };
  const mirror = { ...createMirrorEvaluation(identity.id), tier: 'B' as const, score: 27 };
  const old: LibraryData = { version: 1, entries: [identity], mirrorArchive: { evaluations: [mirror], decks: [] } };
  const migrated = mergeCatalog(parseLibrary(exportLibrary(old)));
  const retained = migrated.entries.find(entry => entry.id === identity.id)!;
  assert.deepEqual(retained, { ...identity, overallTier: 'A' });
  assert.equal(identity.overallTier, undefined);
  assert.deepEqual(migrated.mirrorArchive, old.mirrorArchive);
  retained.tiers.story = 'S'; retained.overallTier = 'unrated';
  const reloaded = mergeCatalog(parseLibrary(exportLibrary(migrated)));
  assert.deepEqual(reloaded.entries.find(entry => entry.id === identity.id), retained);
  retained.overallTier = 'B'; retained.scores = { story: 20, luxcavation: 10, simulation: 30, railway: 10 };
  assert.equal(mergeCatalog(migrated).entries.find(entry => entry.id === identity.id)!.overallTier, 'B');
});

test('overall tiers validate in new backups, remain optional in old backups, and cannot discard an edited demo', () => {
  const identity = { ...createEntry('identity'), id: 'demo-identity-1', overallTier: 'S' as const };
  const data: LibraryData = { version: 1, entries: [identity] };
  assert.deepEqual(parseLibrary(exportLibrary(data)), data);
  const demo = createDemoLibrary();
  const editedDemo = demo.entries.find(entry => entry.kind === 'identity')!;
  editedDemo.overallTier = 'S';
  assert.equal(mergeCatalog(demo).entries.find(entry => entry.id === editedDemo.id)?.overallTier, 'S');
  for (const invalid of ['SS', null, 5]) {
    assert.throws(() => parseLibrary(JSON.stringify({ ...data, entries: [{ ...identity, overallTier: invalid }] })), /종합 티어/);
  }
  const deck = { ...createEntry('deck'), overallTier: 'A' };
  assert.throws(() => parseLibrary(JSON.stringify({ ...data, entries: [deck] })), /종합 티어/);
});
