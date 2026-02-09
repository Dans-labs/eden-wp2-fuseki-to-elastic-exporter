import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GraphRegistry } from './entities/graph-registry.entity';

@Injectable()
export class GraphRegistryService {
  private readonly logger = new Logger(GraphRegistryService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async findByGraphUri(graphUri: string): Promise<GraphRegistry | null> {
    return this.prismaService.graphRegistry.findUnique({
      where: { graphUri },
    });
  }

  async upsert(
    graphUri: string,
    documentIds: string[],
  ): Promise<GraphRegistry> {
    return this.prismaService.graphRegistry.upsert({
      where: { graphUri },
      create: {
        graphUri,
        documentIds,
        documentCount: documentIds.length,
      },
      update: {
        documentIds,
        documentCount: documentIds.length,
      },
    });
  }

  async updateDocumentIds(
    graphUri: string,
    addedOrUpdatedIds: string[],
    removedIds: string[],
  ): Promise<GraphRegistry> {
    const existing = await this.findByGraphUri(graphUri);
    if (!existing) {
      return this.upsert(graphUri, addedOrUpdatedIds);
    }

    const ids = new Set(existing.documentIds);
    for (const id of removedIds) ids.delete(id);
    for (const id of addedOrUpdatedIds) ids.add(id);
    const documentIds = [...ids];

    return this.prismaService.graphRegistry.update({
      where: { graphUri },
      data: { documentIds, documentCount: documentIds.length },
    });
  }

  async delete(graphUri: string): Promise<void> {
    await this.prismaService.graphRegistry.delete({
      where: { graphUri },
    });
  }

  async findAll(): Promise<GraphRegistry[]> {
    return this.prismaService.graphRegistry.findMany();
  }

  async deleteAll(): Promise<void> {
    await this.prismaService.graphRegistry.deleteMany();
  }
}
