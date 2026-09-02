/**
 * Content model for the two kinds of video Fandango at Home (Vudu) plays:
 *
 *   1. "Splash" trailers  — short .mp4 files handed straight to the <video>
 *                           element. Native playback, no MSE, no streaming engine.
 *   2. "Actual" trailers  — adaptive HLS (.m3u8) or DASH (.mpd) manifests.
 *
 * Apex's `loadContent` is driven by a **MIME type string** (case-sensitive).
 * These are the only three we need for trailers:
 *
 *   video/mp4              -> native playback via @apex/default-playback
 *   application/x-mpegURL  -> HLS  (Safari native, else Shaka on MSE)
 *   application/dash+xml   -> DASH (Shaka only — DASH is never natively playable)
 *
 * NOTE: the strings are case-sensitive in Apex. 'hls' works, 'HLS' does not.
 * A wrong type surfaces as a `contentError` (CONTENT_PARSE_ERROR), never a throw.
 */

import type { ContentMediaMimeType } from '@apex/core';

export type TrailerKind = 'mp4' | 'hls' | 'dash';

/** Apex `loadContent` MIME strings, keyed by our friendly kind. */
export const APEX_MIME: Record<TrailerKind, ContentMediaMimeType> = {
  mp4: 'video/mp4',
  hls: 'application/x-mpegURL',
  dash: 'application/dash+xml',
};

/**
 * Infer the trailer kind from a URL extension. Real Vudu content URLs often
 * carry query strings, so we test the pathname only.
 *
 * Returns `undefined` when the extension is not one we recognise — the caller
 * should then pass an explicit kind rather than guess.
 */
export function detectKind(url: string): TrailerKind | undefined {
  let pathname = url;
  try {
    pathname = new URL(url, 'https://placeholder.invalid').pathname;
  } catch {
    // Relative or malformed URL — fall back to the raw string.
  }
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'mp4';
  if (lower.endsWith('.m3u8')) return 'hls';
  if (lower.endsWith('.mpd')) return 'dash';
  return undefined;
}

export interface SampleTrailer {
  label: string;
  url: string;
  kind: TrailerKind;
}

/**
 * Public, DRM-free sample media so the demo runs out of the box. Swap these for
 * your Vudu splash .mp4s and trailer manifests — the wrapper does not care where
 * the bytes come from, only what `kind` they are.
 */
export const SAMPLES: SampleTrailer[] = [
  {
    label: 'Splash intro (native MP4)',
    url: 'https://storage.googleapis.com/muxdemofiles/mux-video-intro.mp4',
    kind: 'mp4',
  },
  {
    label: 'Trailer — HLS (.m3u8)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    kind: 'hls',
  },
  {
    label: 'Trailer — DASH (.mpd)',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    kind: 'dash',
  },
];
