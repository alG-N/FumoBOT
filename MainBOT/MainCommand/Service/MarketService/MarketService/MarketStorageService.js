const { get, all, run } = require('../../../Core/database');

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
    const listings = await all(
        `SELECT * FROM globalMarket ORDER BY listedAt DESC`
    );
    return listings || [];
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
    addGlobalListing,
    removeGlobalListing,
    getUserGlobalListings,
    getAllGlobalListings,
    purchaseGlobalListing
};