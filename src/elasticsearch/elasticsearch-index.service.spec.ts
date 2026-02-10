import { TestBed } from '@suites/unit';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { errors } from '@elastic/elasticsearch';
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

    it('should create alias when index exists but alias does not', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(true);
      (esService.indices.getAlias as jest.Mock).mockRejectedValueOnce(
        new errors.ResponseError({
          statusCode: 404,
          body: {},
          headers: {},
          warnings: null,
          meta: {} as never,
        }),
      );
      (esService.indices.putAlias as jest.Mock).mockResolvedValueOnce({
        acknowledged: true,
      });

      await service.ensureIndex('test-index', 'test-alias');

      expect(esService.indices.getAlias).toHaveBeenCalledWith({
        name: 'test-alias',
      });
      expect(esService.indices.putAlias).toHaveBeenCalledWith({
        index: 'test-index',
        name: 'test-alias',
      });
    });

    it('should create both index and alias when neither exist', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(false);
      (esService.indices.create as jest.Mock).mockResolvedValueOnce({});
      (esService.indices.getAlias as jest.Mock).mockRejectedValueOnce(
        new errors.ResponseError({
          statusCode: 404,
          body: {},
          headers: {},
          warnings: null,
          meta: {} as never,
        }),
      );
      (esService.indices.putAlias as jest.Mock).mockResolvedValueOnce({
        acknowledged: true,
      });

      await service.ensureIndex('test-index', 'test-alias');

      expect(esService.indices.create).toHaveBeenCalled();
      expect(esService.indices.putAlias).toHaveBeenCalledWith({
        index: 'test-index',
        name: 'test-alias',
      });
    });

    it('should not create alias when it already points to this index', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(true);
      (esService.indices.getAlias as jest.Mock).mockResolvedValueOnce({
        'test-index': { aliases: { 'test-alias': {} } },
      });

      await service.ensureIndex('test-index', 'test-alias');

      expect(esService.indices.putAlias).not.toHaveBeenCalled();
    });

    it('should warn when alias exists but points to different index', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(true);
      (esService.indices.getAlias as jest.Mock).mockResolvedValueOnce({
        'other-index': { aliases: { 'test-alias': {} } },
      });

      await service.ensureIndex('test-index', 'test-alias');

      expect(esService.indices.putAlias).not.toHaveBeenCalled();
    });

    it('should not check alias when aliasName is not provided', async () => {
      (esService.indices.exists as jest.Mock).mockResolvedValueOnce(true);

      await service.ensureIndex('test-index');

      expect(esService.indices.getAlias).not.toHaveBeenCalled();
      expect(esService.indices.putAlias).not.toHaveBeenCalled();
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

  describe('bulkDelete', () => {
    it('should bulk delete documents using delete operations', async () => {
      (esService.bulk as jest.Mock).mockResolvedValueOnce({
        errors: false,
        items: [
          { delete: { _id: 'doc1', result: 'deleted' } },
          { delete: { _id: 'doc2', result: 'deleted' } },
        ],
      });

      await service.bulkDelete('test-index', ['doc1', 'doc2']);

      expect(esService.bulk).toHaveBeenCalledWith({
        operations: [
          { delete: { _index: 'test-index', _id: 'doc1' } },
          { delete: { _index: 'test-index', _id: 'doc2' } },
        ],
      });
    });

    it('should skip when documentIds array is empty', async () => {
      await service.bulkDelete('test-index', []);

      expect(esService.bulk).not.toHaveBeenCalled();
    });

    it('should log warnings but not throw when bulk response contains errors', async () => {
      (esService.bulk as jest.Mock).mockResolvedValueOnce({
        errors: true,
        items: [
          { delete: { _id: 'doc1', result: 'deleted' } },
          {
            delete: {
              _id: 'doc2',
              error: {
                type: 'document_missing_exception',
                reason: 'not found',
              },
            },
          },
        ],
      });

      await expect(
        service.bulkDelete('test-index', ['doc1', 'doc2']),
      ).resolves.not.toThrow();
    });
  });

  describe('swapAlias', () => {
    it('should swap alias from old index to new index', async () => {
      (esService.indices.getAlias as jest.Mock).mockResolvedValueOnce({
        'old-index': { aliases: { 'my-alias': {} } },
      });
      (esService.indices.updateAliases as jest.Mock).mockResolvedValueOnce({
        acknowledged: true,
      });

      await service.swapAlias('my-alias', 'new-index');

      expect(esService.indices.getAlias).toHaveBeenCalledWith({
        name: 'my-alias',
      });
      expect(esService.indices.updateAliases).toHaveBeenCalledWith({
        actions: [
          { remove: { index: 'old-index', alias: 'my-alias' } },
          { add: { index: 'new-index', alias: 'my-alias' } },
        ],
      });
    });

    it('should create alias when it does not exist (404)', async () => {
      (esService.indices.getAlias as jest.Mock).mockRejectedValueOnce(
        new errors.ResponseError({
          statusCode: 404,
          body: {},
          headers: {},
          warnings: null,
          meta: {} as never,
        }),
      );
      (esService.indices.updateAliases as jest.Mock).mockResolvedValueOnce({
        acknowledged: true,
      });

      await service.swapAlias('my-alias', 'new-index');

      expect(esService.indices.updateAliases).toHaveBeenCalledWith({
        actions: [{ add: { index: 'new-index', alias: 'my-alias' } }],
      });
    });

    it('should remove multiple old indices from alias', async () => {
      (esService.indices.getAlias as jest.Mock).mockResolvedValueOnce({
        'index-1': { aliases: { 'my-alias': {} } },
        'index-2': { aliases: { 'my-alias': {} } },
      });
      (esService.indices.updateAliases as jest.Mock).mockResolvedValueOnce({
        acknowledged: true,
      });

      await service.swapAlias('my-alias', 'new-index');

      expect(esService.indices.updateAliases).toHaveBeenCalledWith({
        actions: [
          { remove: { index: 'index-1', alias: 'my-alias' } },
          { remove: { index: 'index-2', alias: 'my-alias' } },
          { add: { index: 'new-index', alias: 'my-alias' } },
        ],
      });
    });

    it('should rethrow non-404 errors from getAlias', async () => {
      (esService.indices.getAlias as jest.Mock).mockRejectedValueOnce(
        new errors.ResponseError({
          statusCode: 500,
          body: {},
          headers: {},
          warnings: null,
          meta: {} as never,
        }),
      );

      await expect(
        service.swapAlias('my-alias', 'new-index'),
      ).rejects.toThrow();
    });
  });

  describe('deleteIndex', () => {
    it('should delete the index', async () => {
      (esService.indices.delete as jest.Mock).mockResolvedValueOnce({
        acknowledged: true,
      });

      await service.deleteIndex('test-index');

      expect(esService.indices.delete).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });
  });
});
