import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class ElasticsearchIndexService {
  private readonly logger = new Logger(ElasticsearchIndexService.name);

  constructor(private readonly esService: ElasticsearchService) {}

  async ensureIndex(indexName: string): Promise<void> {
    const exists = await this.esService.indices.exists({ index: indexName });

    if (!exists) {
      this.logger.log(`Creating index "${indexName}" with dynamic templates`);

      // Dynamic templates keep indexing schema-agnostic: new JSON-LD properties
      // are automatically mapped without code changes.
      await this.esService.indices.create({
        index: indexName,
        mappings: {
          dynamic_templates: [
            {
              strings_as_text_and_keyword: {
                match_mapping_type: 'string',
                mapping: {
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword', ignore_above: 512 },
                  },
                },
              },
            },
            {
              objects_as_nested: {
                match_mapping_type: 'object',
                mapping: { type: 'nested' },
              },
            },
          ],
        },
      });
    }
  }

  async bulkIndex(
    indexName: string,
    documents: Record<string, unknown>[],
  ): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    // ES bulk API expects alternating action/document pairs: [action, doc, action, doc, ...]
    const operations = documents.flatMap((doc) => {
      const id = doc['@id'] as string;
      return [{ index: { _index: indexName, _id: id } }, doc];
    });

    const response = await this.esService.bulk({ operations });

    if (response.errors) {
      const errorItems = response.items.filter((item) => item.index?.error);
      this.logger.error(
        `Bulk indexing encountered ${errorItems.length} errors`,
      );
      for (const item of errorItems) {
        this.logger.error(
          `Failed to index document ${item.index?._id}: ${JSON.stringify(item.index?.error)}`,
        );
      }
      throw new Error(`Bulk indexing failed with ${errorItems.length} errors`);
    }

    this.logger.log(
      `Indexed ${documents.length} documents into "${indexName}"`,
    );
  }
}
