// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import {
  toDomainWork,
  toDomainWorkDetail,
  toDomainEdition,
  extractAuthorIds,
} from './open-library.mapper';
import { RawSearchDoc, RawWork, RawEditionEntry } from '../upstream/open-library-client.interface';

describe('open-library.mapper', () => {
  describe('toDomainWork (search result normalization)', () => {
    it('maps a fully-populated search doc', () => {
      const doc: RawSearchDoc = {
        key: '/works/OL893414W',
        title: 'Dune',
        author_name: ['Frank Herbert'],
        first_publish_year: 1965,
        cover_i: 12345,
        edition_count: 155,
      };

      expect(toDomainWork(doc)).toEqual({
        id: 'OL893414W',
        title: 'Dune',
        authors: ['Frank Herbert'],
        firstPublishYear: 1965,
        coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
      });
    });

    it('defaults missing author_name to an empty authors array', () => {
      const doc: RawSearchDoc = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWork(doc).authors).toEqual([]);
    });

    it('defaults missing cover_i to an empty coverUrl', () => {
      const doc: RawSearchDoc = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWork(doc).coverUrl).toBe('');
    });

    it('defaults missing first_publish_year to 0', () => {
      const doc: RawSearchDoc = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWork(doc).firstPublishYear).toBe(0);
    });
  });

  describe('toDomainWorkDetail (work normalization)', () => {
    it('collapses a plain-string description to itself', () => {
      const work: RawWork = { key: '/works/OL893414W', title: 'Dune', description: 'A desert planet.' };

      expect(toDomainWorkDetail(work).description).toBe('A desert planet.');
    });

    it('collapses a {type,value} description object to its value', () => {
      const work: RawWork = {
        key: '/works/OL17732W',
        title: 'Bible',
        description: { type: '/type/text', value: 'A religious text.' },
      };

      expect(toDomainWorkDetail(work).description).toBe('A religious text.');
    });

    it('defaults a missing description to an empty string', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWorkDetail(work).description).toBe('');
    });

    it('treats a -1 entry in covers as no cover available', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled', covers: [-1] };

      expect(toDomainWorkDetail(work).coverUrl).toBe('');
    });

    it('uses the first valid (non -1) cover id when present', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled', covers: [-1, 999] };

      expect(toDomainWorkDetail(work).coverUrl).toBe('https://covers.openlibrary.org/b/id/999-M.jpg');
    });

    it('defaults missing subjects to an empty array', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWorkDetail(work).subjects).toEqual([]);
    });

    it('uses the caller-resolved author names, since raw work.authors only has keys', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWorkDetail(work, ['Frank Herbert']).authors).toEqual(['Frank Herbert']);
    });

    it('defaults authors to an empty array when none were resolved', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled' };

      expect(toDomainWorkDetail(work).authors).toEqual([]);
    });
  });

  describe('extractAuthorIds', () => {
    it('extracts short author ids from the raw author key references', () => {
      const work: RawWork = {
        key: '/works/OL1W',
        title: 'Untitled',
        authors: [{ author: { key: '/authors/OL123A' } }, { author: { key: '/authors/OL456A' } }],
      };

      expect(extractAuthorIds(work)).toEqual(['OL123A', 'OL456A']);
    });

    it('returns an empty array when the work has no authors field', () => {
      const work: RawWork = { key: '/works/OL1W', title: 'Untitled' };

      expect(extractAuthorIds(work)).toEqual([]);
    });
  });

  describe('toDomainEdition', () => {
    it('maps a fully-populated edition entry', () => {
      const entry: RawEditionEntry = {
        key: '/books/OL123M',
        title: 'Dune (Paperback)',
        publish_date: '1990',
        publishers: ['Ace Books'],
      };

      expect(toDomainEdition(entry)).toEqual({
        id: 'OL123M',
        title: 'Dune (Paperback)',
        publishDate: '1990',
        publishers: ['Ace Books'],
      });
    });

    it('defaults a missing publish_date to an empty string', () => {
      const entry: RawEditionEntry = { key: '/books/OL1M', title: 'Untitled edition' };

      expect(toDomainEdition(entry).publishDate).toBe('');
    });

    it('defaults missing publishers to an empty array', () => {
      const entry: RawEditionEntry = { key: '/books/OL1M', title: 'Untitled edition' };

      expect(toDomainEdition(entry).publishers).toEqual([]);
    });
  });
});
