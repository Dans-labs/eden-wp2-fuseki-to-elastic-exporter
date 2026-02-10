import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import {
  coreConfig,
  elasticsearchConfig,
  fusekiConfig,
  EnvironmentConfigSchema,
} from './config';
import { FusekiModule } from './fuseki/fuseki.module';
import { JsonldModule } from './jsonld/jsonld.module';
import { ElasticsearchIndexModule } from './elasticsearch/elasticsearch-index.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      cache: true,
      load: [coreConfig, fusekiConfig, elasticsearchConfig],
      validate: (env) => EnvironmentConfigSchema.parse(env),
    }),
    FusekiModule,
    JsonldModule,
    ElasticsearchIndexModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
