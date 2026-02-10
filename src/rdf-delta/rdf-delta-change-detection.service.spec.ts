import { TestBed } from '@suites/unit';
import { RdfDeltaChangeDetectionService } from './rdf-delta-change-detection.service';
import { RdfDeltaClientService } from './rdf-delta-client.service';
import { RdfPatchParserService } from './rdf-patch-parser.service';
import { PatchGapError } from './patch-gap.error';

describe('RdfDeltaChangeDetectionService', () => {
  let service: RdfDeltaChangeDetectionService;
  let deltaClient: RdfDeltaClientService;
  let patchParser: RdfPatchParserService;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      RdfDeltaChangeDetectionService,
    ).compile();

    service = unit;
    deltaClient = unitRef.get(
      RdfDeltaClientService,
    ) as unknown as RdfDeltaClientService;
    patchParser = unitRef.get(
      RdfPatchParserService,
    ) as unknown as RdfPatchParserService;
  });

  describe('detectChanges', () => {
    it('should return empty result when no new patches are available', async () => {
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 5,
      });

      const result = await service.detectChanges(5);

      expect(result).toEqual({
        affectedGraphs: [],
        newPatchVersion: 5,
      });
      expect(deltaClient.fetchPatchesSince).not.toHaveBeenCalled();
    });

    it('should detect affected graphs with subject URIs from new patches', async () => {
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 3,
      });
      (deltaClient.fetchPatchesSince as jest.Mock).mockResolvedValue([
        'patch-2',
        'patch-3',
      ]);
      (patchParser.extractAffectedResources as jest.Mock)
        .mockReturnValueOnce(
          new Map([
            ['http://example.org/graph/1', new Set(['http://example.org/s1'])],
          ]),
        )
        .mockReturnValueOnce(
          new Map([
            ['http://example.org/graph/2', new Set(['http://example.org/s2'])],
          ]),
        );

      const result = await service.detectChanges(1);

      expect(result.affectedGraphs).toHaveLength(2);
      expect(result.affectedGraphs).toEqual(
        expect.arrayContaining([
          {
            graphUri: 'http://example.org/graph/1',
            subjectUris: ['http://example.org/s1'],
          },
          {
            graphUri: 'http://example.org/graph/2',
            subjectUris: ['http://example.org/s2'],
          },
        ]),
      );
      expect(result.newPatchVersion).toBe(3);
      expect(deltaClient.fetchPatchesSince).toHaveBeenCalledWith(1, 3);
      expect(patchParser.extractAffectedResources).toHaveBeenCalledTimes(2);
    });

    it('should merge subject URIs across patches for the same graph', async () => {
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 3,
      });
      (deltaClient.fetchPatchesSince as jest.Mock).mockResolvedValue([
        'patch-2',
        'patch-3',
      ]);
      (patchParser.extractAffectedResources as jest.Mock)
        .mockReturnValueOnce(
          new Map([
            ['http://example.org/graph/1', new Set(['http://example.org/s1'])],
          ]),
        )
        .mockReturnValueOnce(
          new Map([
            ['http://example.org/graph/1', new Set(['http://example.org/s2'])],
          ]),
        );

      const result = await service.detectChanges(1);

      expect(result.affectedGraphs).toHaveLength(1);
      const graph = result.affectedGraphs[0];
      expect(graph.graphUri).toBe('http://example.org/graph/1');
      expect(graph.subjectUris).toEqual(
        expect.arrayContaining([
          'http://example.org/s1',
          'http://example.org/s2',
        ]),
      );
      expect(graph.subjectUris).toHaveLength(2);
    });

    it('should set subjectUris to null when any patch returns null for a graph', async () => {
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 3,
      });
      (deltaClient.fetchPatchesSince as jest.Mock).mockResolvedValue([
        'patch-2',
        'patch-3',
      ]);
      (patchParser.extractAffectedResources as jest.Mock)
        .mockReturnValueOnce(
          new Map([
            ['http://example.org/graph/1', new Set(['http://example.org/s1'])],
          ]),
        )
        .mockReturnValueOnce(new Map([['http://example.org/graph/1', null]]));

      const result = await service.detectChanges(1);

      expect(result.affectedGraphs).toHaveLength(1);
      expect(result.affectedGraphs[0]).toEqual({
        graphUri: 'http://example.org/graph/1',
        subjectUris: null,
      });
    });

    it('should not throw when first patch appears (minVersion equals lastPatchVersion + 1)', async () => {
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 1,
        maxVersion: 1,
      });
      (deltaClient.fetchPatchesSince as jest.Mock).mockResolvedValue([
        'patch-1',
      ]);
      (patchParser.extractAffectedResources as jest.Mock).mockReturnValueOnce(
        new Map([
          ['http://example.org/graph/1', new Set(['http://example.org/s1'])],
        ]),
      );

      const result = await service.detectChanges(0);

      expect(result).toEqual({
        affectedGraphs: [
          {
            graphUri: 'http://example.org/graph/1',
            subjectUris: ['http://example.org/s1'],
          },
        ],
        newPatchVersion: 1,
      });
    });

    it('should throw PatchGapError when patches have been purged (gap detected)', async () => {
      (deltaClient.describeLog as jest.Mock).mockResolvedValue({
        minVersion: 10,
        maxVersion: 15,
      });

      await expect(service.detectChanges(5)).rejects.toThrow(PatchGapError);
      await expect(service.detectChanges(5)).rejects.toThrow(
        'Patch gap detected: last known version 5, min available 10',
      );
      expect(deltaClient.fetchPatchesSince).not.toHaveBeenCalled();
    });
  });
});
