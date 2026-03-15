import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Sentinel Docs',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/sentinel-visual/sentinel' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/' },
            { label: 'Installation', link: '/guides/installation/' },
            { label: 'Configuration', link: '/guides/configuration/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Plugin Authoring', link: '/guides/plugin-authoring/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'REST API', link: '/reference/api/' },
            { label: 'CLI Commands', link: '/reference/cli/' },
            { label: 'Config File', link: '/reference/config/' },
          ],
        },
      ],
    }),
  ],
});
