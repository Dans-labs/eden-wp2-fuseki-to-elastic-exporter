import { Injectable, Logger } from '@nestjs/common';
import { RdfDeltaClientService } from './rdf-delta-client.service';
import { RdfPatchParserService } from './rdf-patch-parser.service';
import { PatchGapError } from './patch-gap.error';

export interface AffectedGraph {
  graphUri: string;
  subjectUris: string[] | null;
}

export interface ChangeDetectionResult {
  affectedGraphs: AffectedGraph[];
  newPatchVersion: number;
}

@Injectable()
export class RdfDeltaChangeDetectionService {
  private readonly logger = new Logger(RdfDeltaChangeDetectionService.name);

  constructor(
    private readonly deltaClient: RdfDeltaClientService,
    private readonly patchParser: RdfPatchParserService,
  ) {}

  async detectChanges(
    lastPatchVersion: number,
  ): Promise<ChangeDetectionResult> {
    const { minVersion, maxVersion } = await this.deltaClient.describeLog();

    if (minVersion > lastPatchVersion + 1) {
      throw new PatchGapError(lastPatchVersion, minVersion);
    }

    if (maxVersion === lastPatchVersion) {
      this.logger.debug('No new patches available');
      return { affectedGraphs: [], newPatchVersion: lastPatchVersion };
    }

    const patches = await this.deltaClient.fetchPatchesSince(
      lastPatchVersion,
      maxVersion,
    );

    const merged = new Map<string, Set<string> | null>();
    for (const patchText of patches) {
      const resources = this.patchParser.extractAffectedResources(patchText);
      for (const [graphUri, subjects] of resources) {
        const current = merged.get(graphUri);
        if (current === null || subjects === null) {
          merged.set(graphUri, null);
        } else if (current) {
          for (const s of subjects) current.add(s);
        } else {
          merged.set(graphUri, new Set(subjects));
        }
      }
    }

    const affectedGraphs: AffectedGraph[] = [...merged.entries()].map(
      ([graphUri, subjects]) => ({
        graphUri,
        subjectUris: subjects ? [...subjects] : null,
      }),
    );

    this.logger.log(
      `Detected ${affectedGraphs.length} affected graphs from ${patches.length} patches (versions ${lastPatchVersion + 1}–${maxVersion})`,
    );

    return { affectedGraphs, newPatchVersion: maxVersion };
  }
}
