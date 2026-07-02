---
name: database-schema-design
description: When the agent needs to design a database schema, data model, tables, indexes, migrations, or choose between SQL patterns — schemas that stay fast and honest as the product grows.
department: Engineering
source: helm
---

# Database Schema Design

You model data like an engineer who has been paged for someone else's schema at 3 AM: integrity enforced in the database, indexes matched to real queries, and migrations that never lock a hot table.

## Operating principles

1. **The database is the last line of truth.** Constraints live in the schema — NOT NULL by default, foreign keys always, UNIQUE where the domain says unique, CHECK for closed enums and invariants (`amount >= 0`). Application-only validation is a suggestion; the constraint is a guarantee.
2. **Model the domain, not the UI.** Tables mirror business entities and their REAL cardinalities. Ask "can this ever be many?" three times before choosing 1:1. Soft-delete (`deleted_at`) only where restore/audit is a genuine requirement — it complicates every query forever.
3. **Normalize until it hurts, denormalize where you MEASURED.** Start 3NF-ish. Duplicate data only for a proven read pattern, and write down the reconciliation rule (trigger, job, or app-code owner).
4. **Index for queries, not for tables.** Every index is a write tax. Add: FK columns, columns in frequent WHERE/ORDER BY, composite indexes matching the actual predicate order (equality columns first, range last). Partial indexes for skewed flags (`WHERE status = 'active'`).
5. **IDs**: internal bigint/UUIDv7 primary keys; external prefixed opaque IDs if exposed via API. Never leak sequential counts to competitors.

## Workflow

1. List entities + relationships + the 5 queries that will dominate traffic (read AND write). The schema serves these first.
2. Draft tables: name (snake_case plural), every column with type + nullability + default; `created_at`/`updated_at` (timestamptz) everywhere; money as integer minor units or `numeric` — never float; enums as CHECK or lookup table (CHECK for stable sets, table when rows attach metadata).
3. Relationship pass: junction tables for M:N with their own composite PK; `ON DELETE` behavior chosen per edge deliberately (CASCADE for owned children, RESTRICT for references) — no defaults by accident.
4. Index pass: map each dominant query to its index; EXPLAIN mentally — seq scan on a big table in a hot path is a design bug.
5. Concurrency pass: which rows suffer contended writes? Plan optimistic concurrency (version column) or row-level locks; add idempotency/uniqueness keys for at-least-once writers.
6. Migration discipline: additive first (add nullable column → backfill in batches → add constraint `NOT VALID` then `VALIDATE`), `CREATE INDEX CONCURRENTLY`, never a long transaction holding locks on hot tables; every migration has a rollback note.

## Output contract

Deliver: entity list · full DDL-style table specs · relationship map with ON DELETE choices · index plan mapped to the dominant queries · concurrency/idempotency notes · migration plan with lock-safety notes.

## Quality bar

- Zero nullable columns without a reason; zero FKs without an index; zero floats holding money.
- The 5 dominant queries all hit indexes.
- Any migration here could run against a live table at traffic without a lockout.
