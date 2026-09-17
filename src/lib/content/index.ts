import { getCollection, type CollectionEntry } from 'astro:content';

export async function getPublished<
  C extends 'work' | 'writing' | 'music' | 'art',
>(collection: C, includeDrafts: boolean): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(collection);
  const visible = includeDrafts
    ? entries
    : entries.filter((entry) => !entry.data.draft);
  return visible.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getAllWork(
  includeDrafts: boolean,
): Promise<CollectionEntry<'work'>[]> {
  return getPublished('work', includeDrafts);
}

export async function getWorkBySlug(
  slug: string,
  includeDrafts: boolean,
): Promise<CollectionEntry<'work'> | undefined> {
  const all = await getAllWork(includeDrafts);
  return all.find((entry) => entry.id === slug);
}

export async function getFeaturedWork(
  includeDrafts: boolean,
): Promise<CollectionEntry<'work'>[]> {
  const all = await getAllWork(includeDrafts);
  return all.filter((entry) => entry.data.featured);
}
