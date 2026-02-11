import { TestBed } from '@suites/unit';
import { Job } from 'bull';
import { SyncQueueConsumer } from './sync-queue.consumer';
import { GraphSyncService } from '../graph-sync/graph-sync.service';

describe('SyncQueueConsumer', () => {
  let consumer: SyncQueueConsumer;
  let graphSyncService: GraphSyncService;

  const graphUri = 'http://example.org/graph/1';
  const indexName = 'eden-sync-1234';

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(SyncQueueConsumer)
      .mock(GraphSyncService)
      .impl(() => ({
        syncGraph: jest.fn(),
        syncResources: jest.fn(),
        deleteGraph: jest.fn(),
      }))
      .compile();

    consumer = unit;
    graphSyncService = unitRef.get(
      GraphSyncService,
    ) as unknown as GraphSyncService;
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('handleSyncGraph', () => {
    it('should delegate to syncGraph when no subjectUris', async () => {
      const job = {
        id: '1',
        data: { graphUri, indexName, subjectUris: null },
      } as unknown as Job<{
        graphUri: string;
        indexName: string;
        subjectUris: null;
      }>;

      await consumer.handleSyncGraph(job);

      expect(graphSyncService.syncGraph).toHaveBeenCalledWith(
        graphUri,
        indexName,
      );
      expect(graphSyncService.syncResources).not.toHaveBeenCalled();
    });

    it('should delegate to syncResources when subjectUris are provided', async () => {
      const subjectUris = ['http://example.org/s1', 'http://example.org/s2'];
      const job = {
        id: '2',
        data: { graphUri, indexName, subjectUris },
      } as unknown as Job<{
        graphUri: string;
        indexName: string;
        subjectUris: string[];
      }>;

      await consumer.handleSyncGraph(job);

      expect(graphSyncService.syncResources).toHaveBeenCalledWith(
        graphUri,
        subjectUris,
        indexName,
      );
      expect(graphSyncService.syncGraph).not.toHaveBeenCalled();
    });

    it('should delegate to syncGraph when subjectUris is empty array', async () => {
      const job = {
        id: '3',
        data: { graphUri, indexName, subjectUris: [] },
      } as unknown as Job<{
        graphUri: string;
        indexName: string;
        subjectUris: string[];
      }>;

      await consumer.handleSyncGraph(job);

      expect(graphSyncService.syncGraph).toHaveBeenCalledWith(
        graphUri,
        indexName,
      );
      expect(graphSyncService.syncResources).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteGraph', () => {
    it('should delegate to graphSyncService.deleteGraph', async () => {
      const job = {
        id: '4',
        data: { graphUri, indexName },
      } as unknown as Job<{ graphUri: string; indexName: string }>;

      await consumer.handleDeleteGraph(job);

      expect(graphSyncService.deleteGraph).toHaveBeenCalledWith(
        graphUri,
        indexName,
      );
    });
  });
});
