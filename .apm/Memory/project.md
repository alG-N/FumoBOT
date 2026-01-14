# FumoBOT – Project Context

## Project Type
FumoBOT is a long-running Discord bot backend written in Node.js.

It is feature-rich and stateful, with:
- a persistent economy
- progression systems
- external API integrations
- a modular subcommand architecture

This is not a greenfield project.
Stability and backward compatibility matter more than refactoring.

---

## Design Philosophy
- Incremental changes over rewrites
- Preserve balance in economy and progression systems
- Prefer extending existing patterns instead of introducing new ones
- Avoid large architectural changes unless explicitly requested

---

## Core Characteristics
- Command-heavy Discord bot
- Many systems interact with the economy (coins, gems, XP)
- Uses multiple external APIs
- Features have grown organically over time

The codebase may appear complex, but most complexity is intentional.

---

## AI Usage Rules
When acting as an AI assistant:
- Always assume existing systems are in active use
- Do not remove or rewrite systems unless explicitly instructed
- Ask before changing anything that affects economy or progression
- Favor safe, minimal diffs
