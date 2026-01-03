
# FumoBOT – Complete Overview & User Guide

FumoBOT is a versatile, feature-rich Discord bot designed to enhance your server experience with fun, economy systems, customization, utilities, and more. This document merges both the feature overview and tutorial commands into one unified reference.

**A little story:**
It's one of my first projects when I was still learning at FPT Polytechnic School (although ngl, the school's mid, aside from Java and uh CRUD stuff, and some cool tools we got to know, so I'll still give a credit for that). And yes, this project is **NOT** a graduation project. This is my own project, developed by me and the other close friend of mine, thanks to my homies in Discord telling me to try to make one(and started this motivation for me to code, because I'd have ended as a hentai artist anyway lmao). Although, uh, the bot at the start is not like this, but because of my passion and not wanting to make an easy bot, I decided to go **WILD**.

**Note:** This bot is still under active development and is not yet complete. Some bugs may appear, but we're always working to fix them. Your feedback and bug reports are welcome!

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
4. **Join the Community:** [Discord Server](https://discord.gg/3vJEyCCdaA) for support and updates alongside with cool community.

### Step-by-Step Setup

1. **Invite FumoBOT to your Discord server:**
   - Use the [Invite Link](https://discord.com/oauth2/authorize?client_id=1254962096924397569&permissions=182273&integration_type=0&scope=bot)
   - Grant necessary permissions (message, voice, manage roles, etc.)
2. **Configure your bot:**
   - Edit `MainBOT/config.json` for global settings (prefix, language, etc.)
   - Set up `.env` with all required tokens and API keys (see Requirements section)
   - Adjust `MainBOT/MainCommand/Configuration/` files for custom economy, items, events, and more
3. **Start the bot:**
   - Run with Node.js: `node MainBOT/FumoBOTMain.js`
   - Or use PM2 for process management: `pm2 start MainBOT/FumoBOTMain.js --name=fumobot`
   - For Docker: `docker-compose up --build` (if using containers)
4. **Register commands:**
   - Use `.help` in Discord to see all available commands and categories
   - Use `.tutorialHelp` for a guided walkthrough of features
5. **Join the Community:**
   - [Discord Server](https://discord.gg/3vJEyCCdaA) for support, updates, and feedback

### Advanced Configuration

- **Lavalink:**
  - Edit `application.yml` for password, port, and server settings
  - Ensure bot config matches Lavalink endpoint and password
- **yt-cipher & cobalt:**
  - If running in Docker, ensure ports are mapped and endpoints are correct in bot config
- **Database:**
  - For SQLite, database file is in `MainBOT/Data/`
  - For SQL Server, update connection string in `.env` and ORM config
- **API Keys:**
  - Store all secrets in `.env` and never commit this file

### Example .env

```
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-guild-id
LAVALINK_PASSWORD=your-lavalink-password
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
YTCIPHER_HOST=localhost
YTCIPHER_PORT=8060
COBALT_HOST=localhost
COBALT_PORT=8080
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
REDDIT_USER_AGENT=your-app-user-agent
# ...other keys
```

---

# 📚 Command Categories

## Main Commands

### Tutorial & Help

### Example Command Usage

1. **Claim Starter Coins:**
   - Command: `.starter`
   - Description: Claim your starter coins and gems to begin your journey.

2. **Daily Reward:**
   - Command: `.daily`
   - Description: Receive your daily reward of coins and gems.

3. **View Fumos:**
   - Command: `.library`
   - Description: Check your collection of discovered fumos.

4. **Fumo Information:**
   - Command: `.inform <FumoName+Rarity>`
   - Description: Get detailed information about a specific fumo.

5. **Sell Fumos:**
   - Command: `.sell <FumoName>`
   - Description: Sell a specific fumo from your collection.

6. **Redeem Codes:**
   - Command: `.code <code>`
   - Description: Redeem a promotional code for rewards.

7. **Show Current Quest:**
   - Command: `.quest`
   - Description: Display your current quest and its progress.

8. **Claim Completed Quest:**
   - Command: `.claim`
   - Description: Claim rewards for completed quests.

9. **Help Menu:**
   - Command: `.help`
   - Description: Show a menu of all available commands.

10. **Bot Information:**
    - Command: `.aboutBot`
    - Description: Get information about the bot and its features.


- `.craft` – Crafting recipes
- `.mysterycrate` – Open mystery crates for rewards
- `.market` – Marketplace for users
- `.endfarm <fumo>` – Finish farming
### Egg & Pet System
- `.eggcheck` – Check egg hatching progress
- `.useegg <egg>` – Hatch/cook eggs
## Sub Commands
### Basic Utility
- `.groupInform` – Server information
### Interactive User Commands
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

## Project Structure

- `MainBOT/MainCommand/CommandFolder/`: Main commands, organized by category (Craft, Farming, Gacha, Market, Pet, Pray, Trade, Tutorial, UserData)
- `MainBOT/MainCommand/Configuration/`: All config files for economy, items, events, etc.
- `MainBOT/MainCommand/Administrator/`: Admin tools, ban system, ticket system, guild tracking
- `MainBOT/MainCommand/Core/`: Database and logger modules
- `MainBOT/MainCommand/Data/`: Persistent data files (JSON, SQLite)
- `MainBOT/SubCommand/`: Utility, music, video, and API integrations

## Command System

- Modular design: Each command is a separate file/module, easy to add/remove
- Event listeners: Commands register listeners for Discord events (message, interaction, reaction, etc.)
- Aliases: Many commands have short aliases for quick access
- Permissions: Admin commands require elevated permissions

## Database

- Uses SQLite3 by default (file in `MainBOT/Data/`)
- Supports SQL Server for advanced setups (update ORM config and `.env`)
- Handles user profiles, inventory, currency, farming, pets, quests, achievements, and more

## Music & Media System

- Lavalink: Audio streaming node, must run locally
- Shoukaku: Node.js library for connecting bot to Lavalink
- yt-cipher & cobalt: Local services (often Dockerized) for YouTube ciphering and scraping
- ffmpeg & yt-dlp: Media processing and downloading
- Flow: User command → Bot → Shoukaku → Lavalink → yt-cipher/cobalt → Lavalink → Discord

## Configuration & Customization

- All settings (economy, items, events, etc.) are in `MainCommand/Configuration/`
- Edit config files to customize rewards, prices, event schedules, item stats, etc.
- Use `.env` for secrets and API keys

## Logging & Error Handling

- Advanced logger in `MainCommand/Core/logger.js`
- All errors are logged with timestamps and context
- User-facing errors are safe and descriptive

## Extending the Bot

- Add new commands by creating files in the appropriate folder
- Register new event listeners in the main bot file
- Add new config options in `Configuration/` and update relevant modules

---

# 📖 Detailed Tutorial & Usage Examples

## 1. Getting Started

### Step-by-Step
1. **Invite the bot:** Use the invite link and grant all required permissions.
2. **Claim your starter pack:** Type `.starter` to receive coins, gems, and basic items.
3. **Explore commands:** Use `.help` or `.tutorialHelp` for a categorized list and usage guide.
4. **Configure your experience:** Edit config files for custom settings, or use commands to adjust preferences.

## 2. Collecting & Inventory

- **View discovered fumos:**
   - Command: `.library`
   - Shows all fumos you've unlocked, with rarity, stats, and lore.
- **See your full fumo collection:**
   - Command: `.storage`
   - Lists all fumos you own, sortable by rarity, type, or acquisition date.
- **Check your item inventory:**
   - Command: `.items`
   - Displays all usable items, their quantities, and effects.
- **Get details about any item:**
   - Command: `.itemInfo <item>`
   - Shows description, usage, and where to obtain the item.

## 3. Earning & Spending

- **Claim daily coins/gems:**
   - Command: `.daily`
   - Can be claimed once per day, resets at midnight UTC.
- **View your quests:**
   - Command: `.quest`
   - Shows active quests, progress, and possible rewards.
- **Claim quest rewards:**
   - Command: `.claim`
   - Completes the quest and gives you the reward.
- **Buy/sell items and fumos:**
   - Command: `.shop` (NPC shop), `.market` (player-driven market)
   - Use `.shop buy <item>` or `.market sell <fumo>` for transactions.
- **Convert currency:**
   - Command: `.exchange coins/gems <amount>`
   - Exchange rates are set in the config files.

## 4. Gacha & Gambling

- **Roll for fumos/items:**
   - Command: `.crategacha` or `.eventgacha`
   - Event crates have special drops and limited-time rewards.
- **Try your luck:**
   - Commands: `.slot`, `.gamble <amount>`, `.flip`, `.mysterycrate`, `.diceduel`
   - Each command has unique odds and rewards. Use `.help gambling` for details.

## 5. Farming & Capitalism

- **Add fumos to farm slots:**
   - Command: `.addfarm <fumo>`
   - Assign fumos to farm slots; boosts depend on rarity and type.
- **Check farming progress:**
   - Command: `.farmcheck`
   - Shows time left, expected yield, and active boosts.
- **Finish farming:**
   - Command: `.endfarm <fumo>`
   - Collect results; fumos may level up or break.
- **Auto-select best fumos for farming:**
   - Command: `.addbest`
   - Optimizes farm slots for maximum yield.
- **Show detailed farm stats:**
   - Command: `.farminfo`
   - Displays all farm slots, boosts, and farming history.
- **Upgrade farm slots:**
   - Command: `.usefragment <amount>`
   - Spend fragments to unlock or upgrade slots.

## 6. Pets & Eggs

- **View eggs and pets:**
   - Command: `.egginventory`
   - Shows all eggs and pets owned; hatchable eggs are highlighted.
- **Check egg hatching progress:**
   - Command: `.eggcheck`
   - Shows time left and possible pet outcomes.
- **Hatch/cook eggs:**
   - Command: `.useegg <egg>`
   - Consumes the egg and gives a pet or item.
- **Equip pets for boosts:**
   - Command: `.equippet <pet>`
   - Equipped pets give passive bonuses to farming, gacha, or other activities.

## 7. Trading

- **Trade with other users:**
   - Command: `.trade <user> <item/fumo>`
   - Initiates a trade, confirms via DM or reaction. Both parties must accept for the trade to complete.

## 8. Miscellaneous & Utility

- **See top players:**
   - Command: `.leaderboard`
   - Shows rankings for coins, fumos, quests, and more.
- **Report bugs/issues:**
   - Command: `.report <description>`
   - Sends a report to the devs; include as much detail as possible.
- **Bot credits:**
   - Command: `.credit`
   - Lists all contributors and developers.
- **Hidden/extra commands:**
   - Command: `.otherCMD`
   - Easter eggs, dev tools, and undocumented features.
- **API integrations:**
   - Commands: `/anime`, `/pixiv`, `/reddit`, `/rule34`, `/steam`
   - Fetch info, images, posts, and more from external sources.
- **Utility commands:**
   - Commands: `/afk`, `/avatar`, `/groupInform`, `/invite`, `/ping`, `/roleinfo`
   - Get server info, user info, bot status, and more.

---

# 🛠️ Developer Guide & Contribution Rules

## 📌 Contribution Guidelines

- **Allowed:**
   - Suggest features (open an issue or DM devs)
   - Report bugs (include command, error, steps, logs)
   - Submit PRs (fork, branch, test, document)
   - Improve code/docs (refactor, add comments, update README)
   - Reuse small portions for your own projects (with credit)
- **Not Allowed:**
   - Copying/rebranding without major changes
   - Selling the bot or code
   - Removing credits
   - Malicious use or violating MIT License

**If you fork:**
- Keep original credits in README and code headers
- Document all changes in your fork
- Do not upload clones with no modification

## 📝 Submitting Contributions

- **Feature Suggestions:**
   - Describe the feature, why it's useful, and example usage
   - Suggest config options if needed
- **Bug Reports:**
   - Specify command/module, error/logs, steps to reproduce, expected/actual behavior
   - Attach screenshots or logs if possible
- **Pull Requests:**
   - Clean code, clear commit messages, tested locally
   - Document changes in PR description
   - Reference related issues

**Example PR message:**
```
[Fix] Corrected farm boost calculation
- Adjusted formula for boost scaling
- Fixed undefined variable in farmCheck()
- Updated logging for clarity
```

## 📂 Using the Code

- **Allowed:**
   - Learn from the codebase
   - Reuse small parts for your own bot (with credit)
   - Expand/modify for your own server
- **Not Allowed:**
   - Copy-paste whole bot and rebrand
   - Remove credits
   - Monetize without permission

## Developer Workflow

1. Fork the repo and create a new branch for your feature/fix
2. Make small, focused commits with clear messages
3. Test all changes locally (use Jest for unit tests, manual Discord testing for commands)
4. Update documentation and config files as needed
5. Submit a PR and wait for review

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
- **Reddit API keys(and so alot more other API keys...)**: Needed for Reddit integration commands. Register an app at [Reddit Apps](https://www.reddit.com/prefs/apps).

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

## ⚙️ Project Setup (Step-by-Step)

1. **Clone the repository:**
   ```sh
   git clone https://github.com/alG-N/FumoBOT.git
   cd FumoBOT
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Install Docker Desktop:**
   - Download and install from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - Start Docker Desktop and ensure it is running
4. **Install required binaries:**
   - [ffmpeg](https://ffmpeg.org/download.html) (add to PATH)
   - [yt-dlp](https://github.com/yt-dlp/yt-dlp) (add to PATH)
5. **Create `.env` file:**
   - Copy the example from above and fill in all required secrets
6. **Configure Lavalink, yt-cipher, cobalt:**
   - Download Lavalink, configure `application.yml`, run on `localhost:2333`
   - Run yt-cipher and cobalt as Docker containers (see Music/Video/Media Setup)
   - Update bot config to match endpoints and passwords
7. **Start the bot:**
   - With Node.js:
     ```sh
     node MainBOT/FumoBOTMain.js
     ```
   - With PM2:
     ```sh
     npm install pm2 -g
     pm2 start MainBOT/FumoBOTMain.js --name=fumobot
     ```
   - With Docker Compose:
     ```sh
     docker-compose up --build
     ```
8. **Register commands and test:**
   - Use `.help` and `.tutorialHelp` in Discord
   - Check logs for errors and fix any issues

---

## 🧪 Testing Guidelines

- **Command Testing:**
   - Test every command for success and failure cases
   - Test all aliases and edge cases
   - Use Jest for unit tests (see `MainCommand/Test/`)
- **Database Testing:**
   - Verify read/write operations for user profiles, inventory, currency, farming, pets, quests
   - Test migrations and backup/restore
- **Economy Balancing:**
   - Simulate earning/spending flows, check for infinite loops or exploits
   - Adjust config files for fair rates
- **Error Handling:**
   - Trigger errors intentionally, verify safe user messages and proper logging
- **User Flow Simulation:**
   - Create new users, run through starter, daily, gacha, farming, pets, trading
- **Music/Video/API Features:**
   - Test music playback (Lavalink, yt-cipher, ffmpeg, yt-dlp)
   - Test API integrations (Reddit, Pixiv, Steam, etc.)
   - Check Docker containers are running and accessible
- **Performance Testing:**
   - Simulate high user load, check for lag or crashes
- **Security Testing:**
   - Ensure secrets are not exposed, permissions are correct, and no sensitive data is leaked

---

## 🚀 Deployment Guide (Options & Checklist)

### Options
- **Railway/Render.com:**
   - Push your repo, set up environment variables, configure Docker if needed
- **VPS/Local:**
   - Install all dependencies, set up Docker, run bot and services
- **Docker:**
   - Use provided Dockerfile/docker-compose.yml for full stack deployment
- **PM2:**
   - Use for process management, auto-restart, and log management

### Checklist
- Never commit `.env` or sensitive data
- Remove debug logs before production
- Ensure all commands are registered and working
- Test in a private Discord server before public launch
- Monitor logs and performance after deployment

---

# 🧼 Deployment Checklist

- `.env` is not committed
- Remove debug logs and sensitive info
- No sensitive data exposed in logs or errors
- All commands registered and tested
- Test in private Discord server
- No breaking changes or regressions
- Docker containers running and accessible
- API keys and endpoints verified
- Database backups created
- Monitor bot after launch for errors and performance

---

# 🧪 Recommended Tools & Utilities

- **Nodemon:** Live reload for development
- **ESLint:** Code quality and linting
- **Prettier:** Code formatting
- **SQLite viewer:** GUI for inspecting database
- **GitHub Copilot:** AI coding assistant
- **Jest:** Unit testing framework
- **PM2:** Process management and monitoring
- **Docker Compose:** Multi-service orchestration
- **DB Browser for SQLite:** Database inspection and editing
- **Discord.js DevTools:** For debugging Discord API issues

---

# 🧷 Notes for New Developers (Best Practices)

- Always work in your own branch
- Make small, meaningful commits with clear messages
- Update documentation for every new feature or change
- Ask before rewriting major systems or refactoring core modules
- Respect code style, structure, and naming conventions
- Avoid unnecessary dependencies and keep package.json clean
- Test all changes locally and in Discord before PR
- Communicate with other devs for major changes

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