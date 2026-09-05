use super::*;

#[test]
fn mute_survives_sink_replacement_and_stop() {
    let mut player = PlayerInner::default();
    player.set_volume(0.0).unwrap();
    for _ in 0..2 {
        let (sink, _output) = Sink::new();
        player.sink = Some(player.prepare_sink(sink));
        assert_eq!(player.sink.as_ref().unwrap().volume(), 0.0);
        assert!(player.sink.as_ref().unwrap().is_paused());
        player.clear();
        assert_eq!(status(&player).volume, 0.0);
    }
}

#[test]
fn volume_applies_to_current_and_future_sinks() {
    let mut player = PlayerInner::default();
    let (sink, _output) = Sink::new();
    player.sink = Some(player.prepare_sink(sink));
    assert_eq!(player.sink.as_ref().unwrap().volume(), 0.72);
    player.set_volume(0.25).unwrap();
    assert_eq!(player.sink.as_ref().unwrap().volume(), 0.25);
    let (next, _next_output) = Sink::new();
    assert_eq!(player.prepare_sink(next).volume(), 0.25);
    assert!(player.set_volume(f32::NAN).is_err());
    assert_eq!(player.volume, 0.25);
}

#[test]
fn status_identifies_the_loaded_session_and_clear_invalidates_it() {
    let mut player = PlayerInner::default();
    let (sink, _output) = Sink::new();
    player.sink = Some(player.prepare_sink(sink));
    player.path = Some("/music/track.wav".into());
    player.session_id = 7;
    let loaded = status(&player);
    assert_eq!(loaded.path.as_deref(), Some("/music/track.wav"));
    assert_eq!(loaded.session_id, 7);
    assert!(loaded.loaded);
    player.clear();
    let cleared = status(&player);
    assert_eq!(cleared.session_id, 8);
    assert!(cleared.path.is_none());
    assert!(!cleared.loaded);
}
