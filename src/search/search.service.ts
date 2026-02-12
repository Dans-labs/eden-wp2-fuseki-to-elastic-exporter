import { Injectable, NotFoundException } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchService {
  constructor(private readonly esService: ElasticsearchService) {}

  async search(index: string, body: Record<string, unknown>) {
    return this.esService.search({
      index,
      ...body,
    });
  }

  async getSource(index: string, id: string) {
    try {
      return await this.esService.getSource({
        index,
        id,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 404
      ) {
        throw new NotFoundException(`Document "${id}" not found`);
      }
      throw error;
    }
  }
}
