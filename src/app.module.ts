import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import {
  authConfig,
  coreConfig,
  elasticsearchConfig,
  fusekiConfig,
  EnvironmentConfigSchema,
} from './config';
import { AuthModule } from './auth/auth.module';
import { FusekiModule } from './fuseki/fuseki.module';
import { JsonldModule } from './jsonld/jsonld.module';
import { ElasticsearchIndexModule } from './elasticsearch/elasticsearch-index.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      cache: true,
      load: [coreConfig, fusekiConfig, elasticsearchConfig, authConfig],
      validate: (env) => EnvironmentConfigSchema.parse(env),
    }),
    FusekiModule,
    JsonldModule,
    ElasticsearchIndexModule,
    ExportModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
