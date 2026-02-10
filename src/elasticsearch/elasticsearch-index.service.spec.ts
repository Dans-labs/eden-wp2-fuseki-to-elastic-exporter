import { TestBed } from '@suites/unit';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ElasticsearchIndexService } from './elasticsearch-index.service';

describe('ElasticsearchIndexService', () => {
  let service: ElasticsearchIndexService;
  let esService: ElasticsearchService;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      ElasticsearchIndexService,
    ).compile();

    service = unit;
    esService = unitRef.get(
      ElasticsearchService,
    ) as unknown as ElasticsearchService;
  });

  describe('ensureIndex', () => {
    it('should create the index when it does not exist', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(false);
      (esService.indices.create as jest.Mock).mockResolvedValueOnce({});

      await service.ensureIndex('test-index');

      expect(esService.indices.exists).toHaveBeenCalledWith({
        index: 'test-index',
      });
      expect(esService.indices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'test-index',
          mappings: expect.objectContaining({
            dynamic_templates: expect.arrayContaining([
              expect.objectContaining({
                strings_as_text_and_keyword: expect.anything(),
              }),
              expect.objectContaining({
                objects_as_nested: expect.anything(),
              }),
            ]),
          }),
        }),
      );
    });

    it('should not create the index when it already exists', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(true);

      await service.ensureIndex('test-index');

      expect(esService.indices.exists).toHaveBeenCalledWith({
        index: 'test-index',
      });
      expect(esService.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('bulkIndex', () => {
    it('should bulk index documents using @id as _id', async () => {
      (esService.bulk as jest.Mock).mockResolvedValueOnce({
        errors: false,
        items: [],
      });

      const documents = [
        { '@id': 'http://example.org/doc1', '@type': 'Thing' },
        { '@id': 'http://example.org/doc2', '@type': 'Thing' },
      ];

      await service.bulkIndex('test-index', documents);

      expect(esService.bulk).toHaveBeenCalledWith({
        operations: [
          { index: { _index: 'test-index', _id: 'http://example.org/doc1' } },
          documents[0],
          { index: { _index: 'test-index', _id: 'http://example.org/doc2' } },
          documents[1],
        ],
      });
    });

    it('should skip when documents array is empty', async () => {
      await service.bulkIndex('test-index', []);

      expect(esService.bulk).not.toHaveBeenCalled();
    });

    it('should throw when bulk response contains errors', async () => {
      (esService.bulk as jest.Mock).mockResolvedValueOnce({
        errors: true,
        items: [
          {
            index: {
              _id: 'http://example.org/doc1',
              error: { type: 'mapper_parsing_exception', reason: 'failed' },
            },
          },
        ],
      });

      const documents = [
        { '@id': 'http://example.org/doc1', '@type': 'Thing' },
      ];

      await expect(service.bulkIndex('test-index', documents)).rejects.toThrow(
        'Bulk indexing failed with 1 errors',
      );
    });
  });
});
