# Firestore Migration Plan

The application already reads and writes products at the top-level `products/{productId}` collection. This script is a controlled backfill tool for legacy documents under `categories/{categoryId}/products/{productId}`; it is not an application cutover mechanism.

## Scope

- Backfill legacy nested product documents into top-level `products/{productId}`
- Normalize legacy `orders.deliveryAddress` into `orders.shippingAddress` when requested
- Keep every legacy source document intact for rollback
- Do not move Firebase Storage objects or deploy Rules

## Commands

```bash
npm run migrate:firestore:analyze
npm run migrate:firestore:products:dry-run
npm run migrate:firestore:products:execute
npm run migrate:firestore:validate
```

These npm commands are the only supported entrypoints. The CLI loads Firebase Admin lazily; importing the migration module does not initialize dotenv, credentials, Firebase Admin, or Firestore.

## Safety rules

1. Create a managed Firestore export before any write operation.
2. Run `analyze` first and stop if duplicate product IDs exist across legacy category subcollections.
3. Review the dry-run output before using `--execute`.
4. The destination is already the live application collection. The script therefore stops when it detects destination documents unless `--allow-existing-destination` is explicit. Use that flag only after checking every collision and overwrite risk.
5. Keep the legacy source stable during execution, then run validation immediately. If the source changes, repeat analysis and validation.
6. Do not delete legacy documents until validation has passed and the rollback window has elapsed.
7. This repository task documents the migration only; it does not authorize a production export, database read, `--execute`, or deployment.

For an approved backfill into an intentionally populated destination, pass the flag explicitly:

```bash
npm run migrate:firestore:products:dry-run -- --allow-existing-destination
npm run migrate:firestore:products:execute -- --allow-existing-destination
```

## What the migration script does

- scans `categories/{categoryId}/products/{productId}`
- detects product IDs that are not globally unique
- probes the live destination before writing
- copies source product fields into `products/{productId}`
- adds `categoryId`, `legacyPath`, `schemaVersion`, and migration metadata
- updates each source category's `productCount`
- optionally normalizes order address fields
- records real execution metadata in `migrationRuns/{runId}`
- uses `BulkWriter` only after all preconditions pass and `--execute` is explicit

## What the migration script does not do

- it does not delete or move source documents
- it does not move Firebase Storage files
- it does not switch application read paths
- it does not deploy Firestore or Storage Rules
- it does not run or access Firestore when merely imported

## Current repository status and backfill checklist

- `src/shared/services/productService.ts` and the order Function already use top-level `products`.
- Order code uses the current `shippingAddress` contract; address normalization remains only for legacy documents.
- Strict Firestore/Storage Rules and server-only order writes are implemented independently of this data backfill.
- Remaining operational work, if a real backfill is approved: export → analyze duplicates and destination collisions → reviewed dry-run → explicit execute → validate counts/fields/orphans → retain legacy data through the rollback window.

Migration helpers require an explicitly injected runtime. `analyzeStructure(options, runtime)`, `migrateProducts(options, runtime)`, and `validateMigration(options, runtime)` never fall back to a global Admin instance; only the `require.main === module` CLI path calls `loadFirestoreMigrationRuntime()`.
