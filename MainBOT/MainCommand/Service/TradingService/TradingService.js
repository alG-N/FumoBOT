const { get, all, run, transaction } = require('../../Core/database');
const TRADING_CONFIG = require('../../Configuration/tradingConfig');

// Active trade sessions
const activeTrades = new Map();

/**
 * Create a unique session key for two users
 */
function createSessionKey(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

/**
 * Check if user is already in a trade
 */
function isUserTrading(userId) {
    for (const [key, trade] of activeTrades.entries()) {
        if (trade.user1.id === userId || trade.user2.id === userId) {
            return { trading: true, sessionKey: key };
        }
    }
    return { trading: false };
}

/**
 * Initialize a new trade session
 */
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
            fumos: new Map(), // fumoName -> quantity
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

/**
 * Get trade session
 */
function getTradeSession(sessionKey) {
    return activeTrades.get(sessionKey);
}

/**
 * Update trade item with validation and auto-capping
 */
async function updateTradeItem(sessionKey, userId, type, data) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    const userSide = trade.user1.id === userId ? 'user1' : 'user2';
    const user = trade[userSide];

    // Reset both accepts AND confirms when trade changes
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
                // CRITICAL: Always cap to max available
                let cappedQuantity = data.quantity;
                
                // If maxQuantity provided, use it
                if (data.maxQuantity !== undefined && data.maxQuantity !== null) {
                    cappedQuantity = Math.min(data.quantity, data.maxQuantity);
                }
                
                // Double check: verify actual quantity in DB
                // This is a safety measure in case maxQuantity wasn't passed correctly
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

/**
 * Toggle user accept status
 */
function toggleAccept(sessionKey, userId) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    const userSide = trade.user1.id === userId ? 'user1' : 'user2';
    trade[userSide].accepted = !trade[userSide].accepted;

    // Reset confirms when accept status changes
    trade.user1.confirmed = false;
    trade.user2.confirmed = false;

    // Check if both accepted
    if (trade.user1.accepted && trade.user2.accepted) {
        trade.state = TRADING_CONFIG.STATES.BOTH_ACCEPTED;
    } else {
        trade.state = TRADING_CONFIG.STATES.ACTIVE;
    }

    trade.lastUpdate = Date.now();
    return { success: true, trade, bothAccepted: trade.user1.accepted && trade.user2.accepted };
}

/**
 * Toggle user confirm status
 */
function toggleConfirm(sessionKey, userId) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    // Must be in BOTH_ACCEPTED state
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

/**
 * Validate user has resources (with detailed error messages)
 */
async function validateUserResources(userId, coins, gems, items, pets, fumos) {
    const user = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);

    if (!user) return { valid: false, error: 'USER_NOT_FOUND' };
    if (user.coins < coins) return { valid: false, error: `INSUFFICIENT_COINS (Have: ${user.coins}, Need: ${coins})` };
    if (user.gems < gems) return { valid: false, error: `INSUFFICIENT_GEMS (Have: ${user.gems}, Need: ${gems})` };

    // Check items
    for (const [itemName, quantity] of items) {
        const item = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, itemName]
        );
        if (!item || item.quantity < quantity) {
            return { valid: false, error: `INSUFFICIENT_ITEMS: ${itemName} (Have: ${item?.quantity || 0}, Need: ${quantity})` };
        }
    }

    // Check pets
    for (const [petId] of pets) {
        const pet = await get(
            `SELECT * FROM petInventory WHERE userId = ? AND petId = ?`,
            [userId, petId]
        );
        if (!pet) {
            return { valid: false, error: `PET_NOT_FOUND: ${petId}` };
        }
    }

    // Check fumos with detailed messages
    for (const [fumoName, quantity] of fumos) {
        const fumo = await get(
            `SELECT SUM(quantity) as total FROM userInventory 
             WHERE userId = ? AND (fumoName = ? OR itemName = ?)`,
            [userId, fumoName, fumoName]
        );
        const totalQuantity = fumo?.total || 0;
        
        if (totalQuantity < quantity) {
            return { valid: false, error: `INSUFFICIENT_FUMOS: ${fumoName} (Have: ${totalQuantity}, Need: ${quantity})` };
        }
    }

    return { valid: true };
}

/**
 * Execute the trade
 */
async function executeTrade(sessionKey) {
    const trade = activeTrades.get(sessionKey);
    if (!trade) return { success: false, error: 'TRADE_NOT_FOUND' };

    const { user1, user2 } = trade;

    // Validate both users have resources
    const validate1 = await validateUserResources(
        user1.id, user1.coins, user1.gems, user1.items, user1.pets, user1.fumos
    );
    if (!validate1.valid) return validate1;

    const validate2 = await validateUserResources(
        user2.id, user2.coins, user2.gems, user2.items, user2.pets, user2.fumos
    );
    if (!validate2.valid) return validate2;

    // Build transaction operations
    const operations = [];

    // Transfer coins and gems
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

    // Transfer items
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

    // Transfer fumos - HANDLE DUPLICATE ROWS
    for (const [fumoName, quantity] of user1.fumos) {
        // Get all rows for this fumo (there might be duplicates)
        const fumoRows = await all(
            `SELECT id, quantity FROM userInventory 
             WHERE userId = ? AND (fumoName = ? OR itemName = ?)`,
            [user1.id, fumoName, fumoName]
        );
        
        let remaining = quantity;
        
        // Deduct from each row
        for (const row of fumoRows) {
            if (remaining <= 0) break;
            
            const toDeduct = Math.min(row.quantity, remaining);
            
            operations.push({
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                params: [toDeduct, row.id]
            });
            
            remaining -= toDeduct;
        }
        
        // Add to receiver
        operations.push({
            sql: `INSERT INTO userInventory (userId, itemName, fumoName, quantity, type) 
              VALUES (?, ?, ?, ?, 'fumo')
              ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            params: [user2.id, fumoName, fumoName, quantity, quantity]
        });
        
        // Clean up zero quantities
        operations.push({
            sql: `DELETE FROM userInventory WHERE userId = ? AND (fumoName = ? OR itemName = ?) AND quantity <= 0`,
            params: [user1.id, fumoName, fumoName]
        });
    }

    for (const [fumoName, quantity] of user2.fumos) {
        // Get all rows for this fumo (there might be duplicates)
        const fumoRows = await all(
            `SELECT id, quantity FROM userInventory 
             WHERE userId = ? AND (fumoName = ? OR itemName = ?)`,
            [user2.id, fumoName, fumoName]
        );
        
        let remaining = quantity;
        
        // Deduct from each row
        for (const row of fumoRows) {
            if (remaining <= 0) break;
            
            const toDeduct = Math.min(row.quantity, remaining);
            
            operations.push({
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                params: [toDeduct, row.id]
            });
            
            remaining -= toDeduct;
        }
        
        // Add to receiver
        operations.push({
            sql: `INSERT INTO userInventory (userId, itemName, fumoName, quantity, type) 
              VALUES (?, ?, ?, ?, 'fumo')
              ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            params: [user1.id, fumoName, fumoName, quantity, quantity]
        });
        
        // Clean up zero quantities
        operations.push({
            sql: `DELETE FROM userInventory WHERE userId = ? AND (fumoName = ? OR itemName = ?) AND quantity <= 0`,
            params: [user2.id, fumoName, fumoName]
        });
    }

    // Transfer pets
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

    // Execute all operations in a transaction
    try {
        await transaction(operations);
        trade.state = TRADING_CONFIG.STATES.COMPLETED;
        return { success: true, trade };
    } catch (error) {
        return { success: false, error: 'TRANSACTION_FAILED', details: error.message };
    }
}

/**
 * Cancel trade
 */
function cancelTrade(sessionKey) {
    const trade = activeTrades.get(sessionKey);
    if (trade) {
        trade.state = TRADING_CONFIG.STATES.CANCELLED;
    }
    activeTrades.delete(sessionKey);
    return { success: true };
}

/**
 * Get user's available items for trading
 */
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

/**
 * Get user's items by rarity
 */
async function getUserItemsByRarity(userId, rarity) {
    const rarityMap = {
        'Basic': '(B)',
        'Common': '(C)',
        'Rare': '(R)',
        'Epic': '(E)',
        'Legendary': '(L)',
        'Mythical': '(M)',
        'Divine': '(D)',
        'Secret': '(?)'
    };
    
    const suffix = rarityMap[rarity];
    if (!suffix) return [];
    
    // FIXED: Remove type = 'item' filter and exclude fumos instead
    // Also handle both itemName and fumoName columns
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

/**
 * Get user's available pets for trading
 */
async function getUserPets(userId) {
    return await all(
        `SELECT petId, name, petName, rarity, level, age FROM petInventory 
         WHERE userId = ?
         ORDER BY rarity DESC, name`,
        [userId]
    );
}

/**
 * Get user's fumos by type and rarity
 */
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

    // Add rarity filter if specified
    // For shiny/alg, we need to check for the rarity BEFORE the special tag
    if (rarity) {
        if (type === 'shiny') {
            filter += ` AND fumoName LIKE '%(${rarity})[✨SHINY]'`;
        } else if (type === 'alg') {
            filter += ` AND fumoName LIKE '%(${rarity})[🌟alG]'`;
        } else {
            // Normal fumos just have the rarity at the end
            filter += ` AND fumoName LIKE '%(${rarity})'`;
        }
    }

    // Group by fumoName and sum quantities to handle duplicates
    return await all(
        `SELECT fumoName, SUM(quantity) as quantity 
         FROM userInventory 
         WHERE userId = ? AND quantity > 0 AND fumoName LIKE '%(%' ${filter}
         GROUP BY fumoName
         ORDER BY fumoName`,
        [userId]
    );
}

/**
 * Get exact quantity of a specific fumo (handles duplicate rows)
 */
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