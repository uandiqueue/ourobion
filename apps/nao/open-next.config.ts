// ourobion nao — @opennextjs/cloudflare build config (default).
// Drives the OpenNext build that emits .open-next/worker.js (see wrangler.jsonc `main`).
// Left at defaults for v1; override here only when caching/queue overrides are needed.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
