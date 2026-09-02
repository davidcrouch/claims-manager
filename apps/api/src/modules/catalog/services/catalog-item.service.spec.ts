import { CatalogItemService } from './catalog-item.service';

describe('CatalogItemService', () => {
  const tenantId = '00000000-0000-0000-0000-00000000aaaa';
  const parentCategoryId = '11111111-1111-1111-1111-111111111111';
  const childCategoryId = '22222222-2222-2222-2222-222222222222';

  function makeService(overrides: {
    findDescendantIds?: jest.Mock;
    findMany?: jest.Mock;
  } = {}) {
    const itemsRepo = {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const categoriesRepo = {
      findDescendantIds:
        overrides.findDescendantIds ??
        jest.fn().mockImplementation(({ categoryId }: { categoryId: string }) => {
          if (categoryId === parentCategoryId) {
            return Promise.resolve([parentCategoryId, childCategoryId]);
          }
          return Promise.resolve([categoryId]);
        }),
    };
    const tenantContext = {
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };

    const service = new CatalogItemService(
      itemsRepo as never,
      {} as never,
      {} as never,
      categoriesRepo as never,
      {} as never,
      {} as never,
      tenantContext as never,
    );

    return { service, itemsRepo, categoriesRepo };
  }

  describe('findMany category filter', () => {
    it('passes no categoryIds when no category filter is provided', async () => {
      const { service, itemsRepo, categoriesRepo } = makeService();

      await service.findMany({ catalogId: 'cat-1' });

      expect(categoriesRepo.findDescendantIds).not.toHaveBeenCalled();
      expect(itemsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          catalogId: 'cat-1',
          categoryIds: undefined,
        }),
      );
    });

    it('expands categoryIds to descendant ids before querying items', async () => {
      const { service, itemsRepo } = makeService();

      await service.findMany({ categoryIds: [parentCategoryId] });

      expect(itemsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: [parentCategoryId, childCategoryId],
        }),
      );
    });

    it('expands categoryId query param to descendant ids before querying items', async () => {
      const { service, itemsRepo } = makeService();

      await service.findMany({ categoryId: parentCategoryId });

      expect(itemsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: [parentCategoryId, childCategoryId],
        }),
      );
    });

    it('merges categoryId and categoryIds then deduplicates expanded ids', async () => {
      const { service, itemsRepo } = makeService();

      await service.findMany({
        categoryId: parentCategoryId,
        categoryIds: [childCategoryId],
      });

      expect(itemsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: expect.arrayContaining([parentCategoryId, childCategoryId]),
        }),
      );
      const call = itemsRepo.findMany.mock.calls[0]?.[0] as { categoryIds: string[] };
      expect(call.categoryIds).toHaveLength(2);
    });

    it('preserves __uncategorized__ without calling descendant lookup', async () => {
      const { service, itemsRepo, categoriesRepo } = makeService();

      await service.findMany({ categoryIds: ['__uncategorized__'] });

      expect(categoriesRepo.findDescendantIds).not.toHaveBeenCalled();
      expect(itemsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: ['__uncategorized__'],
        }),
      );
    });

    it('combines __uncategorized__ with expanded real category ids', async () => {
      const { service, itemsRepo } = makeService();

      await service.findMany({
        categoryIds: ['__uncategorized__', parentCategoryId],
      });

      expect(itemsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: ['__uncategorized__', parentCategoryId, childCategoryId],
        }),
      );
    });
  });
});
