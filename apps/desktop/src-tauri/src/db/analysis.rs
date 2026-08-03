use super::LibraryDb;
use crate::analyzer::InstrumentAnalysis;

pub(super) fn get(
    library: &LibraryDb,
    track_id: i64,
) -> Result<Option<InstrumentAnalysis>, String> {
    let connection = library.connection()?;
    let mut statement = connection
        .prepare("SELECT result_json FROM instrument_analyses WHERE track_id = ?1")
        .map_err(|error| format!("Could not read instrument analysis: {error}"))?;
    let mut rows = statement
        .query([track_id])
        .map_err(|error| format!("Could not read instrument analysis: {error}"))?;
    let Some(row) = rows
        .next()
        .map_err(|error| format!("Could not read instrument analysis: {error}"))?
    else {
        return Ok(None);
    };
    let json: String = row
        .get(0)
        .map_err(|error| format!("Could not read instrument analysis: {error}"))?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|error| format!("The cached instrument analysis is invalid: {error}"))
}

pub(super) fn save(
    library: &LibraryDb,
    track_id: i64,
    result: &InstrumentAnalysis,
) -> Result<(), String> {
    let json = serde_json::to_string(result)
        .map_err(|error| format!("Could not serialize instrument analysis: {error}"))?;
    let mut connection = library.connection()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not save instrument analysis: {error}"))?;
    transaction.execute(
        "INSERT INTO instrument_analyses (track_id, model_id, model_version, result_json, analyzed_at)
         VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
         ON CONFLICT(track_id) DO UPDATE SET model_id = excluded.model_id, model_version = excluded.model_version,
         result_json = excluded.result_json, analyzed_at = CURRENT_TIMESTAMP",
        rusqlite::params![track_id, result.model_id, result.model_version, json],
    ).map_err(|error| format!("Could not save instrument analysis: {error}"))?;
    transaction
        .execute(
            "UPDATE tracks SET analyzed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [track_id],
        )
        .map_err(|error| format!("Could not update the track analysis state: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not finish saving instrument analysis: {error}"))
}

pub(super) fn track_path(library: &LibraryDb, track_id: i64) -> Result<String, String> {
    library
        .connection()?
        .query_row("SELECT path FROM tracks WHERE id = ?1", [track_id], |row| {
            row.get(0)
        })
        .map_err(|error| format!("Could not find the library track: {error}"))
}
