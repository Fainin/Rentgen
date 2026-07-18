import { useState } from 'react';
import { XrayReveal } from '../hero/XrayReveal';
import { RoomIllustration } from '../hero/RoomIllustration';
import { ItemMarker } from '../hero/ItemMarker';
import { MoneyCounter } from '../hero/MoneyCounter';
import { useAutoSweep } from '../hero/useAutoSweep';
import { REVEAL_ITEMS } from '../hero/items';

export function Hero() {
  const [reveal, setReveal] = useState(0);
  useAutoSweep(setReveal);

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
        <MoneyCounter reveal={reveal} />
        <XrayReveal
          reveal={reveal}
          onRevealChange={setReveal}
          beforeContent={<RoomIllustration variant="before" />}
          afterContent={
            <>
              <RoomIllustration variant="after" />
              {REVEAL_ITEMS.map((item) => (
                <ItemMarker key={item.id} item={item} revealed={reveal >= item.x} />
              ))}
            </>
          }
        />
      </div>
    </section>
  );
}
