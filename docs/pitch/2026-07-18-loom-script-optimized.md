# Rentgen — Optimiertes 2-Min-Loom-Skript (Videodreh)

*Optimiert gegen die offiziellen Hackathon-Regeln ({Tech: Europe} × Almedia „Summer Lock-In", Notion-Manual, abgerufen 18.07.) und das Produkt. Ersetzt den Videodreh-Entwurf. Alle Zahlen gegen `watchlist-public.json` verifiziert.*

## Was die Jury verlangt (und wie dieses Skript es abdeckt)

| Anforderung (Notion) | Abdeckung im Skript |
|---|---|
| 2-Minuten-Video (Loom o. ä.) | Hartes 2:00-Budget, durchgehende Timecodes ohne Lücken |
| „Detailed explanation of your solution" | Hook (0:00) + Kanal-Logik (1:10) + Tech (1:30) |
| „Demonstration of key features with a **live walkthrough**" | 0:20–1:30 ist **echte Screen-Aufnahme**, ungeschnitten — klar vom KI-Hook getrennt |
| Judging: **Creativity** | Clean Thesis-Hook, Reveal-Moment, Marke = These |
| Judging: **Technical complexity** | Architektur-Szene + Demand-Daten-Moat |
| Bonus: **effective use of partner technologies** | Alle DREI namentlich + sichtbar: **OpenAI** (Pflicht-Partner & Hauptpreis!), Tavily, Cognee |

**Wichtigste Korrekturen am Entwurf:**
1. **OpenAI fehlte im Voiceover** — der einzige Pflicht-Partner (und der Hauptpreis sind OpenAI-Credits) wurde nie genannt. Jetzt prominent in Szene 5.
2. **Timing-Loch geschlossen** — der Entwurf sprang von 0:45 auf 1:10. Jetzt lückenlos.
3. **Live-Walkthrough abgesichert** — die Regeln verlangen einen *live walkthrough*. Der Hook ist clean (Typo auf Schwarz, **kein KI-Video, keine AR-Effekte**) und auf 15 s gekappt; ab 0:20 ist alles erkennbar echte App.
4. **Freecash-Cameo gestrichen** — das Freecash-Screenshot-Overlay (Szene 1.2) verwirrt: Es zeigt eine fremde App, bevor unsere eigene etabliert ist. (Almedia-Wink optional als 1-Sekunden-Easter-Egg im Abspann, nicht im Hook.)
5. **Eine Sprache, ein Claim** — durchgehend Englisch (internationale Jury), Grammatik gefixt („what it worths" → „see what it's worth"). Der Entwurf hatte drei verschiedene Taglines; jetzt eine.
6. **Zahlen verifiziert** — G7X: **404** unbediente Anfragen in **exakt 15 Städten** ✓. Soundboks: 49 Anfragen in 5 Städten ✓. Totalwert `$3,472` ist Platzhalter → **durch echten Wert aus dem Probelauf ersetzen** (Zahlen-Gate).

---

## Das Skript (hart 2:00)

**Tagline überall identisch:** *Rentgen — X-ray your room. See what it's worth.*

### 0:00–0:15 — Hook „The Invisible Warehouse" [Clean — Text + VO auf Schwarz]

**Bild:** Schwarz. Weiße These fade-in, Zeile für Zeile — **kein Röntgen-Wipe, kein Neon-Mesh,
kein generierter Film**, straight typography on black. Drei Zeilen:
> *Amazon knows every product in its warehouse.*
> *Nobody knows the products in their own room.*
> **Rentgen makes it visible.**

**VO (EN):**
> "Amazon knows every product in its warehouse. But nobody knows the products in their own
> room. Millions of items sit idle in apartments — real value, completely invisible. Rentgen
> makes it visible."

*Regie: Bewusst clean und unstilisiert — kein Higgsfield-/KI-Hook, keine AR-Effekte, keine
„glitchenden Boxen". Der Kontrast zur echten App ab 0:20 wird dadurch schärfer, nicht schwächer.
Endet hart bei 0:15.*

### 0:15–0:20 — Logo-Card

**Bild:** Rentgen-Logo (Prompt unten), darunter Tagline-Einblendung:
> **Rentgen — X-ray your room. See what it's worth.**

### 0:20–0:45 — Live-Scan [ECHTE Screen-Aufnahme, ungeschnitten]

**Bild:** Handy in der Hand (Over-Shoulder oder Mirror), sichtbar echte UI: 1. Startscreen → 2. Button „Scan my Room" → 3. Kamera offen, läuft langsam durchs Zimmer. Erkannte Items erscheinen live als **Karten** im Inventar — **kein Box-Overlay** auf dem Feed:
Canon G7X · Soundboks · LG UltraWide · PlayStation-Controller.

**VO:**
> "This is the live app — one scan is all it takes. Rentgen watches the camera feed, recognizes every item in the room, and builds your digital inventory automatically. No forms, no typing."

*Regie: Bewusst hand-held und ungeschnitten — der Kontrast zum stilisierten Hook beweist „das ist echt". Hero-Items vorher gut sichtbar platzieren (Licht checken!).*

### 0:45–1:10 — Der Rentgen-Reveal [Screen-Aufnahme]

**Bild:** Scan endet → die Gesamtzahl rollt hoch: **Total value: $X,XXX** *(echter Wert aus
Probelauf!)*. Darunter die Item-Cards (Foto, Preis, Demand-Badge) — **keine Röntgen-/X-Ray-Animation,
kein „Durchleuchten"**; die Zahl und die Karten sind der Reveal. Dann Fokus auf eine Card:

> **Canon G7X Mark II** — Estimated value: $420 · **Demand: 404 unmet requests across 15 cities** · Recommendation: SELL

**VO:**
> "Then comes the moment nobody expects: what is your room actually worth? This Canon alone — 404 unmet rental requests across 15 German cities. That's real demand data from a live rental marketplace. Nobody can fake that number."

### 1:10–1:30 — Sell or Rent [Screen-Aufnahme]

**Bild:** Zwei Buttons: **SELL** / **RENT**. Animation:
Kamera → one-off **$420** · Soundboks → **$45/month**.

**VO:**
> "For every item, Rentgen recommends the best channel: sell the camera once for 420 dollars — or rent out the Soundboks for 45 a month. The recommendation isn't an AI guess. It's grounded in real market data."

### 1:30–1:50 — Die Tech [Architektur-Diagramm, kurz Code/Repo]

**Bild:** Diagramm: `Video Scan → OpenAI GPT-5.6 Luna → Tavily Search → Market Price → Cognee Memory → Personal Inventory`. Kurzer Schwenk über Repo/Code.

**VO:**
> "Under the hood, three AI systems work together: OpenAI's GPT-5.6 Luna recognizes the objects with structured outputs. Tavily grounds every price in live used-market listings. And Cognee remembers your inventory — scan again, and it knows what you've already listed."

*Regie: Alle drei Partner-Logos einblenden — das ist der „bonus points"-Moment. OpenAI zuerst.*

### 1:50–2:00 — Plugin-Close + Final Screen

**Bild:** Adapter-Switch auf zweiten Marktplatz (1–2 s), dann Final-Card: Logo + Tagline + GitHub-Repo-URL.

**VO:**
> "And Rentgen isn't a marketplace — it's a plugin any marketplace can embed. Rentgen: X-ray your room. See what it's worth."

---

## Logo-Prompt (unverändert gut)

> A minimalist tech logo for an app named 'Rentgen'. The icon shows a stylized letter 'R' combined with a sleek camera viewfinder bracket. One half of the 'R' transforms into a glowing neon-cyan X-ray mesh grid. Dark obsidian background, vector, clean lines, professional fintech aesthetic, high trust. --no shading --v 6.0

## Vor dem Aufnehmen (Gates)

- [ ] **Zahlen-Gate:** `$X,XXX` durch echten Reveal-Wert aus dem Probelauf ersetzen. Nur Zahlen aus `watchlist-public.json` behaupten (G7X 404/15 ✓, Soundboks 49/5 ✓).
- [ ] Hero-Items platziert: G7X (stärkstes Badge), Soundboks, Monitor, Controller — Licht checken.
- [ ] Screen-Recording über HTTPS/Vercel am Handy testen (Kamera braucht HTTPS).
- [ ] **2:00 hart** — Stoppuhr-Dry-Run; Loom-Limit.
- [ ] Fallback-Clip: kompletter Flow vorab aufgenommen („That's this morning's run, uncut").
- [ ] Hook-Typo gerendert (Schwarz + weiße Zeilen, kein KI-Video, keine AR-Effekte), BEVOR 17:00-Feature-Freeze.
- [ ] Upload + Submission-Form (https://tally.so/r/XxvlZY) **deutlich vor 19:00**.

## Fallback-Zeilen

- **Scan hängt:** "This wait *is* the entire effort — after this, there's no form to fill."
- **WLAN tot:** vorproduzierten Clip zeigen: "That's this morning's run, uncut."
