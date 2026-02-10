import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ELASTICSEARCH_CONFIG_KEY, type ElasticsearchConfig } from '../config';
import { ElasticsearchIndexService } from './elasticsearch-index.service';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const esConfig = configService.get<ElasticsearchConfig>(
          ELASTICSEARCH_CONFIG_KEY,
        );
        return { node: esConfig!.ELASTICSEARCH_URL };
      },
    }),
  ],
  providers: [ElasticsearchIndexService],
  exports: [ElasticsearchIndexService],
})
export class ElasticsearchIndexModule {}
