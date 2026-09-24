import type { Config } from '@netlify/functions';

export default async function handler(request: Request) {
  // Use the Netlify provided URL or fallback to the APP_ORIGIN
  const baseUrl = process.env.APP_ORIGIN || process.env.URL;
  
  if (!baseUrl) {
    console.error('Missing APP_ORIGIN or URL for cron job.');
    return new Response('Configuration error', { status: 500 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('Missing CRON_SECRET for cron job.');
    return new Response('Configuration error', { status: 500 });
  }

  try {
    const res = await fetch(`${baseUrl}/api/internal/process-outbox`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Outbox processing failed:', errorText);
      return new Response('Failed to process outbox', { status: 500 });
    }
    
    const data = await res.json();
    console.log('Outbox processed successfully:', data);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Cron fetch error:', error);
    return new Response('Network error', { status: 500 });
  }
}

export const config: Config = {
  schedule: '*/5 * * * *', // Run every 5 minutes
};
