import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  authConfig,
  coreConfig,
  databaseConfig,
  elasticsearchConfig,
  fusekiConfig,
  redisConfig,
  REDIS_CONFIG_KEY,
  type RedisConfig,
  EnvironmentConfigSchema,
} from './config';
import { AuthModule } from './auth/auth.module';
import { FusekiModule } from './fuseki/fuseki.module';
import { JsonldModule } from './jsonld/jsonld.module';
import { ElasticsearchIndexModule } from './elasticsearch/elasticsearch-index.module';
import { ExportModule } from './export/export.module';
import { PrismaModule } from './prisma/prisma.module';
import { GraphSyncModule } from './graph-sync/graph-sync.module';
import { RdfDeltaModule } from './rdf-delta/rdf-delta.module';
import { SyncQueueModule } from './sync-queue/sync-queue.module';
import { SyncSchedulerModule } from './sync-scheduler/sync-scheduler.module';
import { ReindexModule } from './reindex/reindex.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        coreConfig,
        fusekiConfig,
        elasticsearchConfig,
        authConfig,
        databaseConfig,
        redisConfig,
      ],
      validate: (env) => EnvironmentConfigSchema.parse(env),
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConf =
          configService.getOrThrow<RedisConfig>(REDIS_CONFIG_KEY);
        return {
          redis: {
            host: redisConf.REDIS_HOST,
            port: redisConf.REDIS_PORT,
            ...(redisConf.REDIS_PASSWORD && {
              password: redisConf.REDIS_PASSWORD,
            }),
          },
        };
      },
    }),
    PrismaModule,
    FusekiModule,
    JsonldModule,
    ElasticsearchIndexModule,
    ExportModule,
    AuthModule,
    GraphSyncModule,
    RdfDeltaModule,
    SyncQueueModule,
    SyncSchedulerModule,
    ReindexModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
