import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  GRAPH_SYNC_QUEUE,
  SYNC_GRAPH_JOB,
  DELETE_GRAPH_JOB,
} from './sync-queue.constants';

@Injectable()
export class SyncQueueProducerService {
  private readonly logger = new Logger(SyncQueueProducerService.name);

  constructor(@InjectQueue(GRAPH_SYNC_QUEUE) private readonly queue: Queue) {}

  async enqueueSyncGraph(
    graphUri: string,
    indexName: string,
    subjectUris?: string[] | null,
  ): Promise<void> {
    const job = await this.queue.add(SYNC_GRAPH_JOB, {
      graphUri,
      indexName,
      subjectUris: subjectUris ?? null,
    });
    this.logger.log(
      `Enqueued sync-graph job ${job.id} for graph "${graphUri}"`,
    );
  }

  async enqueueDeleteGraph(graphUri: string, indexName: string): Promise<void> {
    const job = await this.queue.add(DELETE_GRAPH_JOB, { graphUri, indexName });
    this.logger.log(
      `Enqueued delete-graph job ${job.id} for graph "${graphUri}"`,
    );
  }
}
