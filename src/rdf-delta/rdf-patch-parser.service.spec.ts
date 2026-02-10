import { TestBed } from '@suites/unit';
import { RdfPatchParserService } from './rdf-patch-parser.service';

describe('RdfPatchParserService', () => {
  let service: RdfPatchParserService;

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(RdfPatchParserService).compile();
    service = unit;
  });

  describe('extractAffectedGraphs', () => {
    it('should extract graph URIs from AG directives', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'AG <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph1']));
    });

    it('should extract graph URIs from DG directives', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'DG <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph1']));
    });

    it('should extract graph URIs from quad A lines', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/s> <http://example.org/p> <http://example.org/o> <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph1']));
    });

    it('should extract graph URIs from quad D lines', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'D <http://example.org/s> <http://example.org/p> <http://example.org/o> <http://example.org/graph2> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph2']));
    });

    it('should handle mixed patch with all directive types', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'AG <http://example.org/graph1> .',
        'DG <http://example.org/graph2> .',
        'A <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> <http://example.org/graph3> .',
        'D <http://example.org/s2> <http://example.org/p2> <http://example.org/o2> <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(
        new Set([
          'http://example.org/graph1',
          'http://example.org/graph2',
          'http://example.org/graph3',
        ]),
      );
    });

    it('should return empty set for header-only patch', () => {
      const patch = ['H id <uuid:abc> .', 'TX .', 'TC .'].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set());
    });

    it('should ignore malformed lines', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'INVALID LINE',
        'A only-two-tokens .',
        'A <http://example.org/s> <http://example.org/p> <http://example.org/o> <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph1']));
    });

    it('should deduplicate graph URIs across multiple lines', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> <http://example.org/graph1> .',
        'A <http://example.org/s2> <http://example.org/p2> <http://example.org/o2> <http://example.org/graph1> .',
        'D <http://example.org/s3> <http://example.org/p3> <http://example.org/o3> <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph1']));
      expect(result.size).toBe(1);
    });

    it('should handle quads with literal objects', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/s> <http://example.org/p> "some value" <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedGraphs(patch);

      expect(result).toEqual(new Set(['http://example.org/graph1']));
    });

    it('should handle empty input', () => {
      const result = service.extractAffectedGraphs('');

      expect(result).toEqual(new Set());
    });
  });

  describe('extractAffectedResources', () => {
    it('should extract graph and subject URIs from quad operations', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/resource/1> <http://example.org/p> "value" <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.size).toBe(1);
      expect(result.get('http://example.org/graph1')).toEqual(
        new Set(['http://example.org/resource/1']),
      );
    });

    it('should collect multiple subjects per graph', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/r1> <http://example.org/p> "v1" <http://example.org/g1> .',
        'D <http://example.org/r2> <http://example.org/p> "v2" <http://example.org/g1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.get('http://example.org/g1')).toEqual(
        new Set(['http://example.org/r1', 'http://example.org/r2']),
      );
    });

    it('should set graph to null for AG directives', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'AG <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.get('http://example.org/graph1')).toBeNull();
    });

    it('should set graph to null for DG directives', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'DG <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.get('http://example.org/graph1')).toBeNull();
    });

    it('should set graph to null when subject is a blank node', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A _:b0 <http://example.org/p> "value" <http://example.org/graph1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.get('http://example.org/graph1')).toBeNull();
    });

    it('should keep null once set even if later quads have URI subjects', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A _:b0 <http://example.org/p> "v1" <http://example.org/g1> .',
        'A <http://example.org/r1> <http://example.org/p> "v2" <http://example.org/g1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.get('http://example.org/g1')).toBeNull();
    });

    it('should handle multiple graphs with different subjects', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/r1> <http://example.org/p> "v" <http://example.org/g1> .',
        'A <http://example.org/r2> <http://example.org/p> "v" <http://example.org/g2> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.size).toBe(2);
      expect(result.get('http://example.org/g1')).toEqual(
        new Set(['http://example.org/r1']),
      );
      expect(result.get('http://example.org/g2')).toEqual(
        new Set(['http://example.org/r2']),
      );
    });

    it('should deduplicate subjects within a graph', () => {
      const patch = [
        'H id <uuid:abc> .',
        'TX .',
        'A <http://example.org/r1> <http://example.org/p1> "v1" <http://example.org/g1> .',
        'D <http://example.org/r1> <http://example.org/p2> "v2" <http://example.org/g1> .',
        'TC .',
      ].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.get('http://example.org/g1')).toEqual(
        new Set(['http://example.org/r1']),
      );
    });

    it('should return empty map for header-only patch', () => {
      const patch = ['H id <uuid:abc> .', 'TX .', 'TC .'].join('\n');

      const result = service.extractAffectedResources(patch);

      expect(result.size).toBe(0);
    });
  });
});
