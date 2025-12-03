const fs = require('fs');
const path = require('path');
const { get, all, run } = require('../../../Core/database');

const STORAGE_DIR = path.join(__dirname, '../../../Data');
const COIN_MARKET_FILE = path.join(STORAGE_DIR, 'coinMarket.json');
const GEM_MARKET_FILE = path.join(STORAGE_DIR, 'gemMarket.json');

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

async function addGlobalListing(userId, fumoName, price, currency) {
    await run(
        `INSERT INTO globalMarket (userId, fumoName, price, currency, listedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, fumoName, price, currency, Date.now()]
    );
}

async function removeGlobalListing(userId, listingId) {
    await run(
        `DELETE FROM globalMarket WHERE id = ? AND userId = ?`,
        [listingId, userId]
    );
}

async function getUserGlobalListings(userId) {
    return await all(
        `SELECT * FROM globalMarket WHERE userId = ? ORDER BY listedAt DESC`,
        [userId]
    );
}

async function getAllGlobalListings() {
    return await all(
        `SELECT * FROM globalMarket ORDER BY listedAt DESC`
    );
}

async function purchaseGlobalListing(listingId, buyerId) {
    const listing = await get(
        `SELECT * FROM globalMarket WHERE id = ?`,
        [listingId]
    );
    
    if (!listing) return null;
    
    await run(`DELETE FROM globalMarket WHERE id = ?`, [listingId]);
    
    return listing;
}

module.exports = {
    ensureStorageExists,
    loadCoinMarket,
    saveCoinMarket,
    loadGemMarket,
    saveGemMarket,
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