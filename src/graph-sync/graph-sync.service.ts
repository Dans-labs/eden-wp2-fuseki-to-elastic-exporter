import { Injectable, Logger } from '@nestjs/common';
import { FusekiService } from '../fuseki/fuseki.service';
import { JsonldProcessingService } from '../jsonld/jsonld-processing.service';
import { ElasticsearchIndexService } from '../elasticsearch/elasticsearch-index.service';
import { GraphRegistryService } from './graph-registry.service';

@Injectable()
export class GraphSyncService {
  private readonly logger = new Logger(GraphSyncService.name);

  constructor(
    private readonly fusekiService: FusekiService,
    private readonly jsonldService: JsonldProcessingService,
    private readonly esIndexService: ElasticsearchIndexService,
    private readonly graphRegistryService: GraphRegistryService,
  ) {}

  async syncGraph(graphUri: string, indexName: string): Promise<void> {
    this.logger.log(`Syncing graph "${graphUri}" to index "${indexName}"`);

    const document = await this.fusekiService.fetchGraph(graphUri);
    const flattenedDocs = await this.jsonldService.flatten(document);
    const newDocIds = flattenedDocs.map((d) => d['@id'] as string);

    const existing = await this.graphRegistryService.findByGraphUri(graphUri);
    if (existing) {
      const removedIds = existing.documentIds.filter(
        (id) => !newDocIds.includes(id),
      );
      await this.esIndexService.bulkDelete(indexName, removedIds);
    }

    await this.esIndexService.bulkIndex(indexName, flattenedDocs);
    await this.graphRegistryService.upsert(graphUri, newDocIds);

    this.logger.log(
      `Synced graph "${graphUri}": ${flattenedDocs.length} documents`,
    );
  }

  async syncResources(
    graphUri: string,
    subjectUris: string[],
    indexName: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing ${subjectUris.length} resources from graph "${graphUri}" to index "${indexName}"`,
    );

    const document = await this.fusekiService.fetchResources(
      graphUri,
      subjectUris,
    );
    const flattenedDocs = await this.jsonldService.flatten(document);
    const returnedIds = new Set(flattenedDocs.map((d) => d['@id'] as string));

    const addedOrUpdatedIds = [...returnedIds];
    const removedIds = subjectUris.filter((uri) => !returnedIds.has(uri));

    if (flattenedDocs.length > 0) {
      await this.esIndexService.bulkIndex(indexName, flattenedDocs);
    }
    if (removedIds.length > 0) {
      await this.esIndexService.bulkDelete(indexName, removedIds);
    }

    await this.graphRegistryService.updateDocumentIds(
      graphUri,
      addedOrUpdatedIds,
      removedIds,
    );

    this.logger.log(
      `Synced ${addedOrUpdatedIds.length} resources, removed ${removedIds.length} from graph "${graphUri}"`,
    );
  }

  async deleteGraph(graphUri: string, indexName: string): Promise<void> {
    const existing = await this.graphRegistryService.findByGraphUri(graphUri);

    if (!existing) {
      this.logger.log(`Graph "${graphUri}" not in registry, nothing to delete`);
      return;
    }

    await this.esIndexService.bulkDelete(indexName, existing.documentIds);
    await this.graphRegistryService.delete(graphUri);

    this.logger.log(`Deleted graph "${graphUri}" and its documents`);
  }
}
