import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/widgets.tsx',
    'src/commerce/index.ts',
    'src/lexical/index.ts',
    'src/lexical/react.tsx'
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: [
    'payload',
    'react',
    'react-dom',
    'next',
    '@payloadcms/ui',
    '@payloadcms/next',
    '@payloadcms/richtext-lexical',
    '@payloadcms/richtext-lexical/react',
    '@payloadcms/richtext-lexical/lexical'
  ]
});
