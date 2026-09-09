// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Canonical origin. Astro needs it to resolve `Astro.site` into the absolute
  // URLs that Open Graph and `<link rel="canonical">` require — a share card
  // with a relative image is a share card with no image.
  site: 'https://kiseki-no-oto.com',
  integrations: [react()],
  adapter: cloudflare()
});