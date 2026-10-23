import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG, getArtworkChoice, getEntryArtwork } from './catalog';
import { createCatalogLibrary, createEntry, exportLibrary, mergeCatalog, parseLibrary, resetCatalogEntry } from './library';

const record = CATALOG.find(entry => entry.kind === 'identity' && entry.rarity !== '0')!;

test('old records keep their current images and identity choices resolve to verified 1/3 artwork', () => {
  for (const entry of CATALOG) {
    assert.equal(getEntryArtwork(entry), entry.thumbnail);
    assert.equal(getEntryArtwork(entry, true), entry.image);
  }
  assert.equal(getArtworkChoice(record), 'uptie3');
  assert.equal(getEntryArtwork({ id: record.id, artwork: 'uptie1' }), record.artworks!.uptie1.thumbnail);
  assert.equal(getEntryArtwork({ id: record.id, artwork: 'uptie1' }, true), record.artworks!.uptie1.image);
  assert.equal(getEntryArtwork({ id: record.id, artwork: 'uptie3' }), record.artworks!.uptie3.thumbnail);
  assert.equal(getEntryArtwork(undefined), undefined);
  assert.equal(getEntryArtwork({ id: 'custom-identity' }), undefined);
  for (const base of CATALOG.filter(entry => entry.kind === 'identity' && entry.rarity === '0')) {
    assert.deepEqual(base.artworks!.uptie1, base.artworks!.uptie3);
    assert.equal(getArtworkChoice(base), 'uptie1');
  }
});

test('artwork selection survives backups, catalog merges and evaluation reset independently of scores and tiers', () => {
  const data = createCatalogLibrary();
  const entry = data.entries.find(entry => entry.id === record.id)!;
  entry.artwork = 'uptie1'; entry.overallTier = 'A'; entry.tiers.story = 'S'; entry.scores = { story: 18.25 }; entry.description = '기존 평가';
  const restored = parseLibrary(exportLibrary(data));
  const result = mergeCatalog(restored).entries.find(item => item.id === entry.id)!;
  assert.deepEqual(result, entry);
  assert.equal(resetCatalogEntry(entry).artwork, 'uptie1');
  assert.equal(resetCatalogEntry(entry).description, '');
  assert.equal(data.entries.find(item => item.kind === 'ego')?.artwork, undefined);
});

test('backup rejects unknown artwork modes, image URLs and choices on E.G.O or decks', () => {
  for (const invalid of [null, 1, 3, 'normal', 'uptie2', 'https://example.test/art.webp', { image: 'test' }]) {
    const data = createCatalogLibrary();
    Object.assign(data.entries[0], { artwork: invalid });
    assert.throws(() => parseLibrary(JSON.stringify(data)), /인격 일러스트/);
  }
  const data = createCatalogLibrary();
  data.entries.find(entry => entry.kind === 'ego')!.artwork = 'uptie1';
  assert.throws(() => parseLibrary(JSON.stringify(data)), /인격 일러스트/);
  const withDeck = createCatalogLibrary();
  withDeck.entries.push({ ...createEntry('deck'), name: '기존 덱', artwork: 'uptie3' });
  assert.throws(() => parseLibrary(JSON.stringify(withDeck)), /인격 일러스트/);
});
