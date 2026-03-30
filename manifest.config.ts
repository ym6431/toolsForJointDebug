import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Frontend State Migrator',
  description:
    'Manually export non-sensitive frontend state from one page and import it into another for local debugging.',
  version: '0.1.0',
  permissions: ['storage', 'tabs', 'cookies'],
  host_permissions: ['http://*/*', 'https://*/*'],
  action: {
    default_title: 'Frontend State Migrator',
    default_popup: 'popup.html',
  },
  options_page: 'options.html',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
})
