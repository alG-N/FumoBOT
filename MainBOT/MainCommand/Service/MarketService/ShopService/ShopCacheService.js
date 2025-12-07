const fs = require('fs');
const path = require('path');
const { generateUserShop } = require('./ShopGenerationService');
const { debugLog } = require('../../../Core/logger');

const GLOBAL_SHOP_FILE = path.join(__dirname, '../../../Data/globalShop.json');
const USER_VIEWS_FILE = path.join(__dirname, '../../../Data/userShopViews.json');

function loadGlobalShop() {
    try {
        if (fs.existsSync(GLOBAL_SHOP_FILE)) {
            const data = fs.readFileSync(GLOBAL_SHOP_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load global shop:', error);
    }
    return null;
}

function saveGlobalShop(shopData) {
    try {
        fs.writeFileSync(GLOBAL_SHOP_FILE, JSON.stringify(shopData, null, 2));
        debugLog('SHOP_CACHE', 'Saved global shop');
    } catch (error) {
        console.error('Failed to save global shop:', error);
    }
}

function loadUserViews() {
    try {
        if (fs.existsSync(USER_VIEWS_FILE)) {
            const data = fs.readFileSync(USER_VIEWS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load user views:', error);
    }
    return {};
}

function saveUserViews(views) {
    try {
        fs.writeFileSync(USER_VIEWS_FILE, JSON.stringify(views, null, 2));
        debugLog('SHOP_CACHE', 'Saved user views');
    } catch (error) {
        console.error('Failed to save user views:', error);
    }
}

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

function getGlobalShop() {
    const currentHour = getCurrentHourTimestamp();
    let globalShop = loadGlobalShop();

    if (!globalShop || globalShop.resetTime !== currentHour) {
        globalShop = {
            shop: generateUserShop(),
            resetTime: currentHour
        };
        saveGlobalShop(globalShop);
        
        saveUserViews({});
        
        debugLog('SHOP_CACHE', 'Generated new global shop for everyone');
    }

    return globalShop;
}

function getUserShop(userId) {
    const globalShop = getGlobalShop();
    const currentHour = globalShop.resetTime;
    let userViews = loadUserViews();
    
    if (!userViews[userId] || userViews[userId].resetTime !== currentHour) {
        
        const personalShop = {};
        for (const [itemName, itemData] of Object.entries(globalShop.shop)) {
            personalShop[itemName] = {
                ...itemData,
                stock: itemData.stock,
                message: itemData.message
            };
        }
        
        userViews[userId] = {
            personalShop, 
            resetTime: currentHour
        };
        saveUserViews(userViews);
        debugLog('SHOP_CACHE', `Initialized shop for ${userId}`);
    }
    
    return userViews[userId].personalShop;
}

function forceRerollUserShop(userId) {
    const globalShop = getGlobalShop();
    const currentHour = globalShop.resetTime;
    let userViews = loadUserViews();
    
    const newPersonalShop = generateUserShop();
    
    userViews[userId] = {
        personalShop: newPersonalShop,
        resetTime: currentHour
    };
    saveUserViews(userViews);
    
    debugLog('SHOP_CACHE', `${userId} rerolled - only their shop changed`);
    
    return newPersonalShop;
}

function updateUserStock(userId, itemName, newStock) {
    let userViews = loadUserViews();
    
    if (!userViews[userId] || !userViews[userId].personalShop) {
        console.error(`Cannot update stock: User ${userId} has no shop`);
        return false;
    }
    
    if (!userViews[userId].personalShop[itemName]) {
        console.error(`Cannot update stock: Item ${itemName} not in user ${userId}'s shop`);
        return false;
    }
    
    userViews[userId].personalShop[itemName].stock = newStock;
    
    if (newStock <= 0) {
        userViews[userId].personalShop[itemName].message = 'Out of Stock';
    }
    
    saveUserViews(userViews);
    debugLog('SHOP_CACHE', `Updated ${userId}'s stock for ${itemName}: ${newStock}`);
    return true;
}

function clearAllShopCaches() {
    try {
        if (fs.existsSync(GLOBAL_SHOP_FILE)) {
            fs.unlinkSync(GLOBAL_SHOP_FILE);
        }
        if (fs.existsSync(USER_VIEWS_FILE)) {
            fs.unlinkSync(USER_VIEWS_FILE);
        }
        debugLog('SHOP_CACHE', 'Cleared all shop caches');
    } catch (error) {
        console.error('Failed to clear shop cache:', error);
    }
}

function getShopStats() {
    try {
        const globalShop = loadGlobalShop();
        const userViews = loadUserViews();
        const totalUsers = Object.keys(userViews).length;
        const currentHour = getCurrentHourTimestamp();
        
        let activeUsers = 0;
        let totalPurchases = 0;
        
        for (const userId in userViews) {
            if (userViews[userId].resetTime === currentHour) {
                activeUsers++;
                
                if (userViews[userId].personalShop) {
                    for (const itemName in userViews[userId].personalShop) {
                        const itemData = userViews[userId].personalShop[itemName];
                        
                        if (itemData.stock !== 'unlimited' && itemData.message === 'Out of Stock') {
                            totalPurchases++;
                        }
                    }
                }
            }
        }
        
        return {
            totalUsers,
            activeUsers,
            totalPurchases,
            globalShopItems: globalShop ? Object.keys(globalShop.shop).length : 0,
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