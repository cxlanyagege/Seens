//! Native audio playback service.
//!
//! Rodio's output stream is owned by one dedicated thread. Tauri commands send
//! messages to that thread instead of sharing the platform audio handle across
//! command-handler threads (which is not safe on every supported platform).

pub(crate) mod info;
pub(crate) mod waveform;

#[cfg(test)]
mod tests;

use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink, Source};
use serde::Serialize;
use std::{
    fs::File,
    path::Path,
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::Duration,
};
use tauri::State;

type CommandResult = Result<(), String>;

pub struct AudioPlayer {
    // Senders are safe to keep in Tauri's global managed state.
    commands: Sender<AudioCommand>,
}

// Every command carries a one-shot reply channel so IPC callers receive the
// actual result of the operation performed by the audio thread.
enum AudioCommand {
    Load {
        path: String,
        reply: Sender<Result<LoadedTrack, String>>,
    },
    Play(Sender<CommandResult>),
    Pause(Sender<CommandResult>),
    Stop(Sender<CommandResult>),
    Seek {
        seconds: f64,
        reply: Sender<CommandResult>,
    },
    Volume {
        volume: f32,
        reply: Sender<CommandResult>,
    },
    Status(Sender<Result<PlayerStatus, String>>),
}

struct PlayerInner {
    // The output stream must live at least as long as the sink; dropping it
    // immediately would stop playback even though the sink still exists.
    stream: Option<OutputStream>,
    sink: Option<Sink>,
    duration_seconds: f64,
    path: Option<String>,
    session_id: u64,
    volume: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedTrack {
    path: String,
    file_name: String,
    duration_seconds: f64,
    session_id: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerStatus {
    path: Option<String>,
    session_id: u64,
    volume: f32,
    loaded: bool,
    playing: bool,
    finished: bool,
    position_seconds: f64,
    duration_seconds: f64,
}

impl Default for PlayerInner {
    fn default() -> Self {
        Self {
            stream: None,
            sink: None,
            duration_seconds: 0.0,
            path: None,
            session_id: 0,
            volume: 0.72,
        }
    }
}

impl PlayerInner {
    fn set_volume(&mut self, volume: f32) -> CommandResult {
        if !volume.is_finite() {
            return Err("Volume must be finite".into());
        }
        self.volume = volume.clamp(0.0, 1.0);
        if let Some(sink) = &self.sink {
            sink.set_volume(self.volume);
        }
        Ok(())
    }

    // Configure an empty sink before appending any source, so loading cannot
    // briefly emit sound or reset a muted player to the sink's default volume.
    fn prepare_sink(&self, sink: Sink) -> Sink {
        sink.pause();
        sink.set_volume(self.volume);
        sink
    }

    fn clear(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
        self.stream = None;
        self.path = None;
        self.duration_seconds = 0.0;
        self.session_id += 1;
    }
}

impl Default for AudioPlayer {
    fn default() -> Self {
        let (commands, receiver) = mpsc::channel();
        thread::Builder::new()
            .name("seenstruments-audio".into())
            .spawn(move || audio_worker(receiver))
            .expect("failed to start the audio thread");
        Self { commands }
    }
}

impl AudioPlayer {
    /// Send one command to the worker and wait for its typed response.
    fn request<T>(
        &self,
        command: impl FnOnce(Sender<Result<T, String>>) -> AudioCommand,
    ) -> Result<T, String> {
        let (reply, response) = mpsc::channel();
        self.commands
            .send(command(reply))
            .map_err(|_| "The audio thread is unavailable".to_string())?;
        response
            .recv()
            .map_err(|_| "The audio thread stopped unexpectedly".to_string())?
    }
}

fn audio_worker(receiver: Receiver<AudioCommand>) {
    // All mutable playback state stays on this thread, so it needs no mutex.
    let mut player = PlayerInner::default();
    while let Ok(command) = receiver.recv() {
        match command {
            AudioCommand::Load { path, reply } => {
                let _ = reply.send(load(&mut player, path));
            }
            AudioCommand::Play(reply) => {
                let _ = reply.send(with_sink(&player, |sink| {
                    if sink.empty() {
                        return Err("The track has finished; select it again to replay".into());
                    }
                    sink.play();
                    Ok(())
                }));
            }
            AudioCommand::Pause(reply) => {
                let _ = reply.send(with_sink(&player, |sink| {
                    sink.pause();
                    Ok(())
                }));
            }
            AudioCommand::Stop(reply) => {
                player.clear();
                let _ = reply.send(Ok(()));
            }
            AudioCommand::Seek { seconds, reply } => {
                let _ = reply.send(with_sink(&player, |sink| {
                    if !seconds.is_finite() {
                        return Err("Seek position must be finite".into());
                    }
                    let target = seconds.clamp(0.0, player.duration_seconds);
                    sink.try_seek(Duration::from_secs_f64(target))
                        .map_err(|error| format!("Could not seek in this track: {error}"))
                }));
            }
            AudioCommand::Volume { volume, reply } => {
                let _ = reply.send(player.set_volume(volume));
            }
            AudioCommand::Status(reply) => {
                let _ = reply.send(Ok(status(&player)));
            }
        }
    }
}

fn with_sink<T>(
    player: &PlayerInner,
    action: impl FnOnce(&Sink) -> Result<T, String>,
) -> Result<T, String> {
    action(player.sink.as_ref().ok_or("No audio file is loaded")?)
}

fn load(player: &mut PlayerInner, path: String) -> Result<LoadedTrack, String> {
    let source_path = Path::new(&path);
    if !source_path.is_file() {
        return Err("The selected audio file does not exist".into());
    }

    let file = File::open(source_path).map_err(|error| format!("Could not open audio: {error}"))?;
    let source = Decoder::try_from(file)
        .map_err(|error| format!("Unsupported or invalid audio file: {error}"))?;
    let duration_seconds = source.total_duration().unwrap_or_default().as_secs_f64();
    let stream = OutputStreamBuilder::open_default_stream()
        .map_err(|error| format!("Could not open the system audio output: {error}"))?;
    let sink = player.prepare_sink(Sink::connect_new(stream.mixer()));
    sink.append(source);

    if let Some(previous) = player.sink.take() {
        previous.stop();
    }
    player.stream = Some(stream);
    player.sink = Some(sink);
    player.duration_seconds = duration_seconds;
    player.path = Some(path.clone());
    player.session_id += 1;

    let file_name = source_path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Unknown track")
        .to_string();
    Ok(LoadedTrack {
        path,
        file_name,
        duration_seconds,
        session_id: player.session_id,
    })
}

fn status(player: &PlayerInner) -> PlayerStatus {
    // The frontend polls this lightweight snapshot to update its seek bar.
    match player.sink.as_ref() {
        Some(sink) => PlayerStatus {
            path: player.path.clone(),
            session_id: player.session_id,
            volume: player.volume,
            loaded: true,
            playing: !sink.is_paused() && !sink.empty(),
            finished: sink.empty(),
            position_seconds: sink.get_pos().as_secs_f64(),
            duration_seconds: player.duration_seconds,
        },
        None => PlayerStatus {
            path: None,
            session_id: player.session_id,
            volume: player.volume,
            loaded: false,
            playing: false,
            finished: false,
            position_seconds: 0.0,
            duration_seconds: 0.0,
        },
    }
}

#[tauri::command(async)]
pub fn load_audio(path: String, player: State<'_, AudioPlayer>) -> Result<LoadedTrack, String> {
    // Tauri commands remain thin adapters; playback logic belongs to the worker.
    player.request(|reply| AudioCommand::Load { path, reply })
}

#[tauri::command(async)]
pub fn play_audio(player: State<'_, AudioPlayer>) -> CommandResult {
    player.request(AudioCommand::Play)
}

#[tauri::command(async)]
pub fn pause_audio(player: State<'_, AudioPlayer>) -> CommandResult {
    player.request(AudioCommand::Pause)
}

#[tauri::command(async)]
pub fn stop_audio(player: State<'_, AudioPlayer>) -> CommandResult {
    player.request(AudioCommand::Stop)
}

#[tauri::command(async)]
pub fn seek_audio(seconds: f64, player: State<'_, AudioPlayer>) -> CommandResult {
    player.request(|reply| AudioCommand::Seek { seconds, reply })
}

#[tauri::command(async)]
pub fn set_volume(volume: f32, player: State<'_, AudioPlayer>) -> CommandResult {
    player.request(|reply| AudioCommand::Volume { volume, reply })
}

#[tauri::command(async)]
pub fn player_status(player: State<'_, AudioPlayer>) -> Result<PlayerStatus, String> {
    player.request(AudioCommand::Status)
}
