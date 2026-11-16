// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://f-banda.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
