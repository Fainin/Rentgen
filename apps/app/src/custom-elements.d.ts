/**
 * JSX typings for the SDK's custom elements (React 19 renders custom elements natively;
 * TS just needs to know the tags exist).
 */

import type * as React from 'react';

type RentgenElementProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'rentgen-scanner': RentgenElementProps;
      'rentgen-results': RentgenElementProps;
      'rentgen-upsell': RentgenElementProps;
      'rentgen-report-card': RentgenElementProps;
    }
  }
}
