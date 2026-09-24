import type { Config } from '@netlify/functions';
import { createLiveApp } from '../../apps/api/live';

// Always use real accounts, regardless of local NORVI_MODE. Never import preview data.
const app = createLiveApp(undefined, { upstreamRateLimit: 'netlify' });

export default async function handler(request: Request): Promise<Response> {
  return app.fetch(request, {
    APP_ORIGIN: process.env.APP_ORIGIN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    GITHUB_PAT: process.env.GITHUB_PAT,
    GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
    GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
  });
}

// Custom paths disable the default /.netlify/functions/api URL. All API requests,
// including auth mutations, share this platform-enforced per-IP/domain limit.
// Verify its acceptance in the deployment's post-processing log before launch.
export const config: Config = {
  path: '/api/*',
  preferStatic: false,
};
