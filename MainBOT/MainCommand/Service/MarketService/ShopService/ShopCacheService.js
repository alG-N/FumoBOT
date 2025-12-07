const { get, run, all } = require('../../../Core/database');
const { generateUserShop } = require('./ShopGenerationService');
const { debugLog } = require('../../../Core/logger');

function getCurrentHourTimestamp() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.getTime();
}

function getUserShopTimeLeft() {
    const now = Date.now();
    const nextHour = getCurrentHourTimestamp() + 3600000;
    const timeRemaining = nextHour - now;
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes} minute(s) and ${seconds} second(s)`;
}

async function getGlobalShop() {
    const currentHour = getCurrentHourTimestamp();
    
    const existing = await get(
        `SELECT shopData, resetTime FROM globalShop WHERE resetTime = ?`,
        [currentHour],
        true
    );

    if (existing) {
        return {
            shop: JSON.parse(existing.shopData),
            resetTime: existing.resetTime
        };
    }

    const newShop = generateUserShop();
    
    await run(
        `INSERT OR REPLACE INTO globalShop (resetTime, shopData) VALUES (?, ?)`,
        [currentHour, JSON.stringify(newShop)]
    );

    await run(`DELETE FROM globalShop WHERE resetTime < ?`, [currentHour]);
    await run(`DELETE FROM userShopViews WHERE resetTime < ?`, [currentHour]);

    debugLog('SHOP_CACHE', 'Generated new global shop for everyone');

    return {
        shop: newShop,
        resetTime: currentHour
    };
}

async function getUserShop(userId) {
    try {
        const currentHour = getCurrentHourTimestamp();
        
        const userView = await get(
            `SELECT shopData FROM userShopViews WHERE userId = ? AND resetTime = ?`,
            [userId, currentHour],
            true
        );

        if (userView) {
            const shop = JSON.parse(userView.shopData);
            if (!shop || typeof shop !== 'object') {
                throw new Error('Invalid shop data');
            }
            return shop;
        }

        const globalShop = await getGlobalShop();
        
        if (!globalShop.shop || typeof globalShop.shop !== 'object') {
            globalShop.shop = generateUserShop();
        }

        const personalShop = {};
        for (const [itemName, itemData] of Object.entries(globalShop.shop)) {
            personalShop[itemName] = {
                ...itemData,
                stock: itemData.stock,
                message: itemData.message
            };
        }

        await run(
            `INSERT OR REPLACE INTO userShopViews (userId, resetTime, shopData) VALUES (?, ?, ?)`,
            [userId, currentHour, JSON.stringify(personalShop)]
        );

        debugLog('SHOP_CACHE', `Initialized shop for ${userId}`);
        return personalShop;

    } catch (error) {
        console.error('[SHOP_CACHE] Error in getUserShop:', error);
        return generateUserShop();
    }
}

async function forceRerollUserShop(userId) {
    const currentHour = getCurrentHourTimestamp();
    const newPersonalShop = generateUserShop();
    
    await run(
        `INSERT OR REPLACE INTO userShopViews (userId, resetTime, shopData, createdAt) VALUES (?, ?, ?, ?)`,
        [userId, currentHour, JSON.stringify(newPersonalShop), Date.now()]
    );
    
    debugLog('SHOP_CACHE', `${userId} rerolled - only their shop changed`);
    
    return newPersonalShop;
}

async function updateUserStock(userId, itemName, newStock) {
    try {
        const currentHour = getCurrentHourTimestamp();
        const db = require('../../../Core/Database/dbSetting');
        
        console.log(`[SHOP_CACHE] === UPDATE STOCK START ===`);
        console.log(`[SHOP_CACHE] UserId: ${userId}`);
        console.log(`[SHOP_CACHE] Item: ${itemName}`);
        console.log(`[SHOP_CACHE] New Stock: ${newStock}`);
        console.log(`[SHOP_CACHE] Current Hour Timestamp: ${currentHour}`);
        
        return await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.get(
                    `SELECT shopData FROM userShopViews WHERE userId = ? AND resetTime = ?`,
                    [userId, currentHour],
                    (err, userView) => {
                        if (err) {
                            console.error(`[SHOP_CACHE] ERROR fetching user view:`, err);
                            return resolve(false);
                        }

                        if (!userView) {
                            console.error(`[SHOP_CACHE] ERROR: User ${userId} has no shop`);
                            return resolve(false);
                        }

                        console.log(`[SHOP_CACHE] Found user shop view in database`);
                        const shop = JSON.parse(userView.shopData);

                        if (!shop[itemName]) {
                            console.error(`[SHOP_CACHE] ERROR: Item ${itemName} not found`);
                            return resolve(false);
                        }

                        console.log(`[SHOP_CACHE] Current stock for ${itemName}: ${shop[itemName].stock}`);
                        
                        shop[itemName].stock = newStock;
                        if (newStock <= 0) {
                            shop[itemName].message = 'Out of Stock';
                        }

                        console.log(`[SHOP_CACHE] Updated stock for ${itemName}: ${shop[itemName].stock}`);
                        
                        const updatedShopData = JSON.stringify(shop);

                        db.run(
                            `UPDATE userShopViews SET shopData = ? WHERE userId = ? AND resetTime = ?`,
                            [updatedShopData, userId, currentHour],
                            function(updateErr) {
                                if (updateErr) {
                                    console.error('[SHOP_CACHE] UPDATE error:', updateErr);
                                    return resolve(false);
                                }

                                console.log(`[SHOP_CACHE] UPDATE completed. Changes: ${this.changes}`);

                                db.get(
                                    `SELECT shopData FROM userShopViews WHERE userId = ? AND resetTime = ?`,
                                    [userId, currentHour],
                                    (verifyErr, verifyView) => {
                                        if (verifyErr || !verifyView) {
                                            console.error('[SHOP_CACHE] VERIFICATION fetch failed');
                                            return resolve(false);
                                        }

                                        const verifyShop = JSON.parse(verifyView.shopData);
                                        console.log(`[SHOP_CACHE] VERIFICATION - Stock: ${verifyShop[itemName]?.stock}`);

                                        if (verifyShop[itemName]?.stock !== newStock) {
                                            console.error(`[SHOP_CACHE] VERIFICATION FAILED! Expected ${newStock} but got ${verifyShop[itemName]?.stock}`);
                                            return resolve(false);
                                        }

                                        console.log(`[SHOP_CACHE] VERIFICATION SUCCESS!`);
                                        console.log(`[SHOP_CACHE] === UPDATE STOCK END ===`);
                                        debugLog('SHOP_CACHE', `Updated ${userId}'s stock for ${itemName}: ${newStock}`);
                                        resolve(true);
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });

    } catch (error) {
        console.error('[SHOP_CACHE] EXCEPTION in updateUserStock:', error);
        return false;
    }
}

async function clearAllShopCaches() {
    try {
        await run(`DELETE FROM globalShop`);
        await run(`DELETE FROM userShopViews`);
        debugLog('SHOP_CACHE', 'Cleared all shop caches');
    } catch (error) {
        console.error('Failed to clear shop cache:', error);
    }
}

async function getShopStats() {
    try {
        const currentHour = getCurrentHourTimestamp();
        
        const globalShop = await get(
            `SELECT shopData FROM globalShop WHERE resetTime = ?`,
            [currentHour],
            true
        );

        const totalUsers = await get(
            `SELECT COUNT(*) as count FROM userShopViews WHERE resetTime = ?`,
            [currentHour],
            true
        );

        const allUserViews = await all(
            `SELECT shopData FROM userShopViews WHERE resetTime = ?`,
            [currentHour],
            true
        );

        let totalPurchases = 0;

        for (const view of allUserViews) {
            const shop = JSON.parse(view.shopData);
            for (const itemName in shop) {
                const itemData = shop[itemName];
                if (itemData.stock !== 'unlimited' && itemData.message === 'Out of Stock') {
                    totalPurchases++;
                }
            }
        }

        const globalShopData = globalShop ? JSON.parse(globalShop.shopData) : null;

        return {
            totalUsers: totalUsers ? totalUsers.count : 0,
            activeUsers: allUserViews.length,
            totalPurchases,
            globalShopItems: globalShopData ? Object.keys(globalShopData).length : 0,
            currentHour,
            nextReset: getUserShopTimeLeft()
        };
    } catch (error) {
        console.error('Failed to get shop stats:', error);
        return null;
    }
}

module.exports = {
    getUserShop,
    forceRerollUserShop,
    getUserShopTimeLeft,
    updateUserStock,
    clearAllShopCaches,
    getShopStats,
    getGlobalShop
};