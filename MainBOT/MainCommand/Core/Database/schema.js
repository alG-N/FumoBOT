const db = require('./db');

/**
 * Creates all database tables if they don't exist
 */
function createTables() {
    // User Coins Table
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
        hasFantasyBook INTEGER DEFAULT 0,
        yukariMark INTEGER DEFAULT 0,
        reimuPityCount INTEGER DEFAULT 0,
        timeclockLastUsed INTEGER DEFAULT 0
    )`, err => {
        if (err) console.error('Error creating userCoins table:', err.message);
    });

    // Redeemed Codes Table
    db.run(`CREATE TABLE IF NOT EXISTS redeemedCodes (
        userId TEXT NOT NULL,
        code TEXT NOT NULL,
        PRIMARY KEY (userId, code)
    )`, err => {
        if (err) console.error('Error creating redeemedCodes table:', err.message);
    });

    // Farming Fumos Table
    db.run(`CREATE TABLE IF NOT EXISTS farmingFumos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT, 
        fumoName TEXT, 
        coinsPerMin INTEGER, 
        gemsPerMin INTEGER,
        quantity INTEGER DEFAULT 1,
        rarity TEXT,
        UNIQUE(userId, fumoName)
    )`, err => {
        if (err) console.error('Error creating farmingFumos table:', err.message);
    });

    // User Usage Table
    db.run(`CREATE TABLE IF NOT EXISTS userUsage (
        userId TEXT, 
        command TEXT, 
        date TEXT, 
        count INTEGER, 
        PRIMARY KEY (userId, command)
    )`, err => {
        if (err) console.error('Error creating userUsage table:', err.message);
    });

    // User Inventory Table
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
    )`, err => {
        if (err) console.error('Error creating userInventory table:', err.message);
    });

    // User Upgrades Table
    db.run(`CREATE TABLE IF NOT EXISTS userUpgrades (
        userId TEXT PRIMARY KEY, 
        fragmentUses INTEGER DEFAULT 0
    )`, err => {
        if (err) console.error('Error creating userUpgrades table:', err.message);
    });

    // User Balance Table
    db.run(`CREATE TABLE IF NOT EXISTS userBalance (
        userId TEXT PRIMARY KEY, 
        balance INTEGER
    )`, err => {
        if (err) console.error('Error creating userBalance table:', err.message);
    });

    // Daily Quests Table
    db.run(`CREATE TABLE IF NOT EXISTS dailyQuests (
        userId TEXT, 
        quest TEXT, 
        reward INTEGER, 
        completed INTEGER DEFAULT 0,
        date TEXT
    )`, err => {
        if (err) console.error('Error creating dailyQuests table:', err.message);
    });

    // User Exchange Limits Table
    db.run(`CREATE TABLE IF NOT EXISTS userExchangeLimits (
        userId TEXT,
        date TEXT,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (userId, date)
    )`, err => {
        if (err) console.error('Error creating userExchangeLimits table:', err.message);
    });

    // Exchange History Table
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

    // Exchange Rate Table
    db.run(`CREATE TABLE IF NOT EXISTS exchangeRate (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        coinToGem REAL DEFAULT 10.0
    )`, err => {
        if (err) {
            console.error('Error creating exchangeRate table:', err.message);
        } else {
            db.run(`INSERT OR IGNORE INTO exchangeRate (id, coinToGem) VALUES (1, 10.0)`);
        }
    });

    // Active Boosts Table
    db.run(`CREATE TABLE IF NOT EXISTS activeBoosts (
        userId TEXT,
        type TEXT,
        source TEXT,
        multiplier REAL,
        expiresAt INTEGER,
        stack INTEGER DEFAULT 1,
        uses INTEGER DEFAULT 0,
        extra TEXT DEFAULT '{}',
        PRIMARY KEY(userId, type, source)
    )`, (err) => {
        if (err) return;
        console.log("✅ activeBoosts table ready");
    });

    // Sakuya Usage Table
    db.run(`CREATE TABLE IF NOT EXISTS sakuyaUsage (
        userId TEXT PRIMARY KEY,
        uses INTEGER DEFAULT 0,
        lastUsed INTEGER,
        firstUseTime INTEGER,
        timeBlessing INTEGER DEFAULT 0,
        blessingExpiry INTEGER
    )`, (err) => {
        if (err) {
            // console.error("Failed to create sakuyaUsage table:", err.message);
        }
    });

    // Daily Quest Progress Table
    db.run(`CREATE TABLE IF NOT EXISTS dailyQuestProgress (
        userId TEXT,
        questId TEXT,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        date TEXT,
        PRIMARY KEY (userId, questId, date)
    )`);

    // Weekly Quest Progress Table
    db.run(`CREATE TABLE IF NOT EXISTS weeklyQuestProgress (
        userId TEXT,
        questId TEXT,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        week TEXT,
        PRIMARY KEY (userId, questId, week)
    )`);

    // Achievement Progress Table
    db.run(`CREATE TABLE IF NOT EXISTS achievementProgress (
        userId TEXT,
        achievementId TEXT,
        progress INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        PRIMARY KEY (userId, achievementId)
    )`);

    // User Craft History Table
    db.run(`CREATE TABLE IF NOT EXISTS userCraftHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        itemName TEXT NOT NULL,
        amount INTEGER NOT NULL,
        craftedAt INTEGER NOT NULL
    )`);

    // Potion Craft History Table
    db.run(`CREATE TABLE IF NOT EXISTS potionCraftHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        itemName TEXT NOT NULL,
        amount INTEGER NOT NULL,
        craftedAt INTEGER NOT NULL
    )`);

    // Pet Inventory Table
    db.run(`CREATE TABLE IF NOT EXISTS petInventory (
        petId TEXT PRIMARY KEY,
        userId TEXT,
        type TEXT,      
        name TEXT,
        petName TEXT,        
        timestamp INTEGER, 
        level INTEGER,
        weight REAL, 
        age INTEGER,
        quality REAL,
        rarity TEXT,
        hunger INTEGER DEFAULT 100,
        ageXp INTEGER DEFAULT 0,
        lastHungerUpdate INTEGER DEFAULT (strftime('%s','now')),
        ability TEXT
    )`, function (err) {
        if (err) {
            // console.error("❌ Failed to create table 'petInventory':", err.message);
        } else {
            console.log("✅ Table 'petInventory' is ready.");
        }
    });

    // Hatching Eggs Table
    db.run(`CREATE TABLE IF NOT EXISTS hatchingEggs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        eggName TEXT,
        startedAt INTEGER,
        hatchAt INTEGER
    )`, function (err) {
        if (err) {
            // console.error("❌ Failed to create table 'hatchingEggs':", err.message);
        }
    });

    // Equipped Pets Table
    db.run(`CREATE TABLE IF NOT EXISTS equippedPets (
        userId TEXT,
        petId TEXT,
        PRIMARY KEY (userId, petId),
        FOREIGN KEY (petId) REFERENCES petInventory(petId)
    )`);

    // User Sales Table
    db.run(`CREATE TABLE IF NOT EXISTS userSales (
        userId TEXT, 
        fumoName TEXT, 
        quantity INTEGER, 
        timestamp INTEGER
    )`, err => {
        if (err) {
            console.error('Error creating userSales table:', err.message);
        }
    });
}

/**
 * Ensures all required columns exist in tables
 * Adds missing columns without breaking existing data
 */
function ensureColumnsExist() {
    const addColumnIfNotExists = (table, column, columnType) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnType}`, err => {
            if (err && !err.message.includes("duplicate column name")) {
                console.error(`Error adding column ${column} to ${table} table:`, err.message);
            }
        });
    };

    // Check userCoins table columns
    db.all(`PRAGMA table_info(userCoins)`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching userCoins table info:', err.message);
            return;
        }

        const existingColumns = rows.map(row => row.name);
        const requiredColumns = [
            'rollsSinceLastMythical',
            'rollsSinceLastQuestionMark',
            'level',
            'rebirth',
            'yukariMark',
            'reimuPityCount',
            'timeclockLastUsed'
        ];

        requiredColumns.forEach(col => {
            if (!existingColumns.includes(col)) {
                let columnType = 'INTEGER DEFAULT 0';
                if (col === 'level') columnType = 'INTEGER DEFAULT 1';
                addColumnIfNotExists('userCoins', col, columnType);
            }
        });
    });

    // Check userInventory table columns
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

    // Add extra column to activeBoosts if missing
    addColumnIfNotExists('activeBoosts', 'extra', "TEXT DEFAULT '{}'");

    // Add ability column to petInventory if missing
    addColumnIfNotExists('petInventory', 'ability', 'TEXT');
}

/**
 * Initialize all database tables and columns
 * Call this when the bot starts
 */
function initializeDatabase() {
    createTables();
    ensureColumnsExist();
    console.log('✅ Database schema initialized');
}

module.exports = {
    createTables,
    ensureColumnsExist,
    initializeDatabase
};