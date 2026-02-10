import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DATABASE_CONFIG_KEY } from '../config';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(PrismaService)
      .mock(ConfigService)
      .impl(() => ({
        getOrThrow: jest.fn().mockImplementation((key: symbol) => {
          if (key === DATABASE_CONFIG_KEY) {
            return {
              DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
            };
          }
          return undefined;
        }),
      }))
      .compile();

    service = unit;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call $connect', async () => {
      const connectSpy = jest
        .spyOn(service, '$connect')
        .mockResolvedValueOnce(undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect', async () => {
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValueOnce(undefined);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
