import { fallbackTrack, type Track } from "../../types/music";
import type { PlaybackTransport } from "./playback-types";

export type PlaybackSnapshot = {
  selected: Track;
  isPlaying: boolean;
  progress: number;
  volume: number;
};

/**
 * Owns the selected native track and serializes transport mutations.
 * Polling is advisory: only responses for the current native session and
 * command revision may update state or advance playback.
 */
export class PlaybackSession {
  private snapshot: PlaybackSnapshot = { selected: fallbackTrack, isPlaying: false, progress: 0, volume: 0.72 };
  private listeners = new Set<() => void>();
  private commands: Promise<void> = Promise.resolve();
  private pendingCommands = 0;
  private revision = 0;
  private selectionRevision = 0;
  private sessionId: number | null = null;
  private finishedSession: number | null = null;
  private polling = false;

  constructor(private transport: PlaybackTransport, private onError: (message: string | null) => void) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(values: Partial<PlaybackSnapshot>) {
    if (Object.entries(values).every(([key, value]) => Object.is(this.snapshot[key as keyof PlaybackSnapshot], value))) return;
    this.snapshot = { ...this.snapshot, ...values };
    this.listeners.forEach((listener) => listener());
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    ++this.revision;
    ++this.pendingCommands;
    const operation = this.commands.then(async () => {
      this.onError(null);
      try {
        await action();
      } catch (error) {
        this.onError(String(error));
      } finally {
        --this.pendingCommands;
      }
    });
    this.commands = operation;
    return operation;
  }

  private async load(track: Track) {
    if (!track.path) throw new Error("Import a local audio file to start playback.");
    const loaded = await this.transport.loadAudio(track.path);
    this.sessionId = loaded.sessionId;
    this.finishedSession = null;
    // Commit selection only after the native load succeeds. Failed loads leave
    // both the previous native track and its displayed identity intact.
    this.update({ selected: track, isPlaying: false, progress: 0 });
  }

  select(track: Track, autoplay = false): Promise<void> {
    const selection = ++this.selectionRevision;
    return this.enqueue(async () => {
      if (selection !== this.selectionRevision) return;
      await this.load(track);
      if (autoplay && selection === this.selectionRevision) {
        await this.transport.playAudio();
        this.update({ isPlaying: true });
      }
    });
  }

  /** Late startup queries must not replace a selection already made by the user. */
  restore(track: Track): Promise<void> {
    return this.selectionRevision === 0 ? this.select(track) : Promise.resolve();
  }

  clear(): Promise<void> {
    ++this.selectionRevision;
    return this.enqueue(async () => {
      await this.transport.stopAudio();
      this.sessionId = null;
      this.finishedSession = null;
      this.update({ selected: fallbackTrack, isPlaying: false, progress: 0 });
    });
  }

  toggle(): Promise<void> {
    return this.enqueue(async () => {
      const { selected, isPlaying } = this.snapshot;
      if (!selected.path) throw new Error("Import a local audio file to start playback.");
      if (isPlaying) {
        await this.transport.pauseAudio();
        this.update({ isPlaying: false });
      } else {
        if (this.finishedSession === this.sessionId) await this.load(selected);
        await this.transport.playAudio();
        this.update({ isPlaying: true });
      }
    });
  }

  seek(percentage: number): Promise<void> {
    return this.enqueue(async () => {
      if (!this.snapshot.selected.path || !Number.isFinite(percentage)) return;
      const progress = Math.max(0, Math.min(100, percentage));
      await this.transport.seekAudio(progress / 100 * (this.snapshot.selected.durationSeconds ?? 0));
      this.finishedSession = null;
      this.update({ progress });
    });
  }

  setVolume(volume: number): Promise<void> {
    return this.enqueue(async () => {
      if (!Number.isFinite(volume)) return;
      const value = Math.max(0, Math.min(1, volume));
      await this.transport.changeVolume(value);
      this.update({ volume: value });
    });
  }

  /** A stopped subscription must not consume a completion intended for its replacement. */
  async poll(onFinished: () => Promise<void>, isActive: () => boolean = () => true): Promise<void> {
    if (this.polling || this.pendingCommands || this.sessionId === null) return;
    const revision = this.revision;
    this.polling = true;
    try {
      const status = await this.transport.getPlayerStatus();
      if (!isActive() || revision !== this.revision || this.pendingCommands) return;
      if (status.sessionId !== this.sessionId || status.path !== this.snapshot.selected.path) return;
      this.update({
        isPlaying: status.playing,
        progress: status.durationSeconds > 0 ? Math.min(100, status.positionSeconds / status.durationSeconds * 100) : 0,
        volume: status.volume,
      });
      if (!status.finished) this.finishedSession = null;
      else if (this.finishedSession !== status.sessionId) {
        this.finishedSession = status.sessionId;
        await onFinished();
      }
    } catch (error) {
      if (isActive() && revision === this.revision) this.onError(String(error));
    } finally {
      this.polling = false;
    }
  }
}
