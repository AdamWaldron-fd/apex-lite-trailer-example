/**
 * ApexTrailerPlayer — the smallest useful wrapper around the Apex JS Player for
 * a client that only needs to play two things:
 *
 *   - native MP4 "splash" trailers, and
 *   - HLS / DASH streaming trailers.
 *
 * ─── Why this is the "lightweight" build ────────────────────────────────────
 * Every Apex player needs `@apex/core` + `@apex/devices` + at least one engine.
 * We register exactly two engines and zero plugins:
 *
 *   @apex/default-playback  (priority 1) — MP4 via the native <video> element,
 *                                          plus native HLS on Safari.
 *   @apex/shaka-playback    (priority 2) — DASH (the only engine that can) and
 *                                          HLS on MSE browsers (Chrome/Firefox/TVs).
 *
 * That single MSE engine (Shaka) covers BOTH HLS and DASH, so we avoid also
 * shipping hls.js. Trailers are clear content, so there are no license/DRM
 * plugins either. This is the minimum that plays all three content types on
 * every target Apex supports.
 *
 * Engine selection: Apex sorts engines DESCENDING by priority and uses the
 * first whose `canPlayType` returns true (first match wins, no fallback).
 *   - MP4  -> Shaka declines (not HLS/DASH) -> default-playback plays natively.
 *   - HLS  -> Shaka plays on MSE; on Safari default-playback can also play it
 *             natively if you raise its priority above Shaka (see README).
 *   - DASH -> only Shaka can; default-playback declines everywhere.
 */

import { apexJsPlayer } from '@apex/core';
import type { ApexJsPlayer, PlayerInfo, ContentData } from '@apex/core';
import { selectDevice, allDevices } from '@apex/devices';
import { loadEngine as loadDefaultEngine } from '@apex/default-playback';
import { loadEngine as loadShakaEngine } from '@apex/shaka-playback';

import { APEX_MIME, detectKind } from './content.js';
import type { TrailerKind } from './content.js';

export interface ApexTrailerPlayerOptions {
  /** Existing, already-sized DOM element the player mounts into. Required. */
  container: HTMLElement;
  /** Optional stable id (auto-uniquified by Apex on collision). */
  id?: string;
  /** Show the browser's native <video> controls. Default false. */
  useNativeControls?: boolean;
  /** Called on any fatal player/content/application error, with a readable message. */
  onError?: (message: string, detail: unknown) => void;
}

export class ApexTrailerPlayer {
  private player: ApexJsPlayer;
  /** Serialises destroy() against the next construction to avoid teardown races. */
  private constructor(player: ApexJsPlayer) {
    this.player = player;
  }

  /**
   * Async factory. Mirrors Apex's own required order:
   *   1. container exists & is sized  2. selectDevice (async)
   *   3. apexJsPlayer (async)         4. register engines
   *   5. subscribe to errors          6. THEN loadContent (via play* methods)
   */
  static async create(opts: ApexTrailerPlayerOptions): Promise<ApexTrailerPlayer> {
    if (!opts.container) throw new Error('ApexTrailerPlayer: container is required');

    // selectDevice is async; it probes capabilities (MSE, native codecs, ...).
    const device = await selectDevice(allDevices());

    const info: PlayerInfo = {
      id: opts.id ?? 'apex-player',
      videoContainer: opts.container,
      config: {
        // forceMutedAutoplay defaults to true — splash trailers autoplay muted,
        // which browsers allow without a user gesture. Left explicit for clarity.
        forceMutedAutoplay: true,
        useNativeControls: opts.useNativeControls ?? false,
      },
    };

    const player = await apexJsPlayer(info, device);

    // Register the two engines. Higher priority is checked first.
    player.loadPlaybackEngine({ loadType: 'module', loader: loadDefaultEngine, priority: 1 });
    player.loadPlaybackEngine({ loadType: 'module', loader: loadShakaEngine, priority: 2 });

    // Errors are EVENTS, not thrown exceptions. Subscribe before loading content
    // or an integration is silently blind to failures. Engine/plugin load
    // failures also surface here (they never reject the load* promise).
    const emit = (msg: string, detail: unknown) => {
      if (opts.onError) opts.onError(msg, detail);
      else console.error('[ApexTrailerPlayer]', msg, detail);
    };
    player.on.mediaError(({ error }) => emit(`media error: ${error.message}`, error));
    player.on.contentError(({ error }) => emit(`content error: ${error.message}`, error));
    player.on.applicationError(({ error }) => emit(`application error: ${error.message}`, error));
    // A retried failure fires mediaRetry INSTEAD of mediaError — surface it too,
    // otherwise transient retries look like silent stalls.
    player.on.mediaRetry(({ error }) => emit(`media retry: ${error?.message ?? 'retrying'}`, error));

    return new ApexTrailerPlayer(player);
  }

  /** Direct access to the underlying Apex player for anything this wrapper omits. */
  get api(): ApexJsPlayer {
    return this.player;
  }

  /** Play a native-MP4 splash trailer. */
  playSplash(url: string): void {
    this.load({ type: APEX_MIME.mp4, url });
  }

  /**
   * Play a streaming trailer. The kind is inferred from the URL extension when
   * omitted; pass it explicitly for URLs without a recognisable extension.
   */
  playTrailer(url: string, kind?: TrailerKind): void {
    const resolved = kind ?? detectKind(url);
    if (!resolved) {
      throw new Error(
        `ApexTrailerPlayer: could not infer content kind from "${url}" — pass one of 'mp4' | 'hls' | 'dash'.`,
      );
    }
    this.load({ type: APEX_MIME[resolved], url });
  }

  /** Toggle mute. Autoplay is muted; call this from a user gesture to unmute. */
  setMuted(muted: boolean): void {
    this.player.mute(muted);
  }

  isMuted(): boolean {
    return this.player.isMuted();
  }

  /** There is no play() in Apex — resume is pause(false). */
  resume(): void {
    this.player.pause(false);
  }

  pause(): void {
    this.player.pause(true);
  }

  private load(content: ContentData): void {
    this.player.loadContent(content);
  }

  /**
   * Tear down. `destroy()` is typed `() => void` but is implemented async and
   * returns a Promise; await it before constructing a replacement so a fast swap
   * does not race teardown against a new player on the same element.
   */
  async destroy(): Promise<void> {
    await (this.player.destroy() as unknown as Promise<void>);
  }
}
