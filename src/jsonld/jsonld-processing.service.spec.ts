import { JsonldProcessingService } from './jsonld-processing.service';

describe('JsonldProcessingService', () => {
  let service: JsonldProcessingService;

  beforeEach(() => {
    service = new JsonldProcessingService();
  });

  describe('flatten', () => {
    it('should flatten a JSON-LD document and return URI nodes', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@id': 'http://example.org/resource1',
        '@type': 'dcat:CatalogRecord',
        'dct:title': 'Test Resource',
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      expect(result[0]['@id']).toBe('http://example.org/resource1');
      expect(result[0]['@type']).toBe('dcat:CatalogRecord');
    });

    it('should embed blank nodes into parent documents', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
          prov: 'http://www.w3.org/ns/prov#',
        },
        '@id': 'http://example.org/record1',
        '@type': 'dcat:CatalogRecord',
        'prov:wasGeneratedBy': {
          '@type': 'prov:Activity',
          'prov:name': 'Harvesting',
        },
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      const record = result[0];
      expect(record['@id']).toBe('http://example.org/record1');

      const activity = record['prov:wasGeneratedBy'] as Record<string, unknown>;
      expect(activity).toBeDefined();
      expect(activity['@type']).toBe('prov:Activity');
      expect(activity['prov:name']).toBe('Harvesting');
      expect(activity['@id']).toBeUndefined();
    });

    it('should handle multiple blank nodes in arrays', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
          foaf: 'http://xmlns.com/foaf/0.1/',
        },
        '@id': 'http://example.org/catalog1',
        '@type': 'dcat:Catalog',
        'dct:publisher': [
          { '@type': 'foaf:Agent', 'foaf:name': 'Agent A' },
          { '@type': 'foaf:Agent', 'foaf:name': 'Agent B' },
        ],
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      const catalog = result[0];
      const publishers = catalog['dct:publisher'] as Array<
        Record<string, unknown>
      >;
      expect(publishers).toHaveLength(2);
      expect(publishers[0]['foaf:name']).toBe('Agent A');
      expect(publishers[1]['foaf:name']).toBe('Agent B');
    });

    it('should produce separate documents for multiple URI nodes', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/resource1',
            '@type': 'dcat:CatalogRecord',
            'dct:title': 'Resource 1',
          },
          {
            '@id': 'http://example.org/resource2',
            '@type': 'dcat:Catalog',
            'dct:title': 'Resource 2',
          },
        ],
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(2);
      const ids = result.map((doc) => doc['@id']);
      expect(ids).toContain('http://example.org/resource1');
      expect(ids).toContain('http://example.org/resource2');
    });

    it('should handle documents without @context', async () => {
      const document = {
        '@id': 'http://example.org/resource1',
        '@type': 'http://www.w3.org/ns/dcat#CatalogRecord',
        'http://purl.org/dc/terms/title': 'Test',
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      expect(result[0]['@id']).toBe('http://example.org/resource1');
    });

    it('should handle empty @graph', async () => {
      const document = {
        '@context': { dct: 'http://purl.org/dc/terms/' },
        '@graph': [],
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(0);
    });

    it('should preserve RDF value objects with @language', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
        },
        '@id': 'http://example.org/resource1',
        'dct:title': { '@value': 'Test', '@language': 'en' },
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      const title = result[0]['dct:title'] as Record<string, unknown>;
      expect(title['@value']).toBe('Test');
      expect(title['@language']).toBe('en');
    });

    it('should handle nested blank nodes', async () => {
      const document = {
        '@context': {
          ex: 'http://example.org/',
        },
        '@id': 'http://example.org/root',
        'ex:child': {
          'ex:grandchild': {
            'ex:name': 'Deeply Nested',
          },
        },
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      const root = result[0];
      const child = root['ex:child'] as Record<string, unknown>;
      expect(child).toBeDefined();
      expect(child['@id']).toBeUndefined();
      const grandchild = child['ex:grandchild'] as Record<string, unknown>;
      expect(grandchild).toBeDefined();
      expect(grandchild['ex:name']).toBe('Deeply Nested');
    });

    it('should collapse URI reference objects to plain strings', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/record1',
            '@type': 'dcat:CatalogRecord',
            'dct:conformsTo': { '@id': 'http://example.org/policy' },
          },
          {
            '@id': 'http://example.org/policy',
            '@type': 'dct:Policy',
            'dct:title': 'Some Policy',
          },
        ],
      };

      const result = await service.flatten(document);

      const record = result.find(
        (n) => n['@id'] === 'http://example.org/record1',
      );
      expect(record!['dct:conformsTo']).toBe('http://example.org/policy');
    });

    it('should collapse URI references inside arrays', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/record1',
            '@type': 'dcat:CatalogRecord',
            'dct:conformsTo': [
              { '@id': 'http://example.org/policy1' },
              { '@id': 'http://example.org/policy2' },
            ],
          },
          {
            '@id': 'http://example.org/policy1',
            '@type': 'dct:Policy',
          },
          {
            '@id': 'http://example.org/policy2',
            '@type': 'dct:Policy',
          },
        ],
      };

      const result = await service.flatten(document);

      const record = result.find(
        (n) => n['@id'] === 'http://example.org/record1',
      );
      expect(record!['dct:conformsTo']).toEqual([
        'http://example.org/policy1',
        'http://example.org/policy2',
      ]);
    });

    it('should produce consistent string types for mixed string and URI ref values', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/record1',
            '@type': 'dcat:CatalogRecord',
            'dct:conformsTo': 'https://www.sitemaps.org/protocol.html',
          },
          {
            '@id': 'http://example.org/record2',
            '@type': 'dcat:CatalogRecord',
            'dct:conformsTo': { '@id': 'http://example.org/policy' },
          },
          {
            '@id': 'http://example.org/policy',
            '@type': 'dct:Policy',
          },
        ],
      };

      const result = await service.flatten(document);

      const record1 = result.find(
        (n) => n['@id'] === 'http://example.org/record1',
      );
      const record2 = result.find(
        (n) => n['@id'] === 'http://example.org/record2',
      );
      expect(typeof record1!['dct:conformsTo']).toBe('string');
      expect(typeof record2!['dct:conformsTo']).toBe('string');
    });

    it('should embed blank nodes and collapse URI refs in the same document', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
          prov: 'http://www.w3.org/ns/prov#',
        },
        '@id': 'http://example.org/record1',
        '@type': 'dcat:CatalogRecord',
        'prov:wasGeneratedBy': {
          '@type': 'prov:Activity',
          'prov:name': 'Harvesting',
        },
        'dct:conformsTo': { '@id': 'http://example.org/policy' },
      };

      const result = await service.flatten(document);

      expect(result).toHaveLength(1);
      const record = result[0];

      const activity = record['prov:wasGeneratedBy'] as Record<string, unknown>;
      expect(activity['@type']).toBe('prov:Activity');
      expect(activity['prov:name']).toBe('Harvesting');
      expect(activity['@id']).toBeUndefined();

      expect(record['dct:conformsTo']).toBe('http://example.org/policy');
    });

    it('should add _referencedBy when a document references another', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/catalog',
            '@type': 'dcat:Catalog',
            'dcat:service': { '@id': 'http://example.org/service' },
          },
          {
            '@id': 'http://example.org/service',
            '@type': 'dcat:DataService',
            'dct:title': 'My Service',
          },
        ],
      };

      const result = await service.flatten(document);

      const svc = result.find((n) => n['@id'] === 'http://example.org/service');
      expect(svc!['_referencedBy']).toEqual(['http://example.org/catalog']);
    });

    it('should collect multiple parents in _referencedBy', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/catalog1',
            '@type': 'dcat:Catalog',
            'dct:conformsTo': { '@id': 'http://example.org/policy' },
          },
          {
            '@id': 'http://example.org/catalog2',
            '@type': 'dcat:Catalog',
            'dct:conformsTo': { '@id': 'http://example.org/policy' },
          },
          {
            '@id': 'http://example.org/policy',
            '@type': 'dct:Policy',
            'dct:title': 'Shared Policy',
          },
        ],
      };

      const result = await service.flatten(document);

      const policy = result.find(
        (n) => n['@id'] === 'http://example.org/policy',
      );
      expect(policy!['_referencedBy']).toHaveLength(2);
      expect(policy!['_referencedBy']).toContain('http://example.org/catalog1');
      expect(policy!['_referencedBy']).toContain('http://example.org/catalog2');
    });

    it('should not add _referencedBy for self-references', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@id': 'http://example.org/resource1',
        '@type': 'dcat:CatalogRecord',
        'dct:title': 'Test Resource',
      };

      const result = await service.flatten(document);

      expect(result[0]['_referencedBy']).toBeUndefined();
    });

    it('should not add _referencedBy when no documents reference each other', async () => {
      const document = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
        },
        '@graph': [
          {
            '@id': 'http://example.org/resource1',
            '@type': 'dcat:CatalogRecord',
            'dct:title': 'Resource 1',
          },
          {
            '@id': 'http://example.org/resource2',
            '@type': 'dcat:Catalog',
            'dct:title': 'Resource 2',
          },
        ],
      };

      const result = await service.flatten(document);

      expect(result[0]['_referencedBy']).toBeUndefined();
      expect(result[1]['_referencedBy']).toBeUndefined();
    });
  });
});
