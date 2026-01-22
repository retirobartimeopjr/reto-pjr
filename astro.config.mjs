// @ts-check
import path from 'node:path'

import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

import react from '@astrojs/react'
import vercel from '@astrojs/vercel'

// https://astro.build/config
export default defineConfig({
  site: 'https://pjr-app-data.online',
  adapter: vercel(),
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
      allowedHosts: ['pjr-app-data.online'],
    },
  },
  server: {
    port: 3000
  }
})