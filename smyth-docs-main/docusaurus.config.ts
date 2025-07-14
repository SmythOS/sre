require('dotenv').config();
const webpack = require('webpack');
import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';

const tailwindPostcss = require('@tailwindcss/postcss');
// const timestamp = Math.floor(Date.now() / 1000);

async function tailwindPlugin() {
  return {
    name: 'tailwindcss-loader',
    configurePostCss(postcssOptions) {
      postcssOptions.plugins.push(
        tailwindPostcss({
          config: './tailwind.config.js',
        })
      );
      postcssOptions.plugins.push(require('autoprefixer'));
      return postcssOptions;
    },
  };
}

const config: Config = {
  title: 'SmythOS Documentation',
  tagline: 'Build, deploy, and scale open-source AI agents',
  favicon: 'https://smythos.com/favicon.ico',

  // Base configuration
  url: 'https://smythos.com',
  baseUrl: '/docs/',

  organizationName: 'SmythOS',
  projectName: 'smythos-docs',

  trailingSlash: true,

  customFields: {
    // Make env vars available in components
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    supportFormUrl: 'https://smythos.com/talk-to-us/',
    supportEmail: 'support@smythos.com',
    supportDiscordUrl: 'https://discord.gg/smythos',
  },

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.ts'),
          editUrl: ({ versionDocsDirPath, docPath }) =>
            `https://github.com/SmythOS/smyth-docs/edit/main/${versionDocsDirPath}/${docPath}`,
          includeCurrentVersion: true,
        },
        blog: false,
        pages: {
          path: 'src/pages',
          routeBasePath: '/',
          include: ['**/*.{js,jsx,ts,tsx,md,mdx}'],
          exclude: [
            '**/_*.{js,jsx,ts,tsx,md,mdx}',
            '**/_*/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/__tests__/**',
            '**/index.{js,jsx,ts,tsx,md,mdx}',
          ],
          mdxPageComponent: '@theme/MDXPage',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          filename: 'sitemap.xml',
        },
      },
    ],
  ],

  themes: [
    // [
    //   require.resolve("@easyops-cn/docusaurus-search-local"),
    //   /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
    //   ({
        
    //     hashed: false,
    //     language: ["en"],
    //     indexBlog: false,
    //     indexDocs: true,
    //     docsRouteBasePath: "/",
    //   }),
    // ],
  ],

  plugins: [
    tailwindPlugin,
  ],

  clientModules: [require.resolve('./src/css/tailwind.css'),
    require.resolve('./src/components/DocsHelpPopup.tsx'),
  ],

  // stylesheets: [
  //   { 
  //     href: `https://smythos.com/wp-content/themes/generatepress_child/css/docs.css?ver=${timestamp}`, 
  //     type: 'text/css' 
  //   },
  // ],
  
  // scripts: [
  //   { 
  //     src: `https://smythos.com/wp-content/themes/generatepress_child/js/docs.js?ver=${timestamp}`, 
  //     async: false 
  //   },
  // ],
  
  stylesheets: [
    {
      href: 'https://smythos.com/wp-content/themes/generatepress_child/css/docs.css',
      type: 'text/css',
    },
  ],
  scripts: [
    {
      src: 'https://smythos.com/wp-content/themes/generatepress_child/js/docs.js',
      async: false,
    },
  ],
  

  themeConfig: {
    sidebar: {},
      algolia: {
        appId: process.env.ALGOLIA_APP_ID,
        apiKey: process.env.ALGOLIA_API_KEY,
        indexName: process.env.ALGOLIA_INDEX_NAME,
        contextualSearch: true, 
        // searchPagePath: 'search',
        searchParameters: {
          clickAnalytics: true,
          hitsPerPage: 12,
          analyticsTags: ['docs-prod']
        },
        insights: true     
      },
      metadata: [
        {
          name: 'robots',
          content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
        },
      ],
    // navbar: {
    //   title: 'SmythOS',
    //   logo: {
    //     alt: 'SmythOS Logo',
    //     src: 'img/smythos-500px.png',
    //   },
    //   items: [
    //     // { to: '/docs', label: 'Docs Home', position: 'left' },
    //     { to: '/docs/agent-studio/overview', label: 'Studio', position: 'left' },
    //     { to: '/docs/agent-weaver/overview', label: 'Weaver', position: 'left' },
    //     { to: '/docs/agent-runtime/overview', label: 'Runtime', position: 'left' },
    //     { to: '/docs/agent-deployments/overview', label: 'Deployments', position: 'left' },
    //     { to: '/docs/agent-collaboration/overview', label: 'Collaboration', position: 'left' },
    //     { to: '/docs/agent-templates/overview', label: 'Templates', position: 'left' },
    //     { href: 'https://github.com/Smyth-ai', label: 'GitHub', position: 'right' },
    //   ],
    // },
    // prism: {
    //   theme: prismThemes.github,
    //   darkTheme: prismThemes.dracula,
    // },
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'throw',
    onBrokenAnchors: 'ignore',
    redirects: [
      // Root redirects
      {
        from: '/',
        to: '/agent-studio/overview',
      },
      // Agent Studio redirects
      {
        from: '/docs/agent-studio/agent-settings/logs',
        to: '/docs/agent-studio/build-agents/debugging',
      },
      {
        from: '/docs/agent-studio/manage-agents/authentication',
        to: '/docs/agent-studio/key-concepts/vault',
      },
      {
        from: '/docs/agent-studio/manage-agents/tasks',
        to: '/docs/agent-studio/build-agents/building-workflows',
      },
      {
        from: '/docs/agent-studio/agent-settings/overview',
        to: '/docs/agent-studio/overview',
      },
      {
        from: '/docs/agent-studio/building-agents/overview',
        to: '/docs/agent-studio/build-agents/overview',
      },
      {
        from: '/docs/agent-studio/building-agents/building-workflows',
        to: '/docs/agent-studio/build-agents/building-workflows',
      },
      // Agent Collaboration redirects
      {
        from: '/docs/agent-collaboration/working-with-agents/vault',
        to: '/docs/agent-studio/key-concepts/vault',
      },
      {
        from: '/docs/agent-collaboration/agent-work-schedules',
        to: '/docs/agent-studio/build-agents/building-workflows',
      },
      // Integration redirects - ensure consistent paths
      {
        from: '/docs/agent-studio/integrations/email',
        to: '/docs/agent-studio/integrations/email-integration',
      },
      {
        from: '/docs/agent-studio/integrations/microsoft-teams',
        to: '/docs/agent-studio/integrations/microsoft-teams-integration',
      },
      {
        from: '/docs/agent-studio/integrations/discord-integration',
        to: '/docs/agent-studio/integrations/discord-integration',
      },
      {
        from: '/docs/agent-studio/integrations/slack-integration',
        to: '/docs/agent-studio/integrations/slack-integration',
      },
      {
        from: '/docs/agent-studio/integrations/notion-integration',
        to: '/docs/agent-studio/integrations/notion-integration',
      },
      {
        from: '/docs/agent-studio/integrations/google-calendar',
        to: '/docs/agent-studio/integrations/google-calendar-integration',
      },
      {
        from: '/docs/agent-studio/integrations/microsoft-calendar-integration',
        to: '/docs/agent-studio/integrations/microsoft-calendar-integration',
      },
      {
        from: '/docs/agent-studio/integrations/stripe',
        to: '/docs/agent-studio/integrations/stripe-integration',
      },
      {
        from: '/docs/agent-studio/integrations/shopify-integration',
        to: '/docs/agent-studio/integrations/shopify-integration',
      },
      {
        from: '/docs/agent-studio/integrations/hubspot-integration',
        to: '/docs/agent-studio/integrations/hubspot-integration',
      },
      {
        from: '/docs/agent-studio/integrations/mailchimp-integration',
        to: '/docs/agent-studio/integrations/mailchimp-integration',
      },
      {
        from: '/docs/agent-studio/integrations/klaviyo-integration',
        to: '/docs/agent-studio/integrations/klaviyo-integration',
      },
      {
        from: '/docs/agent-studio/integrations/twilio-integration',
        to: '/docs/agent-studio/integrations/twilio-integration',
      },
      {
        from: '/docs/agent-studio/integrations/sendgrid-integration',
        to: '/docs/agent-studio/integrations/sendgrid-integration',
      },
      {
        from: '/docs/agent-studio/integrations/webflow-integration',
        to: '/docs/agent-studio/integrations/webflow-integration',
      },
      {
        from: '/docs/agent-studio/integrations/wordpress-org-integration',
        to: '/docs/agent-studio/integrations/wordpress-org-integration',
      },
      {
        from: '/docs/agent-studio/integrations/wordpress-com',
        to: '/docs/agent-studio/integrations/wordpress-com-integration',
      },
      {
        from: '/docs/agent-studio/integrations/squarespace-integration',
        to: '/docs/agent-studio/integrations/squarespace-integration',
      },
      {
        from: '/docs/agent-studio/integrations/devto-integration',
        to: '/docs/agent-studio/integrations/devto-integration',
      },
      {
        from: '/docs/agent-studio/integrations/youtube',
        to: '/docs/agent-studio/integrations/youtube-integration',
      },
      {
        from: '/docs/agent-studio/integrations/falai-integration',
        to: '/docs/agent-studio/integrations/falai-integration',
      },
      {
        from: '/docs/agent-studio/integrations/dataforseo-integration',
        to: '/docs/agent-studio/integrations/dataforseo-integration',
      },
      {
        from: '/docs/agent-studio/integrations/tavily-integration',
        to: '/docs/agent-studio/integrations/tavily-integration',
      },
      {
        from: '/docs/agent-studio/integrations/perplexity-ai-integration',
        to: '/docs/agent-studio/integrations/perplexity-ai-integration',
      },
      {
        from: '/docs/agent-studio/integrations/playht-integration',
        to: '/docs/agent-studio/integrations/playht-integration',
      },
      {
        from: '/docs/agent-studio/integrations/stability-ai-integration',
        to: '/docs/agent-studio/integrations/stability-ai-integration',
      },
      {
        from: '/docs/agent-studio/integrations/google-translate',
        to: '/docs/agent-studio/integrations/google-translate-integration',
      },
      {
        from: '/docs/agent-studio/integrations/newsapi-integration',
        to: '/docs/agent-studio/integrations/newsapi-integration',
      },
      {
        from: '/docs/agent-studio/integrations/openapi-integration',
        to: '/docs/agent-studio/integrations/openapi-integration',
      },
      {
        from: '/docs/agent-studio/integrations/google-analytics-integration',
        to: '/docs/agent-studio/integrations/google-analytics-integration-integration',
      },
      {
        from: '/docs/agent-studio/integrations/pdfcrowd-integration',
        to: '/docs/agent-studio/integrations/pdfcrowd-integration',
      },
      {
        from: '/docs/agent-studio/integrations/signnow-integration',
        to: '/docs/agent-studio/integrations/signnow-integration',
      },
      {
        from: '/docs/agent-studio/integrations/tldv-integration',
        to: '/docs/agent-studio/integrations/tldv-integration',
      },
      {
        from: '/docs/agent-studio/integrations/trello-integration',
        to: '/docs/agent-studio/integrations/trello-integration',
      },
      {
        from: '/docs/agent-studio/integrations/elevenlabs-integrationns/elevenlabs-integration',
        to: '/docs/agent-studio/integrations/elevenlabs-integration',
      },
      {
        from: '/docs/agent-studio/integrations/elevenlabs-integrationns/elevenlabs-integration',
        to: '/docs/agent-studio/integrations/elevenlabs-integration',
      },
      // Account management redirects
      {
        from: '/docs/account-management/prganization-management',
        to: '/docs/account-management/organization-management',
      },
      // Agent deployment redirects
      {
        from: '/docs/agent-deployments/overview',
        to: '/docs/agent-deployments/overview',
      },
      {
        from: '/docs/agent-deployments/subdomains',
        to: '/docs/agent-deployments/deployments/subdomains',
      },
      {
        from: '/docs/agent-deployments/quickstart',
        to: '/docs/agent-deployments/quickstart',
      },
      // Agent runtime redirects
      {
        from: '/docs/agent-runtime//quickstart',
        to: '/docs/agent-runtime/quickstart',
      },
    ],
  },
};

export default config;

