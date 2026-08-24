# Database Migrations

The desktop database uses SQLite `PRAGMA user_version` as its schema version.
Application startup applies every pending migration from
`apps/desktop/src-tauri/src/db/migrations` in order and records each version in
the same transaction as its schema changes.

## Adding a migration

1. Add the next zero-padded SQL file to
   `apps/desktop/src-tauri/src/db/migrations`.
2. Register it in the ordered `MIGRATIONS` list in
   `apps/desktop/src-tauri/src/db/schema.rs`.
3. Add an upgrade test that starts from the previous schema version and verifies
   both the new structure and preservation of existing data.

Migration files are append-only after release. Never edit a migration that may
already have been applied to a user database.

The [desktop application documentation](../components/desktop-application.md)
describes the persistence boundary. The
[architecture overview](../architecture/overview.md) explains why Rust owns the
database and analysis cache.
