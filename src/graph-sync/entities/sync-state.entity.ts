import type { SyncStateModel } from '../../generated/prisma/models/SyncState';
import { IsString, IsInt, IsDate, IsOptional } from 'class-validator';

export class SyncState implements SyncStateModel {
  @IsString()
  id: string;

  @IsInt()
  lastPatchVersion: number;

  @IsDate()
  lastSyncedAt: Date;

  @IsOptional()
  @IsString()
  activeIndexName: string | null;
}
