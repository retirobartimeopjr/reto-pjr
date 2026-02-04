// @ts-check
import path from 'node:path'

import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

import node from '@astrojs/node'
import react from '@astrojs/react'

// https://astro.build/config
export default defineConfig({
  site: 'https://retirobartimeo.org',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin')
    }),
    react()
  ],
  output: 'server',
  vite: {
    plugins: [],
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
    server: {
      allowedHosts: ['retirobartimeo.org'],
    },
  },
  server: {
    port: 3000
  }
})