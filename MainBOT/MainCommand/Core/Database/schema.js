const db = require('./dbSetting');

function createIndexes() {
    console.log('📊 Creating database indexes...');

    const indexes = [
        // User Inventory - Most queried table
        `CREATE INDEX IF NOT EXISTS idx_inventory_userId ON userInventory(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_inventory_rarity ON userInventory(userId, rarity)`,
        // CRITICAL: Unique indexes for ON CONFLICT clauses to work
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_userId_fumoName ON userInventory(userId, fumoName)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_userId_itemName ON userInventory(userId, itemName)`,

        // Active Boosts - Checked on every roll
        `CREATE INDEX IF NOT EXISTS idx_boosts_userId ON activeBoosts(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_boosts_expires ON activeBoosts(userId, expiresAt)`,
        `CREATE INDEX IF NOT EXISTS idx_boosts_type ON activeBoosts(userId, type, source)`,
        `CREATE INDEX IF NOT EXISTS idx_boosts_user_source_type ON activeBoosts(userId, source, type)`,

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
        
        // Sanae Blessings
        `CREATE INDEX IF NOT EXISTS idx_sanaeBlessings_user ON sanaeBlessings(userId)`,
        
        // Level System (using userLevelProgress table)
        `CREATE INDEX IF NOT EXISTS idx_levelProgress_user ON userLevelProgress(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_levelProgress_level ON userLevelProgress(level DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_levelMilestones_user ON userLevelMilestones(userId)`,
        
        // Rebirth System
        `CREATE INDEX IF NOT EXISTS idx_rebirthProgress_user ON userRebirthProgress(userId)`,
        `CREATE INDEX IF NOT EXISTS idx_rebirthProgress_count ON userRebirthProgress(rebirthCount DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_rebirthMilestones_user ON userRebirthMilestones(userId)`,
        
        // Biome System
        `CREATE INDEX IF NOT EXISTS idx_userBiome_user ON userBiome(userId)`,
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

        // User Coins Table - Cleaned up (level/exp/rebirth moved to separate tables, dateObtained/fumoName removed)
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
                luckRarity TEXT, 
                lastDailyBonus INTEGER,
                rollsSinceLastMythical INTEGER DEFAULT 0,
                rollsSinceLastQuestionMark INTEGER DEFAULT 0,
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
                timeclockLastUsed INTEGER DEFAULT 0,
                starterPath TEXT DEFAULT 'The Legend'
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
                if (err) console.error('Error creating userBuildings:', err.message);
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
                if (err) console.error('Error creating activeSeasons:', err.message);
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
                if (err) console.error('Error creating userShopRerolls:', err.message);
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
                if (err) console.error('Error creating globalShop:', err.message);
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
                if (err) console.error('Error creating userShopViews:', err.message);
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
                if (err) console.error('Error creating exchangeCache:', err.message);
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
                if (err) console.error('Error creating activeBoosts:', err.message);
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

        // User Active Quests Table (for dynamic quest system)
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userActiveQuests (
                userId TEXT,
                questType TEXT,
                period TEXT,
                questId TEXT,
                uniqueQuestId TEXT,
                trackingType TEXT,
                questData TEXT,
                goal INTEGER,
                PRIMARY KEY (userId, questType, questId)
            )`, () => res());
        }));

        // Add columns if they don't exist (for existing databases)
        tables.push(new Promise((res) => {
            db.run(`ALTER TABLE userActiveQuests ADD COLUMN uniqueQuestId TEXT`, () => res());
        }));
        tables.push(new Promise((res) => {
            db.run(`ALTER TABLE userActiveQuests ADD COLUMN trackingType TEXT`, () => res());
        }));
        
        // Add claimedMilestones column for milestone-based achievement tracking
        tables.push(new Promise((res) => {
            db.run(`ALTER TABLE achievementProgress ADD COLUMN claimedMilestones TEXT DEFAULT '[]'`, () => res());
        }));

        // Create index for trackingType queries
        tables.push(new Promise((res) => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_activeQuests_trackingType 
                    ON userActiveQuests(userId, trackingType, questType, period)`, () => res());
        }));

        // Quest Rerolls Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS questRerolls (
                userId TEXT,
                questType TEXT,
                period TEXT,
                rerollCount INTEGER DEFAULT 0,
                PRIMARY KEY (userId, questType, period)
            )`, () => res());
        }));

        // Quest Chain Progress Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS questChainProgress (
                userId TEXT,
                chainId TEXT,
                currentStep INTEGER DEFAULT 0,
                completedAt INTEGER,
                PRIMARY KEY (userId, chainId)
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
                if (err) console.error('Error creating petInventory:', err.message);
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
                coinPrice TEXT,
                gemPrice TEXT,
                listedAt INTEGER NOT NULL,
                CHECK (coinPrice IS NOT NULL OR gemPrice IS NOT NULL)
            )`, (err) => {
                if (err) console.error('Error creating globalMarket:', err.message);
                res();
            });
        }));

        // Sanae Blessings Table - NEW
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS sanaeBlessings (
                userId TEXT PRIMARY KEY,
                faithPoints INTEGER DEFAULT 0,
                rerollsUsed INTEGER DEFAULT 0,
                craftDiscount INTEGER DEFAULT 0,
                craftDiscountExpiry INTEGER DEFAULT 0,
                freeCraftsExpiry INTEGER DEFAULT 0,
                prayImmunityExpiry INTEGER DEFAULT 0,
                guaranteedRarityRolls INTEGER DEFAULT 0,
                guaranteedMinRarity TEXT DEFAULT NULL,
                luckForRolls INTEGER DEFAULT 0,
                luckForRollsAmount REAL DEFAULT 0,
                craftProtection INTEGER DEFAULT 0,
                boostMultiplierExpiry INTEGER DEFAULT 0,
                permanentLuckBonus REAL DEFAULT 0,
                lastUpdated INTEGER DEFAULT 0,
                boostMultiplier INTEGER DEFAULT 1
            )`, (err) => {
                if (err) console.error('Error creating sanaeBlessings:', err.message);
                res();
            });
        }));
        
        // Level/EXP data is now stored in userLevelProgress table (separate from userCoins)
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userLevelProgress (
                userId TEXT PRIMARY KEY,
                level INTEGER DEFAULT 1,
                exp INTEGER DEFAULT 0,
                totalExpEarned INTEGER DEFAULT 0,
                lastExpSource TEXT,
                lastUpdated INTEGER DEFAULT (strftime('%s', 'now') * 1000)
            )`, (err) => {
                if (err) console.error('Error creating userLevelProgress:', err.message);
                res();
            });
        }));

        // Level Milestones Claimed Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userLevelMilestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                milestoneLevel INTEGER NOT NULL,
                claimedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
                UNIQUE(userId, milestoneLevel)
            )`, (err) => {
                if (err) console.error('Error creating userLevelMilestones:', err.message);
                res();
            });
        }));
        
        // User Rebirth Progress Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userRebirthProgress (
                userId TEXT PRIMARY KEY,
                rebirthCount INTEGER DEFAULT 0,
                totalRebirths INTEGER DEFAULT 0,
                lastRebirthAt INTEGER,
                preservedFumos TEXT DEFAULT '[]',
                lifetimeCoinsBeforeRebirth INTEGER DEFAULT 0,
                lifetimeGemsBeforeRebirth INTEGER DEFAULT 0
            )`, (err) => {
                if (err) console.error('Error creating userRebirthProgress:', err.message);
                res();
            });
        }));

        // Rebirth Milestones Claimed Table
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userRebirthMilestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                milestoneRebirth INTEGER NOT NULL,
                claimedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
                UNIQUE(userId, milestoneRebirth)
            )`, (err) => {
                if (err) console.error('Error creating userRebirthMilestones:', err.message);
                res();
            });
        }));
        
        // User Biome Table (farming biome selection)
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userBiome (
                userId TEXT PRIMARY KEY,
                biomeId TEXT DEFAULT 'GRASSLAND',
                biomeChangedAt INTEGER DEFAULT NULL
            )`, (err) => {
                if (err) console.error('Error creating userBiome:', err.message);
                res();
            });
        }));
        
        // User Other Place Table (alternate dimension farming)
        tables.push(new Promise((res) => {
            db.run(`CREATE TABLE IF NOT EXISTS userOtherPlace (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                fumoName TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                sentAt INTEGER NOT NULL,
                UNIQUE(userId, fumoName)
            )`, (err) => {
                if (err) console.error('Error creating userOtherPlace:', err.message);
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

        // Ensure userCoins has all required columns (removed Sanae columns)
        const userCoinsRows = await dbAllAsync(`PRAGMA table_info(userCoins)`, []);
        const existingCoinsColumns = userCoinsRows.map(row => row.name);
        const requiredColumns = [
            'rollsSinceLastMythical',
            'rollsSinceLastQuestionMark',
            'level',
            'rebirth',
            'yukariMark',
            'reimuPityCount',
            'timeclockLastUsed',
            'lastSigilUse'
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

        // Ensure sanaeBlessings has all required columns
        const sanaeRows = await dbAllAsync(`PRAGMA table_info(sanaeBlessings)`, []);
        const existingSanaeColumns = sanaeRows.map(row => row.name);
        const sanaeCols = [
            { name: 'guaranteedMinRarity', type: 'TEXT DEFAULT NULL' },
            { name: 'luckForRollsAmount', type: 'REAL DEFAULT 0' },
            { name: 'boostMultiplierExpiry', type: 'INTEGER DEFAULT 0' },
            { name: 'boostMultiplier', type: 'INTEGER DEFAULT 1' },  // ADD THIS
            { name: 'lastUpdated', type: 'INTEGER DEFAULT 0' }
        ];

        for (const col of sanaeCols) {
            if (!existingSanaeColumns.includes(col.name)) {
                await addColumnIfNotExists('sanaeBlessings', col.name, col.type);
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
        
        // Ensure quest progress tables have claimed column
        await addColumnIfNotExists('dailyQuestProgress', 'claimed', 'INTEGER DEFAULT 0');
        await addColumnIfNotExists('weeklyQuestProgress', 'claimed', 'INTEGER DEFAULT 0');
        
        // Ensure userCoins has dailyStreak column
        if (!existingCoinsColumns.includes('dailyStreak')) {
            await addColumnIfNotExists('userCoins', 'dailyStreak', 'INTEGER DEFAULT 0');
        }
        
        console.log('✅ Ensured all required columns exist in tables');
    } catch (err) {
        console.error('Error ensuring columns exist:', err.message || err);
    }
}

async function initializeDatabase() {
    await createTables();
    await ensureColumnsExist();
    await createIndexes();
}

module.exports = {
    createTables,
    ensureColumnsExist,
    createIndexes,
    initializeDatabase
};