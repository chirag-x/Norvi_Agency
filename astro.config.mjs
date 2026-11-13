import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nor-vi.in',
  srcDir: './apps/web/src', 
  publicDir: './apps/web/public', 
  output: 'static',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const privatePrefixes = [
          '/account',
          '/admin',
          '/checkout',
          '/orders',
          '/login',
          '/register',
          '/reset-password',
          '/update-password',
          '/verify-email',
          '/auth',
          '/onboarding'
        ];
        return !privatePrefixes.some(prefix => page.includes(prefix));
      }
    })
  ],
  devToolbar: { enabled: false },
  vite: { server: { strictPort: true, proxy: { '/api': 'http://127.0.0.1:4322' } } },
});
