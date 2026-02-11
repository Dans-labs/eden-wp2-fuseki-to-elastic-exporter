import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { ReindexService } from './reindex.service';
import { FusekiService } from '../fuseki/fuseki.service';
import { JsonldProcessingService } from '../jsonld/jsonld-processing.service';
import { ElasticsearchIndexService } from '../elasticsearch/elasticsearch-index.service';
import { GraphRegistryService } from '../graph-sync/graph-registry.service';
import { SyncStateService } from '../graph-sync/sync-state.service';
import { RdfDeltaClientService } from '../rdf-delta/rdf-delta-client.service';
import { ELASTICSEARCH_CONFIG_KEY } from '../config';

describe('ReindexService', () => {
  let service: ReindexService;
  let fusekiService: FusekiService;
  let jsonldService: JsonldProcessingService;
  let esIndexService: ElasticsearchIndexService;
  let graphRegistryService: GraphRegistryService;
  let syncStateService: SyncStateService;
  let deltaClient: RdfDeltaClientService;

  const esAlias = 'eden-test';

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(ReindexService)
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn().mockImplementation((key: symbol) => {
          if (key === ELASTICSEARCH_CONFIG_KEY) {
            return { ELASTICSEARCH_ALIAS: esAlias };
          }
        }),
      }))
      .mock(FusekiService)
      .impl(() => ({
        fetchGraph: jest.fn(),
        listNamedGraphs: jest.fn(),
      }))
      .mock(JsonldProcessingService)
      .impl(() => ({
        flatten: jest.fn(),
      }))
      .mock(ElasticsearchIndexService)
      .impl(() => ({
        ensureIndex: jest.fn(),
        bulkIndex: jest.fn(),
        swapAlias: jest.fn(),
        deleteIndex: jest.fn(),
      }))
      .mock(GraphRegistryService)
      .impl(() => ({
        deleteAll: jest.fn(),
        upsert: jest.fn(),
      }))
      .mock(SyncStateService)
      .impl(() => ({
        get: jest.fn(),
        updateActiveIndex: jest.fn(),
      }))
      .mock(RdfDeltaClientService)
      .impl(() => ({
        describeLog: jest.fn(),
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
    graphRegistryService = unitRef.get(
      GraphRegistryService,
    ) as unknown as GraphRegistryService;
    syncStateService = unitRef.get(
      SyncStateService,
    ) as unknown as SyncStateService;
    deltaClient = unitRef.get(
      RdfDeltaClientService,
    ) as unknown as RdfDeltaClientService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reindexAll', () => {
    const flattenedDocs = [
      { '@id': 'http://example.org/doc/1', title: 'Doc 1' },
      { '@id': 'http://example.org/doc/2', title: 'Doc 2' },
    ];

    it('should perform full reindex with blue-green swap', async () => {
      (syncStateService.get as jest.Mock).mockResolvedValue({
        id: 'singleton',
        lastPatchVersion: 5,
        activeIndexName: 'eden-test-old',
      });
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValue([
        'http://example.org/graph/1',
      ]);
      (fusekiService.fetchGraph as jest.Mock).mockResolvedValue({
        '@context': {},
        '@graph': [],
      });
      (jsonldService.flatten as jest.Mock).mockResolvedValue(flattenedDocs);
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 10,
      });

      await service.reindexAll();

      expect(esIndexService.ensureIndex).toHaveBeenCalledWith(
        expect.stringMatching(/^eden-test-\d+$/),
      );
      expect(graphRegistryService.deleteAll).toHaveBeenCalled();
      expect(fusekiService.fetchGraph).toHaveBeenCalledWith(
        'http://example.org/graph/1',
      );
      expect(jsonldService.flatten).toHaveBeenCalled();
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith(
        expect.stringMatching(/^eden-test-\d+$/),
        flattenedDocs,
      );
      expect(graphRegistryService.upsert).toHaveBeenCalledWith(
        'http://example.org/graph/1',
        ['http://example.org/doc/1', 'http://example.org/doc/2'],
      );
      expect(esIndexService.swapAlias).toHaveBeenCalledWith(
        esAlias,
        expect.stringMatching(/^eden-test-\d+$/),
      );
      expect(syncStateService.updateActiveIndex).toHaveBeenCalledWith(
        expect.stringMatching(/^eden-test-\d+$/),
        10,
      );
      expect(esIndexService.deleteIndex).toHaveBeenCalledWith('eden-test-old');
    });

    it('should handle empty graph list', async () => {
      (syncStateService.get as jest.Mock).mockResolvedValue({
        id: 'singleton',
        lastPatchVersion: 0,
        activeIndexName: null,
      });
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValue([]);
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 0,
        maxVersion: 0,
      });

      await service.reindexAll();

      expect(esIndexService.ensureIndex).toHaveBeenCalled();
      expect(graphRegistryService.deleteAll).toHaveBeenCalled();
      expect(fusekiService.fetchGraph).not.toHaveBeenCalled();
      expect(esIndexService.bulkIndex).not.toHaveBeenCalled();
      expect(esIndexService.swapAlias).toHaveBeenCalledWith(
        esAlias,
        expect.stringMatching(/^eden-test-\d+$/),
      );
      expect(syncStateService.updateActiveIndex).toHaveBeenCalledWith(
        expect.stringMatching(/^eden-test-\d+$/),
        0,
      );
      expect(esIndexService.deleteIndex).not.toHaveBeenCalled();
    });

    it('should not throw when old index deletion fails', async () => {
      (syncStateService.get as jest.Mock).mockResolvedValue({
        id: 'singleton',
        lastPatchVersion: 5,
        activeIndexName: 'eden-test-old',
      });
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValue([]);
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 10,
      });
      (esIndexService.deleteIndex as jest.Mock).mockRejectedValue(
        new Error('index not found'),
      );

      await expect(service.reindexAll()).resolves.toBeUndefined();

      expect(esIndexService.deleteIndex).toHaveBeenCalledWith('eden-test-old');
    });
  });
});
