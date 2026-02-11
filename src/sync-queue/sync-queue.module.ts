import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GraphSyncModule } from '../graph-sync/graph-sync.module';
import { GRAPH_SYNC_QUEUE } from './sync-queue.constants';
import { SyncQueueProducerService } from './sync-queue.producer.service';
import { SyncQueueConsumer } from './sync-queue.consumer';

@Module({
  imports: [
    BullModule.registerQueue({
      name: GRAPH_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    GraphSyncModule,
  ],
  providers: [SyncQueueProducerService, SyncQueueConsumer],
  exports: [SyncQueueProducerService],
})
export class SyncQueueModule {}
