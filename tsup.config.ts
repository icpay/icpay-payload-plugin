import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/widgets.tsx', 'src/commerce/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['payload', 'react', 'react-dom']
});
