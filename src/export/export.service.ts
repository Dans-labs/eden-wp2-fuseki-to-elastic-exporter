import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ELASTICSEARCH_CONFIG_KEY, type ElasticsearchConfig } from '../config';
import { FusekiService } from '../fuseki/fuseki.service';
import { JsonldProcessingService } from '../jsonld/jsonld-processing.service';
import { ElasticsearchIndexService } from '../elasticsearch/elasticsearch-index.service';
import type { JsonLdDocument } from 'jsonld';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly indexName: string;

  constructor(
    private readonly fusekiService: FusekiService,
    private readonly jsonldService: JsonldProcessingService,
    private readonly esIndexService: ElasticsearchIndexService,
    private readonly configService: ConfigService,
  ) {
    const esConfig = this.configService.get<ElasticsearchConfig>(
      ELASTICSEARCH_CONFIG_KEY,
    );
    this.indexName = esConfig!.ELASTICSEARCH_ALIAS;
  }

  async exportAll(): Promise<void> {
    this.logger.log('Starting export pipeline');

    const graphUris = await this.fusekiService.listNamedGraphs();
    this.logger.log(`Found ${graphUris.length} named graphs`);

    const allDocuments: Record<string, unknown>[] = [];

    for (const graphUri of graphUris) {
      this.logger.log(`Processing graph: ${graphUri}`);
      const document = await this.fusekiService.fetchGraph(graphUri);
      const flattenedDocs = await this.jsonldService.flatten(
        document as JsonLdDocument,
      );
      allDocuments.push(...flattenedDocs);
    }

    this.logger.log(`Collected ${allDocuments.length} documents for indexing`);

    await this.esIndexService.ensureIndex(this.indexName);
    await this.esIndexService.bulkIndex(this.indexName, allDocuments);

    this.logger.log('Export pipeline completed');
  }
}
