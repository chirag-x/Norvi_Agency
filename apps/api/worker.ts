import { Hono } from 'hono';
import { createLiveApp, type LiveEnv } from './live';
type Env = LiveEnv & { ASSETS: { fetch: (request: Request) => Promise<Response> } };
const app = new Hono<{ Bindings: Env }>();
app.use('*', async (c, next) => { c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'no-referrer'); c.header('X-Frame-Options', 'DENY'); await next(); });
// Never import the synthetic preview server here.
app.route('/', createLiveApp());
app.get('*', c => c.env.ASSETS.fetch(c.req.raw));
export default app;
