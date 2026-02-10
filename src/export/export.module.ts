import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FusekiModule } from '../fuseki/fuseki.module';
import { JsonldModule } from '../jsonld/jsonld.module';
import { ElasticsearchIndexModule } from '../elasticsearch/elasticsearch-index.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [ConfigModule, FusekiModule, JsonldModule, ElasticsearchIndexModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
