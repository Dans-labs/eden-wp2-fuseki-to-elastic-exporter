import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { SyncQueueProducerService } from './sync-queue.producer.service';
import {
  GRAPH_SYNC_QUEUE,
  SYNC_GRAPH_JOB,
  DELETE_GRAPH_JOB,
} from './sync-queue.constants';

describe('SyncQueueProducerService', () => {
  let service: SyncQueueProducerService;
  let queue: Queue;

  const graphUri = 'http://example.org/graph/1';
  const indexName = 'eden-sync-1234';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SyncQueueProducerService,
        {
          provide: getQueueToken(GRAPH_SYNC_QUEUE),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: '1' }),
          },
        },
      ],
    }).compile();

    service = module.get(SyncQueueProducerService);
    queue = module.get(getQueueToken(GRAPH_SYNC_QUEUE));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueSyncGraph', () => {
    it('should add a sync-graph job with null subjectUris by default', async () => {
      await service.enqueueSyncGraph(graphUri, indexName);

      expect(queue.add).toHaveBeenCalledWith(SYNC_GRAPH_JOB, {
        graphUri,
        indexName,
        subjectUris: null,
      });
    });

    it('should include subjectUris in job data when provided', async () => {
      const subjectUris = ['http://example.org/s1', 'http://example.org/s2'];
      await service.enqueueSyncGraph(graphUri, indexName, subjectUris);

      expect(queue.add).toHaveBeenCalledWith(SYNC_GRAPH_JOB, {
        graphUri,
        indexName,
        subjectUris,
      });
    });
  });

  describe('enqueueDeleteGraph', () => {
    it('should add a delete-graph job to the queue', async () => {
      await service.enqueueDeleteGraph(graphUri, indexName);

      expect(queue.add).toHaveBeenCalledWith(DELETE_GRAPH_JOB, {
        graphUri,
        indexName,
      });
    });
  });
});
