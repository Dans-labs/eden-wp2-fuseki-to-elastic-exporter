import { Module } from '@nestjs/common';
import { ElasticsearchIndexModule } from '../elasticsearch/elasticsearch-index.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [ElasticsearchIndexModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
