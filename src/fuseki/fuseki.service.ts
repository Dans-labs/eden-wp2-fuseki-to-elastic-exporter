import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FUSEKI_CONFIG_KEY, type FusekiConfig } from '../config';

@Injectable()
export class FusekiService {
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    const fusekiConfig =
      this.configService.get<FusekiConfig>(FUSEKI_CONFIG_KEY);
    this.endpoint = fusekiConfig!.FUSEKI_ENDPOINT;
  }

  async listNamedGraphs(): Promise<string[]> {
    const query = 'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }';
    const url = `${this.endpoint}/sparql?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to list named graphs: ${response.status} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as {
      results: { bindings: Array<{ g: { value: string } }> };
    };

    return json.results.bindings.map((binding) => binding.g.value);
  }

  // Uses the Graph Store Protocol (not SPARQL) to retrieve an entire named
  // graph as a single JSON-LD document it is more efficient than a CONSTRUCT query.
  async fetchGraph(graphUri: string): Promise<object> {
    const url = `${this.endpoint}/data?graph=${encodeURIComponent(graphUri)}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/ld+json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch graph ${graphUri}: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as object;
  }
}
