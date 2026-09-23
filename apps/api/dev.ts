import { loadEnvFile } from 'node:process';
import { createLiveApp } from './live';
try { loadEnvFile('.env.local'); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
import { serve } from '@hono/node-server';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createApp, type Repository } from './app';
import { seed, type Store } from '../../packages/shared/model';
import { secret } from './crypto';
import { writeCatalog, syncCatalog } from '../../scripts/catalog';
await syncCatalog();
await mkdir('.local', { recursive: true });
let key: string; try { key = await readFile('.local/key', 'utf8'); } catch { key = secret(); await writeFile('.local/key', key, { mode: 0o600 }); }
let queue = Promise.resolve();
async function read(): Promise<Store> { try { return JSON.parse(await readFile('.local/preview.json', 'utf8')); } catch (e: any) { if (e.code !== 'ENOENT') throw e; return seed(); } }
const repo: Repository = { read, change: fn => { const job = queue.then(async () => { const data = await read(); const result = await fn(data); await writeFile('.local/preview.tmp', JSON.stringify(data, null, 2)); await rename('.local/preview.tmp', '.local/preview.json'); await writeCatalog(data); return result; }); queue = job.then(() => { }, () => { }); return job; } };
const accountMode = process.env.NORVI_MODE === 'supabase';
if (process.env.NORVI_MODE && !['preview', 'supabase'].includes(process.env.NORVI_MODE)) throw Error('NORVI_MODE must be preview or supabase.');
const app = accountMode ? createLiveApp() : createApp(repo, key, { preview: true });
serve({ fetch: request => app.fetch(request, process.env), hostname: '127.0.0.1', port: 4322 }, () => console.log('NORVI API: http://127.0.0.1:4322 (' + (accountMode ? 'Supabase account mode' : 'synthetic preview mode') + ')'));
