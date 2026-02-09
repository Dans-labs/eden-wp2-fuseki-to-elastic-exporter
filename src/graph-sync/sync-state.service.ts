import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncState } from './entities/sync-state.entity';

const SINGLETON_ID = 'singleton';

@Injectable()
export class SyncStateService {
  private readonly logger = new Logger(SyncStateService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /** Get-or-create: returns the singleton row, creating it with defaults on first call. */
  async get(): Promise<SyncState> {
    return this.prismaService.syncState.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  async updateLastPatchVersion(version: number): Promise<void> {
    await this.prismaService.syncState.update({
      where: { id: SINGLETON_ID },
      data: { lastPatchVersion: version },
    });
  }

  async updateActiveIndex(
    indexName: string,
    patchVersion: number,
  ): Promise<void> {
    await this.prismaService.syncState.update({
      where: { id: SINGLETON_ID },
      data: {
        activeIndexName: indexName,
        lastPatchVersion: patchVersion,
      },
    });
  }
}
