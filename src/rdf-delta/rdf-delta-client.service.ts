import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { FUSEKI_CONFIG_KEY, type FusekiConfig } from '../config';

export interface LogDescription {
  minVersion: number;
  maxVersion: number;
}

interface DatasourceDescription {
  id: string;
  name: string;
  uri: string;
}

interface ListDescriptionsResponse {
  array: DatasourceDescription[];
}

interface CreateDatasourceResponse {
  id: string;
}

interface DescribeLogResponse {
  min_version: number;
  max_version: number;
}

@Injectable()
export class RdfDeltaClientService implements OnModuleInit {
  private readonly logger = new Logger(RdfDeltaClientService.name);
  private readonly deltaUrl: string;
  private readonly datasource: string;
  private datasourceId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<FusekiConfig>(FUSEKI_CONFIG_KEY);
    this.deltaUrl = config!.RDF_DELTA_URL;
    this.datasource = config!.RDF_DELTA_DATASOURCE;
  }

  async onModuleInit(): Promise<void> {
    this.datasourceId = await this.resolveDatasourceId();
    this.logger.log(
      `Resolved RDF Delta datasource "${this.datasource}" → ${this.datasourceId}`,
    );
  }

  private async resolveDatasourceId(): Promise<string> {
    const url = `${this.deltaUrl}/$/rpc`;

    const { data } = await firstValueFrom(
      this.httpService.post<ListDescriptionsResponse>(url, {
        operation: 'list_descriptions',
        opid: String(Date.now()),
        arg: {},
      }),
    );

    const entry = data.array.find((ds) => ds.name === this.datasource);
    if (!entry) {
      this.logger.warn(
        `RDF Delta datasource "${this.datasource}" not found — creating it`,
      );
      return this.createDatasource(this.datasource);
    }

    // The id field has the format "id:<uuid>", strip the prefix
    return entry.id.replace(/^id:/, '');
  }

  private async createDatasource(name: string): Promise<string> {
    const url = `${this.deltaUrl}/$/rpc`;

    const { data } = await firstValueFrom(
      this.httpService.post<CreateDatasourceResponse>(url, {
        operation: 'create_datasource',
        opid: String(Date.now()),
        arg: { name, uri: `http://delta/${name}` },
      }),
    );

    this.logger.log(`Created RDF Delta datasource "${name}" → ${data.id}`);
    return data.id;
  }

  async describeLog(): Promise<LogDescription> {
    const url = `${this.deltaUrl}/$/rpc`;
    this.logger.debug(`Describing log for datasource ${this.datasourceId}`);

    const { data } = await firstValueFrom(
      this.httpService.post<DescribeLogResponse>(url, {
        operation: 'describe_log',
        opid: String(Date.now()),
        arg: { datasource: this.datasourceId },
      }),
    );

    return {
      minVersion: data.min_version,
      maxVersion: data.max_version,
    };
  }

  async fetchPatch(version: number): Promise<string> {
    const url = `${this.deltaUrl}/${this.datasource}/${version}`;
    this.logger.debug(`Fetching patch version ${version} from ${url}`);

    const { data } = await firstValueFrom(
      this.httpService.get<string>(url, { responseType: 'text' }),
    );

    return data;
  }

  async fetchPatchesSince(
    fromVersion: number,
    toVersion: number,
  ): Promise<string[]> {
    const patches: string[] = [];

    for (let version = fromVersion + 1; version <= toVersion; version++) {
      const patch = await this.fetchPatch(version);
      patches.push(patch);
    }

    this.logger.log(
      `Fetched ${patches.length} patches (versions ${fromVersion + 1}–${toVersion})`,
    );

    return patches;
  }
}
