import catalog from '../data/catalog.json';

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
  sourceUrl: string;
  affinity?: string;
}

export interface CatalogMetadata {
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
