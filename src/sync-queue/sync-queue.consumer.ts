import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { GraphSyncService } from '../graph-sync/graph-sync.service';
import {
  GRAPH_SYNC_QUEUE,
  SYNC_GRAPH_JOB,
  DELETE_GRAPH_JOB,
} from './sync-queue.constants';

interface SyncGraphJobData {
  graphUri: string;
  indexName: string;
  subjectUris?: string[] | null;
}

@Processor(GRAPH_SYNC_QUEUE)
export class SyncQueueConsumer {
  private readonly logger = new Logger(SyncQueueConsumer.name);

  constructor(private readonly graphSyncService: GraphSyncService) {}

  @Process(SYNC_GRAPH_JOB)
  async handleSyncGraph(job: Job<SyncGraphJobData>): Promise<void> {
    const { graphUri, indexName, subjectUris } = job.data;

    if (subjectUris && subjectUris.length > 0) {
      this.logger.log(
        `Processing sync-resources job ${job.id} for ${subjectUris.length} resources in graph "${graphUri}"`,
      );
      await this.graphSyncService.syncResources(
        graphUri,
        subjectUris,
        indexName,
      );
    } else {
      this.logger.log(
        `Processing sync-graph job ${job.id} for graph "${graphUri}"`,
      );
      await this.graphSyncService.syncGraph(graphUri, indexName);
    }

    this.logger.log(`Completed sync job ${job.id}`);
  }

  @Process(DELETE_GRAPH_JOB)
  async handleDeleteGraph(
    job: Job<{ graphUri: string; indexName: string }>,
  ): Promise<void> {
    this.logger.log(
      `Processing delete-graph job ${job.id} for graph "${job.data.graphUri}"`,
    );
    await this.graphSyncService.deleteGraph(
      job.data.graphUri,
      job.data.indexName,
    );
    this.logger.log(`Completed delete-graph job ${job.id}`);
  }
}
