const { get, all, run, transaction } = require('../../Core/database');
const TRADING_CONFIG = require('../../Configuration/tradingConfig');

const activeTrades = new Map();

function createSessionKey(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

function isUserTrading(userId) {
    for (const [key, trade] of activeTrades.entries()) {
        if (trade.user1.id === userId || trade.user2.id === userId) {
            return { trading: true, sessionKey: key };
        }
    }
    return { trading: false };
}

function createTradeSession(user1, user2) {
    const sessionKey = createSessionKey(user1.id, user2.id);

    const tradeData = {
        sessionKey,
        state: TRADING_CONFIG.STATES.PENDING_INVITE,
        user1: {
            id: user1.id,
            tag: user1.tag,
            coins: 0,
            gems: 0,
            items: new Map(),
            pets: new Map(),
            fumos: new Map(), 
            accepted: false,
            confirmed: false
        },
        user2: {
            id: user2.id,
            tag: user2.tag,
            coins: 0,
            gems: 0,
            items: new Map(),
            pets: new Map(),
            fumos: new Map(),
            accepted: false,
            confirmed: false
        },
        createdAt: Date.now(),
        lastUpdate: Date.now()
    };

    activeTrades.set(sessionKey, tradeData);
    return tradeData;
}

function getTradeSession(sessionKey) {
    return activeTrades.get(sessionKey);
}

async function updateTradeItem(sessionKey, userId, type, data) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    const userSide = trade.user1.id === userId ? 'user1' : 'user2';
    const user = trade[userSide];

    trade.user1.accepted = false;
    trade.user2.accepted = false;
    trade.user1.confirmed = false;
    trade.user2.confirmed = false;

    switch (type) {
        case 'coins':
            if (data.amount < 0 || data.amount > TRADING_CONFIG.MAX_COIN_TRADE) {
                return { success: false, error: 'INVALID_AMOUNT' };
            }
            user.coins = data.amount;
            break;

        case 'gems':
            if (data.amount < 0 || data.amount > TRADING_CONFIG.MAX_GEM_TRADE) {
                return { success: false, error: 'INVALID_AMOUNT' };
            }
            user.gems = data.amount;
            break;

        case 'item':
            if (user.items.size >= TRADING_CONFIG.MAX_ITEMS_PER_TRADE && !user.items.has(data.itemName)) {
                return { success: false, error: 'MAX_ITEMS_REACHED' };
            }
            if (data.quantity <= 0) {
                user.items.delete(data.itemName);
            } else {
                user.items.set(data.itemName, data.quantity);
            }
            break;

        case 'pet':
            if (user.pets.size >= TRADING_CONFIG.MAX_PETS_PER_TRADE && !user.pets.has(data.petId)) {
                return { success: false, error: 'MAX_PETS_REACHED' };
            }
            if (data.remove) {
                user.pets.delete(data.petId);
            } else {
                user.pets.set(data.petId, data);
            }
            break;

        case 'fumo':
            if (user.fumos.size >= TRADING_CONFIG.MAX_FUMOS_PER_TRADE && !user.fumos.has(data.fumoName)) {
                return { success: false, error: 'MAX_FUMOS_REACHED' };
            }
            if (data.quantity <= 0) {
                user.fumos.delete(data.fumoName);
            } else {
                let cappedQuantity = data.quantity;
                
                if (data.maxQuantity !== undefined && data.maxQuantity !== null) {
                    cappedQuantity = Math.min(data.quantity, data.maxQuantity);
                }
                
                if (cappedQuantity > 0) {
                    const actualQuantity = await getUserFumoQuantity(userId, data.fumoName);
                    if (actualQuantity < cappedQuantity) {
                        cappedQuantity = actualQuantity;
                        console.warn(`[Trade] Auto-capped ${data.fumoName} from ${data.quantity} to ${cappedQuantity} (DB check)`);
                    }
                }
                
                user.fumos.set(data.fumoName, cappedQuantity);
            }
            break;
    }

    trade.lastUpdate = Date.now();
    return { success: true, trade };
}

function toggleAccept(sessionKey, userId) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    const userSide = trade.user1.id === userId ? 'user1' : 'user2';
    trade[userSide].accepted = !trade[userSide].accepted;

    trade.user1.confirmed = false;
    trade.user2.confirmed = false;

    if (trade.user1.accepted && trade.user2.accepted) {
        trade.state = TRADING_CONFIG.STATES.BOTH_ACCEPTED;
    } else {
        trade.state = TRADING_CONFIG.STATES.ACTIVE;
    }

    trade.lastUpdate = Date.now();
    return { success: true, trade, bothAccepted: trade.user1.accepted && trade.user2.accepted };
}

function toggleConfirm(sessionKey, userId) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    if (trade.state !== TRADING_CONFIG.STATES.BOTH_ACCEPTED) {
        return { success: false, error: 'NOT_BOTH_ACCEPTED' };
    }

    const userSide = trade.user1.id === userId ? 'user1' : 'user2';
    trade[userSide].confirmed = !trade[userSide].confirmed;

    trade.lastUpdate = Date.now();
    return {
        success: true,
        trade,
        bothConfirmed: trade.user1.confirmed && trade.user2.confirmed
    };
}

async function validateUserResources(userId, coins, gems, items, pets, fumos) {
    // OPTIMIZED: Parallel queries for validation
    const [user, itemResults, petResults, fumoResults] = await Promise.all([
        // Get user balance
        get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]),
        
        // Get all items in one query if there are items to check
        items.size > 0 ? (async () => {
            const itemNames = Array.from(items.keys());
            const placeholders = itemNames.map(() => '?').join(',');
            return all(
                `SELECT itemName, quantity FROM userInventory WHERE userId = ? AND itemName IN (${placeholders})`,
                [userId, ...itemNames]
            );
        })() : [],
        
        // Get all pets in one query if there are pets to check
        pets.size > 0 ? (async () => {
            const petIds = Array.from(pets.keys());
            const placeholders = petIds.map(() => '?').join(',');
            return all(
                `SELECT petId FROM petInventory WHERE userId = ? AND petId IN (${placeholders})`,
                [userId, ...petIds]
            );
        })() : [],
        
        // Get all fumos in one query if there are fumos to check
        fumos.size > 0 ? (async () => {
            const fumoNames = Array.from(fumos.keys());
            const conditions = fumoNames.map(() => `fumoName = ? OR itemName = ?`).join(' OR ');
            const params = [userId];
            fumoNames.forEach(name => params.push(name, name));
            return all(
                `SELECT fumoName, itemName, SUM(quantity) as total FROM userInventory 
                 WHERE userId = ? AND (${conditions}) GROUP BY COALESCE(fumoName, itemName)`,
                params
            );
        })() : []
    ]);

    if (!user) return { valid: false, error: 'USER_NOT_FOUND' };
    if (user.coins < coins) return { valid: false, error: `INSUFFICIENT_COINS (Have: ${user.coins}, Need: ${coins})` };
    if (user.gems < gems) return { valid: false, error: `INSUFFICIENT_GEMS (Have: ${user.gems}, Need: ${gems})` };

    // Validate items
    const itemMap = new Map(itemResults.map(i => [i.itemName, i.quantity]));
    for (const [itemName, quantity] of items) {
        const have = itemMap.get(itemName) || 0;
        if (have < quantity) {
            return { valid: false, error: `INSUFFICIENT_ITEMS: ${itemName} (Have: ${have}, Need: ${quantity})` };
        }
    }

    // Validate pets
    const petSet = new Set(petResults.map(p => p.petId));
    for (const [petId] of pets) {
        if (!petSet.has(petId)) {
            return { valid: false, error: `PET_NOT_FOUND: ${petId}` };
        }
    }

    // Validate fumos
    const fumoMap = new Map(fumoResults.map(f => [f.fumoName || f.itemName, f.total]));
    for (const [fumoName, quantity] of fumos) {
        const have = fumoMap.get(fumoName) || 0;
        if (have < quantity) {
            return { valid: false, error: `INSUFFICIENT_FUMOS: ${fumoName} (Have: ${have}, Need: ${quantity})` };
        }
    }

    return { valid: true };
}

async function executeTrade(sessionKey) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    const { user1, user2 } = trade;

    const validate1 = await validateUserResources(
        user1.id, user1.coins, user1.gems, user1.items, user1.pets, user1.fumos
    );
    if (!validate1.valid) return validate1;

    const validate2 = await validateUserResources(
        user2.id, user2.coins, user2.gems, user2.items, user2.pets, user2.fumos
    );
    if (!validate2.valid) return validate2;

    const operations = [];

    if (user1.coins > 0 || user1.gems > 0) {
        operations.push({
            sql: `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
            params: [user1.coins, user1.gems, user1.id]
        });
        operations.push({
            sql: `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
            params: [user1.coins, user1.gems, user2.id]
        });
    }

    if (user2.coins > 0 || user2.gems > 0) {
        operations.push({
            sql: `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
            params: [user2.coins, user2.gems, user2.id]
        });
        operations.push({
            sql: `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
            params: [user2.coins, user2.gems, user1.id]
        });
    }

    for (const [itemName, quantity] of user1.items) {
        operations.push({
            sql: `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
            params: [quantity, user1.id, itemName]
        });
        operations.push({
            sql: `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
                  ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            params: [user2.id, itemName, quantity, quantity]
        });
    }

    for (const [itemName, quantity] of user2.items) {
        operations.push({
            sql: `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
            params: [quantity, user2.id, itemName]
        });
        operations.push({
            sql: `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
                  ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            params: [user1.id, itemName, quantity, quantity]
        });
    }

    // OPTIMIZED: Pre-fetch all fumo inventory rows for both users in parallel
    const user1FumoNames = Array.from(user1.fumos.keys());
    const user2FumoNames = Array.from(user2.fumos.keys());
    
    let user1FumoRows = [];
    let user2FumoRows = [];
    
    if (user1FumoNames.length > 0 || user2FumoNames.length > 0) {
        const fetchPromises = [];
        
        if (user1FumoNames.length > 0) {
            const conditions1 = user1FumoNames.map(() => `(fumoName = ? OR itemName = ?)`).join(' OR ');
            const params1 = [user1.id];
            user1FumoNames.forEach(name => params1.push(name, name));
            fetchPromises.push(
                all(`SELECT id, fumoName, itemName, quantity FROM userInventory WHERE userId = ? AND (${conditions1})`, params1)
            );
        } else {
            fetchPromises.push(Promise.resolve([]));
        }
        
        if (user2FumoNames.length > 0) {
            const conditions2 = user2FumoNames.map(() => `(fumoName = ? OR itemName = ?)`).join(' OR ');
            const params2 = [user2.id];
            user2FumoNames.forEach(name => params2.push(name, name));
            fetchPromises.push(
                all(`SELECT id, fumoName, itemName, quantity FROM userInventory WHERE userId = ? AND (${conditions2})`, params2)
            );
        } else {
            fetchPromises.push(Promise.resolve([]));
        }
        
        [user1FumoRows, user2FumoRows] = await Promise.all(fetchPromises);
    }
    
    // Build user1 fumo rows map by name
    const user1FumoMap = new Map();
    for (const row of user1FumoRows) {
        const name = row.fumoName || row.itemName;
        if (!user1FumoMap.has(name)) user1FumoMap.set(name, []);
        user1FumoMap.get(name).push(row);
    }
    
    // Build user2 fumo rows map by name
    const user2FumoMap = new Map();
    for (const row of user2FumoRows) {
        const name = row.fumoName || row.itemName;
        if (!user2FumoMap.has(name)) user2FumoMap.set(name, []);
        user2FumoMap.get(name).push(row);
    }

    // Process user1 fumos (no more queries in loop)
    for (const [fumoName, quantity] of user1.fumos) {
        const fumoRows = user1FumoMap.get(fumoName) || [];
        
        let remaining = quantity;
        
        for (const row of fumoRows) {
            if (remaining <= 0) break;
            
            const toDeduct = Math.min(row.quantity, remaining);
            
            operations.push({
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                params: [toDeduct, row.id]
            });
            
            remaining -= toDeduct;
        }
        
        operations.push({
            sql: `INSERT INTO userInventory (userId, fumoName, itemName, quantity, type) 
                  VALUES (?, ?, ?, ?, 'fumo')
                  ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
            params: [user2.id, fumoName, fumoName, quantity, quantity]
        });
        
        operations.push({
            sql: `DELETE FROM userInventory WHERE userId = ? AND (fumoName = ? OR itemName = ?) AND quantity <= 0`,
            params: [user1.id, fumoName, fumoName]
        });
    }

    // Process user2 fumos (no more queries in loop)
    for (const [fumoName, quantity] of user2.fumos) {
        const fumoRows = user2FumoMap.get(fumoName) || [];
        
        let remaining = quantity;
        
        for (const row of fumoRows) {
            if (remaining <= 0) break;
            
            const toDeduct = Math.min(row.quantity, remaining);
            
            operations.push({
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                params: [toDeduct, row.id]
            });
            
            remaining -= toDeduct;
        }
        
        operations.push({
            sql: `INSERT INTO userInventory (userId, fumoName, itemName, quantity, type) 
                  VALUES (?, ?, ?, ?, 'fumo')
                  ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
            params: [user1.id, fumoName, fumoName, quantity, quantity]
        });
        
        operations.push({
            sql: `DELETE FROM userInventory WHERE userId = ? AND (fumoName = ? OR itemName = ?) AND quantity <= 0`,
            params: [user2.id, fumoName, fumoName]
        });
    }

    for (const [petId] of user1.pets) {
        operations.push({
            sql: `UPDATE petInventory SET userId = ? WHERE petId = ?`,
            params: [user2.id, petId]
        });
    }

    for (const [petId] of user2.pets) {
        operations.push({
            sql: `UPDATE petInventory SET userId = ? WHERE petId = ?`,
            params: [user1.id, petId]
        });
    }

    try {
        await transaction(operations);
        trade.state = TRADING_CONFIG.STATES.COMPLETED;
        return { success: true, trade };
    } catch (error) {
        return { success: false, error: 'TRANSACTION_FAILED', details: error.message };
    }
}

function cancelTrade(sessionKey) {
    const trade = activeTrades.get(sessionKey);
    if (trade) {
        trade.state = TRADING_CONFIG.STATES.CANCELLED;
    }
    activeTrades.delete(sessionKey);
    return { success: true };
}

async function getUserItems(userId) {
    return await all(
        `SELECT 
            COALESCE(itemName, fumoName) as itemName,
            quantity 
         FROM userInventory 
         WHERE userId = ? 
         AND quantity > 0 
         AND COALESCE(itemName, fumoName) LIKE '%(%'
         AND COALESCE(itemName, fumoName) NOT LIKE '%[✨SHINY]%'
         AND COALESCE(itemName, fumoName) NOT LIKE '%[🌟alG]%'
         AND (type IS NULL OR type != 'fumo')
         ORDER BY itemName`,
        [userId]
    );
}


async function getUserItemsByRarity(userId, rarity) {
    const rarityMap = {
        'Basic': '(B)',
        'Common': '(C)',
        'Rare': '(R)',
        'Epic': '(E)',
        'Legendary': '(L)',
        'Mythical': '(M)',
        'Divine': '(D)',
        'Secret': '(?)',
        'Unknown': '(Un)',
        'Prime': '(P)'
    };
    
    const suffix = rarityMap[rarity];
    if (!suffix) return [];
    
    return await all(
        `SELECT 
            COALESCE(itemName, fumoName) as itemName,
            quantity 
         FROM userInventory 
         WHERE userId = ? 
         AND quantity > 0 
         AND COALESCE(itemName, fumoName) LIKE ?
         AND COALESCE(itemName, fumoName) NOT LIKE '%[✨SHINY]%'
         AND COALESCE(itemName, fumoName) NOT LIKE '%[🌟alG]%'
         AND (type IS NULL OR type != 'fumo')
         ORDER BY itemName`,
        [userId, `%${suffix}`]
    );
}

async function getUserPets(userId) {
    return await all(
        `SELECT petId, name, petName, rarity, level, age FROM petInventory 
         WHERE userId = ?
         ORDER BY rarity DESC, name`,
        [userId]
    );
}

async function getUserFumos(userId, type, rarity = null) {
    let filter = '';

    switch (type) {
        case 'normal':
            filter = `AND fumoName NOT LIKE '%[✨SHINY]%' AND fumoName NOT LIKE '%[🌟alG]%'`;
            break;
        case 'shiny':
            filter = `AND fumoName LIKE '%[✨SHINY]%'`;
            break;
        case 'alg':
            filter = `AND fumoName LIKE '%[🌟alG]%'`;
            break;
    }

    if (rarity) {
        if (type === 'shiny') {
            filter += ` AND fumoName LIKE '%(${rarity})[✨SHINY]'`;
        } else if (type === 'alg') {
            filter += ` AND fumoName LIKE '%(${rarity})[🌟alG]'`;
        } else {
            filter += ` AND fumoName LIKE '%(${rarity})'`;
        }
    }

    return await all(
        `SELECT fumoName, SUM(quantity) as quantity 
         FROM userInventory 
         WHERE userId = ? AND quantity > 0 AND fumoName LIKE '%(%' ${filter}
         GROUP BY fumoName
         ORDER BY fumoName`,
        [userId]
    );
}

async function getUserFumoQuantity(userId, fumoName) {
    const result = await get(
        `SELECT SUM(quantity) as total FROM userInventory 
         WHERE userId = ? AND (fumoName = ? OR itemName = ?)`,
        [userId, fumoName, fumoName]
    );
    return result?.total || 0;
}

module.exports = {
    createSessionKey,
    isUserTrading,
    createTradeSession,
    getTradeSession,
    updateTradeItem,
    toggleAccept,
    toggleConfirm,
    validateUserResources,
    executeTrade,
    cancelTrade,
    getUserItems,
    getUserItemsByRarity,
    getUserPets,
    getUserFumos,
    getUserFumoQuantity,
    activeTrades
};