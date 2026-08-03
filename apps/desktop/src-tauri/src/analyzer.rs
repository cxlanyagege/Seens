use serde::{Deserialize, Serialize};
use std::{path::PathBuf, process::Command};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentSummary {
    pub instrument: String,
    pub confidence: f64,
    pub active_seconds: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentSegment {
    pub instrument: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub confidence: f64,
    pub peak_confidence: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentAnalysis {
    pub model_id: String,
    pub model_version: String,
    pub duration_seconds: f64,
    pub prediction_interval_seconds: f64,
    pub instruments: Vec<InstrumentSummary>,
    pub segments: Vec<InstrumentSegment>,
}

#[derive(Deserialize)]
struct AnalyzerEnvelope {
    ok: bool,
    result: Option<InstrumentAnalysis>,
    error: Option<String>,
}

pub fn analyze(audio_path: String) -> Result<InstrumentAnalysis, String> {
    let service_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../services/analyzer");
    let python = std::env::var_os("SEENS_ANALYZER_PYTHON")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            if cfg!(windows) {
                service_dir.join(".venv/Scripts/python.exe")
            } else {
                service_dir.join(".venv/bin/python")
            }
        });
    let model_dir = std::env::var_os("SEENS_MODEL_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| service_dir.join("models/instrument-v1"));
    if !python.is_file() {
        return Err(
            "The local analyzer is not installed. Run uv sync in services/analyzer.".into(),
        );
    }

    let output = Command::new(python)
        .arg("-m")
        .arg("seenstruments_analyzer.cli")
        .arg("analyze")
        .arg("--audio")
        .arg(audio_path)
        .arg("--model-dir")
        .arg(model_dir)
        .env("PYTHONPATH", service_dir.join("src"))
        .output()
        .map_err(|error| format!("Could not start the local analyzer: {error}"))?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|_| "The local analyzer returned invalid text".to_string())?;
    let envelope: AnalyzerEnvelope = serde_json::from_str(stdout.trim())
        .map_err(|error| format!("Could not read the analyzer result: {error}"))?;
    if !output.status.success() || !envelope.ok {
        return Err(envelope
            .error
            .unwrap_or_else(|| "Instrument analysis failed".into()));
    }
    envelope
        .result
        .ok_or_else(|| "The analyzer returned no result".into())
}
