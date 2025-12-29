
# FumoBOT – Complete Overview & User Guide

FumoBOT is a versatile, feature-rich Discord bot designed to enhance your server experience with fun, economy systems, customization, utilities, and more. This document merges both the feature overview and tutorial commands into one unified reference.

**A little story:**
It's one of my first projects when I was still learning at FPT Polytechnic School (although ngl, the school's mid, aside from Java and uh CRUD stuff, and some cool tools we got to know, so I'll still give a credit for that). And yes, this project is **NOT** a graduation project. This is my own project, developed by me, thanks to my homies in Discord telling me to try to make one. Although, uh, the bot at the start is not like this, but because of my passion and not wanting to make an easy bot, I decided to go **WILD**.

**Note:** This bot is still under active development and is not yet complete. Some bugs may appear, but we're always working to fix them. Your feedback and bug reports are welcome!

---

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

### Core Requirements

- **Node.js v18+**: The main runtime for the bot. Required for all JavaScript/TypeScript code.
- **npm** or **yarn**: For managing dependencies and scripts.
- **Git**: For version control and cloning the repository.
- **Visual Studio Code**: Recommended editor for development.
- **SQLite3** (current) / **SQL Server** (future): Database for storing user data, inventory, economy, and stats.
- **Discord Bot Token, Client ID, Guild ID**: Required to connect the bot to your Discord server. Get these from the [Discord Developer Portal](https://discord.com/developers/applications).
- **Reddit API keys**: Needed for Reddit integration commands. Register an app at [Reddit Apps](https://www.reddit.com/prefs/apps).


### Additional/Recommended Tools & Libraries

- **Docker Desktop**: For running the bot and its dependencies in containers. Useful for isolating services (e.g., database, web scrapers, yt-cipher, cobalt) and for production deployment. [Download Docker Desktop](https://www.docker.com/products/docker-desktop/).
   - *Why?* Ensures consistent environments, easy scaling, and quick resets. You can run the database, bot, yt-cipher, cobalt, and even supporting services in containers.
- **Lavalink**: A standalone audio sending node based on Lavaplayer. **You must run Lavalink locally** (usually on `localhost:2333`) for music playback. [Lavalink GitHub](https://github.com/freyacodes/Lavalink)
   - *Why?* Lavalink handles audio streaming for Discord bots. The bot connects to Lavalink via the [Shoukaku](https://github.com/Deivu/Shoukaku) library.
- **yt-cipher**: Used for decrypting YouTube signatures, required for music streaming and some video features. Install via npm: `npm install yt-cipher`. **Often run as a Dockerized localhost service.**
   - *Why?* YouTube changes their encryption often; yt-cipher helps keep music/video features working. Lavalink fetches streams, yt-cipher deciphers them, and the bot relays the result.
- **cobalt**: Used for advanced web scraping and API integration, especially for sites with anti-bot measures. Install via npm: `npm install cobalt`. **Can also be run as a Dockerized localhost service.**
   - *Why?* Some API endpoints or web data require bypassing protections; cobalt helps fetch this data reliably.
- **ffmpeg**: Command-line tool for audio/video processing. Required for music, video, and media conversion features. [Download ffmpeg](https://ffmpeg.org/download.html) and add to your PATH.
   - *Why?* Enables the bot to play, convert, and process media files.
- **yt-dlp**: For downloading YouTube and other media content. [Download yt-dlp](https://github.com/yt-dlp/yt-dlp) and add to your PATH.
   - *Why?* Used for music/video download and streaming commands.
- **pm2**: Advanced process manager for Node.js. Install globally: `npm install pm2 -g`.
   - *Why?* Keeps the bot running, restarts on crash, and provides logs.
- **nodemon**: For live reload during development. Install globally: `npm install nodemon -g`.
- **ESLint** and **Prettier**: For code linting and formatting. Install via npm: `npm install eslint prettier --save-dev`.
- **sqlite viewer**: GUI tool for inspecting your SQLite database (e.g., [DB Browser for SQLite](https://sqlitebrowser.org/)).
- **GitHub Copilot**: AI coding assistant for faster development.
- **Other npm libraries:**
   - `discord.js` (core Discord API), `axios` (HTTP requests), `dotenv` (env config), `sequelize` (ORM), `sqlite3` (DB driver), `express` (web server), `cheerio` (HTML parsing), `node-fetch` (fetch API), `form-data`, `sharp` (image processing), `moment` (date/time), and more. See `package.json` for the full list.

### .env File Variables (Example)

Create a `.env` file in the root directory with the following (example):

```
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-guild-id
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
REDDIT_USER_AGENT=your-app-user-agent
# Add any other API keys or secrets as needed
```


### Music/Video/Media Setup & Flow

**How it works:**

1. **Lavalink** must be running on your machine (default: `localhost:2333`). Lavalink is responsible for audio streaming to Discord.
2. **yt-cipher** and **cobalt** are run as local services (often via Docker) to handle YouTube ciphering and advanced scraping. Lavalink and the bot communicate with these services to fetch and decipher streams.
3. **Shoukaku** is the Node.js library that connects the bot to Lavalink, handling all music playback commands.
4. **ffmpeg** and **yt-dlp** are used for media processing and downloading.

**Setup Steps:**

1. **Install and run Lavalink:**
    - Download Lavalink from [Lavalink Releases](https://github.com/freyacodes/Lavalink/releases)
    - Configure `application.yml` (set password, port, etc.)
    - Start Lavalink:
       ```sh
       java -jar Lavalink.jar
       ```
    - Ensure it is running on `localhost:2333` (or update your bot config accordingly)
2. **Run yt-cipher and cobalt as Docker containers (recommended):**
    - Example for yt-cipher:
       ```sh
       docker run -d -p 8060:8060 ghcr.io/yt-dlp/yt-cipher:latest
       ```
    - Example for cobalt:
       ```sh
       docker run -d -p 8080:8080 ghcr.io/cobalt-org/cobalt:latest
       ```
    - Make sure your Lavalink and bot can access these services on `localhost`.
3. **Install ffmpeg and yt-dlp** and ensure both are in your system PATH.
4. **Configure your bot to use the correct Lavalink, yt-cipher, and cobalt endpoints.**

**Music Command Flow:**

1. User issues a music command (e.g., play a YouTube link).
2. Bot (via Shoukaku) sends the request to Lavalink.
3. Lavalink fetches the stream, but if ciphering is needed, it queries yt-cipher (running locally, often in Docker).
4. yt-cipher deciphers the stream and returns the result to Lavalink.
5. Lavalink streams the audio to Discord.
6. Cobalt may be used for scraping or bypassing protections as needed.

### Docker Setup (Optional but Recommended)

1. Install Docker Desktop and start it.
2. (If provided) Use the included `Dockerfile` or `docker-compose.yml` to build and run the bot and its dependencies:
    ```sh
    docker-compose up --build
    ```
    Or build manually:
    ```sh
    docker build -t fumobot .
    docker run --env-file .env -p 3000:3000 fumobot
    ```
3. For database persistence, mount a volume for the SQLite file or connect to an external SQL Server.

### Troubleshooting & Tips

- If music/video commands fail, check that ffmpeg and yt-dlp are installed and in your PATH.
- If API commands fail, verify your API keys in `.env`.
- For Docker issues, ensure all services are up and ports are mapped correctly.
- Use `pm2 logs` or `docker logs` to view runtime errors.
- For Discord permission issues, check your bot's role and OAuth2 scopes.
- For database issues, inspect the SQLite file with a viewer or check logs for migration errors.

**Note:** Some features (like music, video, or API integrations) may require additional dependencies or external binaries. Always check the relevant folders and documentation for setup instructions.

## ⚙️ Project Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/alG-N/FumoBOT.git
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Install Docker Desktop:**
   - Download and install from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - Start Docker Desktop and ensure it is running.
4. **Install required binaries:**
   - [ffmpeg](https://ffmpeg.org/download.html) (add to PATH)
   - [yt-dlp](https://github.com/yt-dlp/yt-dlp) (add to PATH)
5. **Create `.env` file:**
   - Add your Discord bot token, client ID, guild ID, Reddit API keys, and any other required secrets.
6. **Start the bot:**
   ```sh
   node MainBOT/FumoBOTMain.js
   ```
   Or with PM2:
   ```sh
   npm install pm2 -g
   pm2 start MainBOT/FumoBOTMain.js --name=fumobot
   ```

## 🧪 Testing Guidelines

- Test all commands (success/fail, aliases)
- Test database operations (read/write, inventory, currency, farm, quest)
- Test economy balancing (no infinite loops/dupes)
- Test error handling (safe messages, no crashes)
- Simulate user flows (new users, rolls, daily, items, quests, farming, pets)
- Test music/video/API features (ensure ffmpeg, yt-dlp, yt-cipher, cobalt, etc. are working)

## 🚀 Deployment Guide

- Deploy on Railway, Render.com, VPS, local machine, or your own server.
- Use Docker for containerized deployment if desired (see Dockerfile or docker-compose.yml if available).
- Use PM2 for process management.
- Never commit `.env` or sensitive data.
- Test in a private Discord server before deploying.

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

## 👥 Credits

- **Owner/Lead Developer:** golden_exist
- **Developers:** frusito, zephrish

Thank you for supporting and respecting FumoBOT!
Your contributions help FumoBOT grow in a healthy, creative direction.