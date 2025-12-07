const fs = require('fs');
const path = require('path');
const { generateUserShop } = require('./ShopGenerationService');
const { debugLog } = require('../../../Core/logger');

const SHOP_FILE = path.join(__dirname, '../../../Data/globalShop.json');
const USER_VIEWS_FILE = path.join(__dirname, '../../../Data/userShopViews.json');

function loadShopFromFile() {
    try {
        if (fs.existsSync(SHOP_FILE)) {
            const data = fs.readFileSync(SHOP_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load shop from file:', error);
    }
    return null;
}

function saveShopToFile(shopData) {
    try {
        fs.writeFileSync(SHOP_FILE, JSON.stringify(shopData, null, 2));
        debugLog('SHOP_CACHE', 'Saved shop to file');
    } catch (error) {
        console.error('Failed to save shop to file:', error);
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

function getGlobalStock() {
    const currentHour = getCurrentHourTimestamp();
    let shopData = loadShopFromFile();

    if (!shopData || shopData.resetTime !== currentHour) {
        shopData = {
            stock: {},
            resetTime: currentHour
        };
        
        const newShop = generateUserShop();
        for (const [itemName, itemData] of Object.entries(newShop)) {
            shopData.stock[itemName] = {
                stock: itemData.stock,
                message: itemData.message
            };
        }
        
        saveShopToFile(shopData);
        
        const views = {};
        saveUserViews(views);
        
        debugLog('SHOP_CACHE', 'Generated new global stock');
    }

    return shopData;
}

function getUserShop(userId) {
    const globalData = getGlobalStock();
    const currentHour = globalData.resetTime;
    
    let userViews = loadUserViews();
    
    if (!userViews[userId] || userViews[userId].resetTime !== currentHour) {
        userViews[userId] = {
            shop: generateUserShop(),
            resetTime: currentHour
        };
        saveUserViews(userViews);
        debugLog('SHOP_CACHE', `Generated new view for ${userId}`);
    }
    
    const userShop = userViews[userId].shop;
    
    for (const [itemName, itemData] of Object.entries(userShop)) {
        if (globalData.stock[itemName]) {
            itemData.stock = globalData.stock[itemName].stock;
            itemData.message = globalData.stock[itemName].message;
        }
    }
    
    return userShop;
}

function forceRerollUserShop(userId) {
    const globalData = getGlobalStock();
    const currentHour = globalData.resetTime;
    
    let userViews = loadUserViews();
    
    userViews[userId] = {
        shop: generateUserShop(),
        resetTime: currentHour
    };
    saveUserViews(userViews);
    
    const userShop = userViews[userId].shop;
    
    for (const [itemName, itemData] of Object.entries(userShop)) {
        if (globalData.stock[itemName]) {
            itemData.stock = globalData.stock[itemName].stock;
            itemData.message = globalData.stock[itemName].message;
        }
    }
    
    debugLog('SHOP_CACHE', `Force rerolled view for ${userId}`);
    return userShop;
}

function updateShopStock(itemName, newStock) {
    const shopData = loadShopFromFile();
    if (shopData && shopData.stock[itemName]) {
        shopData.stock[itemName].stock = newStock;
        if (newStock <= 0) {
            shopData.stock[itemName].message = 'Out of Stock';
        }
        saveShopToFile(shopData);
        debugLog('SHOP_CACHE', `Updated global stock for ${itemName}: ${newStock}`);
    }
}

function clearAllShopCaches() {
    try {
        if (fs.existsSync(SHOP_FILE)) {
            fs.unlinkSync(SHOP_FILE);
        }
        if (fs.existsSync(USER_VIEWS_FILE)) {
            fs.unlinkSync(USER_VIEWS_FILE);
        }
        debugLog('SHOP_CACHE', 'Cleared all shop caches');
    } catch (error) {
        console.error('Failed to clear shop cache:', error);
    }
}

module.exports = {
    getUserShop,
    forceRerollUserShop,
    getUserShopTimeLeft,
    updateShopStock,
    clearAllShopCaches
};