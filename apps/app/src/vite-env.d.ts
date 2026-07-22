/// <reference types="vite/client" />

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// Teach JSX about the two custom elements so <rentgen-scanner /> / <rentgen-results />
// type-check in React. (React 19 renders unknown elements natively at runtime.)
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'rentgen-scanner': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      'rentgen-results': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by Vite `define` (see vite.config.ts) — a unique id per build, used to
// version the service worker URL so new deploys are detected and installed fast.
declare global {
  const __BUILD_ID__: string;
}
