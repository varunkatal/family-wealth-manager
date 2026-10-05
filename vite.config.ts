import { loadEnv } from 'vite';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Content Security Policy for the built app: code only from this site (plus the one inline
 * theme script, by hash) and Google's sign-in library; network requests only to this site and
 * Google's Drive/Sheets APIs. Not applied to `npm run dev`, which needs inline scripts.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const sha256 = async (code: string) =>
          btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)))));
        const hashes = await Promise.all([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(async ([, code]) => `'sha256-${await sha256(code!)}'`));
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')} https://accounts.google.com/gsi/client`,
          "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
          "connect-src 'self' https://www.googleapis.com https://sheets.googleapis.com https://accounts.google.com/gsi/",
          'frame-src https://accounts.google.com/gsi/',
          "img-src 'self' data:",
          "font-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  };
}

/**
 * GitHub Pages has no "serve index.html for every page" setting, but it serves 404.html for unknown
 * paths. A copy of the app's page there makes links like /family work on refresh.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (index?.type === 'asset') this.emitFile({ type: 'asset', fileName: '404.html', source: index.source });
    },
  };
}

export default defineConfig(({ mode }) => ({
  // The site's path: '/' normally, '/<repo-name>/' on GitHub Pages (set BASE_PATH when building).
  base: loadEnv(mode, '.', '').BASE_PATH || '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), spaFallback()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}));
