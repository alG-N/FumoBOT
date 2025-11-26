# FumoBOT – Complete Overview & Tutorial

FumoBOT is a versatile, feature-rich Discord bot designed to enhance your server experience with fun, economy systems, customization, utilities, and more. This document merges both the feature overview and tutorial commands into one unified reference.

---

## 🌟 Features

### 🎉 Fun Commands
Memes, games, and interactive features to keep your server active.

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
Fun + utility + economy combined in one bot. Regularly updated.

---

## 🚀 Getting Started

1. Invite FumoBOT using the official link.  
2. Configure the bot through settings or commands.  
3. Type `.help` for all commands.  
4. Join the community server for updates & support.

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
| `.pray` | `.p` | A luck-based daily roll with small rewards. |
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

## 📂 Using the Code (Important)

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

If you reuse any part of the bot, it's alright, we're all learning somehow.

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
- A code editor (VS Code recommended)

### **🗄️ 2. Database**
FumoBOT uses:
- **MongoDB** (MongoDB Atlas or local server)

You must set up a database and add the connection string to your config.

### **🔑 3. Developer Tokens**
You will need:
- Discord **Bot Token**
- Discord **Client ID**
- Discord **Guild ID** (optional for quick command testing)
- MongoDB connection link

Never share these tokens publicly.

---

## ⚙️ Project Setup

1. Clone the project:
   ```bash
   git clone https://github.com/your/fumobot
   cd fumobot
   ```

2. Install dependencies:
    ``` npm install
    ```

3. You'll need to create some of the .env file for reddit, the Discord Bot token, and your Test Server's channel ID

4. You can start the bot by running the main file, which is "FumoBOTMain.js", by start debugging on run. 
OR
```npm install pm2
```
And run ```pm2 start MainBOT\FumoBOTMain.js --name=fumobot```

---

## 📩 Contact

For **ideas, bug reports, collaboration, or contribution help**, contact:

### **Discord:** `golden_exist`

I respond fastest on Discord and can guide contributions directly.

---

Thank you for supporting and respecting the project!  
Your contributions help FumoBOT grow in a healthy, creative direction.