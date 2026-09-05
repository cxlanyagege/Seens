/** Native playback identity changes whenever a track is loaded or cleared. */
export type LoadedTrack = {
  path: string;
  fileName: string;
  durationSeconds: number;
  sessionId: number;
};

export type PlayerStatus = {
  path: string | null;
  sessionId: number;
  loaded: boolean;
  playing: boolean;
  finished: boolean;
  positionSeconds: number;
  durationSeconds: number;
  volume: number;
};

/** Transport boundary implemented by the desktop IPC client. */
export interface PlaybackTransport {
  loadAudio(path: string): Promise<LoadedTrack>;
  playAudio(): Promise<void>;
  pauseAudio(): Promise<void>;
  stopAudio(): Promise<void>;
  seekAudio(seconds: number): Promise<void>;
  changeVolume(volume: number): Promise<void>;
  getPlayerStatus(): Promise<PlayerStatus>;
}
