import { defineConfig } from 'vite';

// Nothing special is required to bundle Apex — it ships as standard ESM.
// This config exists only so `pnpm dev` serves index.html on a fixed port.
export default defineConfig({
  server: { port: 5173, open: true },
});
