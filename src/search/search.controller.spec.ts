import { TestBed } from '@suites/unit';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: SearchService;

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(SearchController).compile();

    controller = unit;
    searchService = unitRef.get(SearchService) as unknown as SearchService;
  });

  describe('search', () => {
    it('should forward index and body to the search service', async () => {
      const body = { query: { match_all: {} } };
      const mockResult = { hits: { hits: [] } };
      (searchService.search as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await controller.search('eden', body);

      expect(searchService.search).toHaveBeenCalledWith('eden', body);
      expect(result).toBe(mockResult);
    });
  });

  describe('getSource', () => {
    it('should forward index and id to the search service', async () => {
      const mockSource = { title: 'Test' };
      (searchService.getSource as jest.Mock).mockResolvedValueOnce(mockSource);

      const result = await controller.getSource('eden', 'doc-1');

      expect(searchService.getSource).toHaveBeenCalledWith('eden', 'doc-1');
      expect(result).toBe(mockSource);
    });
  });
});
