# FumoBOT – Complete Overview & User Guide

FumoBOT is a versatile, feature-rich Discord bot designed to enhance your server experience with fun, economy systems, customization, utilities, and more. This document merges both the feature overview and tutorial commands into one unified reference.

It's one of my first project when I'm still learning on FPT Polytechnic School(although ngl, the school's mid, aside from Java and uh CRUD stuff, and some cool tool we got to know, so I'll still give a credit for that). And yes, this project is **NOT** a graduation project. This is my own project, developed by me, thanks to my homies in Discord telling me to try to make one, although, uh, the bot at the start is not like this, but because of my passion and not wanting to make an easy bot, I decided to go **WILD**.

---

## 🌟 Features

- **Economy System:** Coins, gems, shops, quests, leaderboards, and more.
- **Collection:** Collect fumos, pets, eggs, and rare items.
- **Gacha & Gambling:** Crate gacha, event gacha, slots, coin flips, mystery crates.
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

### 1️⃣ Tutorial Commands
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.starter`      | —       | Claim starter coins and gems.            |
| `.daily`        | `.d`    | Daily reward.                            |
| `.library`      | `.li`   | View discovered fumos.                   |
| `.inform`       | `.in`   | Fumo information.                        |
| `.sell`         | `.s`    | Sell fumos.                              |
| `.code`         | —       | Redeem codes.                            |
| `.quest`        | `.qu`   | Show current quest.                      |
| `.claim`        | `.cl`   | Claim completed quest.                   |

### 2️⃣ Information Commands
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.storage`      | `.st`   | Fumo collection.                         |
| `.balance`      | `.b`    | Check balance.                           |
| `.items`        | `.i`    | Item inventory.                          |
| `.itemInfo`     | `.it`   | Info about an item.                      |
| `.use`          | `.u`    | Use an item.                             |
| `.boost`        | `.bst`  | Show boosts.                             |
| `.craft`        | `.c`    | Crafting recipes.                        |

### 3️⃣ Gacha & Gambling Commands
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.crategacha`   | `.cg`   | Roll crate gacha for fumos/items.        |
| `.eventgacha`   | `.eg`   | Limited-time event gacha.                |
| `.pray`         | `.p`    | Luck-based pray for a character.         |
| `.slot`         | `.sl`   | Slot-machine gamble.                     |
| `.gamble`       | `.g`    | Bet coins for a chance to multiply.      |
| `.flip`         | `.f`    | 50/50 coin flip.                         |
| `.mysteryCrate` | `.mc`   | Open mystery crates for rewards.         |
| `.diceduel`     | `.dd`   | Dice duel with the house.                |

### 4️⃣ Shop Commands
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.shop`         | `.sh`   | Main shop.                               |
| `.market`       | `.m`    | Marketplace for users.                   |
| `.exchange`     | `.e`    | Convert coins/gems.                      |
| `.eggshop`      | `.es`   | Purchase eggs/materials.                 |

### 5️⃣ Capitalism Commands
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.addfarm`      | `.af`   | Add fumos to farm slots.                 |
| `.farmcheck`    | `.fc`   | Check farming progress.                  |
| `.endfarm`      | `.ef`   | Finish farming and collect results.      |
| `.addbest`      | `.ab`   | Auto-add best fumos to farm.             |
| `.farminfo`     | `.fi`   | Show detailed farm stats.                |
| `.usefragment`  | `.uf`   | Upgrade farm slots with fragments.       |

### 6️⃣ Egg & Pet System
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.egginventory` | `.ei`   | View eggs and pets.                      |
| `.eggcheck`     | `.ec`   | Check egg hatching progress.             |
| `.useegg`       | `.ue`   | Hatch/cook an egg.                       |
| `.equippet`     | `.ep`   | Equip a pet for boosts.                  |

### 7️⃣ Miscellaneous Commands
| Command         | Alias   | Description                              |
|-----------------|---------|------------------------------------------|
| `.leaderboard`  | `.le`   | Show top players.                        |
| `.report`       | —       | Report a bug/issue.                      |
| `.credit`       | `.cr`   | Bot credits.                             |
| `.otherCMD`     | —       | Show additional commands.                |

---

## 🔧 Extra Utility & Sub Commands

| Command                  | Description                       |
|--------------------------|-----------------------------------|
| `.anime [name]`          | Fetch anime information.          |
| `.play`                  | Play music.                       |
| `.invite`                | Invite the bot.                   |
| `.reddit`                | Fetch a Reddit post.              |
| `.groupInform`           | Server information.               |
| `.avatar help`           | Display avatar/user info.         |
| `.ping`                  | Check bot latency.                |
| `.roleinfo [@role]`      | Show role details.                |
| `.afk`                   | Set AFK status.                   |
| `.deathbattle [@user]`   | Start a themed death battle.       |

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
- Use `.help` or `.tutorial` for a full command list.

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
- `.pray` – Pray to a character for blessings.
- `.slot` / `.gamble` / `.flip` / `.mysteryCrate` / `.diceduel` – Try your luck!

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

## 7. Miscellaneous & Utility

- `.leaderboard` – See top players.
- `.report` – Report bugs/issues.
- `.credit` – Bot credits.
- `.otherCMD` – Hidden/extra commands.
- `.anime`, `.play`, `.invite`, `.reddit`, `.groupInform`, `.avatar`, `.ping`, `.roleinfo`, `.afk`, `.deathbattle` – Utility and fun commands.

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

---

## 🌟 Features

### 🎉 Fun Commands
The most "Unbalanced" Economy Bot(well, its not that **Unbalanced** I swear), alongside with some new side feature that uh, basically inspired by some other Discord Bot, totally cool!!!

### 💰 Economy System
A deep virtual economy featuring:
- Coins & gems  
- Shops, jobs, quests  
- Collectible fumos & pets  
- Crates, eggs, and gachas  
- Leaderboards  

### ⚙️ Custom Features
Custom settings, modular design, moderation options, and flexible utilities.

### 🌀 Hybrid Design
Fun + utility + economy combined in one bot, I'll usually update it when I got freetime, instead of working for 6 hours in a company and 2.5 hours from school

---

## 🚀 Getting Started

1. Invite FumoBOT using the official [link](https://discord.com/oauth2/authorize?client_id=1254962096924397569&permissions=182273&integration_type=0&scope=bot).
2. Configure the bot through settings or commands.  
3. Type `.help` for all commands.  
4. Join the [community server](https://discord.gg/xhmbQCHs) for updates & support.

---

# 📚 Command Categories

---

## 1️⃣ Tutorial Commands

| Command | Alias | Description |
|--------|--------|-------------|
| `.starter` | — | Claim starter coins and gems. |
| `.daily` | `.d` | Daily reward. |
| `.library` | `.li` | View discovered fumos. |
| `.inform (FumoName+Rarity)` | `.in` | Fumo information. |
| `.sell` | `.s` | Sell fumos. |
| `.code` | — | Redeem codes. |
| `.quest` | `.qu` | Show current quest. |
| `.claim` | `.cl` | Claim completed quest. |

---

## 2️⃣ Information Commands

| Command | Alias | Description |
|--------|--------|-------------|
| `.storage` | `.st` | Fumo collection. |
| `.balance (@user/id)` | `.b` | Check balance. |
| `.items` | `.i` | Item inventory. |
| `.itemInfo` | `.it` | Info about an item. |
| `.use` | `.u` | Use an item. |
| `.boost` | `.bst` | Show boosts. |
| `.craft` | `.c` | Crafting recipes. |

---

## 3️⃣ Gacha & Gambling Commands

| Command | Alias | Description |
|--------|--------|-------------|
| `.crategacha` | `.cg` | Roll from the crate gacha to obtain fumos and items. |
| `.eventgacha (status)` | `.eg` | Roll from limited-time event gacha pools. |
| `.pray` | `.p` | A luck-based pray for a random character to come |
| `.slot` | `.sl` | A slot-machine style gamble for coins. |
| `.gamble` | `.g` | Bet coins for a chance to multiply them. |
| `.flip (leaderboard)` | `.f` | 50/50 coin flip. |
| `.mysteryCrate` | `.mc` | Open mystery crates for random rewards. |

---

## 4️⃣ Shop Commands

| Command | Alias | Description |
|--------|--------|-------------|
| `.shop` | `.sh` | Main shop. |
| `.market` | `.m` | Marketplace for users. |
| `.exchange coins/gems` | `.e` | Convert currency. |
| `.eggshop` | `.es` | Purchase eggs and materials. |

---

## 5️⃣ Capitalism Commands 

| Command | Alias | Description |
|--------|--------|-------------|
| `.addfarm` | `.af` | Add fumo(s) into a farm slot. |
| `.farmcheck` | `.fc` | Check farming progress. |
| `.endfarm` | `.ef` | Finish farming and collect results. |
| `.addbest` | `.ab` | Automatically add the best fumos to farm. |
| `.farminfo` | `.fi` | Show detailed farm stats. |
| `.usefragment` | `.uf` | Upgrade farm slots using fragments. |

---

## 6️⃣ Egg & Pet System

| Command | Alias | Description |
|--------|--------|-------------|
| `.egginventory` | `.ei` | View all your eggs and pets. |
| `.eggcheck` | `.ec` | Check egg hatching progress. |
| `.useegg` | `.ue` | Cook/hatch an egg. |
| `.equippet` | `.ep` | Equip a pet for boosts. |

---

## 7️⃣ Miscellaneous Commands

| Command | Alias | Description |
|--------|--------|-------------|
| `.leaderboard` | `.le` | Show top players. |
| `.report` | — | Report a bug/issue. |
| `.credit` | `.cr` | Bot credits. |
| `.otherCMD` | — | Show additional commands. |

---

# 🔧 Extra Utility & Sub Commands

| Command | Description |
|--------|-------------|
| `.anime [name]` | Fetch anime information. |
| `.play` | Play music. |
| `.invite` | Invite the bot. |
| `.reddit` | Fetch a Reddit post. |
| `.groupInform` | Server information. |
| `.avatar help` | Display avatar/user info. |
| `.ping` | Check bot latency. |
| `.roleinfo [@role]` | Show role details. |
| `.afk` | Set AFK status. |
| `.deathbattle [@user] [hp] [jjk/anime]` | Start a themed death battle. |

---

# 🛠️ FumoBOT – Developer Guide & Contribution Rules

If you are using, modifying, or contributing to the FumoBOT codebase, please read this document carefully.  
FumoBOT is a passion-driven project by **golden_exist**, and proper collaboration helps keep the project stable, creative, and fair.

---

## 📌 Contribution Guidelines

### ✅ Allowed
- Suggesting ideas or improvements  
- Reporting bugs  
- Submitting pull requests  
- Adding new features  
- Improving performance and cleaning code  
- Enhancing documentation  
- Reusing small portions of code

### ❌ Not Allowed
- **Copying 100% of the project and republishing it as your own**  
- **Selling or redistributing the bot/code for profit**  
- **Removing credits or claiming ownership**  
- **Using the bot/code for malicious or harmful purposes**  
- **Violating or bypassing the MIT License**  

If you fork the repository:
- Keep original credits in the root.  
- Document your changes clearly.  
- Do not upload cloned versions with no modification.

Respect the project:  
✔️ Modify it  
✔️ Improve it  
❌ Do not steal it  

---

## 📝 Submitting Contributions

### ⭐ Feature Suggestions
When suggesting a feature:
- Provide a clear description  
- Explain why it benefits the bot  
- Add examples or mockups if possible  

### 🐛 Bug Reports
Include:
- The command or module affected  
- Error messages or logs  
- Steps to reproduce  
- Expected vs. actual behavior  

### 🔧 Pull Requests
Before creating a PR:
- Keep code readable and documented  
- Use clear commit messages  
- Avoid mixing unrelated changes  
- Test everything before submitting  

Example PR message:
[Fix] Corrected farm boost calculation
- Adjusted formula for boost scaling
- Fixed undefined variable in farmCheck()
- Updated logging for clarity

---

## 📂 Using the Code (!!! Important !!!)

If you are using FumoBOT as a base for your own project:

### ✔️ Allowed
- Learning from the code  
- Reusing small parts with proper credit  
- Making your own bot inspired by FumoBOT  
- Expanding or modifying systems  

### ❌ Not Allowed
- Copy-pasting the whole bot and rebranding it  
- Reposting the bot with identical systems  
- Removing “created by golden_exist” credits  
- Monetizing the project without permission  

**If you reuse any part of the bot, it's alright, we're all learning somehow.**

---

# 🧪 Developer Setup, Testing, and Deployment Guide

If you are a developer planning to use or contribute to FumoBOT’s codebase, here is a full guide on what you need, how to run the bot locally, how to test changes, and how to deploy it safely.

---

## 🧰 Requirements

To develop or run FumoBOT, you need:

### **📦 1. Software**
- **Node.js v18+**
- **npm** or **yarn**
- **Git** for version control
- **Visual Studio Code**
- **Microsoft SQL Server** (In near future)

### **🗄️ 2. Database**
FumoBOT uses:
- **SQLite3** (Right now)
- **Microsoft SQL Server** (In near future)

You must set up a database and add the connection string to your config.

### **🔑 3. Developer Tokens**
You will need:
- Discord **Bot Token**
- Discord **Client ID**
- Discord **Guild ID** (optional for quick command testing)
- Reddit **Client** and **secret**(if you want to test reddit of course)

Never share these tokens publicly.

---

## ⚙️ Project Setup

1. Clone the project:
   ```
   git clone https://github.com/alG-N/FumoBOT.git
   ```

2. Install dependencies:
    ```
    npm install
    ```

3. You'll need to create some of the .env file for reddit, the Discord Bot token, and your Test Server's channel ID

4. You can start the bot by running the main file, which is "FumoBOTMain.js", by start debugging on run. 
OR
    ```
    npm install pm2
    ```
    And run
    ```
    pm2 start MainBOT\FumoBOTMain.js --name=fumobot
    ```

---
# 🧪 Testing Guidelines

Before submitting any changes, always test these areas:

## 1️⃣ Slash Commands
- Ensure commands respond correctly  
- Test both success and fail scenarios  
- Verify that aliases work (if included)

## 2️⃣ Database Operations
Test:
- Read / write operations  
- Inventory updates  
- Currency changes  
- Farm & quest systems  

## 3️⃣ Economy Balancing
For any change:
- Test multiple roll attempts  
- Ensure no infinite loops  
- Verify no ways to duplicate money or items  

## 4️⃣ Error Handling
- Commands should never crash the bot  
- All errors should return safe, readable messages  

## 5️⃣ User Flow Testing
Simulate:
- New users  
- Rolling fumo, auto roll logic
- Daily rewards  
- Using items logic  
- Claiming quests  
- Farming cycles  
- Pet logic
- And much more...

---

# 🚀 Deployment Guide

You can deploy FumoBOT on any platform such as:

## ✔️ Railway
- Free tier available  
- Easy one-click deployment  
- Automatically restarts on crash  

## ✔️ Render.com
- Free tier, but sleep time on free plans  
- Better for stable hosting  

## ✔️ VPS / Linux Server
For advanced users:
- Ubuntu server  
- PM2 process manager  
- Reverse proxy (optional)  

## ✔️ Local Machine
Perfect for development, but not recommended for production.

## ✔️ A server of your own
Literally perfect to run bot, host website.

---

# 🧼 Deployment Checklist

Before pushing updates:
- Make sure `.env` is **not** committed  
- Remove any debug logs  
- Confirm no sensitive data is exposed  
- Commands must be registered correctly  
- Test the bot in a private Discord server  
- Ensure no breaking changes to users  

---

# 🧪 Recommended Tools for Developers
- Nodemon – live reload  
- ESLint – clean code  
- Prettier – formatting  
- SQLite  – view database  
- Github Copliot - AI Agent that will help you in coding

---

# 🧷 Notes for New Developers
- Always work in your own branch  
- Keep commits small and meaningful  
- Update documentation if you add new features  
- Ask before rewriting major systems  
- Respect code style and structure  
- Don’t introduce new dependencies unless needed  

---

## 📩 Contact

For **ideas, bug reports, collaboration, or contribution help**, contact:

### **Discord:** `golden_exist`

I respond fastest on Discord and can guide contributions directly.

---

Thank you for supporting and respecting the project!  
Your contributions help FumoBOT grow in a healthy, creative direction.