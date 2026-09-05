const { test } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { PlaybackSession } = require(join(process.env.SEENS_TEST_BUILD_DIR, "features/player/playback-session.js"));

function deferred() {
  let resolve;
  const promise = new Promise((accept) => { resolve = accept; });
  return { promise, resolve };
}

function track(id) {
  return { id, path: `/music/${id}.wav`, title: `Track ${id}`, artist: "Artist", album: "Album", duration: "1:40", durationSeconds: 100, year: "", color: "#000", analyzed: false };
}

function setup() {
  const errors = [], calls = [];
  let status = { path: null, sessionId: 0, loaded: false, playing: false, finished: false, positionSeconds: 0, durationSeconds: 100, volume: 0.72 };
  const transport = {
    async loadAudio(path) {
      calls.push(["load", path]);
      status = { ...status, path, sessionId: status.sessionId + 1, loaded: true, playing: false, finished: false, positionSeconds: 0 };
      return { path, sessionId: status.sessionId, fileName: path, durationSeconds: 100 };
    },
    async playAudio() {
      assert.ok(status.loaded, "play requires a successful load");
      calls.push(["play", status.path]);
      status.playing = true;
    },
    async pauseAudio() { calls.push(["pause", status.path]); status.playing = false; },
    async stopAudio() { calls.push(["stop"]); status = { ...status, path: null, sessionId: status.sessionId + 1, loaded: false, playing: false }; },
    async seekAudio(seconds) { status.positionSeconds = seconds; },
    async changeVolume(volume) { status.volume = volume; },
    async getPlayerStatus() { return { ...status }; },
  };
  const session = new PlaybackSession(transport, (error) => { if (error) errors.push(error); });
  return { session, transport, calls, errors, get status() { return status; } };
}

test("restoring a track prepares native playback before Play", async () => {
  const { session, calls, errors } = setup();
  await session.restore(track(1));
  assert.equal(session.getSnapshot().isPlaying, false);
  await session.toggle();
  assert.deepEqual(calls, [["load", "/music/1.wav"], ["play", "/music/1.wav"]]);
  assert.equal(session.getSnapshot().isPlaying, true);
  assert.deepEqual(errors, []);
});

test("selecting another album track changes both native and displayed identity", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  await context.session.select(track(2));
  assert.equal(context.session.getSnapshot().selected.path, context.status.path);
  assert.equal(context.session.getSnapshot().selected.id, 2);
  assert.equal(context.session.getSnapshot().isPlaying, false);
  await context.session.toggle();
  assert.deepEqual(context.calls.at(-1), ["play", "/music/2.wav"]);
});

test("failed selection preserves the previously loaded track", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  context.transport.loadAudio = async () => { throw Error("Missing file"); };
  await context.session.select(track(2), true);
  assert.equal(context.session.getSnapshot().selected.id, 1);
  assert.equal(context.session.getSnapshot().isPlaying, true);
  assert.equal(context.status.path, "/music/1.wav");
  assert.match(context.errors[0], /Missing file/);
  await context.session.toggle();
  assert.equal(context.session.getSnapshot().isPlaying, false);
});

test("late startup restoration cannot replace a user selection", async () => {
  const context = setup();
  const selection = context.session.select(track(2), true);
  await context.session.restore(track(1));
  await selection;
  assert.equal(context.session.getSnapshot().selected.id, 2);
  assert.deepEqual(context.calls, [["load", "/music/2.wav"], ["play", "/music/2.wav"]]);
});

test("clear queued during loading prevents the pending track from starting", async () => {
  const context = setup();
  const pending = deferred();
  const load = context.transport.loadAudio;
  context.transport.loadAudio = async (path) => { await pending.promise; return load(path); };
  const selection = context.session.select(track(1), true);
  await Promise.resolve();
  const clearing = context.session.clear();
  pending.resolve();
  await Promise.all([selection, clearing]);
  assert.equal(context.session.getSnapshot().selected.path, undefined);
  assert.equal(context.status.loaded, false);
  assert.equal(context.calls.some(([command]) => command === "play"), false);
});

test("a delayed completion cannot advance a newly selected track", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  const stale = { ...context.status, finished: true, playing: false, positionSeconds: 100 };
  const pending = deferred();
  context.transport.getPlayerStatus = () => pending.promise;
  let completions = 0;
  const polling = context.session.poll(async () => { completions++; await context.session.select(track(2), true); });
  await context.session.select(track(3), true);
  pending.resolve(stale);
  await polling;
  assert.equal(completions, 0);
  assert.equal(context.session.getSnapshot().selected.id, 3);
  assert.equal(context.session.getSnapshot().isPlaying, true);
  assert.equal(context.session.getSnapshot().progress, 0);
});

test("a previous native session is rejected even when replaying the same path", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  const stale = { ...context.status, finished: true };
  await context.session.select(track(1), true);
  context.transport.getPlayerStatus = async () => stale;
  let completions = 0;
  await context.session.poll(async () => { completions++; });
  assert.equal(completions, 0);
  assert.equal(context.session.getSnapshot().isPlaying, true);
});

test("an inactive subscription leaves completion available to its replacement", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  context.status.finished = true;
  let completions = 0;
  const finish = async () => { completions++; };
  await context.session.poll(finish, () => false);
  await context.session.poll(finish);
  await context.session.poll(finish);
  assert.equal(completions, 1);
});

test("polls do not overlap and a current completion is delivered once", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  const pending = deferred();
  let requests = 0, completions = 0;
  context.transport.getPlayerStatus = () => { requests++; return pending.promise; };
  const finish = async () => { completions++; };
  const first = context.session.poll(finish);
  await context.session.poll(finish);
  assert.equal(requests, 1);
  pending.resolve({ ...context.status, finished: true });
  await first;
  await context.session.poll(finish);
  assert.equal(completions, 1);
});

test("rapid selections serialize loads and only autoplay the latest selection", async () => {
  const context = setup();
  const pending = deferred();
  const originalLoad = context.transport.loadAudio;
  let first = true;
  context.transport.loadAudio = async (path) => {
    if (first) { first = false; await pending.promise; }
    return originalLoad(path);
  };
  const firstSelection = context.session.select(track(1), true);
  await Promise.resolve();
  const nextSelection = context.session.select(track(2), true);
  pending.resolve();
  await Promise.all([firstSelection, nextSelection]);
  assert.deepEqual(context.calls.filter(([command]) => command === "play"), [["play", "/music/2.wav"]]);
  assert.equal(context.session.getSnapshot().selected.id, 2);
});

test("Play queued during preparation runs after the native load", async () => {
  const context = setup();
  const pending = deferred();
  const load = context.transport.loadAudio;
  context.transport.loadAudio = async (path) => { await pending.promise; return load(path); };
  const preparing = context.session.select(track(1));
  const playing = context.session.toggle();
  pending.resolve();
  await Promise.all([preparing, playing]);
  assert.equal(context.session.getSnapshot().isPlaying, true);
  assert.deepEqual(context.errors, []);
});

test("volume can be changed without a loaded track and survives clear and selection", async () => {
  const context = setup();
  await context.session.setVolume(0);
  await context.session.select(track(1), true);
  await context.session.clear();
  await context.session.select(track(2), true);
  assert.equal(context.session.getSnapshot().volume, 0);
  assert.equal(context.status.volume, 0);
});

test("natural completion advances and replay reloads an exhausted sink", async () => {
  const context = setup();
  await context.session.select(track(1), true);
  context.status.finished = true;
  context.status.playing = false;
  await context.session.poll(async () => { await context.session.select(track(2), true); });
  assert.equal(context.session.getSnapshot().selected.id, 2);
  context.status.finished = true;
  context.status.playing = false;
  await context.session.poll(async () => {});
  await context.session.toggle();
  assert.deepEqual(context.calls.slice(-2), [["load", "/music/2.wav"], ["play", "/music/2.wav"]]);
});
