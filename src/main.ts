/**
 * Demo wiring. Builds one ApexTrailerPlayer and plays a splash MP4 on load,
 * with buttons to switch between the native-MP4 splash and the HLS/DASH trailers.
 *
 * This file is the "host application" — in a real integration it is your app's
 * component. Everything Apex-specific lives in ApexTrailerPlayer.
 */

import { ApexTrailerPlayer } from './apex-trailer-player.js';
import { SAMPLES } from './content.js';

const container = document.getElementById('apex-player');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const muteBtn = document.getElementById('mute') as HTMLButtonElement | null;

if (!container || !controls || !status || !muteBtn) {
  throw new Error('Demo markup is missing required elements');
}

function setStatus(text: string): void {
  status!.textContent = text;
}

async function main(): Promise<void> {
  setStatus('Initialising player…');

  const player = await ApexTrailerPlayer.create({
    container: container!,
    useNativeControls: true,
    onError: (message) => setStatus(`⚠️ ${message}`),
  });

  // One button per sample. Splash is native MP4; the others are HLS / DASH.
  for (const sample of SAMPLES) {
    const btn = document.createElement('button');
    btn.textContent = sample.label;
    btn.addEventListener('click', () => {
      setStatus(`Loading: ${sample.label} — ${sample.url}`);
      if (sample.kind === 'mp4') player.playSplash(sample.url);
      else player.playTrailer(sample.url, sample.kind);
    });
    controls!.appendChild(btn);
  }

  muteBtn!.addEventListener('click', () => {
    const next = !player.isMuted();
    player.setMuted(next);
    muteBtn!.textContent = next ? 'Unmute' : 'Mute';
  });

  // Autoplay the splash trailer on load (muted, so browsers allow it).
  const splash = SAMPLES.find((s) => s.kind === 'mp4');
  if (splash) {
    setStatus(`Playing splash: ${splash.label}`);
    player.playSplash(splash.url);
  } else {
    setStatus('Ready — pick a trailer.');
  }

  // Clean teardown if the page is torn down (SPA route change, etc.).
  window.addEventListener('pagehide', () => void player.destroy(), { once: true });
}

void main();
