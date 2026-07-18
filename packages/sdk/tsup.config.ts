import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build — deps stay external (normal npm consumption: React, Angular, bundlers).
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
  },
  // Standalone build — everything bundled, for <script type="module"> in plain HTML.
  {
    entry: { standalone: 'src/index.ts' },
    format: ['esm'],
    dts: false,
    noExternal: [/.*/],
  },
]);
