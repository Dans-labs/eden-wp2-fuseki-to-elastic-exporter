import { Injectable } from '@nestjs/common';

@Injectable()
export class RdfPatchParserService {
  extractAffectedGraphs(patchText: string): Set<string> {
    const graphs = new Set<string>();
    const lines = patchText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // AG <uri> . — add graph directive
      // DG <uri> . — delete graph directive
      if (trimmed.startsWith('AG ') || trimmed.startsWith('DG ')) {
        const uri = this.extractUri(trimmed, 1);
        if (uri) graphs.add(uri);
        continue;
      }

      // A <s> <p> <o> <g> . — quad add (4th URI = graph)
      // D <s> <p> <o> <g> . — quad delete (4th URI = graph)
      if (trimmed.startsWith('A ') || trimmed.startsWith('D ')) {
        const uri = this.extractGraphFromQuad(trimmed);
        if (uri) graphs.add(uri);
      }
    }

    return graphs;
  }

  // Returns a map of graphUri → affected subject URIs.
  // A null value means the entire graph needs syncing (AG/DG directive or blank-node subject).
  extractAffectedResources(patchText: string): Map<string, Set<string> | null> {
    const result = new Map<string, Set<string> | null>();
    const lines = patchText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('AG ') || trimmed.startsWith('DG ')) {
        const graphUri = this.extractUri(trimmed, 1);
        if (graphUri) result.set(graphUri, null);
        continue;
      }

      if (trimmed.startsWith('A ') || trimmed.startsWith('D ')) {
        const graphUri = this.extractGraphFromQuad(trimmed);
        if (!graphUri) continue;

        const subject = this.extractSubjectFromQuad(trimmed);
        if (!subject || subject.startsWith('_:')) {
          result.set(graphUri, null);
          continue;
        }

        const current = result.get(graphUri);
        if (current === null) continue; // already marked for full sync
        if (current) {
          current.add(subject);
        } else {
          result.set(graphUri, new Set([subject]));
        }
      }
    }

    return result;
  }

  private extractUri(line: string, position: number): string | undefined {
    const parts = this.tokenize(line);
    const token = parts[position];
    if (token && token.startsWith('<') && token.endsWith('>')) {
      return token.slice(1, -1);
    }
    return undefined;
  }

  private extractSubjectFromQuad(line: string): string | undefined {
    // Quad format: A/D <s> <p> <o> <g> .
    // The subject is the 1st token (index 1); may be a URI or blank node
    const parts = this.tokenize(line);
    const token = parts[1];
    if (!token) return undefined;
    if (token.startsWith('<') && token.endsWith('>')) return token.slice(1, -1);
    if (token.startsWith('_:')) return token;
    return undefined;
  }

  private extractGraphFromQuad(line: string): string | undefined {
    // Quad format: A/D <s> <p> <o> <g> .
    // The graph URI is the 4th token (index 4)
    return this.extractUri(line, 4);
  }

  private tokenize(line: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (i < line.length) {
      // Skip whitespace
      while (i < line.length && /\s/.test(line[i])) i++;
      if (i >= line.length) break;

      if (line[i] === '<') {
        // URI token: read until closing >
        const start = i;
        i++;
        while (i < line.length && line[i] !== '>') i++;
        if (i < line.length) i++; // consume >
        tokens.push(line.slice(start, i));
      } else if (line[i] === '"') {
        // Literal token: read until unescaped closing "
        const start = i;
        i++;
        while (i < line.length && line[i] !== '"') {
          if (line[i] === '\\') i++; // skip escaped char
          i++;
        }
        if (i < line.length) i++; // consume "
        // Also consume optional datatype or language tag
        while (i < line.length && !/\s/.test(line[i]) && line[i] !== '.') i++;
        tokens.push(line.slice(start, i));
      } else {
        // Plain token (keywords like A, D, AG, DG, TX, TC, H, or .)
        const start = i;
        while (i < line.length && !/\s/.test(line[i])) i++;
        tokens.push(line.slice(start, i));
      }
    }

    return tokens;
  }
}
