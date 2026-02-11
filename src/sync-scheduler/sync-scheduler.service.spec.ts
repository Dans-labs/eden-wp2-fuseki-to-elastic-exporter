import { TestBed } from '@suites/unit';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SyncSchedulerService } from './sync-scheduler.service';
import { RdfDeltaChangeDetectionService } from '../rdf-delta/rdf-delta-change-detection.service';
import { PatchGapError } from '../rdf-delta/patch-gap.error';
import { SyncStateService } from '../graph-sync/sync-state.service';
import { SyncQueueProducerService } from '../sync-queue/sync-queue.producer.service';
import { FusekiService } from '../fuseki/fuseki.service';
import { GraphRegistryService } from '../graph-sync/graph-registry.service';
import { ReindexService } from '../reindex/reindex.service';
import { ELASTICSEARCH_CONFIG_KEY } from '../config';

describe('SyncSchedulerService', () => {
  let service: SyncSchedulerService;
  let schedulerRegistry: SchedulerRegistry;
  let changeDetection: RdfDeltaChangeDetectionService;
  let syncState: SyncStateService;
  let syncQueueProducer: SyncQueueProducerService;
  let fusekiService: FusekiService;
  let graphRegistry: GraphRegistryService;
  let reindexService: ReindexService;

  const esAlias = 'eden-test';

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(SyncSchedulerService)
      .mock(SchedulerRegistry)
      .impl(() => ({
        addCronJob: jest.fn(),
      }))
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn().mockImplementation((key: symbol) => {
          if (key === ELASTICSEARCH_CONFIG_KEY) {
            return { ELASTICSEARCH_ALIAS: esAlias };
          }
        }),
      }))
      .mock(RdfDeltaChangeDetectionService)
      .impl(() => ({
        detectChanges: jest.fn(),
      }))
      .mock(SyncStateService)
      .impl(() => ({
        get: jest.fn(),
        updateLastPatchVersion: jest.fn(),
      }))
      .mock(SyncQueueProducerService)
      .impl(() => ({
        enqueueSyncGraph: jest.fn(),
        enqueueDeleteGraph: jest.fn(),
      }))
      .mock(FusekiService)
      .impl(() => ({
        listNamedGraphs: jest.fn(),
      }))
      .mock(GraphRegistryService)
      .impl(() => ({
        findAll: jest.fn(),
      }))
      .mock(ReindexService)
      .impl(() => ({
        reindexAll: jest.fn(),
      }))
      .compile();

    service = unit;
    schedulerRegistry = unitRef.get(
      SchedulerRegistry,
    ) as unknown as SchedulerRegistry;
    changeDetection = unitRef.get(
      RdfDeltaChangeDetectionService,
    ) as unknown as RdfDeltaChangeDetectionService;
    syncState = unitRef.get(SyncStateService) as unknown as SyncStateService;
    syncQueueProducer = unitRef.get(
      SyncQueueProducerService,
    ) as unknown as SyncQueueProducerService;
    fusekiService = unitRef.get(FusekiService) as unknown as FusekiService;
    graphRegistry = unitRef.get(
      GraphRegistryService,
    ) as unknown as GraphRegistryService;
    reindexService = unitRef.get(ReindexService) as unknown as ReindexService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should register a cron job with the scheduler registry', () => {
      service.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'incremental-sync',
        expect.objectContaining({ start: expect.any(Function) }),
      );

      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      job.stop();
    });
  });

  describe('handleIncrementalSync', () => {
    const mockState = {
      id: 'singleton',
      lastPatchVersion: 5,
      activeIndexName: null,
      lastSyncedAt: new Date(),
    };

    beforeEach(() => {
      (syncState.get as jest.Mock).mockResolvedValue(mockState);
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValue([]);
      (graphRegistry.findAll as jest.Mock).mockResolvedValue([]);
    });

    it('should enqueue sync jobs for affected graphs with subjectUris and update patch version', async () => {
      (changeDetection.detectChanges as jest.Mock).mockResolvedValue({
        affectedGraphs: [
          {
            graphUri: 'http://example.org/graph/1',
            subjectUris: ['http://example.org/s1'],
          },
          { graphUri: 'http://example.org/graph/2', subjectUris: null },
        ],
        newPatchVersion: 8,
      });

      await service.handleIncrementalSync();

      expect(syncState.get).toHaveBeenCalled();
      expect(changeDetection.detectChanges).toHaveBeenCalledWith(5);
      expect(syncQueueProducer.enqueueSyncGraph).toHaveBeenCalledWith(
        'http://example.org/graph/1',
        esAlias,
        ['http://example.org/s1'],
      );
      expect(syncQueueProducer.enqueueSyncGraph).toHaveBeenCalledWith(
        'http://example.org/graph/2',
        esAlias,
        null,
      );
      expect(syncState.updateLastPatchVersion).toHaveBeenCalledWith(8);
    });

    it('should use activeIndexName when available', async () => {
      (syncState.get as jest.Mock).mockResolvedValue({
        ...mockState,
        activeIndexName: 'eden-test-1234',
      });
      (changeDetection.detectChanges as jest.Mock).mockResolvedValue({
        affectedGraphs: [
          {
            graphUri: 'http://example.org/graph/1',
            subjectUris: ['http://example.org/s1'],
          },
        ],
        newPatchVersion: 6,
      });

      await service.handleIncrementalSync();

      expect(syncQueueProducer.enqueueSyncGraph).toHaveBeenCalledWith(
        'http://example.org/graph/1',
        'eden-test-1234',
        ['http://example.org/s1'],
      );
    });

    it('should skip when already running', async () => {
      (changeDetection.detectChanges as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ affectedGraphs: [], newPatchVersion: 5 }),
              50,
            ),
          ),
      );

      const first = service.handleIncrementalSync();
      const second = service.handleIncrementalSync();

      await Promise.all([first, second]);

      expect(changeDetection.detectChanges).toHaveBeenCalledTimes(1);
    });

    it('should not enqueue jobs or update version when no changes detected', async () => {
      (changeDetection.detectChanges as jest.Mock).mockResolvedValue({
        affectedGraphs: [],
        newPatchVersion: 5,
      });

      await service.handleIncrementalSync();

      expect(syncQueueProducer.enqueueSyncGraph).not.toHaveBeenCalled();
      expect(syncQueueProducer.enqueueDeleteGraph).not.toHaveBeenCalled();
      expect(syncState.updateLastPatchVersion).not.toHaveBeenCalled();
    });

    it('should trigger full reindex on PatchGapError', async () => {
      (changeDetection.detectChanges as jest.Mock).mockRejectedValue(
        new PatchGapError(5, 10),
      );

      await expect(service.handleIncrementalSync()).resolves.toBeUndefined();

      expect(reindexService.reindexAll).toHaveBeenCalled();
      expect(syncQueueProducer.enqueueSyncGraph).not.toHaveBeenCalled();
      expect(fusekiService.listNamedGraphs).not.toHaveBeenCalled();
      expect(syncState.updateLastPatchVersion).not.toHaveBeenCalled();
    });

    it('should propagate errors from reindexAll on PatchGapError', async () => {
      (changeDetection.detectChanges as jest.Mock).mockRejectedValue(
        new PatchGapError(5, 10),
      );
      (reindexService.reindexAll as jest.Mock).mockRejectedValue(
        new Error('reindex failed'),
      );

      await expect(service.handleIncrementalSync()).rejects.toThrow(
        'reindex failed',
      );
    });

    it('should re-throw non-PatchGapError errors', async () => {
      (changeDetection.detectChanges as jest.Mock).mockRejectedValue(
        new Error('connection failed'),
      );

      await expect(service.handleIncrementalSync()).rejects.toThrow(
        'connection failed',
      );
    });

    it('should enqueue delete jobs for graphs that disappeared from Fuseki', async () => {
      (changeDetection.detectChanges as jest.Mock).mockResolvedValue({
        affectedGraphs: [],
        newPatchVersion: 5,
      });
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValue([
        'http://example.org/graph/1',
      ]);
      (graphRegistry.findAll as jest.Mock).mockResolvedValue([
        { graphUri: 'http://example.org/graph/1' },
        { graphUri: 'http://example.org/graph/2' },
        { graphUri: 'http://example.org/graph/3' },
      ]);

      await service.handleIncrementalSync();

      expect(syncQueueProducer.enqueueDeleteGraph).toHaveBeenCalledWith(
        'http://example.org/graph/2',
        esAlias,
      );
      expect(syncQueueProducer.enqueueDeleteGraph).toHaveBeenCalledWith(
        'http://example.org/graph/3',
        esAlias,
      );
      expect(syncQueueProducer.enqueueDeleteGraph).toHaveBeenCalledTimes(2);
    });

    it('should not enqueue sync jobs for graphs that disappeared from Fuseki', async () => {
      (changeDetection.detectChanges as jest.Mock).mockResolvedValue({
        affectedGraphs: [
          {
            graphUri: 'http://example.org/graph/1',
            subjectUris: ['http://example.org/s1'],
          },
          { graphUri: 'http://example.org/graph/2', subjectUris: null },
        ],
        newPatchVersion: 6,
      });
      (fusekiService.listNamedGraphs as jest.Mock).mockResolvedValue([
        'http://example.org/graph/1',
      ]);
      (graphRegistry.findAll as jest.Mock).mockResolvedValue([
        { graphUri: 'http://example.org/graph/1' },
        { graphUri: 'http://example.org/graph/2' },
      ]);

      await service.handleIncrementalSync();

      // graph/1 still in Fuseki: should sync
      expect(syncQueueProducer.enqueueSyncGraph).toHaveBeenCalledWith(
        'http://example.org/graph/1',
        esAlias,
        ['http://example.org/s1'],
      );
      // graph/2 disappeared: should NOT sync, only delete
      expect(syncQueueProducer.enqueueSyncGraph).toHaveBeenCalledTimes(1);
      expect(syncQueueProducer.enqueueDeleteGraph).toHaveBeenCalledWith(
        'http://example.org/graph/2',
        esAlias,
      );
      expect(syncQueueProducer.enqueueDeleteGraph).toHaveBeenCalledTimes(1);
    });

    it('should reset isRunning flag even when an error occurs', async () => {
      (changeDetection.detectChanges as jest.Mock).mockRejectedValue(
        new Error('unexpected'),
      );

      await expect(service.handleIncrementalSync()).rejects.toThrow();

      (changeDetection.detectChanges as jest.Mock).mockResolvedValue({
        affectedGraphs: [],
        newPatchVersion: 5,
      });

      await service.handleIncrementalSync();

      expect(changeDetection.detectChanges).toHaveBeenCalledTimes(2);
    });
  });
});
