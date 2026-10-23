import catalog from '../data/catalog.json' with { type: 'json' };

export type IdentityArtwork = 'uptie1' | 'uptie3';
export interface CatalogArtwork { image: string; thumbnail: string }

/** Official game metadata stays separate from personal, version 1 notebook records. */
export interface CatalogRecord {
  id: string;
  gameId: string;
  kind: 'identity' | 'ego';
  name: string;
  sinner: string;
  sinnerId: number;
  rarity: string;
  releaseDate: string;
  season: number | string;
  tags: string[];
  image: string;
  thumbnail: string;
  artworks?: Record<IdentityArtwork, CatalogArtwork>;
  sourceUrl: string;
  affinity?: string;
}

export interface CatalogMetadata {
  automaticUpdatePolicy?: string;
  verifiedAt: string;
  asOf: string;
  sourceUpdatedAt: string;
  sourceCommit: string;
  localizationCommit: string;
  latestReleaseDate: string;
  gameVersion: string;
  coverageNote: string;
  sources: { label: string; url: string }[];
  counts: { identity: number; ego: number };
  sinnerCounts: { sinner: string; identity: number; ego: number }[];
  excludedUpcomingIds: string[];
  copyright: string;
}

export const CATALOG: readonly CatalogRecord[] = catalog.entries as CatalogRecord[];
export const CATALOG_METADATA: CatalogMetadata = catalog.metadata;
export const CATALOG_BY_ID: ReadonlyMap<string, CatalogRecord> = new Map(
  CATALOG.map((record) => [record.id, record]),
);

export function getCatalogRecord(id: string): CatalogRecord | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getArtworkChoice(entry: { id: string; artwork?: IdentityArtwork }): IdentityArtwork {
  return entry.artwork ?? (getCatalogRecord(entry.id)?.rarity === '0' ? 'uptie1' : 'uptie3');
}

/** The same saved choice drives lists, details, formations and first-member deck covers. */
export function getEntryArtwork(entry: { id: string; artwork?: IdentityArtwork } | undefined, large = false): string | undefined {
  if (!entry) return undefined;
  const record = getCatalogRecord(entry.id);
  const art = record?.kind === 'identity' ? record.artworks?.[getArtworkChoice(entry)] ?? record : record;
  return large ? art?.image : art?.thumbnail;
}
