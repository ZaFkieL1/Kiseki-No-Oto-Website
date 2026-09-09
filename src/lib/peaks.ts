/**
 * Real waveforms for real files.
 *
 * The scrubber used to be a seeded shape wobbling with the analyser, which
 * meant it showed nothing true and never sat still. For an actual track we
 * decode the file once and measure it: the bars become the track's own
 * dynamics and then stop moving, which is what a waveform is for.
 *
 * Decoding uses an OfflineAudioContext so it can run before any user gesture.
 * The PCM buffer is released as soon as the peaks are measured — it is two
 * orders of magnitude larger than the numbers we keep.
 */

const cache = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[] | null>>();

export const PEAK_BUCKETS = 400;

export function cachedPeaks(url: string): number[] | null {
  return cache.get(url) ?? null;
}

export async function loadPeaks(url: string): Promise<number[] | null> {
  const hit = cache.get(url);
  if (hit) return hit;

  const running = inflight.get(url);
  if (running) return running;

  const job = (async (): Promise<number[] | null> => {
    try {
      const response = await fetch(encodeURI(url));
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();

      // Decode at a low rate: decodeAudioData resamples to the context's
      // rate, which cuts peak memory roughly fourfold on a long track. Peak
      // envelopes survive this intact — it is a picture, not playback.
      const offline = new OfflineAudioContext(1, 1, 11025);
      const buffer = await offline.decodeAudioData(bytes);

      const channels = Math.min(2, buffer.numberOfChannels);
      const frames = buffer.length;
      const per = Math.max(1, Math.floor(frames / PEAK_BUCKETS));
      const peaks: number[] = [];

      for (let bucket = 0; bucket < PEAK_BUCKETS; bucket++) {
        const start = bucket * per;
        let max = 0;
        for (let c = 0; c < channels; c++) {
          const data = buffer.getChannelData(c);
          const end = Math.min(frames, start + per);
          // Step through the window rather than reading every sample; the
          // extremes survive and the decode stays responsive on long tracks.
          for (let i = start; i < end; i += 4) {
            const v = Math.abs(data[i]!);
            if (v > max) max = v;
          }
        }
        peaks.push(max);
      }

      // Normalise so quiet masters still fill the box.
      const ceiling = Math.max(...peaks, 0.0001);
      const shaped = peaks.map((p) => Math.max(0.03, p / ceiling));

      cache.set(url, shaped);
      return shaped;
    } catch {
      // A failed decode is not worth breaking the player over — the scrubber
      // falls back to a flat bar and seeking still works.
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, job);
  return job;
}
