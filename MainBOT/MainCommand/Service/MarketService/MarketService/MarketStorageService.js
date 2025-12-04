const { get, all, run } = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');

async function addGlobalListing(userId, fumoName, coinPrice, gemPrice) {
    const existing = await get(
        `SELECT id FROM globalMarket WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );

    if (existing) {
        await run(
            `UPDATE globalMarket SET coinPrice = ?, gemPrice = ?, listedAt = ? WHERE id = ?`,
            [coinPrice, gemPrice, Date.now(), existing.id]
        );
    } else {
        await run(
            `INSERT INTO globalMarket (userId, fumoName, coinPrice, gemPrice, listedAt)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, fumoName, coinPrice, gemPrice, Date.now()]
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

async function notifySellerOfSale(client, sellerId, fumoName, coinPrice, gemPrice, buyerUsername) {
    try {
        const seller = await client.users.fetch(sellerId).catch(() => null);
        if (!seller) return;

        const coinTax = Math.floor(coinPrice * 0.05);
        const gemTax = Math.floor(gemPrice * 0.05);
        const afterTaxCoins = coinPrice - coinTax;
        const afterTaxGems = gemPrice - gemTax;

        const message = `✅ **Sale Notification**\n\n` +
            `Your **${fumoName}** has been purchased!\n\n` +
            `**Buyer:** ${buyerUsername}\n\n` +
            `**Sale Price:**\n` +
            `🪙 ${formatNumber(coinPrice)} coins\n` +
            `💎 ${formatNumber(gemPrice)} gems\n\n` +
            `**After Tax (5%):**\n` +
            `🪙 ${formatNumber(afterTaxCoins)} coins\n` +
            `💎 ${formatNumber(afterTaxGems)} gems`;

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