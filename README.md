# Apex Lite — Splash + Trailer Player

A minimal, production-shaped example of embedding the **[Apex JS Player]** to play
the two kinds of video seen on Fandango at Home (Vudu):

| Content | Example | How it plays |
|---|---|---|
| **Splash trailers** | short `.mp4` handed straight to the `<video>` element | **native** playback — `@apex/default-playback` |
| **Actual trailers** | adaptive **HLS** (`.m3u8`) or **DASH** (`.mpd`) | **streaming** — `@apex/shaka-playback` (MSE) |

The goal was the **lightest Apex footprint that still plays all three types on every
target Apex supports**. See [Why this is lightweight](#why-this-is-the-lightweight-build).

[Apex JS Player]: https://github.com/fandango/apex-js-player

---

## Quick start

The `@apex/*` packages live on Fandango's private Nexus registry (see `.npmrc`), so
you need network access to that host (VPN) to install.

```bash
nvm use            # Node 20+
pnpm install       # or npm install / yarn
pnpm dev           # serves http://localhost:5173
```

A splash MP4 autoplays (muted); the buttons switch between the native-MP4 splash and
the HLS / DASH trailers. All sample media is public and DRM-free — swap in your own
Vudu URLs in [`src/content.ts`](src/content.ts).

```bash
pnpm typecheck     # tsc --noEmit against the real Apex types
pnpm build         # typecheck + vite build
```

---

## The whole integration in three lines

```ts
import { ApexTrailerPlayer } from './apex-trailer-player.js';

const player = await ApexTrailerPlayer.create({ container: document.getElementById('apex-player')! });
player.playSplash('https://…/intro.mp4');                    // native MP4
player.playTrailer('https://…/trailer.m3u8');                // HLS  (kind inferred from extension)
player.playTrailer('https://…/trailer.mpd', 'dash');         // DASH (explicit kind)
```

Everything Apex-specific is contained in [`src/apex-trailer-player.ts`](src/apex-trailer-player.ts);
[`src/main.ts`](src/main.ts) is the "host application" and touches only the wrapper.

---

## Why this is the "lightweight" build

Every Apex player needs `@apex/core` + `@apex/devices` + **at least one playback
engine**. This example adds exactly **two engines and zero plugins**:

- **`@apex/default-playback`** — plays MP4 through the native `<video>` element, and
  native HLS on Safari.
- **`@apex/shaka-playback`** — the only engine that can play **DASH**, and it also
  plays **HLS** on MSE browsers (Chrome, Firefox, smart TVs).

One MSE engine (Shaka) covers **both** HLS and DASH, so we don't also ship `hls.js`.
Trailers are clear content, so there are **no DRM/license plugins** either. That's the
floor: you cannot play DASH with fewer packages, and dropping either engine drops a
content type or a platform.

```
@apex/core  +  @apex/devices  +  default-playback (MP4/native)  +  shaka-playback (DASH+HLS/MSE)
```

> **Why not `@apex/default-playback` alone?** Samsung and LG report native HLS as
> `false`, and DASH is never natively playable on any device — so a default-only build
> cannot play the trailers at all off Safari. An MSE engine is mandatory.

> **Why not add `hls.js`?** `@apex/hlsjs-playback` only adds HLS, which Shaka already
> covers. It would be a third engine for zero new capability. Reach for it only if you
> specifically want hls.js's HLS behavior over Shaka's.

---

## How engine selection works

Apex sorts engines **descending by priority** and uses the **first** whose
`canPlayType()` returns true — **first match wins, no fallback**. This example
registers `default-playback` at priority 1 and `shaka-playback` at priority 2:

| Content type (`loadContent`) | Result |
|---|---|
| `video/mp4` | Shaka declines (not HLS/DASH) → **default-playback** plays it natively |
| `application/x-mpegURL` (HLS) | **Shaka** on MSE browsers; on Safari, raise default-playback's priority above Shaka to use native HLS |
| `application/dash+xml` (DASH) | **Shaka** — default-playback declines everywhere |

To force native HLS on Safari (lightest runtime path, and required for FairPlay on
Safari), give `default-playback` the higher priority — it then wins HLS wherever the
platform reports native support and Shaka catches everything else.

---

## Gotchas this example already handles

These are the Apex-specific rules that bite integrators; the wrapper encodes each one:

- **Content type is a case-sensitive MIME string.** `video/mp4`,
  `application/x-mpegURL`, `application/dash+xml` (or `mp4` / `hls` / `dash`). A wrong
  type is reported as a `contentError`, not thrown.
- **Errors are events, not exceptions.** Subscribe to `mediaError`, `contentError`,
  `applicationError`, and `mediaRetry` **before** loading — an unsubscribed player is
  silently blind. Engine/plugin load failures also arrive on `applicationError`.
- **There is no `play()`.** Resume is `pause(false)`. Autoplay is muted
  (`forceMutedAutoplay` defaults to `true`), so unmuting needs a user gesture.
- **The container must exist and be sized before `create()`.** A missing container is
  one of the only two failures that actually throw.
- **`destroy()` is async** despite its `void` type — `await` it before building a
  replacement player on the same element, or a fast swap races teardown.
- **Time is in milliseconds** everywhere (`seek`, offsets, timeline positions).

---

## Adding DRM later (out of scope here)

Trailers are clear, so this example ships no license plugins. When you need protected
content, DRM is wired **per engine**:

- **Shaka** (DASH/HLS) goes through the license-plugin system —
  `@apex/widevine-license-plugin`, `@apex/playready-license-plugin`,
  `@apex/fairplay-license-plugin` — or per-asset `drm` on the `loadContent` object.
- **`hls.js`**, if you add it, takes DRM as **engine config**, not license plugins.

---

## Project layout

```
index.html                     host page; #apex-player container + controls
src/apex-trailer-player.ts     the reusable wrapper — all Apex code lives here
src/content.ts                 MIME mapping, URL→kind detection, sample media
src/main.ts                    demo host app (buttons, autoplay, teardown)
.npmrc                         Fandango private @apex registry
```

Verified against Apex release **v0.16.0** (`@apex/core` 0.16.0).
