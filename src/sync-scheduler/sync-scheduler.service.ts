import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import {
  RdfDeltaChangeDetectionService,
  type ChangeDetectionResult,
} from '../rdf-delta/rdf-delta-change-detection.service';
import { PatchGapError } from '../rdf-delta/patch-gap.error';
import { SyncStateService } from '../graph-sync/sync-state.service';
import { SyncQueueProducerService } from '../sync-queue/sync-queue.producer.service';
import { FusekiService } from '../fuseki/fuseki.service';
import { GraphRegistryService } from '../graph-sync/graph-registry.service';
import { ReindexService } from '../reindex/reindex.service';
import { ELASTICSEARCH_CONFIG_KEY, type ElasticsearchConfig } from '../config';

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly changeDetection: RdfDeltaChangeDetectionService,
    private readonly syncState: SyncStateService,
    private readonly syncQueueProducer: SyncQueueProducerService,
    private readonly fusekiService: FusekiService,
    private readonly graphRegistry: GraphRegistryService,
    private readonly reindexService: ReindexService,
  ) {}

  onModuleInit() {
    const job = new CronJob(CronExpression.EVERY_10_MINUTES, () => {
      void this.handleIncrementalSync();
    });
    this.schedulerRegistry.addCronJob('incremental-sync', job);
    job.start();
    this.logger.log('Registered incremental-sync cron job (every 10 minutes)');
  }

  async handleIncrementalSync(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Incremental sync already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      const state = await this.syncState.get();
      const { lastPatchVersion, activeIndexName } = state;

      const esConfig = this.configService.get<ElasticsearchConfig>(
        ELASTICSEARCH_CONFIG_KEY,
      );
      const indexName = activeIndexName ?? esConfig!.ELASTICSEARCH_ALIAS;

      let result: ChangeDetectionResult;
      try {
        result = await this.changeDetection.detectChanges(lastPatchVersion);
      } catch (error) {
        if (error instanceof PatchGapError) {
          this.logger.warn(`${error.message} — triggering full reindex`);
          await this.reindexService.reindexAll();
          return;
        }
        throw error;
      }

      // Compare Fuseki's current graphs against registry to find deletions
      const [fusekiGraphs, registeredGraphs] = await Promise.all([
        this.fusekiService.listNamedGraphs(),
        this.graphRegistry.findAll(),
      ]);
      const fusekiGraphSet = new Set(fusekiGraphs);
      const disappearedGraphs = registeredGraphs
        .filter((g) => !fusekiGraphSet.has(g.graphUri))
        .map((g) => g.graphUri);

      const disappearedSet = new Set(disappearedGraphs);

      for (const affected of result.affectedGraphs) {
        if (!disappearedSet.has(affected.graphUri)) {
          await this.syncQueueProducer.enqueueSyncGraph(
            affected.graphUri,
            indexName,
            affected.subjectUris,
          );
        }
      }

      for (const graphUri of disappearedGraphs) {
        await this.syncQueueProducer.enqueueDeleteGraph(graphUri, indexName);
      }

      if (result.newPatchVersion !== lastPatchVersion) {
        await this.syncState.updateLastPatchVersion(result.newPatchVersion);
      }

      this.logger.log(
        `Incremental sync complete: ${result.affectedGraphs.length} synced, ${disappearedGraphs.length} deleted, patch version ${result.newPatchVersion}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
