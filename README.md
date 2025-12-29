# FumoBOT – Complete Overview & User Guide

FumoBOT is a versatile, feature-rich Discord bot designed to enhance your server experience with fun, economy systems, customization, utilities, and more. This document merges both the feature overview and tutorial commands into one unified reference.

It's one of my first project when I'm still learning on FPT Polytechnic School(although ngl, the school's mid, aside from Java and uh CRUD stuff, and some cool tool we got to know, so I'll still give a credit for that). And yes, this project is **NOT** a graduation project. This is my own project, developed by me, thanks to my homies in Discord telling me to try to make one, although, uh, the bot at the start is not like this, but because of my passion and not wanting to make an easy bot, I decided to go **WILD**.

---

## 🌟 Features

- **Economy System:** Coins, gems, shops, quests, leaderboards, and more.
- **Collection:** Collect fumos, pets, eggs, and rare items.
- **Gacha & Gambling:** Crate gacha, event gacha, slots, coin flips, mystery crates, dice duel.
- **Customization:** Settings, modular commands, and flexible utilities.
- **Admin Tools:** Ban system, ticket system, guild tracking, and more.
- **Hybrid Design:** Fun + utility + economy, always evolving.

---

## 🚀 Getting Started

1. **Invite FumoBOT:** [Invite Link](https://discord.com/oauth2/authorize?client_id=1254962096924397569&permissions=182273&integration_type=0&scope=bot)
2. **Configure:** Use settings or commands to customize.
3. **Type `.help`:** See all commands and categories.
4. **Join the Community:** [Discord Server](https://discord.gg/xhmbQCHs) for support and updates.

---

# 📚 Command Categories

## Main Commands

### Tutorial & Help
- `.starter` – Claim starter coins and gems
- `.daily` – Daily reward
- `.library` – View discovered fumos
- `.inform <FumoName+Rarity>` – Fumo information
- `.sell` – Sell fumos
- `.code` – Redeem codes
- `.quest` – Show current quest
- `.claim` – Claim completed quest
- `.help` – Show help menu
- `.aboutBot` – Bot info

### Information & Inventory
- `.storage` – Fumo collection
- `.balance [@user/id]` – Check balance
- `.items` – Item inventory
- `.itemInfo <item>` – Info about an item
- `.use <item>` – Use an item
- `.boost` – Show boosts
- `.craft` – Crafting recipes

### Gacha & Gambling
- `.crategacha` – Roll crate gacha for fumos/items
- `.eventgacha` – Limited-time event gacha
- `.slot` – Slot-machine gamble
- `.gamble` – Bet coins for a chance to multiply
- `.flip` – 50/50 coin flip
- `.mysterycrate` – Open mystery crates for rewards
- `.diceduel` – Dice duel with the house

### Shop & Market
- `.shop` – Main shop
- `.market` – Marketplace for users
- `.exchange coins/gems <amount>` – Convert currency
- `.eggshop` – Purchase eggs/materials

### Farming & Capitalism
- `.addfarm <fumo>` – Add fumos to farm slots
- `.farmcheck` – Check farming progress
- `.endfarm <fumo>` – Finish farming
- `.addbest` – Auto-select best fumos for farming
- `.farminfo` – Show detailed farm stats
- `.usefragment <amount>` – Upgrade farm slots

### Egg & Pet System
- `.egginventory` – View eggs and pets
- `.eggcheck` – Check egg hatching progress
- `.useegg <egg>` – Hatch/cook eggs
- `.equippet <pet>` – Equip pets for boosts

### Trading
- `.trade` – Trade fumos/items with other users

---

## Sub Commands

### Basic Utility
- `.afk` – Set AFK status
- `.avatar` – Display avatar/user info
- `.groupInform` – Server information
- `.invite` – Invite the bot
- `.ping` – Check bot latency
- `.roleinfo [@role]` – Show role details
- `.tutorialHelp` – Show tutorial help

### Interactive User Commands
- (See folder for more, e.g. custom games, quizzes, etc.)

### Music & Video
- Music: Play, queue, skip, etc. (see MusicFunction folder)
- Video: Play, search, etc. (see VideoFunction folder)

### API-Website Integration
- `.anime <name>` – Fetch anime info
- `.pixiv <query>` – Pixiv image search
- `.reddit <subreddit>` – Fetch Reddit post
- `.rule34 <query>` – NSFW image search
- `.steam <game>` – Steam game info

---

## Administrator & Advanced

- Ban system, ticket system, guild tracking, and more (see `MainCommand/Administrator/`)
- Configuration files for achievements, balance, boosts, crafting, events, items, market, pets, quests, rarity, rewards, shop, trading, weather, etc.

---

# 📝 How FumoBOT Works

- **Command System:** Modular, with folders for each category (Tutorial, Information, Gacha, Shop, Capitalism, Egg/Pet, Misc).
- **Event Listeners:** Each command registers listeners for Discord events (message, interaction, etc).
- **Database:** Uses SQLite3 for user data, inventory, economy, and stats.
- **Admin Tools:** Ban system, ticket system, and guild tracking are in `MainCommand/Administrator/`.
- **SubCommands:** Utility and API commands are in `SubCommand/` (music, anime, reddit, etc).
- **Config Files:** All settings and constants are in `MainCommand/Configuration/`.

---

# 📖 Detailed Tutorial

## 1. Getting Started

- **Invite the bot** to your server.
- Type `.starter` to claim your starter pack.
- Use `.help` or `.tutorialHelp` for a full command list.

## 2. Collecting & Inventory

- `.library` – View discovered fumos.
- `.storage` – See your full fumo collection.
- `.items` – Check your item inventory.
- `.itemInfo <item>` – Get details about any item.

## 3. Earning & Spending

- `.daily` – Claim daily coins/gems.
- `.quest` – View your quests.
- `.claim` – Claim quest rewards.
- `.shop` / `.market` – Buy/sell items and fumos.
- `.exchange coins/gems <amount>` – Convert currency.

## 4. Gacha & Gambling

- `.crategacha` / `.eventgacha` – Roll for fumos/items.
- `.slot` / `.gamble` / `.flip` / `.mysterycrate` / `.diceduel` – Try your luck!

## 5. Farming & Capitalism

- `.addfarm <fumo>` – Add fumos to farm slots.
- `.farmcheck` – Check farm progress.
- `.endfarm <fumo>` – Finish farming.
- `.addbest` – Auto-select best fumos for farming.
- `.usefragment <amount>` – Upgrade farm slots.

## 6. Pets & Eggs

- `.egginventory` – View eggs/pets.
- `.eggcheck` – Check hatching progress.
- `.useegg <egg>` – Hatch/cook eggs.
- `.equippet <pet>` – Equip pets for boosts.

## 7. Trading

- `.trade <user> <item/fumo>` – Trade with other users.

## 8. Miscellaneous & Utility

- `.leaderboard` – See top players.
- `.report` – Report bugs/issues.
- `.credit` – Bot credits.
- `.otherCMD` – Hidden/extra commands.
- `.anime`, `.pixiv`, `.reddit`, `.rule34`, `.steam` – API integrations.
- `.afk`, `.avatar`, `.groupInform`, `.invite`, `.ping`, `.roleinfo` – Utility commands.

---

# 🛠️ Developer Guide & Contribution Rules

## 📌 Contribution Guidelines

- **Allowed:** Suggest features, report bugs, submit PRs, improve code/docs, reuse small portions.
- **Not Allowed:** Copying/rebranding, selling, removing credits, malicious use, violating MIT License.

If you fork:
- Keep original credits.
- Document changes.
- Don’t upload clones with no modification.

## 📝 Submitting Contributions

- **Feature Suggestions:** Clear description, benefit, examples.
- **Bug Reports:** Command/module, error/logs, steps, expected/actual.
- **Pull Requests:** Clean code, clear commits, test everything.

Example PR message:
```
[Fix] Corrected farm boost calculation
- Adjusted formula for boost scaling
- Fixed undefined variable in farmCheck()
- Updated logging for clarity
```

## 📂 Using the Code

- **Allowed:** Learn, reuse small parts, make your own inspired bot, expand/modify.
- **Not Allowed:** Copy-paste whole bot, rebrand, remove credits, monetize without permission.

---

# 🧪 Developer Setup, Testing, and Deployment Guide

## 🧰 Requirements

- Node.js v18+
- npm or yarn
- Git
- Visual Studio Code
- SQLite3 (current) / SQL Server (future)
- Discord Bot Token, Client ID, Guild ID, Reddit API keys

## ⚙️ Project Setup

1. Clone:
   ```
   git clone https://github.com/alG-N/FumoBOT.git
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create `.env` for tokens and config.
4. Start bot:
   ```
   node MainBOT/FumoBOTMain.js
   ```
   Or with PM2:
   ```
   npm install pm2
   pm2 start MainBOT/FumoBOTMain.js --name=fumobot
   ```

## 🧪 Testing Guidelines

- Test all commands (success/fail, aliases)
- Test database operations (read/write, inventory, currency, farm, quest)
- Test economy balancing (no infinite loops/dupes)
- Test error handling (safe messages, no crashes)
- Simulate user flows (new users, rolls, daily, items, quests, farming, pets)

## 🚀 Deployment Guide

- Railway, Render.com, VPS, Local, or your own server.
- Use PM2 for process management.
- Never commit `.env` or sensitive data.
- Test in a private server before deploying.

---

# 🧼 Deployment Checklist

- `.env` is not committed
- Remove debug logs
- No sensitive data exposed
- Commands registered correctly
- Test in private Discord server
- No breaking changes

---

# 🧪 Recommended Tools

- Nodemon (live reload)
- ESLint (code quality)
- Prettier (formatting)
- SQLite viewer
- GitHub Copilot (AI coding assistant)

---

# 🧷 Notes for New Developers

- Work in your own branch
- Small, meaningful commits
- Update docs for new features
- Ask before rewriting major systems
- Respect code style/structure
- Avoid unnecessary dependencies

---

## 📩 Contact

For ideas, bug reports, or contributions:

**Discord:** `golden_exist`

Fastest response via Discord!

---

Thank you for supporting and respecting FumoBOT!  
Your contributions help FumoBOT grow in a healthy, creative direction.