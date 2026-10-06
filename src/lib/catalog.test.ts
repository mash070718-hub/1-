import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CATALOG, CATALOG_BY_ID, CATALOG_METADATA, getCatalogRecord } from './catalog';
import { SINNERS, createCatalogLibrary, exportLibrary, parseLibrary } from './library';

test('catalog counts and game IDs are unique and agree with the source manifest', () => {
  assert.equal(CATALOG.length, CATALOG_METADATA.counts.identity + CATALOG_METADATA.counts.ego);
  for (const kind of ['identity', 'ego'] as const) {
    assert.equal(CATALOG.filter((record) => record.kind === kind).length, CATALOG_METADATA.counts[kind]);
  }
  assert.equal(new Set(CATALOG.map(({ id }) => id)).size, CATALOG.length);
  assert.equal(new Set(CATALOG.map(({ kind, gameId }) => `${kind}-${gameId}`)).size, CATALOG.length);
  assert.equal(CATALOG_BY_ID.size, CATALOG.length);
  assert.equal(getCatalogRecord('unknown-catalog-entry'), undefined);
});

test('all twelve sinners have identities and E.G.O. with official Korean localization names', () => {
  for (const sinner of SINNERS) {
    for (const kind of ['identity', 'ego'] as const) {
      assert.ok(CATALOG.some((record) => record.sinner === sinner && record.kind === kind), `${sinner}: ${kind}`);
    }
  }
  for (const record of CATALOG) {
    assert.ok(SINNERS.includes(record.sinner));
    assert.ok(record.sinnerId >= 1 && record.sinnerId <= 12);
    assert.equal(record.sinner, SINNERS[record.sinnerId - 1]);
    assert.ok(/[가-힣]/.test(record.name) || ['AEDD', 'LCE E.G.O:: AEDD'].includes(record.name), record.id);
    assert.equal(record.name, record.name.trim());
    assert.ok(!record.name.includes('예시'), record.id);
    assert.equal(record.id, `catalog-${record.kind}-${record.gameId}`);
  }
  assert.equal(getCatalogRecord('catalog-identity-10101')?.name, 'LCB 수감자');
  assert.equal(getCatalogRecord('catalog-ego-20101')?.name, '오감도');
  for (const { sinner, identity, ego } of CATALOG_METADATA.sinnerCounts) {
    assert.equal(CATALOG.filter((record) => record.sinner === sinner && record.kind === 'identity').length, identity);
    assert.equal(CATALOG.filter((record) => record.sinner === sinner && record.kind === 'ego').length, ego);
  }
});

test('source provenance and release dates identify the catalog coverage without future entries', () => {
  assert.ok(CATALOG_METADATA.sourceCommit.length >= 7);
  assert.ok(CATALOG_METADATA.sources.length >= 1);
  assert.ok(CATALOG_METADATA.coverageNote.trim().length > 0);
  const verifiedDate = CATALOG_METADATA.verifiedAt.slice(0, 10);
  assert.match(verifiedDate, /^\d{4}-\d{2}-\d{2}$/);
  const releaseDates = CATALOG.map(({ releaseDate, sourceUrl }) => {
    assert.match(releaseDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${releaseDate}T00:00:00.000Z`).toISOString().slice(0, 10), releaseDate);
    assert.ok(releaseDate <= verifiedDate, releaseDate);
    assert.match(sourceUrl, /^https:\/\//);
    return releaseDate;
  });
  assert.equal([...releaseDates].sort().at(-1), CATALOG_METADATA.latestReleaseDate);
  for (const source of CATALOG_METADATA.sources) assert.match(source.url, /^https:\/\//);
  assert.ok(CATALOG.every((record) => !CATALOG_METADATA.excludedUpcomingIds.includes(record.gameId)));
});

test('every catalog illustration and thumbnail is bundled locally as a valid WebP', () => {
  for (const record of CATALOG) {
    for (const image of [record.image, record.thumbnail]) {
      assert.match(image, /^\/images\/catalog\/[a-z0-9-]+\.webp$/);
      const path = fileURLToPath(new URL(`../../public${image}`, import.meta.url));
      const bytes = readFileSync(path);
      assert.ok(bytes.length > 100, image);
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', image);
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', image);
      assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, image);
    }
  }
});

test('official entries have no invented evaluations and remain valid version 1 backups', () => {
  const library = createCatalogLibrary();
  assert.equal(library.entries.length, CATALOG.length);
  for (const entry of library.entries) {
    assert.equal(entry.description, '');
    assert.equal(entry.strengths, '');
    assert.equal(entry.weaknesses, '');
    assert.equal(entry.operation, '');
    assert.equal(entry.formationCode, '');
    assert.ok(Object.values(entry.tiers).every((tier) => tier === 'unrated'));
  }
  assert.deepEqual(parseLibrary(exportLibrary(library)), library);
});
