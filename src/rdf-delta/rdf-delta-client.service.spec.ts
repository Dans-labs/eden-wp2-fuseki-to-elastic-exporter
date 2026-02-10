import { TestBed } from '@suites/unit';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosError, type AxiosResponse } from 'axios';
import { RdfDeltaClientService } from './rdf-delta-client.service';
import { FUSEKI_CONFIG_KEY } from '../config';

describe('RdfDeltaClientService', () => {
  let service: RdfDeltaClientService;
  let httpService: HttpService;

  const deltaUrl = 'http://localhost:1066';
  const datasource = 'eden';
  const datasourceId = '961cce67-9b46-40ef-9778-eb76546f4c42';

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(RdfDeltaClientService)
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn().mockImplementation((key: symbol) => {
          if (key === FUSEKI_CONFIG_KEY) {
            return {
              FUSEKI_ENDPOINT: 'http://localhost:3030/eden',
              RDF_DELTA_URL: deltaUrl,
              RDF_DELTA_DATASOURCE: datasource,
            };
          }
          return undefined;
        }),
      }))
      .compile();

    service = unit;
    httpService = unitRef.get(HttpService) as unknown as HttpService;
  });

  describe('onModuleInit', () => {
    it('should resolve datasource name to UUID', async () => {
      const listResponse: AxiosResponse = {
        data: {
          array: [
            {
              id: `id:${datasourceId}`,
              name: 'eden',
              uri: 'http://delta/eden',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      (httpService.post as jest.Mock).mockReturnValue(of(listResponse));

      await service.onModuleInit();

      expect(httpService.post).toHaveBeenCalledWith(
        `${deltaUrl}/$/rpc`,
        expect.objectContaining({
          operation: 'list_descriptions',
          arg: {},
        }),
      );
    });

    it('should auto-create datasource when not found', async () => {
      const emptyListResponse: AxiosResponse = {
        data: { array: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      const createResponse: AxiosResponse = {
        data: { id: datasourceId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      (httpService.post as jest.Mock)
        .mockReturnValueOnce(of(emptyListResponse))
        .mockReturnValueOnce(of(createResponse));

      await service.onModuleInit();

      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(httpService.post).toHaveBeenNthCalledWith(
        2,
        `${deltaUrl}/$/rpc`,
        expect.objectContaining({
          operation: 'create_datasource',
          arg: { name: datasource, uri: `http://delta/${datasource}` },
        }),
      );
    });

    it('should propagate creation failure', async () => {
      const emptyListResponse: AxiosResponse = {
        data: { array: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      const error = new AxiosError('Internal Server Error', '500');

      (httpService.post as jest.Mock)
        .mockReturnValueOnce(of(emptyListResponse))
        .mockReturnValueOnce(throwError(() => error));

      await expect(service.onModuleInit()).rejects.toThrow(
        'Internal Server Error',
      );
    });
  });

  describe('describeLog', () => {
    beforeEach(async () => {
      // Resolve datasource ID first
      const listResponse: AxiosResponse = {
        data: {
          array: [
            {
              id: `id:${datasourceId}`,
              name: 'eden',
              uri: 'http://delta/eden',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      (httpService.post as jest.Mock).mockReturnValueOnce(of(listResponse));
      await service.onModuleInit();
    });

    it('should return parsed min and max versions via JSON-RPC', async () => {
      const response: AxiosResponse = {
        data: { min_version: 1, max_version: 42 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      (httpService.post as jest.Mock).mockReturnValue(of(response));

      const result = await service.describeLog();

      expect(result).toEqual({ minVersion: 1, maxVersion: 42 });
      expect(httpService.post).toHaveBeenCalledWith(
        `${deltaUrl}/$/rpc`,
        expect.objectContaining({
          operation: 'describe_log',
          arg: { datasource: datasourceId },
        }),
      );
    });

    it('should propagate HTTP errors', async () => {
      const error = new AxiosError('Request failed', '500');
      (httpService.post as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.describeLog()).rejects.toThrow('Request failed');
    });
  });

  describe('fetchPatch', () => {
    it('should return raw patch text', async () => {
      const patchText = 'H id <uuid:123> .\nTX .\nTC .';
      const response: AxiosResponse = {
        data: patchText,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as AxiosResponse['config'],
      };

      (httpService.get as jest.Mock).mockReturnValue(of(response));

      const result = await service.fetchPatch(5);

      expect(result).toBe(patchText);
      expect(httpService.get).toHaveBeenCalledWith(
        `${deltaUrl}/${datasource}/5`,
        { responseType: 'text' },
      );
    });

    it('should propagate HTTP errors', async () => {
      const error = new AxiosError('Not Found', '404');
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.fetchPatch(999)).rejects.toThrow('Not Found');
    });
  });

  describe('fetchPatchesSince', () => {
    it('should fetch all patches in the version range', async () => {
      const patches = ['patch-2', 'patch-3', 'patch-4'];

      (httpService.get as jest.Mock).mockImplementation((url: string) => {
        const version = parseInt(url.split('/').pop()!, 10);
        return of({
          data: patches[version - 2],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} } as AxiosResponse['config'],
        });
      });

      const result = await service.fetchPatchesSince(1, 4);

      expect(result).toEqual(patches);
      expect(httpService.get).toHaveBeenCalledTimes(3);
    });

    it('should return empty array when fromVersion equals toVersion', async () => {
      const result = await service.fetchPatchesSince(5, 5);

      expect(result).toEqual([]);
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });
});
