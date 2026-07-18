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
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_TAVILY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
