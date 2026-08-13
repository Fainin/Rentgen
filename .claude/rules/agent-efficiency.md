Subagent efficiency conventions — how to spawn and run work inside subagents so they stay fast and cheap. Adapted for Rentgen (npm workspaces + tsup + Vite; Windows/PowerShell default shell).

- **Model routing — set `model` explicitly on every spawned agent; never let it inherit the session model.** A subagent with no `model` inherits the orchestrator's model, which is overpowered for exploration and burns latency/cost on reasoning the task doesn't need. Tier by what the agent's output *feeds*:
  - **Haiku** — locate/enumerate only: "where is X", "list files matching", "find all callers", grep-style sweeps. Pure retrieval, nothing to reason away.
  - **Sonnet** — trace-and-explain that feeds a plan or an edit: "how does this flow across files", "report the signatures / return shapes / event names so I can change it". A cheap-but-90%-right map silently propagates into the plan and the code, so pay for accuracy here.
  - **Top tier (Opus)** — never for exploration. Reserve it for judgment: hard review, design trade-offs, gnarly multi-file implementation, adversarial verification.
  - Pass it: Agent tool `model: 'haiku' | 'sonnet' | 'opus'`; workflow `agent(prompt, { model })`. Prefer low reasoning effort for the mechanical stages and reserve higher effort for the judgment stages.

- **Search with the Grep / Glob tools, not shell `grep -r` / `find`.** The Grep tool is ripgrep — fast, gitignore-aware, and **shell-independent: it works identically under PowerShell and Bash**. Raw shell search is **not portable**: on Windows the PowerShell tool has no `rg`/`grep` installed and `find` resolves to Windows `find.exe` (incompatible flags); even in the Bash tool an unbounded `grep -r` is slow, and worse over cloud-synced trees.

- **Don't force cold rebuilds to get clean output.** For verification prefer the cheapest signal that answers the question: `npm run typecheck` (`tsc --noEmit`) over a full `npm run build`, and never `rm -rf node_modules` / reinstall inside an agent unless dependency resolution is genuinely broken (e.g. the npm platform-optionals bug, npm/cli#4828). Cold installs and full builds cost tens of seconds to minutes each; the incremental path is correct the overwhelming majority of the time.

When a task genuinely needs a shell (running a build, a one-off script), that's fine — this rule is specifically about **searching code**, which should always go through the Grep/Glob tools.
