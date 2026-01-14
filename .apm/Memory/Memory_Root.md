# FumoBOT – Persistent Memory

## Update Log
- 2026-01: Expanded SubCommand architecture
- 2026-01: Added leveling and rebirth systems
- 2026-01: Added Administrator command domain
- 2026-01: Integrated multiple external APIs (nhentai, Google, Wikipedia, MyAnimeList)

---

## Command Architecture

- Commands are organized under `SubCommand/`
- Each major feature group is implemented as a subcommand domain
- `SubCommand/index.js` acts as a dispatcher / entry point

## Code Review Constraints

- FumoBOT is a long-running production Discord bot
- Many systems (economy, leveling, rebirth, gacha, admin) are intentionally complex
- AI reviewers must:
  - Detect bugs, race conditions, edge cases
  - Explain why something may be a bug
  - NOT refactor or rebalance systems
  - NOT change logic unless explicitly instructed

### Example Structure
SubCommand/
├─ Administrator/
│ ├─ Commands/
│ ├─ Config/
│ ├─ Database/
│ └─ Service/
└─ index.js


This structure is intentional and should be preserved.

---

## Core Systems

### Economy
- Coins and gems are persistent currencies
- Many systems depend on economy balance
- Changes to rewards or costs must be minimal and explicit

### Progression
- Level system based on XP
- Rebirth system resets level with permanent bonuses
- Progression systems are tightly coupled to economy
- Do not rebalance casually

---

## SubCommand Domains

### Administrator
- Restricted / permission-gated commands
- Includes configuration, database, and service-level operations
- Must remain secure and inaccessible to regular users

### Utility / Information
- nhentai integration
- Google search
- Wikipedia lookup

### Anime
- Uses MyAnimeList API
- Replaced older or deprecated anime data sources

---

## External APIs
- External services are integrated directly into commands
- API usage patterns should not be refactored unless broken
- Assume rate limits and edge cases already exist

---

## Stability Constraints (Important)

- Do not remove existing commands
- Do not rewrite economy, leveling, or rebirth systems
- Avoid touching Administrator logic unless explicitly requested
- Avoid large refactors without approval

When in doubt, ask first.
