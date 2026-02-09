import { TestBed } from '@suites/unit';
import { SyncStateService } from './sync-state.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SyncStateService', () => {
  let service: SyncStateService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(SyncStateService)
      .mock(PrismaService)
      .impl(() => ({
        syncState: {
          upsert: jest.fn(),
          update: jest.fn(),
        },
      }))
      .compile();

    service = unit;
    prismaService = unitRef.get(PrismaService) as unknown as PrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should upsert the singleton and return it', async () => {
      const mockState = {
        id: 'singleton',
        lastPatchVersion: 42,
        lastSyncedAt: new Date(),
        activeIndexName: 'eden-123',
      };
      (prismaService.syncState.upsert as jest.Mock).mockResolvedValueOnce(
        mockState,
      );

      const result = await service.get();

      expect(prismaService.syncState.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: { id: 'singleton' },
        update: {},
      });
      expect(result).toEqual(mockState);
    });
  });

  describe('updateLastPatchVersion', () => {
    it('should update the singleton with the new version', async () => {
      (prismaService.syncState.update as jest.Mock).mockResolvedValueOnce({});

      await service.updateLastPatchVersion(99);

      expect(prismaService.syncState.update).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        data: { lastPatchVersion: 99 },
      });
    });
  });

  describe('updateActiveIndex', () => {
    it('should update both activeIndexName and lastPatchVersion', async () => {
      (prismaService.syncState.update as jest.Mock).mockResolvedValueOnce({});

      await service.updateActiveIndex('eden-1700000000', 50);

      expect(prismaService.syncState.update).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        data: {
          activeIndexName: 'eden-1700000000',
          lastPatchVersion: 50,
        },
      });
    });
  });
});
