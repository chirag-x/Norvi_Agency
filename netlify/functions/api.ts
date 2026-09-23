import type { Config } from '@netlify/functions';
import { createLiveApp } from '../../apps/api/live';

// Always use real accounts, regardless of local NORVI_MODE. Never import preview data.
const app = createLiveApp(undefined, { upstreamRateLimit: 'netlify' });

export default async function handler(request: Request): Promise<Response> {
  return app.fetch(request, {
    APP_ORIGIN: process.env.APP_ORIGIN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  });
}

// Custom paths disable the default /.netlify/functions/api URL. All API requests,
// including auth mutations, share this platform-enforced per-IP/domain limit.
// Verify its acceptance in the deployment's post-processing log before launch.
export const config: Config = {
  path: '/api/*',
  preferStatic: false,
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
