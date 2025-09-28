const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActivityType,
    Events,
    Collection
} = require('discord.js');
const db = require('./Command/database/db');
const fs = require('fs');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
require('dotenv').config();
client.setMaxListeners(150);

const path = require('path');
client.commands = new Collection();
const commandFolders = [
    'BotTrollinCommand(Owner)',
    'OtherFunCommand'
];
for (const folder of commandFolders) {
    const commandsPath = path.join(__dirname, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${file} in ${folder} is missing "data" or "execute".`);
        }
    }
}

// Load all event files
const gacha = require('./Command/Gacha/crategacha');
const fumos = require('./ThyFumoStorage');
const help = require('./Command/Tutorial/help');
const inventory = require('./Command/UserData/Storage');
const balance = require('./Command/UserData/Balance');
const item = require('./Command/UserData/Item');
const Efumos = require('./EventFumoStorage');
const Egacha = require('./Command/Gacha/eventgacha');
const library = require('./FumoData/library');
const libraryFumos = require('./FumoData/libraryFumo');
const inform = require('./FumoData/inform');
const leaderboard = require('./Command/UserData/leaderboard');
const gamble = require('./Command/Gacha/gamble');
const slot = require('./Command/Gacha/slot');
const flip = require('./Command/Gacha/flip');
const mysteryCrate = require('./Command/Gacha/mysterycrate');
const sell = require('./Command/UserData/sell');
const pray = require('./Command/PrayCMD/pray');
const Pfumos = require('./Command/PrayCMD/fumoStorage');
const market = require('./Command/Market/market');
const marketFumos = require('./Command/Market/Storage/marketStorage');
const exchange = require('./Command/Market/exchange');
const shop = require('./Command/Market/shop');
const useItem = require('./Command/UserData/use');
const itemInfo = require('./Command/UserData/itemInfo');
const boost = require('./Command/UserData/boost');
const credit = require('./Command/UserData/aboutBot');
const Pcraft = require('./Command/Craft/potionCraft');
const Icraft = require('./Command/Craft/itemCraft');
const craft = require('./Command/Craft/craft');
const quest = require('./Command/UserData/quest');
const daily = require('./Command/UserData/daily');
const starter = require('./Command/UserData/starter');
const eggshop = require('./Command/Market/eggshop');
const eggInventory = require('./Command/UserData/PetData/eggInventory');
const eggOpen = require('./Command/UserData/PetData/eggOpen');
const eggcheck = require('./Command/UserData/PetData/eggcheck');
const equipPet = require('./Command/UserData/PetData/equipPet');

//Const for only farming table
const useFragment = require('./Command/FarmingPhase/useFragment');
const farm = require('./Command/FarmingPhase/addFarm');

// Create maintances
const { maintenance, developerID } = require("./Command/Maintenace/MaintenaceConfig");
console.log(`Maintenance mode is currently: ${maintenance}`);

// Backup Database (save only, notify in Discord, no zip)
const DB_PATH = './MainBOT/Command/database/fumos.db';
const BACKUP_DIR = './backup';
const CHANNEL_ID = '1367500981809447054';
const AdmZip = require('adm-zip');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

async function backupAndSendDB() {
    try {
        console.log('🚀 Starting backup process...');

        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempDir = path.join(BACKUP_DIR, `temp_${timestamp}`);
        fs.mkdirSync(tempDir);

        const filesToBackup = ['fumos.db', 'fumos.db-wal', 'fumos.db-shm'];
        const copiedFiles = [];

        for (const file of filesToBackup) {
            const sourcePath = path.join(path.dirname(DB_PATH), file);
            const destPath = path.join(tempDir, file);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
                copiedFiles.push(file);
                console.log(`📁 Copied ${file}`);
            } else {
                console.log(`⚠️ Skipped missing file: ${file}`);
            }
        }

        const zipPath = path.join(BACKUP_DIR, `fumos_backup_${timestamp}.zip`);
        const zip = new AdmZip();
        zip.addLocalFolder(tempDir);
        zip.writeZip(zipPath);
        console.log(`🗜️ Created zip: ${zipPath}`);

        // Clean up temp folder
        fs.rmSync(tempDir, { recursive: true, force: true });

        const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);

        const MAX_DISCORD_FILE_SIZE = 25 * 1024 * 1024; // 25MB
        const actualSize = fs.statSync(zipPath).size;
        // Build file stats
        const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

        const fileStats = copiedFiles.map(file => {
            const originalPath = path.join(path.dirname(DB_PATH), file);
            const originalSize = fs.existsSync(originalPath) ? fs.statSync(originalPath).size : 0;
            return `📄 \`${file}\` → 🗃️ ${formatSize(originalSize)}`;
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 Database Backup Completed')
            .setColor(actualSize <= MAX_DISCORD_FILE_SIZE ? 0x2ECC71 : 0xE67E22)
            .addFields(
                {
                    name: 'Included Files',
                    value: fileStats.length > 0 ? fileStats.join('\n') : '⚠️ No files were copied.'
                },
                {
                    name: 'Backup Zip',
                    value: `\`${path.basename(zipPath)}\`\n💾 Size: **${zipSize} MB**`
                }
            )
            .setTimestamp();
        // Send message to channel
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            if (actualSize <= MAX_DISCORD_FILE_SIZE) {
                await channel.send({
                    content: `✅ Backup successful and uploaded below.`,
                    embeds: [embed],
                    files: [zipPath]
                });
            } else {
                embed.addFields({
                    name: 'Note',
                    value: `⚠️ File too large to upload (limit is 25MB).\n` +
                        `You can retrieve the backup manually from the server:\n\`${zipPath}\``
                });

                await channel.send({
                    embeds: [embed]
                });
            }
        }

        // Delete old zip backups (keep last 5)
        const zipFiles = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('fumos_backup_') && f.endsWith('.zip'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        const oldZips = zipFiles.slice(5);
        for (const f of oldZips) {
            fs.unlinkSync(path.join(BACKUP_DIR, f.name));
            console.log(`🗑️ Deleted old zip: ${f.name}`);
        }

        console.log(`✅ Backup finished. Total kept: ${zipFiles.length}, Deleted: ${oldZips.length}`);
    } catch (error) {
        console.error('❌ Error during backup:', error);
    }
}

// Schedule backup every 12 hours (at midnight and noon)
cron.schedule('0 */12 * * *', () => {
    console.log('⏰ Running scheduled backup...');
    backupAndSendDB();
});

// Create tables if they don't exist
const createTables = () => {
    db.run(`CREATE TABLE IF NOT EXISTS userCoins (
    userId TEXT PRIMARY KEY, 
    coins INTEGER, 
    gems INTEGER, 
    joinDate TEXT, 
    luck INTEGER DEFAULT 0, 
    reimuStatus INTEGER DEFAULT 0, 
    reimuPenalty INTEGER DEFAULT 0, 
    prayedToMarisa INTEGER, 
    rollsLeft INTEGER DEFAULT 0, 
    totalRolls INTEGER DEFAULT 0, 
    dailyStreak INTEGER DEFAULT 0, 
    dateObtained TEXT, 
    fumoName TEXT, 
    luckRarity TEXT, 
    lastDailyBonus INTEGER,
    rollsSinceLastMythical INTEGER DEFAULT 0,
    rollsSinceLastQuestionMark INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    rebirth INTEGER DEFAULT 0,
    exp INTEGER DEFAULT 0,
    lastRollTime INTEGER DEFAULT 0,
    rollCount INTEGER DEFAULT 0,
    rollsInCurrentWindow INTEGER DEFAULT 0,
    coinsEarned INTEGER DEFAULT 0,
    gemsEarned INTEGER DEFAULT 0,
    yukariCoins INTEGER DEFAULT 0,
    yukariGems INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    spiritTokens INTEGER DEFAULT 0,
    marisaBorrowCount INTEGER DEFAULT 0,
    marisaDonationCount INTEGER DEFAULT 0,
    boostCharge INTEGER DEFAULT 0,
    boostActive INTEGER DEFAULT 0,
    boostRollsRemaining INTEGER DEFAULT 0,
    pityTranscendent INTEGER DEFAULT 0,
    pityEternal INTEGER DEFAULT 0,
    pityInfinite INTEGER DEFAULT 0,
    pityCelestial INTEGER DEFAULT 0,
    pityAstral INTEGER DEFAULT 0,
    reimuUsageCount INTEGER DEFAULT 0,
    reimuLastReset INTEGER DEFAULT 0,
    hasFantasyBook INTEGER DEFAULT 0
  )`, err => { if (err) console.error('Error creating userCoins table:', err.message); });

    db.run(`
    CREATE TABLE IF NOT EXISTS redeemedCodes (
      userId TEXT NOT NULL,
      code TEXT NOT NULL,
      PRIMARY KEY (userId, code)
    )
  `, err => {
        if (err) {
            console.error('Error creating redeemedCodes table:', err.message);
        }
    });

    // db.run(`DROP TABLE IF EXISTS farmingFumos`, (err) => {
    //   if (err) {
    //     console.error('Error dropping farmingFumos table:', err.message);
    //   } else {
    //     console.log('farmingFumos table deleted successfully.');
    //   }
    // });

    db.run(`CREATE TABLE IF NOT EXISTS farmingFumos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT, 
    fumoName TEXT, 
    coinsPerMin INTEGER, 
    gemsPerMin INTEGER,
    quantity INTEGER DEFAULT 1,
    rarity TEXT,
    UNIQUE(userId, fumoName)
  )`, err => { if (err) console.error('Error creating farmingFumos table:', err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS userUsage (
    userId TEXT, 
    command TEXT, 
    date TEXT, 
    count INTEGER, 
    PRIMARY KEY (userId, command)
  )`, err => { if (err) console.error('Error creating userUsage table:', err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS userInventory (
    id INTEGER PRIMARY KEY, 
    userId TEXT, 
    fumoName TEXT,
    rarity TEXT, 
    type TEXT, 
    items TEXT, 
    itemName TEXT, 
    quantity INTEGER DEFAULT 1,
    dateObtained TEXT,
    luckRarity TEXT,
    UNIQUE (userId, itemName)
  )`, err => { if (err) console.error('Error creating userInventory table:', err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS userUpgrades (
    userId TEXT PRIMARY KEY, 
    fragmentUses INTEGER DEFAULT 0
  )`, err => { if (err) console.error('Error creating userUpgrades table:', err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS userBalance (
    userId TEXT PRIMARY KEY, 
    balance INTEGER
  )`, err => { if (err) console.error('Error creating userBalance table:', err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS dailyQuests (
    userId TEXT, 
    quest TEXT, 
    reward INTEGER, 
    completed INTEGER DEFAULT 0,
    date TEXT
  )`, err => { if (err) console.error('Error creating dailyQuests table:', err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS userExchangeLimits (
    userId TEXT,
    date TEXT,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (userId, date)
  )`, err => {
        if (err) console.error('Error creating userExchangeLimits table:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS exchangeHistory (
    userId TEXT,
    type TEXT,
    amount REAL,
    taxedAmount REAL,
    result REAL,
    date TEXT
  )`, err => {
        if (err) console.error('Error creating exchangeHistory table:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS exchangeRate (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    coinToGem REAL DEFAULT 10.0
  )`, err => {
        if (err) {
            console.error('Error creating exchangeRate table:', err.message);
        } else {
            // Only run this insert AFTER table creation has succeeded
            db.run(`INSERT OR IGNORE INTO exchangeRate (id, coinToGem) VALUES (1, 10.0)`);
        }
    });

    db.run(`
    CREATE TABLE activeBoosts (
        userId TEXT,
        type TEXT,
        source TEXT,
        multiplier REAL,
        expiresAt INTEGER,
        stack INTEGER DEFAULT 1,
        PRIMARY KEY(userId, type, source)
    );
    `, (err) => {
        if (err) return // console.error("❌ Error creating activeBoosts table:", err.message);
        console.log("✅ activeBoosts table ready");
    });

    db.run(`ALTER TABLE activeBoosts ADD COLUMN uses INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes("duplicate column")) {
            console.error("Failed to add 'uses' column:", err);
        } else {
            // console.log("✅ 'uses' column added (or already exists)");
        }
    });

    db.run(`ALTER TABLE userCoins ADD COLUMN yukariMark INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding yukariMark column:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS sakuyaUsage (
          userId TEXT PRIMARY KEY,
          uses INTEGER DEFAULT 0,
          lastUsed INTEGER,
          firstUseTime INTEGER,
          timeBlessing INTEGER DEFAULT 0,
          blessingExpiry INTEGER
        )
    `, (err) => {
        if (err) {
            // console.error("Failed to create sakuyaUsage table:", err.message);
        } else {
            // console.log("sakuyaUsage table is ready.");
        }
    });

    // Daily quest progress table (unchanged)
    db.run(`CREATE TABLE IF NOT EXISTS dailyQuestProgress (
    userId TEXT,
    questId TEXT,
    progress INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    date TEXT,
    PRIMARY KEY (userId, questId, date)
    )`);

    // Updated: Weekly quest progress table (no banner dependency)
    db.run(`CREATE TABLE IF NOT EXISTS weeklyQuestProgress (
    userId TEXT,
    questId TEXT,
    progress INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    week TEXT,
    PRIMARY KEY (userId, questId, week)
    )`);

    // Achievement progress table (unchanged)
    db.run(`CREATE TABLE IF NOT EXISTS achievementProgress (
    userId TEXT,
    achievementId TEXT,
    progress INTEGER DEFAULT 0,
    claimed INTEGER DEFAULT 0,
    PRIMARY KEY (userId, achievementId)
    )`);

    db.run(`
        CREATE TABLE IF NOT EXISTS userCraftHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        itemName TEXT NOT NULL,
        amount INTEGER NOT NULL,
        craftedAt INTEGER NOT NULL
    )
`);

    db.run(`
        CREATE TABLE IF NOT EXISTS potionCraftHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        itemName TEXT NOT NULL,
        amount INTEGER NOT NULL,
        craftedAt INTEGER NOT NULL
    )
`);

    // Pet database
    db.run(`CREATE TABLE IF NOT EXISTS petInventory (
    petId TEXT PRIMARY KEY,
    userId TEXT,
    type TEXT,      
    name TEXT,        
    timestamp INTEGER, 
    level INTEGER,
    weight REAL, 
    age INTEGER,
    quality REAL,
    rarity TEXT,
    hunger INTEGER DEFAULT 100,
    ageXp INTEGER DEFAULT 0,
    lastHungerUpdate INTEGER DEFAULT (strftime('%s','now')),
)`, function (err) {
        if (err) {
            // console.error("❌ Failed to create table 'petInventory':", err.message);
        } else {
            console.log("✅ Table 'petInventory' is ready.");
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS hatchingEggs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    eggName TEXT,
    startedAt INTEGER,
    hatchAt INTEGER
)`, function (err) {
        if (err) {
            // console.error("❌ Failed to create table 'hatchingEggs':", err.message);
        } else {
            // console.log("✅ Table 'hatchingEggs' is ready.");
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS equippedPets (
    userId TEXT,
    petId TEXT,
    PRIMARY KEY (userId, petId),
    FOREIGN KEY (petId) REFERENCES petInventory(petId)
)`);

    db.run(`ALTER TABLE petInventory ADD COLUMN ability TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            // console.error("❌ Failed to add 'ability' column:", err.message);
        } else {
            // console.log("✅ Column 'ability' added (if not already present).");
        }
    });

    // Drop petInventory table
    // db.run(`DROP TABLE IF EXISTS petInventory`, (err) => {
    //     if (err) {
    //         console.error("Error dropping petInventory table:", err);
    //     } else {
    //         console.log("petInventory table dropped successfully.");
    //     }
    // });

    // // Drop hatchingEggs table
    // db.run(`DROP TABLE IF EXISTS hatchingEggs`, (err) => {
    //     if (err) {
    //         console.error("Error dropping hatchingEggs table:", err);
    //     } else {
    //         console.log("hatchingEggs table dropped successfully.");
    //     }
    // });

    // Drop equippedPets table
    // db.run(`DROP TABLE IF EXISTS equippedPets`, (err) => {
    //     if (err) {
    //         console.error("Error dropping equippedPets table:", err);
    //     } else {
    //         console.log("equippedPets table dropped successfully.");
    //     }
    // });

};

db.run(`CREATE TABLE IF NOT EXISTS userSales (
  userId TEXT, 
  fumoName TEXT, 
  quantity INTEGER, 
  timestamp INTEGER
)`, err => {
    if (err) {
        console.error('Error creating userSales table:', err.message);
    } else {
        // console.log('userSales table created or already exists.');
    }
});

db.run(`ALTER TABLE userCoins ADD COLUMN reimuPityCount INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes("duplicate")) {
        console.error("Error adding reimuPityCount column:", err.message);
    }
});

db.run(`ALTER TABLE userCoins ADD COLUMN timeclockLastUsed INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes("duplicate")) {
        console.error("Error adding reimuPityCount column:", err.message);
    }
});

db.run(`ALTER TABLE activeBoosts ADD COLUMN extra TEXT DEFAULT '{}'`, (err) => {
    if (err && !err.message.includes("duplicate")) {
        console.error("Error adding reimuPityCount column:", err.message);
    }
});

createTables();

// Ensure columns exist in userCoins and userInventory tables
const ensureColumnsExist = () => {
    const addColumnIfNotExists = (table, column, columnType) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnType}`, err => {
            if (err && !err.message.includes("duplicate column name")) {
                console.error(`Error adding column ${column} to ${table} table:`, err.message);
            }
        });
    };

    db.all(`PRAGMA table_info(userCoins)`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching userCoins table info:', err.message);
            return;
        }

        const existingColumns = rows.map(row => row.name);
        const requiredColumns = ['rollsSinceLastMythical', 'rollsSinceLastQuestionMark', 'level', 'rebirth'];

        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col)) {
                let columnType = 'INTEGER DEFAULT 0';
                if (col === 'level') columnType = 'INTEGER DEFAULT 1';
                addColumnIfNotExists('userCoins', col, columnType);
            }
        });
    });

    db.all(`PRAGMA table_info(userInventory)`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching userInventory table info:', err.message);
            return;
        }

        const requiredColumns = ['type', 'dateObtained', 'fumoName', 'luckRarity'];
        const existingColumns = rows.map(row => row.name);

        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col)) {
                addColumnIfNotExists('userInventory', col, 'TEXT');
            }
        });
    });
};
// checkUserCoinsTable();
ensureColumnsExist();

function logBoosts(userId) {
    db.all(`SELECT * FROM activeBoosts WHERE userId = ?`, (err, rows) => {
        if (err) return console.error("❌ Failed to fetch boosts:", err);
        if (!rows.length) {
            console.log(`📭 No boosts found for user ${userId}`);
        } else {
            console.log(`📦 Active boosts for user ${userId}:`, rows);
        }
    });
}

client.once('ready', () => {
    createTables();
    ensureColumnsExist();
    // Now you can call updateCoins
    updateCoins();
    cleanExpiredBoosts();
    // backupAndSendDB();
    // logBoosts('123456789012345678'); // Replace with a valid user ID for testing
});

// Update user's coin and gems(boostable), clean expired boost
function cleanExpiredBoosts() {
    const now = Date.now();
    db.run(`DELETE FROM activeBoosts WHERE expiresAt <= ?`, [now], (err) => {
        if (err) return console.error("❌ Error cleaning expired boosts:", err.message);
        // console.log("🧼 Cleaned expired boosts at", new Date().toISOString());
    });

    // Schedule next clean in 1 minute (60000 ms)
    setTimeout(cleanExpiredBoosts, 60000);
}

function updateCoins() {
    const now = Date.now();

    // Remove expired boosts
    db.run(`DELETE FROM activeBoosts WHERE expiresAt IS NOT NULL AND expiresAt <= ?`, [now]);

    db.all(`SELECT userId FROM userCoins`, (err, users) => {
        if (err) return console.error(err);
        if (!users || users.length === 0) return;

        users.forEach(user => {
            const userId = user.userId;

            // STEP 1: Fetch all boost multipliers
            db.all(`
                SELECT type, multiplier, source FROM activeBoosts
                WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)
            `, [userId, now], (err, boosts) => {
                if (err) return console.error(err);

                let coinMultiplier = 1;
                let gemMultiplier = 1;

                let coinSources = [];
                let gemSources = [];

                // STEP 2: Calculate multipliers
                boosts.forEach(b => {
                    const type = b.type.toLowerCase();
                    const mult = b.multiplier;

                    if (['coin', 'income'].includes(type)) {
                        coinMultiplier *= mult;
                        coinSources.push(`${type}:x${mult.toFixed(2)} from [${b.source}]`);
                    }
                    if (['gem', 'gems', 'income'].includes(type)) {
                        gemMultiplier *= mult;
                        gemSources.push(`${type}:x${mult.toFixed(2)} from [${b.source}]`);
                    }
                });

                const coinsToAdd = Math.floor(150 * coinMultiplier);
                const gemsToAdd = Math.floor(50 * gemMultiplier);

                // ✅ Debug log for testing
                // console.log(`💰 [${userId}] +${coinsToAdd} coins (x${coinMultiplier.toFixed(2)}): ${coinSources.join(', ') || 'none'}`);
                // console.log(`💎 [${userId}] +${gemsToAdd} gems (x${gemMultiplier.toFixed(2)}): ${gemSources.join(', ') || 'none'}`);

                // STEP 3: Update balances
                db.run(`
                    UPDATE userCoins
                    SET coins = COALESCE(coins, 0) + ?, gems = COALESCE(gems, 0) + ?
                    WHERE userId = ?
                `, [coinsToAdd, gemsToAdd, userId]);

                // STEP 4: Update quest progress
                const date = new Date().toISOString().slice(0, 10);
                const questId = "coins_1m";

                db.run(`
                    INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(userId, questId, date) DO UPDATE SET
                        progress = MIN(dailyQuestProgress.progress + ?, 1000000),
                        completed = CASE 
                            WHEN dailyQuestProgress.progress + ? >= 1000000 THEN 1
                            ELSE dailyQuestProgress.completed
                        END
                `, [userId, questId, date, coinsToAdd, 0, coinsToAdd, coinsToAdd]);
            });
        });

        // Run every 60 seconds
        setTimeout(updateCoins, 5000);
    });
}


//-----------------Functionality of the MAIN-----------------\\
//Define .crategacha command
gacha(client, fumos);

//Define .eventgacha command
Egacha(client, Efumos);

//Define .starter command
starter(client);

//Define .daily command
daily(client);

//Define .help command
help(client);

//Define .inventory command
inventory(client);

//Define .balance command
balance(client);

//Define .item command
item(client);

//Define .library command
library(client, libraryFumos);

//Define .inform command
inform(client);

//Define .leaderboard command
leaderboard(client);

//Define .gamble command
gamble(client);

//Define .slot command
slot(client);

//Define .flip command
flip(client);

//Define .mysteryCrate command
mysteryCrate(client)

//Define .sell command
sell(client);

//Define .pray command
pray(client, Pfumos);

//Define .market command
market(client, marketFumos);

//Define .exchange command
exchange(client);

//Define .shop command
shop(client);

//Define .use command
useItem(client);

//Define .itemInfo command
itemInfo(client);

//Define .boost command
boost(client);

//Define all Farming Fumo command
useFragment(client);
farm(client);

//Define .aboutBot command
credit(client);

// Define .potionCraft command
Pcraft(client);

// Define the .itemCraft command
Icraft(client);

// Define the .craft command
craft(client);

// Define the .quest command
quest(client);

// Define the .eggshop command
eggshop(client);

// Define the .eggInventory command
eggInventory(client);

// Define the .eggOpen command
eggOpen(client);

// Define the .eggcheck command
eggcheck(client);

// Define the .equipPet command
equipPet(client);

//Define the .code command
const validCodes = {
    "Welcome": {
        coins: 10000,
        gems: 500,
        expires: null,
        maxUses: null,
        description: "A warm welcome gift for new users!"
    },
    "UpdatedServer": {
        items: [
            { item: "PetFoob(C)", quantity: 15 },
            { item: "Dice(C)", quantity: 10 },
            { item: "10RollsTicket(M)", quantity: 1 },
            { item: "MysteriousTicket(E)", quantity: 1 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Updated server lets gooo!"
    },
    "BetaTest33": {
        items: [
            { item: "Lumina(M)", quantity: 150 },
            { item: "ForgottenBook(C)", quantity: 500 },
            { item: "RedShard(L)", quantity: 150 },
            { item: "WhiteShard(L)", quantity: 150 },
            { item: "YellowShard(L)", quantity: 150 },
            { item: "BlueShard(L)", quantity: 150 },
            { item: "DarkShard(L)", quantity: 150 },
            { item: "AncientRelic(E)", quantity: 150 },
            { item: "FragmentOf1800s(R)", quantity: 150 },
            { item: "Nullified(?)", quantity: 150 },
            { item: "HakureiTicket(L)", quantity: 150 },
            { item: "TimeClock(L)", quantity: 150 },
            { item: "MysteriousDice(M)", quantity: 150 },
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Beta tester exclusive!"
    },
    "golden_exist": {
        coins: 99999,
        gems: 9999,
        expires: null,
        maxUses: 1,
        description: "Only the first to find this gets the gold!"
    },
    "JACKPOT": {
        coins: 7777,
        gems: 777,
        expires: null,
        maxUses: null,
        description: "Lucky jackpot code!"
    },
};
// Utility: Format reward string
function formatReward(reward) {
    let parts = [];
    if (reward.coins) parts.push(`🪙 **${reward.coins.toLocaleString()} coins**`);
    if (reward.gems) parts.push(`💎 **${reward.gems.toLocaleString()} gems**`);
    if (reward.items) {
        reward.items.forEach(({ item, quantity }) => {
            parts.push(`🎁 **${item}** x${quantity}`);
        });
    }
    return parts.length ? parts.join('\n') : "*No reward data*";
}
// Utility: Log errors with context
function logCodeError(context, error) {
    console.error(`[CodeRedemption] ${context}:`, error);
}
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    // Show code info
    if (message.content === '.code') {
        // Suggestion: Show available (non-expired) codes if user is admin
        const isAdmin = ['1128296349566251068', '1362450043939979378'].includes(message.author.id);
        let codeList = '';
        if (isAdmin) {
            codeList = '\n\n**Active Codes:**\n' +
                Object.entries(validCodes)
                    .filter(([k, v]) => !v.expires || new Date(v.expires) > new Date())
                    .map(([k, v]) => `\`${k}\` - ${v.description || 'No description'}`)
                    .join('\n');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎁 Code Redemption System')
            .setDescription(
                'Welcome to the **Code Redemption System**! 🎉\n\n' +
                'Find secret codes around the bot and enter them to claim amazing rewards! 🏆💎\n\n' +
                'Here’s how it works:\n' +
                '1. **Find a code** hidden in various parts of the bot.\n' +
                '2. **Enter** the code using `.code <code>`.\n' +
                '3. **Enjoy** your rewards!\n' +
                (isAdmin ? codeList : '') +
                '\n\nGood luck and have fun! 🤩'
            )
            .setColor(0xFFD700)
            .setThumbnail('https://static.wikia.nocookie.net/nicos-nextbots-fanmade/images/f/f4/Bottled_cirno.png/revision/latest?cb=20240125031826')
            .setImage('https://media.istockphoto.com/id/520327210/photo/young-boy-finding-treasure.jpg?s=612x612&w=0&k=20&c=Q3PcIngIESMXeXofRLnWwq1wwMO3VmznA9T2Mg1gt2I=')
            .setFooter({ text: 'Remember: Each code can only be used once!', iconURL: 'https://gcdn.thunderstore.io/live/repository/icons/FraDirahra-Fumo_Cirno-1.0.0.png.256x256_q95.png' })
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }

    // Redeem code
    if (message.content.startsWith('.code ')) {
        const code = message.content.split(' ')[1]?.trim();
        const reward = validCodes[code];
        const userId = message.author.id;
        const currentDate = new Date().toISOString();

        if (!code || !reward) {
            const embed = new EmbedBuilder()
                .setTitle('Invalid Code')
                .setDescription('The code you entered is invalid. Please try again.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Check your spelling and try again!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Check expiration
        if (reward.expires && new Date() > new Date(reward.expires)) {
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('⏰ Code Expired')
                    .setDescription(`Sorry, the code **${code}** has expired.`)
                    .setColor(0xFFA500)
                ]
            });
        }

        // Check usage limit (global)
        if (reward.maxUses) {
            try {
                const redeemedCount = await new Promise((resolve, reject) => {
                    db.get(`SELECT COUNT(*) as count FROM redeemedCodes WHERE code = ?`, [code], (err, row) => {
                        if (err) return reject(err);
                        resolve(row.count);
                    });
                });
                if (redeemedCount >= reward.maxUses) {
                    return message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🚫 Code Limit Reached')
                            .setDescription(`Sorry, the code **${code}** has already been fully redeemed.`)
                            .setColor(0xFF0000)
                        ]
                    });
                }
            } catch (err) {
                logCodeError('Checking code usage limit', err);
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('Error')
                        .setDescription('Could not verify code usage. Please try again later.')
                        .setColor(0xFF0000)
                    ]
                });
            }
        }

        try {
            // Check if user already redeemed
            const redeemedRow = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM redeemedCodes WHERE userId = ? AND code = ?`, [userId, code], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });
            if (redeemedRow) {
                const embed = new EmbedBuilder()
                    .setTitle('Code Already Redeemed')
                    .setDescription(`You have already redeemed the code **${code}**. Each code can only be used once.`)
                    .setColor(0xFF4500);
                return message.channel.send({ embeds: [embed] });
            }

            // Transaction: update coins/gems/items atomically
            await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', err => err ? reject(err) : resolve()));
            try {
                // Coins/gems
                if (reward.coins || reward.gems) {
                    const coinsRow = await new Promise((resolve, reject) => {
                        db.get(`SELECT * FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
                            if (err) return reject(err);
                            resolve(row);
                        });
                    });
                    if (coinsRow) {
                        await new Promise((resolve, reject) => {
                            db.run(`UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
                                [reward.coins || 0, reward.gems || 0, userId], err => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                        });
                    } else {
                        await new Promise((resolve, reject) => {
                            db.run(`INSERT INTO userCoins (userId, coins, gems, joinDate) VALUES (?, ?, ?, ?)`,
                                [userId, reward.coins || 0, reward.gems || 0, currentDate], err => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                        });
                    }
                }

                // Items (support multiple items)
                if (reward.items && Array.isArray(reward.items)) {
                    for (const { item, quantity } of reward.items) {
                        const itemRow = await new Promise((resolve, reject) => {
                            db.get(`SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, item], (err, row) => {
                                if (err) return reject(err);
                                resolve(row);
                            });
                        });
                        if (itemRow) {
                            await new Promise((resolve, reject) => {
                                db.run(`UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                                    [quantity, userId, item], err => {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                            });
                        } else {
                            await new Promise((resolve, reject) => {
                                db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
                                    [userId, item, quantity], err => {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                            });
                        }
                    }
                }

                // Record redemption
                await new Promise((resolve, reject) => {
                    db.run(`INSERT INTO redeemedCodes (userId, code) VALUES (?, ?)`, [userId, code], err => {
                        if (err) return reject(err);
                        resolve();
                    });
                });

                await new Promise((resolve, reject) => db.run('COMMIT', err => err ? reject(err) : resolve()));
            } catch (err) {
                await new Promise((resolve, reject) => db.run('ROLLBACK', () => resolve()));
                throw err;
            }

            // Success message
            const rewardMsg = formatReward(reward);
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Code Redeemed!')
                .setDescription(`You've received:\n${rewardMsg}`)
                .setColor(0x00FF00)
                .setFooter({ text: 'Enjoy your rewards!' });
            message.channel.send({ embeds: [successEmbed] });

            // Feature: DM user a receipt (optional, can comment out)
            try {
                await message.author.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🎁 Code Redemption Receipt')
                            .setDescription(`You redeemed code: **${code}**\n\n${rewardMsg}`)
                            .setColor(0x00FF00)
                            .setTimestamp()
                    ]
                });
            } catch (dmErr) {
                // Ignore DM errors (user may have DMs closed)
            }

        } catch (error) {
            logCodeError('Redeeming code', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('Something went wrong. Please try again later.')
                .setColor(0xFF0000);
            message.channel.send({ embeds: [errorEmbed] });
        }
    }
});
//-----------------Functionality of the OTHER-----------------\\
const anime = require('./OtherFunCommand/anime');
const afk = require('./OtherFunCommand/afk');
const musicCommands = require('./OtherFunCommand/MusicFunction/MainMusic');

//Define .afk command
client.on(Events.MessageCreate, message => {
    afk.onMessage(message, client);
});

//Define .anime command
client.on(Events.MessageCreate, message => {
    anime.onMessage(message, client);
});

//Define music command
musicCommands(client);

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        if (interaction.isRepliable()) {
            if (interaction.deferred || interaction.replied) {
                // Already acknowledged → just log the error, do not follow up
                console.warn("Interaction has already been acknowledged, cannot reply or follow up.");
            } else {
                // Safe to reply
                await interaction.reply({
                    content: "❌ There was an error executing this command!",
                    ephemeral: true
                });
            }
        } else {
            // Interaction is no longer valid, just log the error
            console.warn("Interaction is no longer repliable.");
        }
    }
});

//-----------------Functionality of the BOT-----------------\\
function setStaticStatus() {
    try {
        if (client.user) {
            client.user.setPresence({
                activities: [{
                    name: '.help and .starter',
                    type: ActivityType.Playing,
                }],
                status: 'online', // or 'idle', 'dnd', etc.
            });
            console.log('Status set to: Playing .help and .starter');
        } else {
            console.warn('Client user is not ready yet.');
        }
    } catch (error) {
        console.error('Failed to set bot presence:', error);
    }
}
// When the bot is ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    setStaticStatus();
    // backupAndSendDB(); // -- turn off if u are testing new feature
});

// Define .report command
// Ticket setup
let ticketCounter = 0;
const ticketFile = 'ticketCounter.txt';
const tickets = new Map();

// Load or initialize ticket counter
if (fs.existsSync(ticketFile)) {
    ticketCounter = parseInt(fs.readFileSync(ticketFile, 'utf8'), 10);
} else {
    fs.writeFileSync(ticketFile, '0', 'utf8');
}

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('.report')) return;

    const promptEmbed = new EmbedBuilder()
        .setTitle('📩 Report an Issue/Suggestion to alterGolden')
        .setDescription('Reply to this message with a brief description of your problem/suggestion.\nOr appeal for a ban if you were banned.')
        .setColor(0xff0000);

    try {
        const sentPrompt = await message.channel.send({ embeds: [promptEmbed] });

        const filter = m =>
            m.reference?.messageId === sentPrompt.id && m.author.id === message.author.id;

        const collector = message.channel.createMessageCollector({ filter, time: 60000 });

        collector.on('collect', async m => {
            const problemDescription = m.content;

            // Delete user’s message
            await m.delete().catch(() => null);

            // Increment and store ticket count
            ticketCounter++;
            fs.writeFileSync(ticketFile, ticketCounter.toString(), 'utf8');

            // Fetch target guild and channel
            const guild = client.guilds.cache.get('1255091916823986207');
            const reportChannel = guild?.channels.cache.get('1362826913088799001');

            if (!guild || !reportChannel?.isTextBased()) {
                console.error('Guild or channel not found.');
                return;
            }

            const reportEmbed = new EmbedBuilder()
                .setTitle(`🎟️ New Support Ticket #${ticketCounter}`)
                .setDescription(`Please reply to this message to respond to the user.`)
                .addFields(
                    { name: '📝 Problem/Suggestion:', value: problemDescription },
                    { name: '🙋 Reported by:', value: `${m.author.tag} (${m.author.id})` }
                )
                .setColor(0x00ff00)
                .setTimestamp();

            try {
                const reportMsg = await reportChannel.send({ embeds: [reportEmbed] });

                tickets.set(reportMsg.id, { userId: m.author.id, responded: false });

                await sentPrompt.delete().catch(() => null);

                await message.channel.send('✅ Thank you! We’ll look into your issue shortly. Please check and open your DMs, so we can send you a message!');

                const replyFilter = response =>
                    response.reference?.messageId === reportMsg.id;

                const replyCollector = reportChannel.createMessageCollector({ filter: replyFilter, time: 60000 });

                replyCollector.on('collect', async response => {
                    const ticket = tickets.get(reportMsg.id);

                    if (!ticket) return;

                    if (ticket.responded) {
                        return await response.reply('⚠️ This ticket has already been responded to.');
                    }

                    const userResponse = response.content;

                    const replyEmbed = new EmbedBuilder()
                        .setTitle(`💬 Response to Your Ticket #${ticketCounter}`)
                        .addFields(
                            { name: 'Responded by:', value: `${response.author.tag} (${response.author.id})` },
                            { name: 'Message:', value: userResponse }
                        )
                        .setColor(0x0000ff)
                        .setTimestamp();

                    try {
                        const user = await client.users.fetch(ticket.userId);
                        await user.send({ embeds: [replyEmbed] });
                        await response.reply('📨 Response has been sent to the user.');

                        tickets.set(reportMsg.id, { ...ticket, responded: true });
                    } catch (err) {
                        console.error('Error DMing user:', err);
                        await response.reply('❌ Failed to send the response to the user.');
                    }
                });

                replyCollector.on('end', collected => {
                    if (collected.size === 0) {
                        reportChannel.send('⌛ No reply to the support ticket was made in time.');
                    }
                });

            } catch (err) {
                console.error('Error sending report:', err);
                await message.channel.send('❌ Failed to submit your report. Please try again later.');
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                message.channel.send('⏳ You did not respond in time. Try using `/report` again.');
                sentPrompt.delete().catch(() => null);
            }
        });

    } catch (err) {
        console.error('Error creating report prompt:', err);
        message.channel.send('⚠️ Something went wrong while starting the report process.');
    }
});

// Global Anti-Crash Handlers / PM2 fix n help
const errorChannelId = '1367886953286205530';
/**
 * Error formatting and reporting utilities for global error handling.
 * - Formats errors for Discord and console.
 * - Sends error details to a designated Discord channel.
 * - Handles process-level unhandled errors.
 */
// Helper: Format error stack and message for Discord/console
function formatError(error) {
    if (error instanceof Error) {
        const stackLines = error.stack?.split('\n') || [];
        // Try to find the first stack line from the project directory, else fallback
        const relevantLine = stackLines.find(line =>
            line.includes(process.cwd())
        ) || stackLines[1] || 'Stack trace not available';

        return `${error.name}: ${error.message}\nAt: ${relevantLine.trim()}\n\n${error.stack}`;
    } else if (typeof error === 'object' && error !== null) {
        // Try to stringify objects (like rejection reasons)
        try {
            return JSON.stringify(error, null, 2);
        } catch {
            return String(error);
        }
    } else {
        return String(error);
    }
}
// Helper: Format uptime in a readable way
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
// Helper: Log errors to console with timestamp and prefix
function logToConsole(prefix, error) {
    const formatted = formatError(error);
    console.error(`🟥 [${new Date().toISOString()}] ${prefix}:\n${formatted}`);
}
// Helper: Send error details as an embed to a Discord channel
async function sendErrorEmbed(prefix, error) {
    try {
        // Wait for client to be ready
        if (!client?.channels?.fetch) return;

        // Fetch channel fresh to avoid cache issues
        const channel = await client.channels.fetch(errorChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const formatted = formatError(error).slice(0, 4000); // Discord embed field limit
        const uptime = formatUptime(process.uptime() * 1000);
        const guilds = client.guilds.cache.map(g => g.name).join(', ').slice(0, 1024) || 'N/A';

        const embed = new EmbedBuilder()
            .setTitle('🟥 Error Detected')
            .setDescription(`**${prefix}**`)
            .addFields(
                { name: 'Details', value: `\`\`\`js\n${formatted.slice(0, 1010)}\n\`\`\`` },
                { name: 'Bot Uptime', value: uptime, inline: true },
                { name: 'Connected Servers', value: guilds, inline: false }
            )
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `${client.user?.username || 'Bot'} • Error Logger` });

        await channel.send({ embeds: [embed] });

    } catch (sendErr) {
        // Log to console if Discord reporting fails
        console.error('🟥 Failed to send error embed to Discord:', formatError(sendErr));
    }
}
// Feature: Track and count errors for monitoring
let errorCount = 0;
function incrementErrorCount() {
    errorCount++;
    // Optionally: Add logic to alert if too many errors in a short time
}
// Global error handlers
process.on('unhandledRejection', async (reason, promise) => {
    incrementErrorCount();
    logToConsole('Unhandled Promise Rejection', reason);
    await sendErrorEmbed('Unhandled Promise Rejection', reason);
});
process.on('uncaughtException', async (error) => {
    incrementErrorCount();
    logToConsole('Uncaught Exception', error);
    await sendErrorEmbed('Uncaught Exception', error);
});
// Feature: Command to show error stats (admin only)
client.on('messageCreate', async (message) => {
    if (message.content.trim() === '.errorstats' && ['1128296349566251068', '1362450043939979378'].includes(message.author.id)) {
        const embed = new EmbedBuilder()
            .setTitle('🟠 Error Statistics')
            .setDescription(`Total errors since last restart: **${errorCount}**`)
            .setColor(0xFFA500)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
});
// setTimeout(() => {
//     Promise.reject(new Error('Simulated unhandled rejection'));
// }, 15000); // crashes 15 sec after start

//Reset everything.
client.on('messageCreate', async (message) => {
    if (message.content.trim() !== '.reset') return;

    const userId = message.author.id;

    // Allowed user IDs only
    const allowedUsers = ['1128296349566251068', '1362450043939979378'];

    if (!allowedUsers.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Access Denied')
                    .setDescription('❌ You do not have permission to use this command.')
            ]
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ Confirm Data Reset')
        .setDescription(
            '**Are you sure you want to reset ALL your data?**\nThis includes:\n- Coins\n- Inventory\n- Upgrades\n- Quests\n- Exchange History\n\nType `yes` to confirm within `15 seconds`.'
        );

    const msg = await message.channel.send({ embeds: [confirmEmbed] });

    const filter = (response) =>
        response.author.id === userId && response.content.toLowerCase() === 'yes';

    try {
        const collected = await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 15000,
            errors: ['time'],
        });

        // Begin DB operations after confirmation
        db.serialize(() => {
            db.run(`DELETE FROM userCoins WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM redeemedCodes WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM farmingFumos WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM userUsage WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM userInventory WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM userUpgrades WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM userBalance WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM dailyQuests WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM userExchangeLimits WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM exchangeHistory WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM activeBoosts WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM sakuyaUsage WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM dailyQuestProgress WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM weeklyQuestProgress WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM achievementProgress WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM petInventory WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM hatchingEggs WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM equippedPets WHERE userId = ?`, [userId]);
            db.run(`DELETE FROM userSales WHERE userId = ?`, [userId], function (err) {
                if (err) {
                    console.error('Reset error:', err.message);
                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('❗ Error')
                                .setDescription('Something went wrong while resetting your data. Please try again later.')
                        ]
                    });
                }

                const successEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('✅ Data Reset Complete')
                    .setDescription('All your user data has been successfully wiped from the system.');

                message.reply({ embeds: [successEmbed] });
            });
        });
    } catch (error) {
        const timeoutEmbed = new EmbedBuilder()
            .setColor('Grey')
            .setTitle('⏰ Timed Out')
            .setDescription('You did not confirm in time. Your data has **not** been reset.');

        message.reply({ embeds: [timeoutEmbed] });
    }
});
//Reset balance.
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.resetbalance')) return;

    const userId = message.author.id;

    // Whitelist of allowed users
    const allowedUsers = ['1128296349566251068', '1362450043939979378'];

    if (!allowedUsers.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ Confirm Coin & Gem Reset')
        .setDescription('Are you sure you want to reset your **coins and gems to 0**?\n\nType `yes` within 15 seconds to confirm.');

    await message.channel.send({ embeds: [confirmEmbed] });

    const filter = (response) =>
        response.author.id === userId && response.content.toLowerCase() === 'yes';

    try {
        const collected = await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 15000,
            errors: ['time'],
        });

        // Reset coin and gem values
        db.run(`UPDATE userCoins SET coins = 0, gems = 0 WHERE userId = ?`, [userId], function (err) {
            if (err) {
                console.error('Coin reset error:', err.message);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❗ Error')
                            .setDescription('Something went wrong while resetting your coins and gems.')
                    ]
                });
            }

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Balance Reset')
                .setDescription('Your **coins and gems** have been successfully reset to 0.');

            message.reply({ embeds: [successEmbed] });
        });
    } catch {
        const timeoutEmbed = new EmbedBuilder()
            .setColor('Grey')
            .setTitle('⏰ Timed Out')
            .setDescription('You didn’t confirm in time. Coins and gems were **not reset**.');

        message.reply({ embeds: [timeoutEmbed] });
    }
});
//Add balance.
client.on('messageCreate', async (message) => {
    if (message.content.trim().toLowerCase() !== '.addbalance') return;

    const userId = message.author.id;
    const allowedUsers = ['1128296349566251068', '1362450043939979378'];

    if (!allowedUsers.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ Confirm Add Balance')
        .setDescription('Are you sure you want to set your **coins and gems to 1,000,000,000**?\n\nType `yes` within 15 seconds to confirm.');

    await message.channel.send({ embeds: [confirmEmbed] });

    const filter = (response) =>
        response.author.id === userId && response.content.toLowerCase() === 'yes';

    try {
        await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 15000,
            errors: ['time'],
        });

        db.run(`UPDATE userCoins SET coins = 1000000000, gems = 1000000000 WHERE userId = ?`, [userId], (err) => {
            if (err) {
                console.error('Add balance error:', err.message);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❗ Error')
                            .setDescription('Something went wrong while updating your balance.')
                    ]
                });
            }

            const formattedCoins = (1000000000).toLocaleString();
            const formattedGems = (1000000000).toLocaleString();

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Balance Updated')
                .setDescription(`Your **coins** and **gems** have been set to \`${formattedCoins}\` and \`${formattedGems}\` successfully.`);

            message.reply({ embeds: [successEmbed] });
        });
    } catch {
        const timeoutEmbed = new EmbedBuilder()
            .setColor('Grey')
            .setTitle('⏰ Timed Out')
            .setDescription('You didn’t confirm in time. Your balance has **not** been changed.');

        message.reply({ embeds: [timeoutEmbed] });
    }
});


//-----------------Functionality of the Admin Command-----------------\\
/**
 * Add (give) an item to a user's inventory by userId and itemName.
 * Usage: .additem <userId> <itemName> <quantity>
 * Only allowed for bot admins.
 */
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.additem')) return;
    const allowedUsers = ['1128296349566251068'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.additem <userId> <itemName> [quantity]`')
            ]
        });
    }

    const [userId, ...rest] = args;
    let quantity = 1;
    let itemName = rest.join(' ');

    // If last arg is a number, treat as quantity
    if (!isNaN(rest[rest.length - 1])) {
        quantity = parseInt(rest.pop(), 10);
        itemName = rest.join(' ');
    }

    if (!itemName) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.additem <userId> <itemName> [quantity]`')
            ]
        });
    }

    // Check if item already exists for user
    db.get(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName],
        (err, row) => {
            if (err) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❗ Error')
                            .setDescription('Failed to add the item to the user\'s inventory.')
                    ]
                });
            }
            if (row) {
                // Update quantity
                db.run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                    [quantity, userId, itemName],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('❗ Error')
                                        .setDescription('Failed to update the item quantity.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Added')
                                    .setDescription(`Added **${quantity}x ${itemName}** to user \`${userId}\`.`)
                            ]
                        });
                    }
                );
            } else {
                // Insert new item
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
                    [userId, itemName, quantity],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('❗ Error')
                                        .setDescription('Failed to add the item to the user\'s inventory.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Added')
                                    .setDescription(`Added **${quantity}x ${itemName}** to user \`${userId}\`.`)
                            ]
                        });
                    }
                );
            }
        }
    );
});

//**
// * Remove (take) an item from a user's inventory by userId and itemName.
// * Usage: .removeitem <userId> <itemName> [quantity] */
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.removeitem')) return;
    const allowedUsers = ['1128296349566251068'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }
    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.removeitem <userId> <itemName> [quantity]`')
            ]
        });
    }
    const [userId, ...rest] = args;
    let quantity = 1;
    let itemName = rest.join(' ');
    // If last arg is a number, treat as quantity
    if (!isNaN(rest[rest.length - 1])) {
        quantity = parseInt(rest.pop(), 10);
        itemName = rest.join(' ');
    }
    if (!itemName) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.removeitem <userId> <itemName> [quantity]`')
            ]
        });
    }
    // Check if item exists for user
    db.get(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName],
        (err, row) => {
            if (err) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❗ Error')
                            .setDescription('Failed to remove the item from the user\'s inventory.')
                    ]
                });
            }
            if (!row || row.quantity < quantity) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Orange')
                            .setTitle('❌ Item Not Found')
                            .setDescription(`User \`${userId}\` does not have enough **${itemName}**.`)
                    ]
                });
            }
            // Update quantity
            db.run(
                `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                [quantity, userId, itemName],
                function (err) {
                    if (err) {
                        return message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('❗ Error')
                                    .setDescription('Failed to update the item quantity.')
                            ]
                        });
                    }
                    if (row.quantity - quantity <= 0) {
                        // If quantity goes to 0 or below, delete the item
                        db.run(
                            `DELETE FROM userInventory WHERE userId = ? AND itemName = ?`,
                            [userId, itemName],
                            function (err) {
                                if (err) {
                                    return message.reply({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor('Red')
                                                .setTitle('❗ Error')
                                                .setDescription('Failed to delete the item from the user\'s inventory.')
                                        ]
                                    });
                                }
                                message.reply({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor('Green')
                                            .setTitle('✅ Item Removed')
                                            .setDescription(`Removed **${quantity}x ${itemName}** from user \`${userId}\`.`)
                                    ]
                                });
                            }
                        );
                    } else {
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Quantity Updated')
                                    .setDescription(`Updated **${itemName}**
                                    quantity for user \`${userId}\` to **${row.quantity - quantity}**.`)
                            ]
                        });
                    }
                }
            );
        }
    );
});

//**
// * Ban a user from using the bot.
// * Usage: .ban <userId>
const banfilepath = './MainBOT/Command/Banned/Banned.json';
// Ensure the ban file exists
if (!fs.existsSync(banfilepath)) {
    fs.writeFileSync(banfilepath, JSON.stringify([]));
}
function parseDuration(durationStr) {
    const regex = /^(\d+)([smhdwy])$/i;
    const match = durationStr.match(regex);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000
    };

    return num * multipliers[unit];
}
function banUser(userId, reason, durationMs = null) {
    const banList = JSON.parse(fs.readFileSync(banfilepath));
    const expiresAt = durationMs ? Date.now() + durationMs : null;

    const existingIndex = banList.findIndex(b => b.userId === userId);
    if (existingIndex !== -1) {
        banList[existingIndex] = { userId, reason, expiresAt };
    } else {
        banList.push({ userId, reason, expiresAt });
    }

    fs.writeFileSync(banfilepath, JSON.stringify(banList, null, 2));
}
function unbanUser(userId) {
    const banList = JSON.parse(fs.readFileSync(banfilepath));
    const newList = banList.filter(ban => ban.userId !== userId);
    fs.writeFileSync(banfilepath, JSON.stringify(newList, null, 2));
}
function isBanned(userId) {
    const banList = JSON.parse(fs.readFileSync(banfilepath));

    const updatedBanList = banList.filter(ban => {
        if (ban.expiresAt && Date.now() > ban.expiresAt) {
            return false; // expired
        }
        return true;
    });

    if (updatedBanList.length !== banList.length) {
        fs.writeFileSync(banfilepath, JSON.stringify(updatedBanList, null, 2));
    }

    return updatedBanList.some(ban => ban.userId === userId);
}
// Handle commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const prefix = '.';
    if (!message.content.startsWith(prefix)) return;

    const fullCommand = message.content.slice(prefix.length).trim();
    const [command, ...args] = fullCommand.split(/ +/);
    const lowerCommand = command?.toLowerCase();

    // Security check: Only developer can run these
    if ((lowerCommand === 'ban' || lowerCommand === 'unban') && message.author.id !== developerID) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription('You do not have permission to use this command.')
            .setColor('Red');
        return message.reply({ embeds: [embed] });
    }

    // BAN COMMAND
    if (lowerCommand === 'ban') {
        const userId = args[0];

        if (!userId || !/^\d{17,19}$/.test(userId)) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Invalid Input')
                .setDescription('Please provide a valid user ID.')
                .setColor('Yellow');
            return message.reply({ embeds: [embed] });
        }

        if (userId === message.author.id) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Action Forbidden')
                .setDescription('You cannot ban yourself.')
                .setColor('Red');
            return message.reply({ embeds: [embed] });
        }

        if (userId === client.user.id) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Action Forbidden')
                .setDescription('You cannot ban the bot.')
                .setColor('Red');
            return message.reply({ embeds: [embed] });
        }

        // Find optional duration argument (e.g., 30d, 2h, etc.)
        const durationStr = args.find(arg => /^(\d+)([smhdwy])$/i.test(arg));
        const durationMs = durationStr ? parseDuration(durationStr) : null;

        // Reason is everything between userId and duration (if present)
        const reason = args
            .filter(arg => arg !== userId && arg !== durationStr)
            .join(' ') || 'No reason';

        banUser(userId, reason, durationMs);

        const embed = new EmbedBuilder()
            .setTitle('✅ User Banned')
            .addFields(
                { name: 'User ID', value: `<@${userId}>`, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Duration', value: durationMs ? durationStr : 'Permanent', inline: true }
            )
            .setColor('DarkRed');
        return message.reply({ embeds: [embed] });
    }

    // UNBAN COMMAND
    if (lowerCommand === 'unban') {
        const userId = args[0];

        if (!userId || !/^\d{17,19}$/.test(userId)) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Invalid Input')
                .setDescription('Please provide a valid user ID to unban.')
                .setColor('Yellow');
            return message.reply({ embeds: [embed] });
        }

        unbanUser(userId);

        const embed = new EmbedBuilder()
            .setTitle('✅ User Unbanned')
            .setDescription(`Successfully unbanned <@${userId}>.`)
            .setColor('Green');
        return message.reply({ embeds: [embed] });
    }
});
//-----------------Functionality of the BOT_token-----------------\\
client.login(process.env.BOT_TOKEN);

// The end of FumoBOTMain.js
// This file contains the main functionality of the FumoBOT, including ticket handling, error reporting, and admin commands for managing user inventories and bans. It also includes global error handling to ensure the bot remains stable and responsive.
// Make sure to keep this file updated with any new features or changes to the bot's functionality
// as it serves as the core of the FumoBOT's operations.
// If you have any questions or need further assistance, feel free to ask!
// End of MainBOT/FumoBOTMain.js
// Please ensure to keep this file secure and do not share your BOT_TOKEN publicly.