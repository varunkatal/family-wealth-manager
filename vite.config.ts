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

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
