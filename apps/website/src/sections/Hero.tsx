import { useState } from 'react';
import { XrayReveal } from '../hero/XrayReveal';

export function Hero() {
  const [reveal, setReveal] = useState(0);

  return (
    <section className="hero" aria-label="Rentgen interactive demo">
      <div className="hero__copy">
        <h1 className="hero__headline">Your room is worth more than you think.</h1>
        <p className="hero__subhead">Drag the line. Watch dead capital turn into cash.</p>
        <a className="hero__cta" href="#sdk">
          Try the scan
        </a>
      </div>
      <div className="hero__stage">
        <XrayReveal
          reveal={reveal}
          onRevealChange={setReveal}
          beforeContent={<div className="hero__layer-fill hero__layer-fill--before" />}
          afterContent={<div className="hero__layer-fill hero__layer-fill--after" />}
        />
      </div>
    </section>
  );
}
