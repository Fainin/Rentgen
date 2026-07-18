interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: 'Scan your room',
    description: "Point your phone at your things. That's it — no forms, no listing text to write.",
  },
  {
    title: 'We identify each item',
    description: "Vision AI recognizes what you’re looking at, item by item, in real time.",
  },
  {
    title: 'See resale + rent/day, instantly',
    description: 'Prices are grounded in live web comps, not guesses — so the number on screen is real.',
  },
];

export function HowItWorks() {
  return (
    <section className="section how-it-works" aria-labelledby="how-it-works-heading">
      <h2 id="how-it-works-heading">Scan. Identify. Price.</h2>
      <ol className="how-it-works__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="how-it-works__step">
            <span className="how-it-works__step-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

