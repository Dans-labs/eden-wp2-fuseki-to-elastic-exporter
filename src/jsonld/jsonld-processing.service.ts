import { Injectable } from '@nestjs/common';
import * as jsonld from 'jsonld';
import type { ContextDefinition, JsonLdDocument } from 'jsonld';

type JsonLdNode = Record<string, unknown>;

interface FlattenedDocument {
  '@context'?: ContextDefinition;
  '@graph'?: JsonLdNode[];
}

@Injectable()
export class JsonldProcessingService {
  // W3C JSON-LD flatten returns different shapes depending on whether a context
  // is provided: an array of expanded nodes (no context) or an object with
  // @graph containing compacted nodes (with context). Both cases are handled.
  async flatten(document: JsonLdDocument): Promise<JsonLdNode[]> {
    const context =
      !Array.isArray(document) && '@context' in document
        ? (document['@context'] as ContextDefinition)
        : undefined;

    const flattened = await jsonld.flatten(document, context);

    let nodes: JsonLdNode[];
    if (Array.isArray(flattened)) {
      nodes = flattened as JsonLdNode[];
    } else {
      nodes =
        ((flattened as FlattenedDocument)['@graph'] as JsonLdNode[]) ?? [];
    }

    return this.addBackReferences(this.embedBlankNodes(nodes));
  }

  // After flattening, URI references are collapsed to plain strings. Scan each
  // document for string values that match another document's @id and add a
  // synthetic _referencedBy array to the referenced document.
  private addBackReferences(nodes: JsonLdNode[]): JsonLdNode[] {
    const docIds = new Set(nodes.map((n) => n['@id'] as string));
    const backRefs = new Map<string, string[]>();

    for (const node of nodes) {
      const parentId = node['@id'] as string;
      this.collectUriReferences(node, docIds, parentId, backRefs);
    }

    return nodes.map((node) => {
      const id = node['@id'] as string;
      const refs = backRefs.get(id);
      return refs?.length ? { ...node, _referencedBy: refs } : node;
    });
  }

  private collectUriReferences(
    value: unknown,
    docIds: Set<string>,
    parentId: string,
    backRefs: Map<string, string[]>,
  ): void {
    if (typeof value === 'string') {
      if (value !== parentId && docIds.has(value)) {
        const existing = backRefs.get(value) ?? [];
        if (!existing.includes(parentId)) {
          backRefs.set(value, [...existing, parentId]);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectUriReferences(item, docIds, parentId, backRefs);
      }
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const v of Object.values(value)) {
        this.collectUriReferences(v, docIds, parentId, backRefs);
      }
    }
  }

  // Partition nodes into URI nodes (real entities) and blank nodes (anonymous),
  // then inline each blank node into the parent that references it.
  private embedBlankNodes(nodes: JsonLdNode[]): JsonLdNode[] {
    const blankNodeMap = new Map<string, JsonLdNode>();
    const uriNodes: JsonLdNode[] = [];

    for (const node of nodes) {
      const id = node['@id'] as string | undefined;
      if (id && id.startsWith('_:')) {
        blankNodeMap.set(id, node);
      } else {
        uriNodes.push(node);
      }
    }

    return uriNodes.map((node) =>
      this.resolveBlankNodeRefs(node, blankNodeMap),
    );
  }

  private resolveBlankNodeRefs(
    node: JsonLdNode,
    blankNodeMap: Map<string, JsonLdNode>,
  ): JsonLdNode {
    const resolved: JsonLdNode = {};

    for (const [key, value] of Object.entries(node)) {
      resolved[key] = this.resolveValue(value, blankNodeMap);
    }

    return resolved;
  }

  private resolveValue(
    value: unknown,
    blankNodeMap: Map<string, JsonLdNode>,
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, blankNodeMap));
    }

    if (this.isBlankNodeRef(value)) {
      const blankNode = blankNodeMap.get(value['@id']);
      if (blankNode) {
        const embedded = { ...blankNode };
        delete embedded['@id'];
        return this.resolveBlankNodeRefs(embedded, blankNodeMap);
      }
    }

    if (this.isUriRef(value)) {
      return value['@id'];
    }

    return value;
  }

  // A blank node reference is a single-key object like {"@id": "_:b0"} — the
  // flattened form of an anonymous node that should be resolved to its full object.
  private isBlankNodeRef(value: unknown): value is { '@id': string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 1 &&
      '@id' in value &&
      typeof (value as Record<string, unknown>)['@id'] === 'string' &&
      ((value as Record<string, unknown>)['@id'] as string).startsWith('_:')
    );
  }

  // A URI reference is a single-key object like {"@id": "https://example.org/resource"}.
  // These are collapsed to plain URI strings so that ES field types stay consistent —
  // without this, the same property can be a string in one doc and an object in another,
  // which causes ES dynamic mapping conflicts.
  private isUriRef(value: unknown): value is { '@id': string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 1 &&
      '@id' in value &&
      typeof (value as Record<string, unknown>)['@id'] === 'string' &&
      !((value as Record<string, unknown>)['@id'] as string).startsWith('_:')
    );
  }
}
