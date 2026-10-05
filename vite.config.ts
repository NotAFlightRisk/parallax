import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const plausible = process.env.PUBLIC_PLAUSIBLE_SCRIPT ?? '';
const pulse = plausible ? [new URL(plausible).origin as `${string}.${string}`] : [];

export default defineConfig({
  define: { 'import.meta.env.PUBLIC_PLAUSIBLE_SCRIPT': JSON.stringify(plausible) },
  plugins: [
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true
      },
      adapter: adapter({ fallback: '404.html' }),
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self', ...pulse],
          'connect-src': ['self', ...pulse],
          'img-src': ['self', 'data:'],
          'style-src': ['self', 'unsafe-inline'],
          'font-src': ['self'],
          'worker-src': ['self', 'blob:'],
          'base-uri': ['none'],
          'form-action': ['none'],
          'frame-ancestors': ['none']
        }
      }
    })
  ],
  test: {
    include: ['tests/**/*.test.ts']
  }
});
