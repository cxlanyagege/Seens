from seenstruments_analyzer.domain import InstrumentAnalysis, InstrumentSegment, InstrumentSummary


def test_analysis_protocol_uses_camel_case_fields() -> None:
    result = InstrumentAnalysis(
        model_id="model",
        model_version="1",
        duration_seconds=3.0,
        prediction_interval_seconds=1.0,
        instruments=[InstrumentSummary("Piano", 0.7, 2.0)],
        segments=[InstrumentSegment("Piano", 0.0, 2.0, 0.7, 0.8)],
    ).to_dict()

    assert result["modelId"] == "model"
    assert result["instruments"][0]["activeSeconds"] == 2.0
    assert result["segments"][0]["startSeconds"] == 0.0
