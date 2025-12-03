const { get, all, run } = require('../../../Core/database');

async function addGlobalListing(userId, fumoName, price, currency) {
    const existing = await get(
        `SELECT id FROM globalMarket WHERE userId = ? AND fumoName = ? AND currency = ?`,
        [userId, fumoName, currency]
    );

    if (existing) {
        await run(
            `UPDATE globalMarket SET price = ?, listedAt = ? WHERE id = ?`,
            [price, Date.now(), existing.id]
        );
    } else {
        await run(
            `INSERT INTO globalMarket (userId, fumoName, price, currency, listedAt)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, fumoName, price, currency, Date.now()]
        );
    }
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

async function notifySellerOfSale(client, sellerId, fumoName, price, currency, buyerUsername) {
    try {
        const seller = await client.users.fetch(sellerId).catch(() => null);
        if (!seller) return;

        const currencyEmoji = currency === 'coins' ? '🪙' : '💎';
        const message = `✅ **Sale Notification**\n\n` +
            `Your **${fumoName}** has been purchased!\n\n` +
            `**Buyer:** ${buyerUsername}\n` +
            `**Price:** ${currencyEmoji} ${price.toLocaleString()}\n` +
            `**After Tax (5%):** ${currencyEmoji} ${Math.floor(price * 0.95).toLocaleString()}`;

        await seller.send(message).catch(() => {});
    } catch (error) {
        console.error('Failed to notify seller:', error);
    }
}

module.exports = {
    addGlobalListing,
    removeGlobalListing,
    getUserGlobalListings,
    getAllGlobalListings,
    purchaseGlobalListing,
    notifySellerOfSale
};