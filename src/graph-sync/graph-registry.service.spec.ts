import { TestBed } from '@suites/unit';
import { GraphRegistryService } from './graph-registry.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GraphRegistryService', () => {
  let service: GraphRegistryService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(GraphRegistryService)
      .mock(PrismaService)
      .impl(() => ({
        graphRegistry: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          findMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      }))
      .compile();

    service = unit;
    prismaService = unitRef.get(PrismaService) as unknown as PrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByGraphUri', () => {
    it('should return the registry when found', async () => {
      const mockResult = {
        id: 'uuid-1',
        graphUri: 'http://example.org/graph1',
        documentIds: ['doc1'],
        documentCount: 1,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      };
      (
        prismaService.graphRegistry.findUnique as jest.Mock
      ).mockResolvedValueOnce(mockResult);

      const result = await service.findByGraphUri('http://example.org/graph1');

      expect(prismaService.graphRegistry.findUnique).toHaveBeenCalledWith({
        where: { graphUri: 'http://example.org/graph1' },
      });
      expect(result).toEqual(mockResult);
    });

    it('should return null when not found', async () => {
      (
        prismaService.graphRegistry.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);

      const result = await service.findByGraphUri('http://example.org/unknown');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should upsert with correct data and compute documentCount', async () => {
      const documentIds = ['doc1', 'doc2', 'doc3'];
      const mockResult = {
        id: 'uuid-1',
        graphUri: 'http://example.org/graph1',
        documentIds,
        documentCount: 3,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      };
      (prismaService.graphRegistry.upsert as jest.Mock).mockResolvedValueOnce(
        mockResult,
      );

      const result = await service.upsert(
        'http://example.org/graph1',
        documentIds,
      );

      expect(prismaService.graphRegistry.upsert).toHaveBeenCalledWith({
        where: { graphUri: 'http://example.org/graph1' },
        create: {
          graphUri: 'http://example.org/graph1',
          documentIds,
          documentCount: 3,
        },
        update: {
          documentIds,
          documentCount: 3,
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('delete', () => {
    it('should delete by graph URI', async () => {
      (prismaService.graphRegistry.delete as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await service.delete('http://example.org/graph1');

      expect(prismaService.graphRegistry.delete).toHaveBeenCalledWith({
        where: { graphUri: 'http://example.org/graph1' },
      });
    });
  });

  describe('findAll', () => {
    it('should return all registries', async () => {
      const mockResults = [
        {
          id: 'uuid-1',
          graphUri: 'http://example.org/graph1',
          documentIds: [],
          documentCount: 0,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      (prismaService.graphRegistry.findMany as jest.Mock).mockResolvedValueOnce(
        mockResults,
      );

      const result = await service.findAll();

      expect(prismaService.graphRegistry.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });
  });

  describe('updateDocumentIds', () => {
    const graphUri = 'http://example.org/graph1';

    it('should create a new registry when none exists', async () => {
      (
        prismaService.graphRegistry.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);
      (prismaService.graphRegistry.upsert as jest.Mock).mockResolvedValueOnce({
        id: 'uuid-1',
        graphUri,
        documentIds: ['doc1'],
        documentCount: 1,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      });

      await service.updateDocumentIds(graphUri, ['doc1'], []);

      expect(prismaService.graphRegistry.upsert).toHaveBeenCalledWith({
        where: { graphUri },
        create: { graphUri, documentIds: ['doc1'], documentCount: 1 },
        update: { documentIds: ['doc1'], documentCount: 1 },
      });
    });

    it('should add new IDs and remove old IDs from existing registry', async () => {
      (
        prismaService.graphRegistry.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: 'uuid-1',
        graphUri,
        documentIds: ['doc1', 'doc2', 'doc3'],
        documentCount: 3,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      });
      (prismaService.graphRegistry.update as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await service.updateDocumentIds(graphUri, ['doc4'], ['doc2']);

      expect(prismaService.graphRegistry.update).toHaveBeenCalledWith({
        where: { graphUri },
        data: {
          documentIds: expect.arrayContaining(['doc1', 'doc3', 'doc4']),
          documentCount: 3,
        },
      });
    });

    it('should deduplicate IDs that already exist', async () => {
      (
        prismaService.graphRegistry.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: 'uuid-1',
        graphUri,
        documentIds: ['doc1', 'doc2'],
        documentCount: 2,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      });
      (prismaService.graphRegistry.update as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await service.updateDocumentIds(graphUri, ['doc1', 'doc3'], []);

      expect(prismaService.graphRegistry.update).toHaveBeenCalledWith({
        where: { graphUri },
        data: {
          documentIds: expect.arrayContaining(['doc1', 'doc2', 'doc3']),
          documentCount: 3,
        },
      });
    });
  });

  describe('deleteAll', () => {
    it('should call deleteMany', async () => {
      (
        prismaService.graphRegistry.deleteMany as jest.Mock
      ).mockResolvedValueOnce({ count: 5 });

      await service.deleteAll();

      expect(prismaService.graphRegistry.deleteMany).toHaveBeenCalled();
    });
  });
});
