import {
  emptyLineItemsPage,
  paginateAssembledLineItems,
  parseLineItemsPageQuery,
} from './line-items-page';

describe('line-items-page', () => {
  describe('parseLineItemsPageQuery', () => {
    it('defaults to page 1 and 100 items', () => {
      expect(parseLineItemsPageQuery({})).toEqual({
        search: undefined,
        groupIds: undefined,
        page: 1,
        limit: 100,
        all: false,
      });
    });

    it('caps limit at 100', () => {
      expect(parseLineItemsPageQuery({ limit: '5000' }).limit).toBe(100);
    });

    it('parses comma-separated group ids and search', () => {
      const parsed = parseLineItemsPageQuery({
        search: '  timber  ',
        groupIds: 'a, b,,c',
        page: '2',
        all: 'true',
      });
      expect(parsed.search).toBe('timber');
      expect(parsed.groupIds).toEqual(['a', 'b', 'c']);
      expect(parsed.page).toBe(2);
      expect(parsed.all).toBe(true);
    });
  });

  describe('paginateAssembledLineItems', () => {
    const groups = [
      {
        id: 'g1',
        groupLabel: { name: 'Kitchen' },
        items: [
          { id: 'i1', name: 'Timber lining' },
          { id: 'i2', name: 'Plasterboard' },
        ],
        combos: [{ id: 'c1', name: 'Window assembly', items: [{ id: 'i3', name: 'Sill' }] }],
        scopes: [],
      },
      {
        id: 'g2',
        description: 'Bathroom',
        items: [{ id: 'i4', name: 'Vanity' }],
        combos: [],
        scopes: [{ id: 's1', name: 'Plumbing scope', items: [{ id: 'i5', name: 'Tap' }] }],
      },
    ];

    it('pages by display units and keeps BOM children with the parent', () => {
      const page = paginateAssembledLineItems(groups, { page: 1, limit: 3 });
      expect(page.total).toBe(5);
      expect(page.groups).toHaveLength(1);
      expect(page.groups[0].id).toBe('g1');
      expect(page.groups[0].items).toHaveLength(2);
      expect(page.groups[0].combos).toHaveLength(1);
      expect((page.groups[0].combos as Array<{ items: unknown[] }>)[0].items).toHaveLength(1);
    });

    it('filters search across all records before paging', () => {
      const page = paginateAssembledLineItems(groups, { search: 'vanity', page: 1, limit: 100 });
      expect(page.total).toBe(1);
      expect(page.groups[0].id).toBe('g2');
      expect(page.groupSummaries.map((g) => g.label)).toEqual(['Kitchen', 'Bathroom']);
    });

    it('filters by visible group ids', () => {
      const page = paginateAssembledLineItems(groups, { groupIds: ['g2'] });
      expect(page.total).toBe(2);
      expect(page.groups.every((g) => g.id === 'g2')).toBe(true);
    });

    it('returns the full set when all=true', () => {
      const page = paginateAssembledLineItems(groups, { all: true, limit: 1 });
      expect(page.groups).toHaveLength(2);
      expect(page.total).toBe(5);
    });

    it('includes empty groups in paged results', () => {
      const page = paginateAssembledLineItems(
        [
          {
            id: 'empty-1',
            groupLabel: { name: 'Bedroom' },
            items: [],
            combos: [],
            scopes: [],
          },
        ],
        { page: 1, limit: 100 },
      );
      expect(page.total).toBe(1);
      expect(page.groups).toHaveLength(1);
      expect(page.groups[0].id).toBe('empty-1');
      expect(page.groupSummaries.map((g) => g.label)).toEqual(['Bedroom']);
    });

    it('keeps empty groups when search matches the group label', () => {
      const page = paginateAssembledLineItems(
        [
          {
            id: 'empty-1',
            groupLabel: { name: 'Bedroom' },
            items: [],
            combos: [],
            scopes: [],
          },
          {
            id: 'empty-2',
            groupLabel: { name: 'Kitchen' },
            items: [],
            combos: [],
            scopes: [],
          },
        ],
        { search: 'bed', page: 1, limit: 100 },
      );
      expect(page.groups).toHaveLength(1);
      expect(page.groups[0].id).toBe('empty-1');
    });
  });

  it('emptyLineItemsPage returns a wrapped empty result', () => {
    expect(emptyLineItemsPage({ page: 3, limit: 100 })).toEqual({
      groups: [],
      total: 0,
      page: 3,
      limit: 100,
      groupSummaries: [],
    });
  });
});
