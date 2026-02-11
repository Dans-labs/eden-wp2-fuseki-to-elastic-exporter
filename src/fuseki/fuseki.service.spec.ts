import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { FusekiService } from './fuseki.service';
import { FUSEKI_CONFIG_KEY } from '../config';

describe('FusekiService', () => {
  let service: FusekiService;
  const fusekiEndpoint = 'http://localhost:3030/eden';

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(FusekiService)
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn().mockImplementation((key: symbol) => {
          if (key === FUSEKI_CONFIG_KEY) {
            return { FUSEKI_ENDPOINT: fusekiEndpoint };
          }
          return undefined;
        }),
      }))
      .compile();

    service = unit;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listNamedGraphs', () => {
    it('should return an array of graph URIs', async () => {
      const sparqlResponse = {
        results: {
          bindings: [
            { g: { value: 'http://example.org/graph1' } },
            { g: { value: 'http://example.org/graph2' } },
          ],
        },
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sparqlResponse),
      } as Response);

      const result = await service.listNamedGraphs();

      expect(result).toEqual([
        'http://example.org/graph1',
        'http://example.org/graph2',
      ]);
    });

    it('should call the correct SPARQL endpoint', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [] } }),
      } as Response);

      await service.listNamedGraphs();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${fusekiEndpoint}/sparql?query=`),
        expect.objectContaining({
          headers: { Accept: 'application/sparql-results+json' },
        }),
      );
    });

    it('should throw when the response is not ok', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(service.listNamedGraphs()).rejects.toThrow(
        'Failed to list named graphs: 500 Internal Server Error',
      );
    });
  });

  describe('fetchGraph', () => {
    const graphUri = 'http://example.org/graph1';

    it('should return parsed JSON-LD', async () => {
      const jsonLd = {
        '@context': { dct: 'http://purl.org/dc/terms/' },
        '@id': 'http://example.org/resource',
        'dct:title': 'Test',
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(jsonLd),
      } as Response);

      const result = await service.fetchGraph(graphUri);

      expect(result).toEqual(jsonLd);
    });

    it('should call the Graph Store Protocol endpoint', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await service.fetchGraph(graphUri);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${fusekiEndpoint}/data?graph=${encodeURIComponent(graphUri)}`,
        expect.objectContaining({
          headers: { Accept: 'application/ld+json' },
        }),
      );
    });

    it('should throw when the response is not ok', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(service.fetchGraph(graphUri)).rejects.toThrow(
        `Failed to fetch graph ${graphUri}: 404 Not Found`,
      );
    });
  });

  describe('fetchResources', () => {
    const graphUri = 'http://example.org/graph1';
    const subjectUris = [
      'http://example.org/resource/1',
      'http://example.org/resource/2',
    ];

    it('should return parsed JSON-LD from CONSTRUCT query', async () => {
      const jsonLd = {
        '@context': {},
        '@graph': [
          { '@id': 'http://example.org/resource/1', title: 'R1' },
          { '@id': 'http://example.org/resource/2', title: 'R2' },
        ],
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(jsonLd),
      } as Response);

      const result = await service.fetchResources(graphUri, subjectUris);

      expect(result).toEqual(jsonLd);
    });

    it('should call the SPARQL endpoint with a CONSTRUCT query', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await service.fetchResources(graphUri, subjectUris);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${fusekiEndpoint}/sparql?query=`),
        expect.objectContaining({
          headers: { Accept: 'application/ld+json' },
        }),
      );
      const url = fetchSpy.mock.calls[0][0] as string;
      const query = decodeURIComponent(url.split('query=')[1]);
      expect(query).toContain('CONSTRUCT');
      expect(query).toContain('<http://example.org/resource/1>');
      expect(query).toContain('<http://example.org/resource/2>');
    });

    it('should throw when the response is not ok', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(
        service.fetchResources(graphUri, subjectUris),
      ).rejects.toThrow(
        `Failed to fetch resources from graph ${graphUri}: 500 Internal Server Error`,
      );
    });
  });
});
