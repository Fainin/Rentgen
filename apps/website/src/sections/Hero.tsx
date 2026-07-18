import { ItemGrid } from '../hero/ItemGrid';
import { TotalCard } from '../hero/TotalCard';
import { useScanLoop } from '../hero/useScanLoop';

const NOISE_URI =
  "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')";

export function Hero() {
  const scan = useScanLoop();

  return (
    <>
      <div className="xray-field" aria-hidden="true">
        <div className="xray-field__glow" />
        <ItemGrid litCount={scan.litCount} />
        <div className="xray-field__scrim" />
        <div
          className="scan-beam"
          style={{ top: `${(scan.progress * 100).toFixed(2)}%`, opacity: scan.beamOn ? 1 : 0 }}
        />
        <div className="grit" style={{ backgroundImage: NOISE_URI }} />
      </div>

      <header className="site-header">
        <div className="site-header__brand">
          <span className="site-header__wordmark">RENTGEN</span>
          <span className="site-header__tag">röntgen · rent-gen</span>
        </div>
        <a className="btn btn--ghost" href="#sdk">
          Try the scan
        </a>
      </header>

      <main className="hero" aria-label="Rentgen — X-ray your room">
        <TotalCard total={scan.total} rentTotal={scan.rentTotal} />

        <h1 className="hero__headline">
          X-ray your room.
          <br />
          <span className="hero__headline-sub">See the money you forgot you owned.</span>
        </h1>

        <p className="hero__body">
          Point your phone and pan across the room. Rentgen&rsquo;s AI identifies every object in view and
          prices it live against web comps — what it sells for today, and what it earns per day as a
          rental. Your clutter becomes a balance sheet.
        </p>

        <div className="hero__ctas">
          <a className="btn btn--primary" href="#sdk">
            Scan my room
          </a>
          <a className="btn btn--ghost" href="#how">
            See how it works
          </a>
        </div>

        <div className="hero__trust">
          <span>nothing stored</span>
          <span>·</span>
          <span>no account</span>
          <span>·</span>
          <span>zero backend</span>
        </div>
      </main>
    </>
  );
}
