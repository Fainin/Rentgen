import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { Trust } from './sections/Trust';
import { SdkPitch } from './sections/SdkPitch';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';

export function App() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Trust />
      <SdkPitch />
      <FinalCta />
      <Footer />
    </>
  );
}
