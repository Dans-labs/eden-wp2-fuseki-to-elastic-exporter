import { TestBed } from '@suites/unit';
import { GraphSyncService } from './graph-sync.service';
import { FusekiService } from '../fuseki/fuseki.service';
import { JsonldProcessingService } from '../jsonld/jsonld-processing.service';
import { ElasticsearchIndexService } from '../elasticsearch/elasticsearch-index.service';
import { GraphRegistryService } from './graph-registry.service';

describe('GraphSyncService', () => {
  let service: GraphSyncService;
  let fusekiService: FusekiService;
  let jsonldService: JsonldProcessingService;
  let esIndexService: ElasticsearchIndexService;
  let graphRegistryService: GraphRegistryService;

  const graphUri = 'http://example.org/graph/1';
  const indexName = 'eden-sync-1234';

  const flattenedDocs = [
    { '@id': 'http://example.org/doc/1', title: 'Doc 1' },
    { '@id': 'http://example.org/doc/2', title: 'Doc 2' },
  ];

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(GraphSyncService)
      .mock(FusekiService)
      .impl(() => ({
        fetchGraph: jest.fn(),
        fetchResources: jest.fn(),
      }))
      .mock(JsonldProcessingService)
      .impl(() => ({
        flatten: jest.fn(),
      }))
      .mock(ElasticsearchIndexService)
      .impl(() => ({
        bulkIndex: jest.fn(),
        bulkDelete: jest.fn(),
      }))
      .mock(GraphRegistryService)
      .impl(() => ({
        findByGraphUri: jest.fn(),
        upsert: jest.fn(),
        updateDocumentIds: jest.fn(),
        delete: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncGraph', () => {
    it('should index a new graph when no registry exists', async () => {
      const rawDocument = { '@context': {}, '@graph': [] };
      (fusekiService.fetchGraph as jest.Mock).mockResolvedValueOnce(
        rawDocument,
      );
      (jsonldService.flatten as jest.Mock).mockResolvedValueOnce(flattenedDocs);
      (graphRegistryService.findByGraphUri as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (esIndexService.bulkIndex as jest.Mock).mockResolvedValueOnce(undefined);
      (graphRegistryService.upsert as jest.Mock).mockResolvedValueOnce({});

      await service.syncGraph(graphUri, indexName);

      expect(fusekiService.fetchGraph).toHaveBeenCalledWith(graphUri);
      expect(jsonldService.flatten).toHaveBeenCalledWith(rawDocument);
      expect(graphRegistryService.findByGraphUri).toHaveBeenCalledWith(
        graphUri,
      );
      expect(esIndexService.bulkDelete).not.toHaveBeenCalled();
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith(
        indexName,
        flattenedDocs,
      );
      expect(graphRegistryService.upsert).toHaveBeenCalledWith(graphUri, [
        'http://example.org/doc/1',
        'http://example.org/doc/2',
      ]);
    });

    it('should delete removed documents when graph content changes', async () => {
      const rawDocument = { '@context': {}, '@graph': [] };
      (fusekiService.fetchGraph as jest.Mock).mockResolvedValueOnce(
        rawDocument,
      );
      (jsonldService.flatten as jest.Mock).mockResolvedValueOnce(flattenedDocs);
      (graphRegistryService.findByGraphUri as jest.Mock).mockResolvedValueOnce({
        id: 'uuid-1',
        graphUri,
        documentIds: [
          'http://example.org/doc/1',
          'http://example.org/doc/2',
          'http://example.org/doc/3',
        ],
        documentCount: 3,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      });
      (esIndexService.bulkDelete as jest.Mock).mockResolvedValueOnce(undefined);
      (esIndexService.bulkIndex as jest.Mock).mockResolvedValueOnce(undefined);
      (graphRegistryService.upsert as jest.Mock).mockResolvedValueOnce({});

      await service.syncGraph(graphUri, indexName);

      expect(esIndexService.bulkDelete).toHaveBeenCalledWith(indexName, [
        'http://example.org/doc/3',
      ]);
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith(
        indexName,
        flattenedDocs,
      );
      expect(graphRegistryService.upsert).toHaveBeenCalledWith(graphUri, [
        'http://example.org/doc/1',
        'http://example.org/doc/2',
      ]);
    });
  });

  describe('syncResources', () => {
    const subjectUris = [
      'http://example.org/doc/1',
      'http://example.org/doc/2',
      'http://example.org/doc/3',
    ];

    it('should upsert returned resources and delete missing ones', async () => {
      const rawDocument = { '@context': {}, '@graph': [] };
      (fusekiService.fetchResources as jest.Mock).mockResolvedValueOnce(
        rawDocument,
      );
      (jsonldService.flatten as jest.Mock).mockResolvedValueOnce(flattenedDocs);
      (esIndexService.bulkIndex as jest.Mock).mockResolvedValueOnce(undefined);
      (esIndexService.bulkDelete as jest.Mock).mockResolvedValueOnce(undefined);
      (
        graphRegistryService.updateDocumentIds as jest.Mock
      ).mockResolvedValueOnce({});

      await service.syncResources(graphUri, subjectUris, indexName);

      expect(fusekiService.fetchResources).toHaveBeenCalledWith(
        graphUri,
        subjectUris,
      );
      expect(jsonldService.flatten).toHaveBeenCalledWith(rawDocument);
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith(
        indexName,
        flattenedDocs,
      );
      // doc/3 was requested but not returned → should be deleted
      expect(esIndexService.bulkDelete).toHaveBeenCalledWith(indexName, [
        'http://example.org/doc/3',
      ]);
      expect(graphRegistryService.updateDocumentIds).toHaveBeenCalledWith(
        graphUri,
        ['http://example.org/doc/1', 'http://example.org/doc/2'],
        ['http://example.org/doc/3'],
      );
    });

    it('should not call bulkDelete when all subjects are returned', async () => {
      const twoSubjects = [
        'http://example.org/doc/1',
        'http://example.org/doc/2',
      ];
      const rawDocument = { '@context': {}, '@graph': [] };
      (fusekiService.fetchResources as jest.Mock).mockResolvedValueOnce(
        rawDocument,
      );
      (jsonldService.flatten as jest.Mock).mockResolvedValueOnce(flattenedDocs);
      (esIndexService.bulkIndex as jest.Mock).mockResolvedValueOnce(undefined);
      (
        graphRegistryService.updateDocumentIds as jest.Mock
      ).mockResolvedValueOnce({});

      await service.syncResources(graphUri, twoSubjects, indexName);

      expect(esIndexService.bulkDelete).not.toHaveBeenCalled();
      expect(esIndexService.bulkIndex).toHaveBeenCalledWith(
        indexName,
        flattenedDocs,
      );
    });

    it('should delete all subjects when none are returned from Fuseki', async () => {
      const rawDocument = { '@context': {}, '@graph': [] };
      (fusekiService.fetchResources as jest.Mock).mockResolvedValueOnce(
        rawDocument,
      );
      (jsonldService.flatten as jest.Mock).mockResolvedValueOnce([]);
      (esIndexService.bulkDelete as jest.Mock).mockResolvedValueOnce(undefined);
      (
        graphRegistryService.updateDocumentIds as jest.Mock
      ).mockResolvedValueOnce({});

      await service.syncResources(graphUri, subjectUris, indexName);

      expect(esIndexService.bulkIndex).not.toHaveBeenCalled();
      expect(esIndexService.bulkDelete).toHaveBeenCalledWith(
        indexName,
        subjectUris,
      );
      expect(graphRegistryService.updateDocumentIds).toHaveBeenCalledWith(
        graphUri,
        [],
        subjectUris,
      );
    });
  });

  describe('deleteGraph', () => {
    it('should delete documents and registry for an existing graph', async () => {
      const existingRegistry = {
        id: 'uuid-1',
        graphUri,
        documentIds: ['http://example.org/doc/1', 'http://example.org/doc/2'],
        documentCount: 2,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      };
      (graphRegistryService.findByGraphUri as jest.Mock).mockResolvedValueOnce(
        existingRegistry,
      );
      (esIndexService.bulkDelete as jest.Mock).mockResolvedValueOnce(undefined);
      (graphRegistryService.delete as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      await service.deleteGraph(graphUri, indexName);

      expect(graphRegistryService.findByGraphUri).toHaveBeenCalledWith(
        graphUri,
      );
      expect(esIndexService.bulkDelete).toHaveBeenCalledWith(indexName, [
        'http://example.org/doc/1',
        'http://example.org/doc/2',
      ]);
      expect(graphRegistryService.delete).toHaveBeenCalledWith(graphUri);
    });

    it('should be a no-op when graph is not in registry', async () => {
      (graphRegistryService.findByGraphUri as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await service.deleteGraph(graphUri, indexName);

      expect(graphRegistryService.findByGraphUri).toHaveBeenCalledWith(
        graphUri,
      );
      expect(esIndexService.bulkDelete).not.toHaveBeenCalled();
      expect(graphRegistryService.delete).not.toHaveBeenCalled();
    });
  });
});
