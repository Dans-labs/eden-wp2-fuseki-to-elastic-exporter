import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { ExportService } from './export.service';
import { FusekiService } from '../fuseki/fuseki.service';
import { JsonldProcessingService } from '../jsonld/jsonld-processing.service';
import { ElasticsearchIndexService } from '../elasticsearch/elasticsearch-index.service';
import { ELASTICSEARCH_CONFIG_KEY } from '../config';

describe('ExportService', () => {
  let service: ExportService;
  let fusekiService: FusekiService;
  let jsonldService: JsonldProcessingService;
  let esIndexService: ElasticsearchIndexService;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(ExportService)
      .mock(ConfigService)
      .impl((stub) => ({
        get: stub().mockImplementation((key: symbol) => {
          if (key === ELASTICSEARCH_CONFIG_KEY) {
            return { ELASTICSEARCH_ALIAS: 'test-index' };
          }
          return undefined;
        }),
      }))
      .compile();

    service = unit;
    fusekiService = unitRef.get(FusekiService) as unknown as FusekiService;
    jsonldService = unitRef.get(
      JsonldProcessingService,
    ) as unknown as JsonldProcessingService;
    esIndexService = unitRef.get(
      ElasticsearchIndexService,
    ) as unknown as ElasticsearchIndexService;
  });

  describe('exportAll', () => {
    it('should execute the full pipeline', async () => {
      const graphUris = [
        'http://example.org/graph1',
        'http://example.org/graph2',
      ];

      const graph1Doc = { '@id': 'http://example.org/graph1', data: 'a' };
      const graph2Doc = { '@id': 'http://example.org/graph2', data: 'b' };

      const flattenedDocs1 = [
        { '@id': 'http://example.org/doc1', '@type': 'Thing' },
      ];
      const flattenedDocs2 = [
        { '@id': 'http://example.org/doc2', '@type': 'Thing' },
      ];

      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValueOnce(
        graphUris,
      );
      (fusekiService.fetchGraph as jest.Mock)
        .mockResolvedValueOnce(graph1Doc)
        .mockResolvedValueOnce(graph2Doc);
      (jsonldService.flatten as jest.Mock)
        .mockResolvedValueOnce(flattenedDocs1)
        .mockResolvedValueOnce(flattenedDocs2);
      (esIndexService.ensureIndex as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (esIndexService.bulkIndex as jest.Mock).mockResolvedValueOnce(undefined);

      await service.exportAll();

      expect(fusekiService.listNamedGraphs).toHaveBeenCalled();
      expect(fusekiService.fetchGraph).toHaveBeenCalledWith(graphUris[0]);
      expect(fusekiService.fetchGraph).toHaveBeenCalledWith(graphUris[1]);
      expect(jsonldService.flatten).toHaveBeenCalledTimes(2);
      expect(esIndexService.ensureIndex).toHaveBeenCalledWith('test-index');
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith('test-index', [
        ...flattenedDocs1,
        ...flattenedDocs2,
      ]);
    });

    it('should handle empty graph list', async () => {
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValueOnce([]);
      (esIndexService.ensureIndex as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (esIndexService.bulkIndex as jest.Mock).mockResolvedValueOnce(undefined);

      await service.exportAll();

      expect(fusekiService.fetchGraph).not.toHaveBeenCalled();
      expect(jsonldService.flatten).not.toHaveBeenCalled();
      expect(esIndexService.ensureIndex).toHaveBeenCalledWith('test-index');
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith('test-index', []);
    });
  });
});
