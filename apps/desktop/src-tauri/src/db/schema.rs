//! SQLite connection configuration and ordered schema migrations.

use rusqlite::Connection;

#[derive(Clone, Copy)]
struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "initial_schema",
    sql: include_str!("migrations/0001_initial_schema.sql"),
}];

pub(super) fn initialize(connection: &mut Connection) -> Result<(), String> {
    configure_connection(connection)?;
    apply_migrations(connection, MIGRATIONS)
}

fn configure_connection(connection: &Connection) -> Result<(), String> {
    // Foreign keys are a per-connection setting. WAL keeps reads responsive
    // while background work persists analysis results.
    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|error| format!("Could not configure the music library: {error}"))
}

fn apply_migrations(connection: &mut Connection, migrations: &[Migration]) -> Result<(), String> {
    validate_migration_sequence(migrations)?;

    let current_version = schema_version(connection)?;
    let latest_version = migrations.last().map_or(0, |migration| migration.version);
    if current_version > latest_version {
        return Err(format!(
            "The music library schema version {current_version} is newer than the supported version {latest_version}"
        ));
    }

    for migration in migrations
        .iter()
        .filter(|migration| migration.version > current_version)
    {
        let transaction = connection.transaction().map_err(|error| {
            format!(
                "Could not start database migration {} ({}): {error}",
                migration.version, migration.name
            )
        })?;
        transaction.execute_batch(migration.sql).map_err(|error| {
            format!(
                "Could not apply database migration {} ({}): {error}",
                migration.version, migration.name
            )
        })?;
        transaction
            .pragma_update(None, "user_version", migration.version)
            .map_err(|error| {
                format!(
                    "Could not record database migration {} ({}): {error}",
                    migration.version, migration.name
                )
            })?;
        transaction.commit().map_err(|error| {
            format!(
                "Could not finish database migration {} ({}): {error}",
                migration.version, migration.name
            )
        })?;
    }

    Ok(())
}

fn validate_migration_sequence(migrations: &[Migration]) -> Result<(), String> {
    for (index, migration) in migrations.iter().enumerate() {
        let expected_version = index as i64 + 1;
        if migration.version != expected_version {
            return Err(format!(
                "Database migration {} ({}) is out of sequence; expected version {expected_version}",
                migration.version, migration.name
            ));
        }
    }
    Ok(())
}

fn schema_version(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| format!("Could not read the music library schema version: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_exists(connection: &Connection, name: &str) -> bool {
        connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
                [name],
                |row| row.get(0),
            )
            .expect("table lookup should succeed")
    }

    #[test]
    fn initializes_a_new_database_at_the_latest_version() {
        let mut connection = Connection::open_in_memory().expect("database should open");

        initialize(&mut connection).expect("migration should succeed");

        assert_eq!(schema_version(&connection).unwrap(), 1);
        for table in [
            "tracks",
            "playlists",
            "playlist_tracks",
            "instrument_analyses",
        ] {
            assert!(table_exists(&connection, table));
        }
    }

    #[test]
    fn adopts_an_unversioned_database_without_losing_data() {
        let mut connection = Connection::open_in_memory().expect("database should open");
        connection
            .execute_batch(MIGRATIONS[0].sql)
            .expect("legacy schema should be created");
        connection
            .execute(
                "INSERT INTO tracks (path, title, artist, album) VALUES (?1, ?2, ?3, ?4)",
                ["/music/example.flac", "Example", "Artist", "Album"],
            )
            .expect("legacy data should be inserted");

        initialize(&mut connection).expect("legacy database should be adopted");

        assert_eq!(schema_version(&connection).unwrap(), 1);
        let title: String = connection
            .query_row(
                "SELECT title FROM tracks WHERE path = ?1",
                ["/music/example.flac"],
                |row| row.get(0),
            )
            .expect("legacy data should remain available");
        assert_eq!(title, "Example");
    }

    #[test]
    fn rejects_a_database_created_by_a_newer_application() {
        let mut connection = Connection::open_in_memory().expect("database should open");
        connection
            .pragma_update(None, "user_version", 2)
            .expect("schema version should be set");

        let error = initialize(&mut connection).expect_err("newer schema should be rejected");

        assert!(error.contains("newer than the supported version 1"));
    }

    #[test]
    fn rolls_back_a_failed_migration_without_advancing_the_version() {
        let mut connection = Connection::open_in_memory().expect("database should open");
        let migrations = [Migration {
            version: 1,
            name: "broken",
            sql: "CREATE TABLE transient_value (id INTEGER); INVALID SQL;",
        }];

        let error = apply_migrations(&mut connection, &migrations)
            .expect_err("invalid migration should fail");

        assert!(error.contains("Could not apply database migration 1 (broken)"));
        assert_eq!(schema_version(&connection).unwrap(), 0);
        assert!(!table_exists(&connection, "transient_value"));
    }
}
