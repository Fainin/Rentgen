const SNIPPET = `import { configureRentgen } from '@rentgen/sdk';

configureRentgen({
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  tavilyApiKey: import.meta.env.VITE_TAVILY_API_KEY,
});

// mount anywhere — React, Angular, or plain HTML
<rentgen-scanner></rentgen-scanner>
<rentgen-results></rentgen-results>`;

export function SdkPitch() {
  return (
    <section className="section sdk-pitch" id="sdk" aria-labelledby="sdk-heading">
      <h2 id="sdk-heading">Built as an SDK, not a silo.</h2>
      <p>
        Rentgen drops into any platform as web components — React, Angular, or plain HTML, unchanged. Give
        dead listings a second life: identify, price, and let users cash in, right inside your product.
      </p>
      <pre className="sdk-pitch__snippet">
        <code>{SNIPPET}</code>
      </pre>
    </section>
  );
}
