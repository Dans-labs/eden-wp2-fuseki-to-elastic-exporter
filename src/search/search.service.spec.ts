import { TestBed } from '@suites/unit';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { NotFoundException } from '@nestjs/common';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let esService: ElasticsearchService;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(SearchService).compile();

    service = unit;
    esService = unitRef.get(
      ElasticsearchService,
    ) as unknown as ElasticsearchService;
  });

  describe('search', () => {
    it('should forward index and body to elasticsearch search', async () => {
      const body = { query: { match_all: {} } };
      const mockResult = { hits: { hits: [] } };
      (esService.search as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await service.search('eden', body);

      expect(esService.search).toHaveBeenCalledWith({
        index: 'eden',
        ...body,
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('getSource', () => {
    it('should return the document source by id', async () => {
      const mockSource = { title: 'Test' };
      (esService.getSource as jest.Mock).mockResolvedValueOnce(mockSource);

      const result = await service.getSource('eden', 'doc-1');

      expect(esService.getSource).toHaveBeenCalledWith({
        index: 'eden',
        id: 'doc-1',
      });
      expect(result).toBe(mockSource);
    });

    it('should throw NotFoundException when document is not found', async () => {
      const error = Object.assign(new Error('Not Found'), {
        statusCode: 404,
      });
      (esService.getSource as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.getSource('eden', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should rethrow non-404 errors', async () => {
      const error = new Error('Connection failed');
      (esService.getSource as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.getSource('eden', 'doc-1')).rejects.toThrow(
        'Connection failed',
      );
    });
  });
});
