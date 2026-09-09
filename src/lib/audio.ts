/**
 * The deck.
 *
 * It plays uploaded files and nothing else. Upload a song in KERNEL — it goes
 * to R2 and sets `file` on the track — and this plays it; `trackSource` is the
 * only thing that decides what that is (`file` is the source, `audio` is the
 * destination the release scene links out to).
 *
 * **The synthesiser below is no longer reachable.** When the catalogue was
 * invented there was no music to play at all, so rather than fake a visualiser
 * against silence the engine generated a real J-Core signal — distorted kick,
 * offbeat stabs, a seeded lead — and everything the interface reacts to was
 * measured off it. The catalogue is real now, and generated music coming out of
 * a real label's record is worse than silence: it sounds like theirs, and is
 * not. `play()` refuses a song with no file, and `next`/`prev` walk only songs
 * that have one. The sequencer is kept because deleting it is a separate
 * decision from silencing it.
 */

import { featuredTrack } from "./catalogue";
import { firstPlayable, mulberry32, trackSource, type Release } from "./data";
import { store } from "./store";

/** The live catalogue, not the seed — records can be added and removed. */
function catalogue(): Release[] {
  return store.getSnapshot().releases;
}

/**
 * What the transport is doing, in the machine's own words.
 *
 * `FETCHING` is not decoration: a file coming off the bucket takes real time,
 * and a play button that does nothing visible for two seconds is a play button
 * the reader presses again. `NO SIGNAL` exists because the alternative was
 * worse — the element used to fail with no listener on it at all, so a 404 or a
 * file the browser could not decode produced silence and no explanation.
 */
export type Phase = "STANDBY" | "FETCHING" | "TRANSMITTING" | "NO SIGNAL";

export interface DeckState {
  release: Release;
  /** Which song of the release is loaded. Index into `release.tracks`. */
  track: number;
  playing: boolean;
  phase: Phase;
  /** Why the signal was lost, when it was. Shown on the readout's tooltip. */
  problem: string | null;
  /**
   * "STREAM" when there is a file behind what is loaded, "NONE" when there is
   * not. It used to read "SYNTH" for the second case, because the deck would
   * generate a signal rather than sit silent — see `play()` for why it no
   * longer does.
   */
  source: "STREAM" | "NONE";
  /**
   * Running the record's `preview` rather than a song of it. The loaded track
   * still points at a real index — it is what the pattern and the tempo are
   * read from — but the file on the element is the record's.
   */
  preview: boolean;
  muted: boolean;
  volume: number;
  /**
   * Authoritative track length. For a real file this is the element's own
   * duration once metadata lands — never the placeholder in data.ts, or
   * seeking would map to the wrong point in the audio.
   */
  duration: number;
}

export interface Levels {
  bass: number;
  mid: number;
  high: number;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const STEPS_PER_BAR = 16;
const BARS = 8;

const MINOR = [0, 2, 3, 5, 7, 8, 10];

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Soft clipper — the reason a gabber kick sounds like a gabber kick. */
/* `WaveShaperNode.curve` wants a Float32Array over a plain ArrayBuffer, not the
   SharedArrayBuffer the unparameterised type also admits. */
function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

class Deck {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private delaySend: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private shaper: WaveShaperNode | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextStepTime = 0;
  private startedAt = 0;
  private offset = 0;

  private media: HTMLAudioElement | null = null;
  private mediaNode: MediaElementAudioSourceNode | null = null;
  private pendingSeek: number | null = null;

  private freq: Uint8Array = new Uint8Array(0);
  private levels: Levels = { bass: 0, mid: 0, high: 0 };

  private listeners = new Set<() => void>();
  private snapshot: DeckState;

  private pattern = { lead: [] as number[], chords: [] as number[] };

  /**
   * True once anyone has loaded or played anything by hand.
   *
   * Until then the deck is only showing what the catalogue says is on air, and
   * it will keep following that mark as the catalogue arrives or changes. After
   * it, it will not: pulling a record out from under someone who chose it is
   * worse than showing them a mark that is one edit old.
   */
  private touched = false;

  /**
   * Whether sound has been asked for. Separates "the file is broken" from
   * "nobody has pressed anything yet" — `prime()` attaches an element on mount,
   * and a record failing to load before a visitor has asked for it is not a
   * `NO SIGNAL` to put across the hero.
   */
  private intent = false;

  constructor() {
    const { release, track } = featuredTrack();
    this.snapshot = {
      release,
      track,
      playing: false,
      phase: "STANDBY",
      problem: null,
      source: trackSource(release.tracks[track]) ? "STREAM" : "NONE",
      preview: false,
      muted: false,
      volume: 0.7,
      duration: release.tracks[track]?.duration ?? 0,
    };
    this.loadPattern(release);

    /*
     * The deck is built at module scope, which is before Firestore has said a
     * word — `featuredTrack()` above therefore reads the *seed*. Without this
     * the on-air mark in KERNEL could never reach the site: the store would
     * swap to the cloud, every component would repaint, and the deck would sit
     * there still holding the record the seed shipped with.
     */
    store.subscribe(() => this.adoptFeatured());
  }

  /** Follows the catalogue's on-air mark, while the deck is still untouched. */
  private adoptFeatured(): void {
    if (this.touched) return;
    const { release, track } = featuredTrack();
    const { release: current, track: currentTrack } = this.snapshot;

    /*
     * Comparing only `cat` and `track` was not enough, and the bug it caused
     * was a good one: the deck boots against the *seed*, so when Firestore
     * reported a record with the same catalogue number it looked unchanged and
     * the deck kept the seeded object — including its tracks. Upload a song,
     * put it on air, press play, silence, because the deck was still holding a
     * version of the record from before the upload existed.
     */
    if (release.cat === current.cat && track === currentTrack) {
      if (
        trackSource(release.tracks[track]) ===
        trackSource(current.tracks[currentTrack])
      ) {
        // Same audio: keep the element, but take the fresher record — a title
        // or a credit may have been edited under us.
        if (release !== current) this.emit({ release });
        return;
      }
    }

    this.teardownMedia();
    this.loadPattern(release);
    this.emit({
      release,
      track,
      source: trackSource(release.tracks[track]) ? "STREAM" : "NONE",
      preview: false,
      phase: "STANDBY",
      problem: null,
      duration: release.tracks[track]?.duration ?? 0,
    });
    // Same job as the mount-time `prime()`: have a true duration and a
    // waveform ready before anyone presses play.
    this.attachMedia(release, track);
  }

  /* ---- store ---------------------------------------------------------- */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): DeckState => this.snapshot;

  private emit(patch: Partial<DeckState>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  /* ---- transport ------------------------------------------------------ */

  get position(): number {
    if (this.media) return this.media.currentTime || 0;
    if (!this.snapshot.playing || !this.ctx) return this.offset;
    const t = this.offset + (this.ctx.currentTime - this.startedAt);
    return t >= this.duration ? this.duration : t;
  }

  get duration(): number {
    return this.snapshot.duration;
  }

  /**
   * Start fetching metadata for the loaded record without touching the
   * AudioContext, so the transport shows a true duration before first play.
   */
  prime(): void {
    this.attachMedia(this.snapshot.release, this.snapshot.track);
  }

  /** Sound actually coming out, as opposed to a flag that says it is. */
  private get running(): boolean {
    if (this.media) return !this.media.paused && !this.media.ended;
    return this.timer !== null;
  }

  /**
   * `playing` alone is not enough to decide this.
   *
   * A track that ends somewhere the deck cannot carry on from — nothing left in
   * the running order, a next record whose file will not load — leaves the flag
   * true with nothing behind it. Then the next press reads as *pause*, does
   * nothing anyone can hear, and the button looks broken. Ask the transport,
   * not the flag.
   */
  async toggle(): Promise<void> {
    if (this.snapshot.playing && this.running) this.pause();
    else await this.play();
  }

  /** Whether what is loaded has an actual file behind it. */
  private get hasSource(): boolean {
    const { release, track, preview } = this.snapshot;
    return Boolean(
      preview ? release.preview : trackSource(release.tracks[track])
    );
  }

  async play(): Promise<void> {
    // Pressing play is choosing. From here the deck stops following the mark.
    this.touched = true;
    this.intent = true;

    /*
     * **Nothing to play means nothing plays.**
     *
     * The deck used to answer this case by synthesising a J-Core signal —
     * kick, stabs, a seeded lead — because the catalogue was invented and there
     * was no music to play at all. The catalogue is real now, and generated
     * music coming out of a real label's record is worse than silence: it
     * sounds like the label's, and it is not. The sequencer below is left
     * intact and is no longer reachable from the transport.
     */
    if (!this.hasSource) {
      this.emit({
        playing: false,
        phase: "NO SIGNAL",
        problem: "No file has been uploaded for this song yet.",
      });
      return;
    }

    // Said before anything is awaited: fetching a file off the bucket takes
    // real time, and a control that shows nothing for two seconds gets pressed
    // again.
    this.emit({ phase: "FETCHING", problem: null });

    // A real file only needs the element; the graph is wired on first play so
    // no AudioContext is constructed before the user asks for sound.
    this.attachMedia(this.snapshot.release, this.snapshot.track);

    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();

    if (this.media) {
      this.connectMedia();
      // Play on a finished element is meant to restart it, but only some of
      // the time — rewind explicitly so pressing play after the last second
      // always means the same thing.
      if (this.media.ended) this.media.currentTime = 0;
      this.media.volume = this.snapshot.muted ? 0 : this.snapshot.volume;
      this.fade(1);
      try {
        await this.media.play();
      } catch (problem) {
        // Autoplay policy, a source that will not load, a decode failure — all
        // arrive here, and all used to arrive silently.
        this.emit({
          playing: false,
          phase: "NO SIGNAL",
          problem:
            problem instanceof Error ? problem.message : "Playback was refused.",
        });
        return;
      }
      // `playing` on the element moves it to TRANSMITTING; until then it is
      // still buffering and the readout should say so.
      this.emit({ playing: true });
      return;
    }

    this.startedAt = ctx.currentTime;
    this.nextStepTime = ctx.currentTime + 0.06;
    this.step = 0;
    this.fade(this.snapshot.muted ? 0 : this.snapshot.volume);
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    // The synth has nothing to fetch: it is generating the signal right now.
    this.emit({ playing: true, phase: "TRANSMITTING" });
  }

  pause(): void {
    this.intent = false;
    if (this.media) {
      this.media.pause();
    } else {
      this.offset = this.position;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.fade(0);
    }
    this.emit({ playing: false, phase: "STANDBY" });
  }

  /**
   * Loads one song of a record. `track` defaults to the first with a file
   * behind it, so clicking a release still does the obvious thing.
   */
  async load(
    release: Release,
    track = firstPlayable(release),
    autoplay = true
  ): Promise<void> {
    this.touched = true;
    const wasPlaying = this.snapshot.playing || autoplay;
    if (this.snapshot.playing) this.pause();

    this.teardownMedia();
    this.offset = 0;
    this.loadPattern(release);

    const song = release.tracks[track];
    this.emit({
      release,
      track,
      source: trackSource(song) ? "STREAM" : "NONE",
      preview: false,
      playing: false,
      phase: "STANDBY",
      problem: null,
      duration: song?.duration ?? 0,
    });

    this.attachMedia(release, track);
    if (wasPlaying) await this.play();
  }

  /**
   * Runs the record's preview instead of one of its songs.
   *
   * The loaded track is still a real index, so the dock has a credit to print
   * and the synth has a tempo if the file ever fails — what changes is which
   * file `attachMedia` reaches for. Anything that loads a song afterwards
   * clears the flag, which is what makes this a detour and not a mode.
   */
  async loadPreview(release: Release): Promise<void> {
    if (!release.preview) return;
    this.touched = true;
    if (this.snapshot.playing) this.pause();

    this.teardownMedia();
    this.offset = 0;
    this.loadPattern(release);

    this.emit({
      release,
      track: 0,
      source: "STREAM",
      preview: true,
      playing: false,
      phase: "STANDBY",
      problem: null,
      duration: 0,
    });

    this.attachMedia(release, 0);
    await this.play();
  }

  /**
   * Creates the element and starts pulling metadata. Deliberately free of any
   * AudioContext work so it can run on page load — that is how the transport
   * knows the true length before anyone presses play.
   */
  private attachMedia(release: Release, track: number): void {
    const source = this.snapshot.preview
      ? release.preview
      : trackSource(release.tracks[track]);
    if (!source || this.media || typeof Audio === "undefined") return;

    const el = new Audio();
    el.preload = "metadata";
    el.src = encodeURI(source);

    el.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        this.emit({ duration: el.duration });
      }
      if (this.pendingSeek !== null) {
        el.currentTime = Math.min(this.pendingSeek, el.duration);
        this.pendingSeek = null;
      }
    });
    /*
     * A song that ends is the end of it.
     *
     * This used to roll into the next record, which is what a radio does — and
     * what it did in practice was start playing a *different* act's record at
     * someone who had chosen this one. `next` and `prev` are still there; they
     * are controls, and a control is somebody asking.
     */
    el.addEventListener("ended", () => {
      this.intent = false;
      this.seek(0);
      this.emit({ playing: false, phase: "STANDBY" });
    });
    el.addEventListener("pause", () => {
      if (!el.ended) this.emit({ playing: false, phase: "STANDBY" });
    });
    el.addEventListener("play", () => this.emit({ playing: true }));

    /* The three that make the readout honest. `playing` is the only one that
       means sound is actually coming out; `waiting` is the buffer running dry
       mid-track, which is a fetch like any other. */
    el.addEventListener("playing", () =>
      this.emit({ playing: true, phase: "TRANSMITTING", problem: null })
    );
    el.addEventListener("waiting", () => {
      if (this.intent) this.emit({ phase: "FETCHING" });
    });

    /*
     * The listener whose absence made this silent. A 404 — which is what a
     * missing object looks like — surfaces here as MEDIA_ERR_SRC_NOT_SUPPORTED,
     * because the browser was handed a page where it expected audio.
     */
    el.addEventListener("error", () => {
      const code = el.error?.code;
      const reason =
        code === 4
          ? "The file could not be loaded — missing, or not an audio format."
          : code === 3
          ? "The file could not be decoded."
          : code === 2
          ? "The network dropped while loading the file."
          : "The file failed to load.";
      this.emit({
        playing: false,
        problem: `${reason} (${source})`,
        phase: this.intent ? "NO SIGNAL" : this.snapshot.phase,
      });
    });

    this.media = el;
  }

  private connectMedia(): void {
    if (!this.media || this.mediaNode) return;
    const ctx = this.ensure();
    this.mediaNode = ctx.createMediaElementSource(this.media);
    this.mediaNode.connect(this.master!);
  }

  /**
   * Walks the running order first, then rolls into the next record. A twelve
   * track album should play through, not jump away after one song.
   */
  /**
   * Every song in the catalogue with a file behind it, in running order.
   *
   * `next` and `prev` walk *this*, not the catalogue: stepping onto a record
   * with nothing uploaded used to hand the reader a generated signal, and now
   * would hand them silence and a `NO SIGNAL`. Neither is what the button
   * promises. A song that cannot be played is not somewhere the transport goes.
   */
  private playable(): { release: Release; track: number }[] {
    const out: { release: Release; track: number }[] = [];
    for (const release of catalogue()) {
      release.tracks.forEach((song, track) => {
        if (trackSource(song)) out.push({ release, track });
      });
    }
    return out;
  }

  private async stepTo(by: number): Promise<void> {
    const list = this.playable();
    if (list.length === 0) return;

    const { release, track } = this.snapshot;
    const at = list.findIndex(
      (entry) => entry.release.cat === release.cat && entry.track === track
    );
    // Loaded on something unplayable: step onto the nearest end of the list
    // rather than counting from a position it does not occupy.
    const index =
      at === -1
        ? by > 0
          ? 0
          : list.length - 1
        : (at + by + list.length) % list.length;

    const target = list[index]!;
    await this.load(target.release, target.track);
  }

  async next(): Promise<void> {
    await this.stepTo(1);
  }

  async prev(): Promise<void> {
    // Restart the current song first, like every deck ever built.
    if (this.position > 3) {
      this.seek(0);
      return;
    }
    await this.stepTo(-1);
  }

  seek(seconds: number): void {
    const limit = this.duration > 0 ? this.duration : seconds;
    const t = Math.max(0, Math.min(limit, seconds));

    if (this.media) {
      // Setting currentTime before metadata arrives is silently ignored, so
      // hold the request and apply it the moment the element knows its length.
      if (this.media.readyState < 1 || !Number.isFinite(this.media.duration)) {
        this.pendingSeek = t;
        return;
      }
      this.media.currentTime = t;
      return;
    }

    this.offset = t;
    if (this.ctx) this.startedAt = this.ctx.currentTime;
  }

  setVolume(volume: number): void {
    this.emit({ volume, muted: volume === 0 });
    if (this.media) this.media.volume = volume;
    else if (this.snapshot.playing) this.fade(volume, 0.05);
  }

  toggleMute(): void {
    const muted = !this.snapshot.muted;
    this.emit({ muted });
    const target = muted ? 0 : this.snapshot.volume;
    if (this.media) this.media.volume = target;
    else if (this.snapshot.playing) this.fade(target, 0.05);
  }

  /* ---- analysis ------------------------------------------------------- */

  getLevels(): Levels {
    if (!this.analyser || !this.snapshot.playing) {
      // Decay to rest rather than snapping, so the UI settles gracefully.
      this.levels = {
        bass: this.levels.bass * 0.86,
        mid: this.levels.mid * 0.86,
        high: this.levels.high * 0.86,
      };
      return this.levels;
    }

    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>);
    const nyquist = this.ctx!.sampleRate / 2;
    const perBin = nyquist / this.freq.length;

    const band = (lo: number, hi: number): number => {
      const a = Math.max(1, Math.floor(lo / perBin));
      const b = Math.min(this.freq.length - 1, Math.ceil(hi / perBin));
      let sum = 0;
      for (let i = a; i <= b; i++) sum += this.freq[i]!;
      return sum / (b - a + 1) / 255;
    };

    this.levels = {
      bass: Math.min(1, band(24, 170) * 1.25),
      mid: Math.min(1, band(170, 2000) * 1.6),
      high: Math.min(1, band(2000, 11000) * 2.1),
    };
    return this.levels;
  }

  getSpectrum(): Uint8Array {
    if (!this.analyser) return this.freq;
    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>);
    return this.freq;
  }

  /* ---- graph ---------------------------------------------------------- */

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;

    // 3/16 delay on the lead — standard issue for this genre.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.18;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    const send = ctx.createGain();
    send.gain.value = 0.28;

    send.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(master);

    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(9);
    shaper.oversample = "4x";
    shaper.connect(master);

    // One noise buffer, reused by every hat and clap.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.analyser = analyser;
    this.delaySend = send;
    this.shaper = shaper;
    this.noise = noise;
    this.freq = new Uint8Array(analyser.frequencyBinCount);

    return ctx;
  }

  private fade(to: number, time = 0.03): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(to, now + time);
  }

  private teardownMedia(): void {
    if (this.media) {
      this.media.pause();
      this.media.removeAttribute("src");
      this.media.load();
    }
    this.mediaNode?.disconnect();
    this.media = null;
    this.mediaNode = null;
    this.pendingSeek = null;
  }

  /* ---- sequencer ------------------------------------------------------ */

  private loadPattern(release: Release): void {
    const rand = mulberry32(release.seed);
    const root = 45 + Math.floor(rand() * 7); // A1–D#2 territory
    const chords = [0, 5, 3, 7].map((d) => root + d);
    const lead: number[] = [];
    for (let i = 0; i < STEPS_PER_BAR * 4; i++) {
      // Sparse, syncopated, and never on the kick — leaves room for the low end.
      const on = rand() < (i % 4 === 0 ? 0.18 : 0.42);
      lead.push(on ? root + 24 + MINOR[Math.floor(rand() * MINOR.length)]! : -1);
    }
    this.pattern = { lead, chords };
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const { release, track } = this.snapshot;
    // Tempo belongs to the song. Unset falls back to a hardcore-ish 175 rather
    // than dividing by zero and scheduling every step at the same instant.
    const bpm = release.tracks[track]?.bpm || 175;
    const stepDur = 60 / bpm / 4;

    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.tick(this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % (STEPS_PER_BAR * BARS);
    }

    // Same rule as a real file reaching its end: stop there.
    if (this.duration > 0 && this.position >= this.duration) {
      this.pause();
      this.offset = 0;
    }
  }

  private tick(step: number, time: number, stepDur: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const beat = step % STEPS_PER_BAR;
    const { chords, lead } = this.pattern;

    if (beat % 4 === 0) this.kick(time);
    if (bar === BARS - 1 && beat >= 12 && beat % 2 === 0) this.kick(time); // fill
    if (beat === 4 || beat === 12) this.clap(time);
    if (beat % 2 === 1) this.hat(time, beat === 15);

    // Offbeat stabs — the engine of the genre.
    if (beat % 4 === 2) {
      const chord = chords[bar % chords.length]!;
      this.stab(time, chord, stepDur);
    }

    if (bar >= 2) {
      const note = lead[step % lead.length]!;
      if (note > 0) this.lead(time, midiToFreq(note), stepDur);
    }
  }

  private kick(time: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(47, time + 0.075);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(1, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
    osc.connect(gain);
    gain.connect(this.shaper!);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  private clap(time: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1700;
    bp.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.master!);
    src.start(time);
    src.stop(time + 0.16);
  }

  private hat(time: number, open: boolean): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8200;
    const gain = ctx.createGain();
    const decay = open ? 0.16 : 0.035;
    gain.gain.setValueAtTime(open ? 0.16 : 0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.master!);
    src.start(time);
    src.stop(time + decay + 0.02);
  }

  private stab(time: number, midi: number, stepDur: number): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.exponentialRampToValueAtTime(3400, time + 0.02);
    filter.frequency.exponentialRampToValueAtTime(700, time + stepDur);

    for (const detune of [-11, 0, 11]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(midi + 12);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + stepDur * 1.1);
    }

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.22, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + stepDur * 1.05);
    filter.connect(gain);
    gain.connect(this.master!);
  }

  private lead(time: number, freq: number, stepDur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2800;
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.1, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + stepDur * 0.9);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.master!);
    gain.connect(this.delaySend!);
    osc.start(time);
    osc.stop(time + stepDur);
  }
}

/** One deck per document. */
export const deck = new Deck();
