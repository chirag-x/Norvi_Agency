import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
export default defineConfig({
  srcDir: './apps/web/src', publicDir: './apps/web/public', output: 'static',
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: { server: { strictPort: true, proxy: { '/api': 'http://127.0.0.1:4322' } } },
});
