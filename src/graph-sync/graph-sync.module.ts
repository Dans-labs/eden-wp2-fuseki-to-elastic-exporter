import { Module } from '@nestjs/common';
import { FusekiModule } from '../fuseki/fuseki.module';
import { JsonldModule } from '../jsonld/jsonld.module';
import { ElasticsearchIndexModule } from '../elasticsearch/elasticsearch-index.module';
import { GraphRegistryService } from './graph-registry.service';
import { SyncStateService } from './sync-state.service';
import { GraphSyncService } from './graph-sync.service';

@Module({
  imports: [FusekiModule, JsonldModule, ElasticsearchIndexModule],
  providers: [GraphRegistryService, SyncStateService, GraphSyncService],
  exports: [GraphRegistryService, SyncStateService, GraphSyncService],
})
export class GraphSyncModule {}
