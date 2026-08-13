# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub's private vulnerability reporting](../../security/advisories/new)
("Security" tab → "Report a vulnerability"). Don't open a public issue for security
problems. We'll respond as soon as we can — this is a small side project, not a staffed
product.

## Known, deliberate trade-offs

Rentgen is a hackathon proof-of-concept with **no backend**: detection adapters call
model APIs directly from the browser, so **any API keys you configure end up in the
client bundle**. This is documented, demo-scoped behavior — use rate-limited, disposable
keys and rotate them after demos. Before shipping anything real, put the adapter bodies
behind a thin server. Reports about this design itself are appreciated but already known.
