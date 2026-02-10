# Implementation Plan: Enterprise Incremental Sync

## Context

Fuseki has no native change detection. This plan adds automatic sync every 10 minutes via RDF Delta change detection (with polling fallback), PostgreSQL state tracking, and Bull/Redis job queuing. A manual full reindex via `GET /api/export` uses blue-green index swapping for zero downtime.

**Current state:** Commit 1 is done and committed. Commit 2 is done and committed. Commits 3-11 are pending.

---

## Commit 1 — `feat(prisma): add Prisma with PostgreSQL schema` DONE

**Files created/modified:**

- `prisma/schema.prisma` — Prisma 7 schema with `SyncState` + `GraphRegistry` models, `prisma-client` generator outputting to `./generated/prisma`
- `prisma.config.ts` — Prisma 7 config using `defineConfig` + `env('DATABASE_URL')`
- `src/prisma/prisma.service.ts` — Extends `PrismaClient`, injects `ConfigService` to get `DATABASE_URL`, creates `PrismaPg` adapter, implements `OnModuleInit`/`OnModuleDestroy`
- `src/prisma/prisma.module.ts` — `@Global()` module importing `ConfigModule`, providing + exporting `PrismaService`
- `src/prisma/prisma.service.spec.ts` — Unit test with `@suites/unit` mocking `ConfigService`
- `src/config/database.config.ts` — Zod schema `z.url()`, `DATABASE_CONFIG_KEY` symbol, `registerAs`
- `src/config/index.ts` — Added `databaseConfig` re-export
- `src/config/validation-schema.ts` — Merged `DatabaseConfigSchema`
- `src/config/validation-schema.spec.ts` — Added `DATABASE_URL` to fixture + tests
- `.env.example` — Added `DATABASE_URL`
- `.gitignore` — Added `/prisma/generated`
- `package.json` / `pnpm-lock.yaml` — Added `@prisma/client`, `@prisma/adapter-pg`, `@nestjs/schedule`, `@nestjs/bull`, `bull`, `ioredis`, `prisma`, `@types/bull`

---

## Commit 2 — `feat(config): add sync, redis, and rdf-delta configuration` DONE

**Files created/modified:**

- `src/config/sync.config.ts` — `SYNC_CRON` (default `*/10 * * * *`), `SYNC_ENABLED` (enum `'true'|'false'` transformed to boolean), `CHANGE_DETECTION_MODE` (enum `'delta'|'polling'`)
- `src/config/redis.config.ts` — `REDIS_HOST` (default `localhost`), `REDIS_PORT` (coerce number, default `6379`)
- `src/config/fuseki.config.ts` — Added `RDF_DELTA_URL` (url, optional), `RDF_DELTA_DATASOURCE` (string, optional) to `FusekiConfigSchema`
- `src/config/index.ts` — Added re-exports for `syncConfig`, `redisConfig`, `EnvironmentConfigInput`
- `src/config/validation-schema.ts` — Merged all new schemas into `BaseSchema`, added `.refine()` for conditional delta validation, exported `EnvironmentConfigInput` (input type for tests)
- `src/config/validation-schema.spec.ts` — Added all new env vars to fixture, test blocks for Sync/Redis/RdfDelta schemas
- `.env.example` — Added Redis, Sync, RDF Delta sections

---

## Commit 3 — `feat(graph-sync): add graph registry and sync state services`

### Create `src/graph-sync/` directory

### `src/graph-sync/graph-registry.service.ts`

Prisma CRUD wrapper for the `GraphRegistry` model:

- `findByGraphUri(graphUri: string): Promise<GraphRegistry | null>` — `prisma.graphRegistry.findUnique({ where: { graphUri } })`
- `upsert(graphUri: string, contentHash: string, documentIds: string[]): Promise<GraphRegistry>` — `prisma.graphRegistry.upsert(...)` setting `documentCount: documentIds.length`
- `delete(graphUri: string): Promise<void>` — `prisma.graphRegistry.delete({ where: { graphUri } })`
- `findAll(): Promise<GraphRegistry[]>` — `prisma.graphRegistry.findMany()`
- `deleteAll(): Promise<void>` — `prisma.graphRegistry.deleteMany()`

Inject `PrismaService`. Import types from `../../prisma/generated/prisma/client`.

### `src/graph-sync/sync-state.service.ts`

Prisma CRUD wrapper for the `SyncState` model (singleton pattern):

- `get(): Promise<SyncState>` — `prisma.syncState.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} })` (ensures row exists)
- `updateLastPatchVersion(version: number): Promise<void>` — `prisma.syncState.update({ where: { id: 'singleton' }, data: { lastPatchVersion: version } })`
- `updateActiveIndex(indexName: string, patchVersion: number): Promise<void>` — updates both `activeIndexName` and `lastPatchVersion`

Inject `PrismaService`.

### `src/graph-sync/graph-sync.module.ts`

```
imports: [ConfigModule]
providers: [GraphRegistryService, SyncStateService]
exports: [GraphRegistryService, SyncStateService]
```

No need to import `PrismaModule` since it's `@Global()`.

### Tests

- `graph-registry.service.spec.ts` — Use `@suites/unit` `TestBed.solitary(GraphRegistryService)`. Mock `PrismaService`, verify correct Prisma calls for each CRUD method.
- `sync-state.service.spec.ts` — Same pattern. Mock `PrismaService`, verify `syncState.upsert`/`syncState.update` calls.

### Steps:

1. Create directory `src/graph-sync/`
2. Write `graph-registry.service.ts`, `sync-state.service.ts`, `graph-sync.module.ts`
3. Write `graph-registry.service.spec.ts`, `sync-state.service.spec.ts`
4. `npx tsc --noEmit`
5. `npx jest --testPathPattern=graph-registry` and `npx jest --testPathPattern=sync-state`
6. `pnpm run lint && pnpm run format`
7. Stage and commit

---

## Commit 4 — `feat(elasticsearch): add bulk delete, alias swap, and index deletion`

### Modify `src/elasticsearch/elasticsearch-index.service.ts`

Add three methods to existing `ElasticsearchIndexService`:

**`bulkDelete(indexName: string, documentIds: string[]): Promise<void>`**

- Early return if `documentIds.length === 0`
- Build `operations` array: `documentIds.flatMap(id => [{ delete: { _index: indexName, _id: id } }])`
- Call `this.esService.bulk({ operations })`
- Check `response.errors`, log failures but don't throw (deletes are best-effort)
- Log count of deleted documents

**`swapAlias(aliasName: string, newIndexName: string): Promise<void>`**

- First get current indices for alias: `this.esService.indices.getAlias({ name: aliasName })` (catch 404 = no existing alias)
- Build actions array: `remove` old index from alias + `add` new index to alias
- Call `this.esService.indices.updateAliases({ actions })`
- Log the swap

**`deleteIndex(indexName: string): Promise<void>`**

- Call `this.esService.indices.delete({ index: indexName })`
- Log deletion

### Modify `src/elasticsearch/elasticsearch-index.service.spec.ts`

Add test blocks for each new method following existing pattern:

- `bulkDelete`: test with documents, test empty array skip, test error logging
- `swapAlias`: test with existing alias (remove+add), test with no existing alias (add only)
- `deleteIndex`: test successful deletion

Mock pattern: `(esService.bulk as jest.Mock).mockResolvedValueOnce(...)`, `(esService.indices.getAlias as jest.Mock)`, `(esService.indices.updateAliases as jest.Mock)`, `(esService.indices.delete as jest.Mock)`.

### Steps:

1. Add three methods to `elasticsearch-index.service.ts`
2. Add tests to `elasticsearch-index.service.spec.ts`
3. `npx tsc --noEmit`
4. `npx jest --testPathPattern=elasticsearch-index`
5. `pnpm run lint && pnpm run format`
6. Stage and commit

---

## Commit 5 — `feat(rdf-delta): add RDF Delta client and patch parser`

### Create `src/rdf-delta/` directory

### `src/rdf-delta/rdf-delta-client.service.ts`

HTTP client for the RDF Delta Patch Log Server. Inject `ConfigService` to get `RDF_DELTA_URL` and `RDF_DELTA_DATASOURCE` from `FUSEKI_CONFIG_KEY`.

**`describeLog(): Promise<{ minVersion: number; maxVersion: number }>`**

- `GET {RDF_DELTA_URL}/{datasource}/` or appropriate endpoint
- Parse JSON response, extract `min_version` and `max_version`
- Return `{ minVersion, maxVersion }`

**`fetchPatch(version: number): Promise<string>`**

- `GET {RDF_DELTA_URL}/{datasource}/{version}`
- Return raw patch text (RDF Patch format)

**`fetchPatchesSince(fromVersion: number, toVersion: number): Promise<string[]>`**

- Loop from `fromVersion + 1` to `toVersion`, call `fetchPatch` for each
- Return array of patch texts

Uses native `fetch`. Throws on non-OK responses.

### `src/rdf-delta/rdf-patch-parser.service.ts`

Stateless parser — no DI dependencies needed, but still `@Injectable()` for testability.

**`extractAffectedGraphs(patchText: string): Set<string>`**

- Parse RDF Patch format lines
- Look for `AG <uri> .` (add to graph) and `DG <uri> .` (delete from graph) directives
- Also extract graph URIs from quad lines: `A <s> <p> <o> <g> .` — the 4th URI is the graph
- Return `Set<string>` of all affected graph URIs

RDF Patch format reference:

```
H id <uuid> .
TX .
A <s> <p> <o> <g> .
D <s> <p> <o> <g> .
TC .
```

### `src/rdf-delta/rdf-delta.module.ts`

```
imports: [ConfigModule]
providers: [RdfDeltaClientService, RdfPatchParserService]
exports: [RdfDeltaClientService, RdfPatchParserService]
```

### Tests

- `rdf-delta-client.service.spec.ts` — Mock `fetch`, test `describeLog()` and `fetchPatch()` with mock responses, test error handling
- `rdf-patch-parser.service.spec.ts` — Pure unit tests with sample patch text, verify correct graph URI extraction

### Steps:

1. Create directory `src/rdf-delta/`
2. Write service files and module
3. Write tests
4. `npx tsc --noEmit`
5. `npx jest --testPathPattern=rdf-delta`
6. `pnpm run lint && pnpm run format`
7. Stage and commit

---

## Commit 6 — `feat(change-detection): add pluggable change detection strategy`

### Create `src/change-detection/` directory

### `src/change-detection/change-detection-strategy.interface.ts`

```typescript
export const CHANGE_DETECTION_STRATEGY = Symbol('CHANGE_DETECTION_STRATEGY');

export interface ChangeDetectionResult {
  affectedGraphUris: string[];
  deletedGraphUris: string[];
  newPatchVersion: number;
}

export interface ChangeDetectionStrategy {
  detectChanges(lastPatchVersion: number): Promise<ChangeDetectionResult>;
}
```

### `src/change-detection/patch-gap.error.ts`

```typescript
export class PatchGapError extends Error {
  constructor(
    public readonly lastKnownVersion: number,
    public readonly minAvailableVersion: number,
  ) {
    super(
      `Patch gap detected: last known version ${lastKnownVersion}, min available ${minAvailableVersion}`,
    );
    this.name = 'PatchGapError';
  }
}
```

### `src/change-detection/rdf-delta-strategy.service.ts`

Implements `ChangeDetectionStrategy`. Injects `RdfDeltaClientService`, `RdfPatchParserService`.

**`detectChanges(lastPatchVersion)`:**

1. Call `deltaClient.describeLog()` -> `{ minVersion, maxVersion }`
2. If `minVersion > lastPatchVersion` -> throw `PatchGapError`
3. If `maxVersion === lastPatchVersion` -> return empty (no changes)
4. Fetch patches: `deltaClient.fetchPatchesSince(lastPatchVersion, maxVersion)`
5. For each patch text: `parser.extractAffectedGraphs(patchText)` -> accumulate into a `Set<string>`
6. Return `{ affectedGraphUris: [...set], deletedGraphUris: [], newPatchVersion: maxVersion }`

`deletedGraphUris` stays empty for delta mode — deletions are detected at scheduler level.

### `src/change-detection/polling-strategy.service.ts`

Implements `ChangeDetectionStrategy`. Injects `FusekiService`, `GraphRegistryService`.

**`detectChanges(lastPatchVersion)`:**

1. Call `fusekiService.listNamedGraphs()` -> current graph URIs
2. Call `fusekiService.queryTripleCounts()` -> `Map<string, number>` of graph -> triple count
3. Call `graphRegistryService.findAll()` -> known graphs
4. Compare: for each current graph, compute a content hash (`String(tripleCount)`). If hash differs from registry -> affected
5. For registry entries not in current graphs -> deleted
6. Return `{ affectedGraphUris, deletedGraphUris, newPatchVersion: lastPatchVersion + 1 }`

### Add `FusekiService.queryTripleCounts()` — modify `src/fuseki/fuseki.service.ts`

```typescript
async queryTripleCounts(): Promise<Map<string, number>> {
  const query = 'SELECT ?g (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g';
  // ... fetch + parse SPARQL results into Map
}
```

### `src/change-detection/change-detection.provider.ts`

Factory provider that selects strategy based on `CHANGE_DETECTION_MODE`:

```typescript
export const changeDetectionProvider: Provider = {
  provide: CHANGE_DETECTION_STRATEGY,
  useFactory: (configService, deltaStrategy, pollingStrategy) => {
    const syncConfig = configService.getOrThrow<SyncConfig>(SYNC_CONFIG_KEY);
    return syncConfig.CHANGE_DETECTION_MODE === 'delta'
      ? deltaStrategy
      : pollingStrategy;
  },
  inject: [ConfigService, RdfDeltaStrategyService, PollingStrategyService],
};
```

### `src/change-detection/change-detection.module.ts`

```
imports: [ConfigModule, RdfDeltaModule, GraphSyncModule, FusekiModule]
providers: [RdfDeltaStrategyService, PollingStrategyService, changeDetectionProvider]
exports: [CHANGE_DETECTION_STRATEGY]
```

### Tests

- `rdf-delta-strategy.service.spec.ts` — Mock delta client + parser. Test: no changes, new patches detected, PatchGapError thrown
- `polling-strategy.service.spec.ts` — Mock FusekiService + GraphRegistryService. Test: new graph, changed graph, deleted graph, no changes
- `src/fuseki/fuseki.service.spec.ts` — Add test for `queryTripleCounts()` (mock `fetch`)

### Steps:

1. Create `src/change-detection/` directory
2. Write interface, strategies, provider, module, error class
3. Add `queryTripleCounts()` to `FusekiService`
4. Write all tests
5. `npx tsc --noEmit`
6. Run tests: `npx jest --testPathPattern="change-detection|fuseki"`
7. `pnpm run lint && pnpm run format`
8. Stage and commit

---

## Commit 7 — `feat(graph-sync): add graph sync service`

### `src/graph-sync/graph-sync.service.ts`

Per-graph sync logic. Injects: `FusekiService`, `JsonldProcessingService`, `ElasticsearchIndexService`, `GraphRegistryService`, `ConfigService` (for `ELASTICSEARCH_ALIAS`).

**`syncGraph(graphUri: string, indexName: string): Promise<void>`**

1. Fetch graph from Fuseki: `fusekiService.fetchGraph(graphUri)`
2. Flatten JSON-LD: `jsonldService.flatten(document)`
3. Compute content hash: `createHash('sha256').update(JSON.stringify(flattenedDocs)).digest('hex')`
4. Look up existing registry: `graphRegistryService.findByGraphUri(graphUri)`
5. If registry exists and hash matches -> skip (no change)
6. Compute new document IDs: `flattenedDocs.map(d => d['@id'] as string)`
7. If registry exists: diff old vs new document IDs. Delete removed docs from ES: `esIndexService.bulkDelete(indexName, removedIds)`
8. Bulk index new/updated docs: `esIndexService.bulkIndex(indexName, flattenedDocs)`
9. Upsert registry: `graphRegistryService.upsert(graphUri, contentHash, newDocIds)`

**`deleteGraph(graphUri: string, indexName: string): Promise<void>`**

1. Look up registry: `graphRegistryService.findByGraphUri(graphUri)`
2. If no registry -> return (nothing to delete)
3. Delete docs from ES: `esIndexService.bulkDelete(indexName, registry.documentIds)`
4. Delete registry entry: `graphRegistryService.delete(graphUri)`

Import `createHash` from `node:crypto`.

### Update `src/graph-sync/graph-sync.module.ts`

Add `GraphSyncService` to providers and exports. Add imports: `FusekiModule`, `JsonldModule`, `ElasticsearchIndexModule`, `ConfigModule`.

### Tests

- `graph-sync.service.spec.ts` — Mock all dependencies. Test: new graph (no registry), changed graph (different hash, docs removed), unchanged graph (same hash -> skip), deleteGraph existing, deleteGraph non-existent (no-op)

### Steps:

1. Write `graph-sync.service.ts`
2. Update `graph-sync.module.ts` with new imports/providers
3. Write `graph-sync.service.spec.ts`
4. `npx tsc --noEmit`
5. `npx jest --testPathPattern=graph-sync`
6. `pnpm run lint && pnpm run format`
7. Stage and commit

---

## Commit 8 — `feat(sync-queue): add Bull queue for graph sync jobs`

### Create `src/sync-queue/` directory

### `src/sync-queue/sync-queue.constants.ts`

```typescript
export const GRAPH_SYNC_QUEUE = 'graph-sync';
export const SYNC_GRAPH_JOB = 'sync-graph';
export const DELETE_GRAPH_JOB = 'delete-graph';
```

### `src/sync-queue/sync-queue.producer.service.ts`

Injects `@InjectQueue(GRAPH_SYNC_QUEUE) private readonly queue: Queue`.

**`enqueueSyncGraph(graphUri: string, indexName: string): Promise<void>`**

- `this.queue.add(SYNC_GRAPH_JOB, { graphUri, indexName }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })`

**`enqueueDeleteGraph(graphUri: string, indexName: string): Promise<void>`**

- `this.queue.add(DELETE_GRAPH_JOB, { graphUri, indexName }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })`

### `src/sync-queue/sync-queue.consumer.ts`

```typescript
@Processor(GRAPH_SYNC_QUEUE)
export class SyncQueueConsumer {
  constructor(private readonly graphSyncService: GraphSyncService) {}

  @Process(SYNC_GRAPH_JOB)
  async handleSyncGraph(job: Job<{ graphUri: string; indexName: string }>): Promise<void> { ... }

  @Process(DELETE_GRAPH_JOB)
  async handleDeleteGraph(job: Job<{ graphUri: string; indexName: string }>): Promise<void> { ... }
}
```

### `src/sync-queue/sync-queue.module.ts`

```
imports: [BullModule.registerQueue({ name: GRAPH_SYNC_QUEUE }), GraphSyncModule]
providers: [SyncQueueProducerService, SyncQueueConsumer]
exports: [SyncQueueProducerService]
```

### Tests

- `sync-queue.producer.service.spec.ts` — Mock `Queue` via `getQueueToken(GRAPH_SYNC_QUEUE)`. Verify `queue.add` called with correct job name + options.
- `sync-queue.consumer.spec.ts` — Mock `GraphSyncService`. Create fake `Job` objects. Verify correct service method called.

### Steps:

1. Create `src/sync-queue/` directory
2. Write constants, producer, consumer, module
3. Write tests
4. `npx tsc --noEmit`
5. `npx jest --testPathPattern=sync-queue`
6. `pnpm run lint && pnpm run format`
7. Stage and commit

---

## Commit 9 — `feat(sync-scheduler): add cron-based incremental sync orchestration`

### Create `src/sync-scheduler/` directory

### `src/sync-scheduler/sync-scheduler.service.ts`

Injects: `SchedulerRegistry`, `ConfigService` (for `SYNC_CONFIG_KEY` + `ELASTICSEARCH_CONFIG_KEY`), `@Inject(CHANGE_DETECTION_STRATEGY) changeDetection`, `SyncStateService`, `SyncQueueProducerService`, `FusekiService`, `GraphRegistryService`.

Has `private isRunning = false` guard flag.

**`onModuleInit()`** — If `SYNC_ENABLED`:

- Create a `CronJob` with `SYNC_CRON` expression
- Register via `this.schedulerRegistry.addCronJob('incremental-sync', job)`
- Start the job

**`handleIncrementalSync(): Promise<void>`**

1. Guard: if `isRunning` -> log skip, return
2. Set `isRunning = true`, wrap in try/finally to reset
3. Get sync state: `syncStateService.get()` -> `lastPatchVersion`
4. Get active index name from sync state (or fall back to `ELASTICSEARCH_ALIAS`)
5. Try: call `changeDetection.detectChanges(lastPatchVersion)` -> `{ affectedGraphUris, deletedGraphUris, newPatchVersion }`
6. Catch `PatchGapError` -> log warning, trigger full reindex (wired in commit 11), return
7. Detect disappeared graphs: `fusekiService.listNamedGraphs()` vs `graphRegistryService.findAll()`
8. Enqueue sync jobs for affected graphs
9. Enqueue delete jobs for deleted/disappeared graphs
10. Update state: `syncStateService.updateLastPatchVersion(newPatchVersion)`

### `src/sync-scheduler/sync-scheduler.module.ts`

```
imports: [ConfigModule, ChangeDetectionModule, GraphSyncModule, SyncQueueModule, FusekiModule]
providers: [SyncSchedulerService]
exports: [SyncSchedulerService]
```

### Tests

- Cron registration when `SYNC_ENABLED=true`
- No cron when `SYNC_ENABLED=false`
- Normal incremental sync flow
- Skip when already running
- PatchGapError handling (logs, doesn't crash)
- Graph deletion detection

### Steps:

1. Create `src/sync-scheduler/` directory
2. Write service and module
3. Write tests
4. `npx tsc --noEmit`
5. `npx jest --testPathPattern=sync-scheduler`
6. `pnpm run lint && pnpm run format`
7. Stage and commit

---

## Commit 10 — `feat(reindex): add full reindex with blue-green index swap`

### Create `src/reindex/` directory

### `src/reindex/reindex.service.ts`

Injects: `FusekiService`, `JsonldProcessingService`, `ElasticsearchIndexService`, `GraphRegistryService`, `SyncStateService`, `RdfDeltaClientService` (optional, for getting current patch version in delta mode), `ConfigService` (for `ELASTICSEARCH_ALIAS`, `CHANGE_DETECTION_MODE`).

**`reindexAll(): Promise<void>`**

1. Generate new index name: `${alias}-${Date.now()}`
2. Create new index: `esIndexService.ensureIndex(newIndexName)`
3. List all graphs: `fusekiService.listNamedGraphs()`
4. Clear graph registry: `graphRegistryService.deleteAll()`
5. For each graph: fetch -> flatten -> compute hash -> bulk index into new index -> register in GraphRegistry
6. Swap alias: `esIndexService.swapAlias(alias, newIndexName)`
7. Get current patch version (delta mode: `deltaClient.describeLog().maxVersion`, polling: `0`)
8. Update sync state: `syncStateService.updateActiveIndex(newIndexName, patchVersion)`
9. Delete old index (try/catch, may not exist)

### Modify `src/export/export.controller.ts`

Change to inject `ReindexService` instead of `ExportService`:

```typescript
constructor(private readonly reindexService: ReindexService) {}

@Get()
async triggerExport(): Promise<{ message: string }> {
  await this.reindexService.reindexAll();
  return { message: 'Reindex completed successfully' };
}
```

### Modify `src/export/export.module.ts`

Add `ReindexModule` to imports. Controller now uses `ReindexService`.

### Modify `src/export/export.controller.spec.ts`

Update to mock `ReindexService` instead of `ExportService`.

### `src/reindex/reindex.module.ts`

```
imports: [ConfigModule, FusekiModule, JsonldModule, ElasticsearchIndexModule, GraphSyncModule, RdfDeltaModule]
providers: [ReindexService]
exports: [ReindexService]
```

### Tests

- Full reindex flow: creates index, processes graphs, swaps alias, updates state, deletes old
- Empty graph list: still creates index, swaps alias
- Error during graph processing: propagates

### Steps:

1. Create `src/reindex/` directory
2. Write `reindex.service.ts`, `reindex.module.ts`, `reindex.service.spec.ts`
3. Modify `export.controller.ts`, `export.module.ts`, `export.controller.spec.ts`
4. `npx tsc --noEmit`
5. `npx jest --testPathPattern="reindex|export"`
6. `pnpm run lint && pnpm run format`
7. Stage and commit

---

## Commit 11 — `feat(app): wire all sync modules into root module`

### Modify `src/app.module.ts`

Update `ConfigModule.forRoot` to load all configs:

```typescript
load: [coreConfig, fusekiConfig, elasticsearchConfig, authConfig, databaseConfig, syncConfig, redisConfig],
```

Add to `imports` array:

```typescript
ScheduleModule.forRoot(),
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const redisConf = configService.getOrThrow<RedisConfig>(REDIS_CONFIG_KEY);
    return { redis: { host: redisConf.REDIS_HOST, port: redisConf.REDIS_PORT } };
  },
}),
PrismaModule,
GraphSyncModule,
RdfDeltaModule,
ChangeDetectionModule,
SyncQueueModule,
SyncSchedulerModule,
ReindexModule,
```

### Wire PatchGapError -> ReindexService in SyncSchedulerService

Update `SyncSchedulerService` to inject `ReindexService` and call `reindexAll()` when catching `PatchGapError`. Resolve circular dependency with `@Inject(forwardRef(() => ReindexService))` or by having the scheduler module import `ReindexModule`.

### Steps:

1. Update `src/app.module.ts`
2. Wire ReindexService into SyncSchedulerService
3. `npx tsc --noEmit`
4. `pnpm run test` (full suite)
5. `pnpm run lint && pnpm run format`
6. Stage and commit

---

## Post-implementation checklist

1. All 11 commits are on `main`
2. `npx tsc --noEmit` passes
3. `pnpm run test` — full suite green
4. `pnpm run lint && pnpm run format` — clean
5. No `CLAUDE.md` staged in any commit
6. No co-author lines in commits
7. No `git push` unless explicitly asked
