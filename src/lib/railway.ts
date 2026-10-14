import type { LibraryEntry } from './library';

export const LEGACY_RAILWAYS = ['railway6', 'railway2', 'railway1'] as const;

/** Seed the unified evaluation once. Retain every legacy value for old backups. */
export function unifyRailway(entry: LibraryEntry): LibraryEntry {
  if (Object.hasOwn(entry.tiers, 'railway')) return entry;
  const order = [...new Set([entry.scoreRailway ?? 'railway6', ...LEGACY_RAILWAYS])];
  const source = order.find(id => entry.scores?.[id] != null)
    ?? order.find(id => entry.tiers[id] !== 'unrated')
    ?? order.find(id => entry.contentIds.includes(id))
    ?? order[0];
  const scores = entry.scores && !Object.hasOwn(entry.scores, 'railway') && Object.hasOwn(entry.scores, source)
    ? { ...entry.scores, railway: entry.scores[source] } : entry.scores;
  return {
    ...entry,
    tiers: { ...entry.tiers, railway: entry.tiers[source] ?? 'unrated' },
    ...(scores ? { scores } : {}),
    contentIds: entry.contentIds.some(id => LEGACY_RAILWAYS.some(legacy => legacy === id))
      ? [...new Set([...entry.contentIds, 'railway' as const])] : [...entry.contentIds],
  };
}
