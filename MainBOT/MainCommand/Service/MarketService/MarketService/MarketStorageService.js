const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../../Data');
const COIN_MARKET_FILE = path.join(STORAGE_DIR, 'coinMarket.json');
const GEM_MARKET_FILE = path.join(STORAGE_DIR, 'gemMarket.json');
const GLOBAL_MARKET_FILE = path.join(STORAGE_DIR, 'globalMarket.json');

function ensureStorageExists() {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(COIN_MARKET_FILE)) {
        fs.writeFileSync(COIN_MARKET_FILE, JSON.stringify({}));
    }
    
    if (!fs.existsSync(GEM_MARKET_FILE)) {
        fs.writeFileSync(GEM_MARKET_FILE, JSON.stringify({}));
    }
    
    if (!fs.existsSync(GLOBAL_MARKET_FILE)) {
        fs.writeFileSync(GLOBAL_MARKET_FILE, JSON.stringify({ listings: [] }));
    }
}

function loadCoinMarket() {
    ensureStorageExists();
    try {
        const data = fs.readFileSync(COIN_MARKET_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load coin market:', error);
        return {};
    }
}

function saveCoinMarket(data) {
    ensureStorageExists();
    try {
        fs.writeFileSync(COIN_MARKET_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save coin market:', error);
    }
}

function loadGemMarket() {
    ensureStorageExists();
    try {
        const data = fs.readFileSync(GEM_MARKET_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load gem market:', error);
        return {};
    }
}

function saveGemMarket(data) {
    ensureStorageExists();
    try {
        fs.writeFileSync(GEM_MARKET_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save gem market:', error);
    }
}

function loadGlobalMarket() {
    ensureStorageExists();
    try {
        const data = fs.readFileSync(GLOBAL_MARKET_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load global market:', error);
        return { listings: [] };
    }
}

function saveGlobalMarket(data) {
    ensureStorageExists();
    try {
        fs.writeFileSync(GLOBAL_MARKET_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save global market:', error);
    }
}

function getUserCoinMarket(userId) {
    const markets = loadCoinMarket();
    return markets[userId] || null;
}

function setUserCoinMarket(userId, market) {
    const markets = loadCoinMarket();
    markets[userId] = market;
    saveCoinMarket(markets);
}

function getUserGemMarket(userId) {
    const markets = loadGemMarket();
    return markets[userId] || null;
}

function setUserGemMarket(userId, market) {
    const markets = loadGemMarket();
    markets[userId] = market;
    saveGemMarket(markets);
}

function addGlobalListing(listing) {
    const data = loadGlobalMarket();
    listing.id = Date.now() + Math.random();
    data.listings.push(listing);
    saveGlobalMarket(data);
    return listing.id;
}

function removeGlobalListing(userId, listingId) {
    const data = loadGlobalMarket();
    data.listings = data.listings.filter(l => !(l.userId === userId && l.id === listingId));
    saveGlobalMarket(data);
}

function getUserGlobalListings(userId) {
    const data = loadGlobalMarket();
    return data.listings.filter(l => l.userId === userId);
}

function getAllGlobalListings() {
    const data = loadGlobalMarket();
    return data.listings;
}

function purchaseGlobalListing(listingId, buyerId) {
    const data = loadGlobalMarket();
    const index = data.listings.findIndex(l => l.id === listingId);
    
    if (index === -1) return null;
    
    const listing = data.listings[index];
    data.listings.splice(index, 1);
    saveGlobalMarket(data);
    
    return listing;
}

module.exports = {
    ensureStorageExists,
    loadCoinMarket,
    saveCoinMarket,
    loadGemMarket,
    saveGemMarket,
    loadGlobalMarket,
    saveGlobalMarket,
    getUserCoinMarket,
    setUserCoinMarket,
    getUserGemMarket,
    setUserGemMarket,
    addGlobalListing,
    removeGlobalListing,
    getUserGlobalListings,
    getAllGlobalListings,
    purchaseGlobalListing
};