const db = require('./dbSetting');

function createIndexes() {
    console.log('📊 Creating database indexes...');

    const indexes = [
        // User Inventory - Most queried table
        `CREATE INDEX IF NOT EXISTS idx_inventory_userId ON userInventory(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_inventory_itemName ON userInventory(userId, itemName)`,
        `CREATE INDEX IF NOT EXISTS idx_inventory_rarity ON userInventory(userId, rarity)`,

        // Active Boosts - Checked on every roll
        `CREATE INDEX IF NOT EXISTS idx_boosts_userId ON activeBoosts(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_boosts_expires ON activeBoosts(userId, expiresAt)`,
        `CREATE INDEX IF NOT EXISTS idx_boosts_type ON activeBoosts(userId, type, source)`,

        // Daily Quests - Checked frequently
        `CREATE INDEX IF NOT EXISTS idx_daily_quest ON dailyQuestProgress(userId, questId, date)`,
        `CREATE INDEX IF NOT EXISTS idx_daily_completed ON dailyQuestProgress(userId, date, completed)`,

        // Weekly Quests
        `CREATE INDEX IF NOT EXISTS idx_weekly_quest ON weeklyQuestProgress(userId, questId, week)`,
        `CREATE INDEX IF NOT EXISTS idx_weekly_completed ON weeklyQuestProgress(userId, week, completed)`,

        // Achievements
        `CREATE INDEX IF NOT EXISTS idx_achievement ON achievementProgress(userId, achievementId)`,

        // Farming Fumos
        `CREATE INDEX IF NOT EXISTS idx_farming_user ON farmingFumos(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_farming_fumo ON farmingFumos(userId, fumoName)`,

        // Pet Inventory
        `CREATE INDEX IF NOT EXISTS idx_pet_userId ON petInventory(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_pet_type ON petInventory(userId, type)`,

        // Equipped Pets
        `CREATE INDEX IF NOT EXISTS idx_equipped_user ON equippedPets(userId)`,

        // User Sales History
        `CREATE INDEX IF NOT EXISTS idx_sales_user ON userSales(userId, timestamp)`,

        // Exchange History
        `CREATE INDEX IF NOT EXISTS idx_exchange_user ON exchangeHistory(userId, date)`,

        // Exchange Cache
        `CREATE INDEX IF NOT EXISTS idx_exchangeCache_expiresAt ON exchangeCache(expiresAt)`,
        `CREATE INDEX IF NOT EXISTS idx_exchangeCache_userId ON exchangeCache(userId)`,

        // Redeemed Codes
        `CREATE INDEX IF NOT EXISTS idx_codes_user ON redeemedCodes(userId)`,

        // User Buildings
        `CREATE INDEX IF NOT EXISTS idx_buildings_user ON userBuildings(userId)`,

        // Craft
        `CREATE INDEX IF NOT EXISTS idx_craftQueue_user ON craftQueue(userId, completesAt)`,
        `CREATE INDEX IF NOT EXISTS idx_craftQueue_claimed ON craftQueue(claimed)`,
        `CREATE INDEX IF NOT EXISTS idx_craftHistory_user ON craftHistory(userId, craftedAt DESC)`,

        // Global market
        `CREATE INDEX IF NOT EXISTS idx_globalMarket_userId ON globalMarket(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_globalMarket_listedAt ON globalMarket(listedAt)`,

        // Pray
        `CREATE INDEX IF NOT EXISTS idx_inventory_user_item ON userInventory(userId, itemName, quantity)`,
        `CREATE INDEX IF NOT EXISTS idx_activeBoosts_user_expires ON activeBoosts(userId, expiresAt, type)`,
        `CREATE INDEX IF NOT EXISTS idx_farmingFumos_user ON farmingFumos(userId, fumoName)`,
        `CREATE INDEX IF NOT EXISTS idx_sakuyaUsage_user ON sakuyaUsage(userId, uses, lastUsed)`,
        `CREATE INDEX IF NOT EXISTS idx_userCoins_pray ON userCoins(userId, prayedToMarisa, reimuStatus, yukariMark)`,
    ];

    return new Promise((resolve, reject) => {
        let completed = 0;
        let successCount = 0;

        indexes.forEach((sql, idx) => {
            db.run(sql, (err) => {
                completed++;

                if (err) {
                    console.error(`❌ Failed to create index ${idx}:`, err.message);
                } else {
                    successCount++;
                }

                    if (completed === indexes.length) {
                        if (successCount > 0) {
                            if (successCount === indexes.length) {
                                console.log(`✅ Created ${successCount} database indexes successfully`);
                            } else {
                                console.warn(`⚠️ Created ${successCount} of ${indexes.length} database indexes (some failed)`);
                            }
                            resolve();
                        } else {
                            reject(new Error('Failed to create any database indexes'));
                        }
                    }
                });
            });
        });
    }
    
    function createTables() {
        return new Promise((resolve) => {
        const tables = [];
        let completed = 0;

        const checkCompletion = () => {
            completed++;
            if (completed === tables.length) {
                console.log('✅ All tables created successfully');
                resolve();
            }
        };

        // User Coins Table
        tables.push(new Promise((res) => {
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
            )`, (err) => {
                if (err) console.error('Error creating userCoins table:', err.message);
                res();
            });
        }));

        // User Buildings Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userBuildings (
                userId TEXT PRIMARY KEY,
                coinBoostLevel INTEGER DEFAULT 0,
                gemBoostLevel INTEGER DEFAULT 0,
                criticalFarmingLevel INTEGER DEFAULT 0,
                eventBoostLevel INTEGER DEFAULT 0
            )`, (err) => {
                if (err) {
                    console.error('Error creating userBuildings table:', err.message);
                } else {
                    console.log('✅ Table userBuildings is ready');
                }
                res();
            });
        }));

        // Active Seasons Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS activeSeasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seasonType TEXT NOT NULL,
                startedAt INTEGER NOT NULL,
                expiresAt INTEGER,
                isActive INTEGER DEFAULT 1
            )`, (err) => {
                if (err) {
                    console.error('Error creating activeSeasons table:', err.message);
                } else {
                    console.log('✅ Table activeSeasons is ready');
                }
                res();
            });
        }));

        // Shop reroll market
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userShopRerolls (
                    userId TEXT PRIMARY KEY,
                    rerollCount INTEGER DEFAULT 5,
                    lastRerollReset INTEGER DEFAULT 0,
                    paidRerollCount INTEGER DEFAULT 0
            )`, (err) => {
                if (err) {
                    console.error('Error creating userShopRerolls table:', err.message);
                } else {
                    console.log('✅ Table userShopRerolls is ready');
                }
                res();
            });
        }));

        // Global shop table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS globalShop (
                    resetTime INTEGER PRIMARY KEY,
                    shopData TEXT NOT NULL,
                    createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
            )`, (err) => {
                if (err) {
                    console.error('❌ Failed to create globalShop table:', err.message);
                } else {
                    console.log('✅ Table globalShop is ready');
                }
                res();
            });
        }));

        // User shop views table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userShopViews (
                userId TEXT NOT NULL,
                resetTime INTEGER NOT NULL,
                shopData TEXT NOT NULL,
                createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
                PRIMARY KEY (userId, resetTime)
            )`, (err) => {
                if (err) {
                    console.error('❌ Failed to create userShopViews table:', err.message);
                } else {
                    console.log('✅ Table userShopViews is ready');
                }
                res();
            });
        }));

        // Redeemed Codes Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS redeemedCodes (
                userId TEXT NOT NULL,
                code TEXT NOT NULL,
                PRIMARY KEY (userId, code)
            )`, (err) => {
                if (err) console.error('Error creating redeemedCodes table:', err.message);
                res();
            });
        }));

        // Farming Fumos Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS farmingFumos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT, 
                fumoName TEXT, 
                coinsPerMin INTEGER, 
                gemsPerMin INTEGER,
                quantity INTEGER DEFAULT 1,
                rarity TEXT,
                UNIQUE(userId, fumoName)
            )`, (err) => {
                if (err) console.error('Error creating farmingFumos table:', err.message);
                res();
            });
        }));

        // User Usage Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userUsage (
                userId TEXT, 
                command TEXT, 
                date TEXT, 
                count INTEGER, 
                PRIMARY KEY (userId, command)
            )`, (err) => {
                if (err) console.error('Error creating userUsage table:', err.message);
                res();
            });
        }));

        // User Inventory Table
        tables.push(new Promise((res) => {
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
            )`, (err) => {
                if (err) console.error('Error creating userInventory table:', err.message);
                res();
            });
        }));

        // User Upgrades Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userUpgrades (
                userId TEXT PRIMARY KEY, 
                fragmentUses INTEGER DEFAULT 0
            )`, (err) => {
                if (err) console.error('Error creating userUpgrades table:', err.message);
                res();
            });
        }));

        // User Balance Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userBalance (
                userId TEXT PRIMARY KEY, 
                balance INTEGER
            )`, (err) => {
                if (err) console.error('Error creating userBalance table:', err.message);
                res();
            });
        }));

        // Daily Quests Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS dailyQuests (
                userId TEXT, 
                quest TEXT, 
                reward INTEGER, 
                completed INTEGER DEFAULT 0,
                date TEXT
            )`, (err) => {
                if (err) console.error('Error creating dailyQuests table:', err.message);
                res();
            });
        }));

        // User Exchange Limits Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userExchangeLimits (
                userId TEXT,
                date TEXT,
                count INTEGER DEFAULT 0,
                PRIMARY KEY (userId, date)
            )`, (err) => {
                if (err) console.error('Error creating userExchangeLimits table:', err.message);
                res();
            });
        }));

        // Exchange History Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS exchangeHistory (
                userId TEXT,
                type TEXT,
                amount REAL,
                taxedAmount REAL,
                taxRate REAL DEFAULT 0,
                result REAL,
                date TEXT
            )`, (err) => {
                if (err) console.error('Error creating exchangeHistory table:', err.message);
                res();
            });
        }));

        // Exchange Cache Table - NEW
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS exchangeCache (
                exchangeId TEXT PRIMARY KEY,
                userId TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('coins', 'gems')),
                amount INTEGER NOT NULL,
                expiresAt INTEGER NOT NULL,
                createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
            )`, (err) => {
                if (err) {
                    console.error('Error creating exchangeCache table:', err.message);
                } else {
                    console.log('✅ Table exchangeCache is ready');
                }
                res();
            });
        }));

        // Exchange Rate Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS exchangeRate (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                coinToGem REAL DEFAULT 10.0
            )`, (err) => {
                if (err) {
                    console.error('Error creating exchangeRate table:', err.message);
                } else {
                    db.run(`INSERT OR IGNORE INTO exchangeRate (id, coinToGem) VALUES (1, 10.0)`);
                }
                res();
            });
        }));

        // Active Boosts Table
        tables.push(new Promise((res) => {
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
                if (!err) console.log("✅ activeBoosts table ready");
                res();
            });
        }));

        // Sakuya Usage Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS sakuyaUsage (
                userId TEXT PRIMARY KEY,
                uses INTEGER DEFAULT 0,
                lastUsed INTEGER,
                firstUseTime INTEGER,
                timeBlessing INTEGER DEFAULT 0,
                blessingExpiry INTEGER
            )`, () => res());
        }));

        // Daily Quest Progress Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS dailyQuestProgress (
                userId TEXT,
                questId TEXT,
                progress INTEGER DEFAULT 0,
                completed INTEGER DEFAULT 0,
                date TEXT,
                PRIMARY KEY (userId, questId, date)
            )`, () => res());
        }));

        // Weekly Quest Progress Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS weeklyQuestProgress (
                userId TEXT,
                questId TEXT,
                progress INTEGER DEFAULT 0,
                completed INTEGER DEFAULT 0,
                week TEXT,
                PRIMARY KEY (userId, questId, week)
            )`, () => res());
        }));

        // Achievement Progress Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS achievementProgress (
                userId TEXT,
                achievementId TEXT,
                progress INTEGER DEFAULT 0,
                claimed INTEGER DEFAULT 0,
                PRIMARY KEY (userId, achievementId)
            )`, () => res());
        }));

        // Pet Inventory Table
        tables.push(new Promise((res) => {
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
                ability TEXT,
                baseWeight REAL
            )`, (err) => {
                if (!err) console.log("✅ Table 'petInventory' is ready.");
                res();
            });
        }));

        // Hatching Eggs Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS hatchingEggs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                eggName TEXT,
                startedAt INTEGER,
                hatchAt INTEGER
            )`, () => res());
        }));

        // Equipped Pets Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS equippedPets (
                userId TEXT,
                petId TEXT,
                PRIMARY KEY (userId, petId),
                FOREIGN KEY (petId) REFERENCES petInventory(petId)
            )`, () => res());
        }));

        // User Sales Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userSales (
                userId TEXT, 
                fumoName TEXT, 
                quantity INTEGER, 
                timestamp INTEGER
            )`, () => res());
        }));

        // User Craft Queue Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS craftQueue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                craftType TEXT NOT NULL,
                itemName TEXT NOT NULL,
                amount INTEGER NOT NULL,
                startedAt INTEGER NOT NULL,
                completesAt INTEGER NOT NULL,
                claimed INTEGER DEFAULT 0
            )`, () => res());
        }));

        // User Craft History Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS craftHistory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                craftType TEXT NOT NULL,
                itemName TEXT NOT NULL,
                amount INTEGER NOT NULL,
                craftedAt INTEGER NOT NULL
            )`, () => res());
        }));

        // Global market table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS globalMarket (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                fumoName TEXT NOT NULL,
                coinPrice INTEGER,
                gemPrice INTEGER,
                listedAt INTEGER NOT NULL,
                CHECK (coinPrice IS NOT NULL OR gemPrice IS NOT NULL)
            )`, (err) => {
                if (err) {
                    console.error("Error creating globalMarket table:", err.message);
                } else {
                    console.log("✅ Table globalMarket is ready");
                }
                res();
            });
        }));

        // Wait for all tables to complete
        Promise.all(tables).then(resolve);
    });
}

async function ensureColumnsExist() {
    const addColumnIfNotExists = (table, column, columnType) => {
        return new Promise((res) => {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnType}`, err => {
                if (err && !err.message.includes("duplicate column name")) {
                    console.error(`Error adding column ${column} to ${table} table:`, err.message);
                }
                res();
            });
        });
    };

    const dbAllAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    };

    try {
        // Ensure userUpgrades has limitBreaks column
        const userUpgradesRows = await dbAllAsync(`PRAGMA table_info(userUpgrades)`, []);
        const existingUpgradeColumns = userUpgradesRows.map(row => row.name);

        if (!existingUpgradeColumns.includes('limitBreaks')) {
            await addColumnIfNotExists('userUpgrades', 'limitBreaks', 'INTEGER DEFAULT 0');
            console.log('✅ Added limitBreaks column to userUpgrades table');
        }

        // Ensure userCoins has all required columns
        const userCoinsRows = await dbAllAsync(`PRAGMA table_info(userCoins)`, []);
        const existingCoinsColumns = userCoinsRows.map(row => row.name);
        const requiredColumns = [
            'rollsSinceLastMythical',
            'rollsSinceLastQuestionMark',
            'level',
            'rebirth',
            'yukariMark',
            'reimuPityCount',
            'timeclockLastUsed'
        ];

        for (const col of requiredColumns) {
            if (!existingCoinsColumns.includes(col)) {
                let columnType = 'INTEGER DEFAULT 0';
                if (col === 'level') {
                    columnType = 'INTEGER DEFAULT 1';
                }
                await addColumnIfNotExists('userCoins', col, columnType);
            }
        }

        // Ensure userInventory has all required columns
        const userInventoryRows = await dbAllAsync(`PRAGMA table_info(userInventory)`, []);
        const requiredColumns2 = ['type', 'dateObtained', 'fumoName', 'luckRarity'];
        const existingInventoryColumns = userInventoryRows.map(row => row.name);

        for (const col of requiredColumns2) {
            if (!existingInventoryColumns.includes(col)) {
                await addColumnIfNotExists('userInventory', col, 'TEXT');
            }
        }

        // Ensure other tables have their additional columns
        await addColumnIfNotExists('activeBoosts', 'extra', "TEXT DEFAULT '{}'");
        await addColumnIfNotExists('petInventory', 'ability', 'TEXT');
    } catch (err) {
        console.error('Error ensuring columns exist:', err.message || err);
    }
}

async function initializeDatabase() {
    console.log('🚀 Initializing database schema...');
    await createTables();
    await ensureColumnsExist();
    await createIndexes();
    console.log('✅ Database initialization complete');
}

module.exports = {
    createTables,
    ensureColumnsExist,
    createIndexes,
    initializeDatabase
};