// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Work, WorkDetail, Edition } from '../proto/gen/catalog';
import { RawSearchDoc, RawWork, RawEditionEntry } from '../upstream/open-library-client.interface';

// The only module aware of Open Library's quirks: missing author_name,
// missing/-1 cover_i, and description's two shapes (plain string or
// {type,value}). Nothing outside this file should ever branch on those
// shapes again.

function extractId(key: string): string {
  const segments = key.split('/');
  return segments[segments.length - 1];
}

function coverUrlFromId(coverId: number | undefined): string {
  if (coverId === undefined || coverId < 0) return '';
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
}

function firstValidCoverUrl(covers: number[] | undefined): string {
  if (!covers) return '';
  const validId = covers.find((id) => id >= 0);
  return coverUrlFromId(validId);
}

function normalizeDescription(description: RawWork['description']): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  return description.value ?? '';
}

export function toDomainWork(doc: RawSearchDoc): Work {
  return {
    id: extractId(doc.key),
    title: doc.title,
    authors: doc.author_name ?? [],
    firstPublishYear: doc.first_publish_year ?? 0,
    coverUrl: coverUrlFromId(doc.cover_i),
  };
}

// The work detail endpoint only carries author keys, not display names;
// resolving a name is a separate upstream call per author. The service
// resolves them (bounded, partial-failure tolerant, see CatalogService)
// and passes the names in; this mapper stays pure and synchronous.
export function extractAuthorIds(work: RawWork): string[] {
  return (work.authors ?? []).map((ref) => extractId(ref.author.key));
}

export function toDomainWorkDetail(work: RawWork, authorNames: string[] = []): WorkDetail {
  return {
    id: extractId(work.key),
    title: work.title,
    authors: authorNames,
    description: normalizeDescription(work.description),
    subjects: work.subjects ?? [],
    coverUrl: firstValidCoverUrl(work.covers),
  };
}

export function toDomainEdition(entry: RawEditionEntry): Edition {
  return {
    id: extractId(entry.key),
    title: entry.title,
    publishDate: entry.publish_date ?? '',
    publishers: entry.publishers ?? [],
  };
}
