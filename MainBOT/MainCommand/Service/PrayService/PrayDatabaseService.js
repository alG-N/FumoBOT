const { get, run, all } = require('../../Core/database');
const { getWeekIdentifier } = require('../../Ultility/weekly');

async function consumeTicket(userId) {
    await run(
        `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`,
        [userId, 'PrayTicket(R)']
    );
}

async function consumeShards(userId, shardNames) {
    for (const shardName of shardNames) {
        await run(
            `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`,
            [userId, shardName]
        );
    }
}

async function getUserInventory(userId) {
    return await all(
        `SELECT * FROM userInventory WHERE userId = ?`,
        [userId]
    );
}

async function getUserData(userId) {
    const user = await get(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
    return user;
}

async function updateUserCoins(userId, coins, gems) {
    await run(
        `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
        [coins, gems, userId]
    );
}

async function deductUserCurrency(userId, coins, gems) {
    await run(
        `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
        [coins, gems, userId]
    );
}

async function updateUserLuck(userId, luckIncrease, luckRarity = null) {
    if (luckRarity) {
        await run(
            `UPDATE userCoins SET luck = CASE WHEN luck + ? > 1 THEN 1 ELSE luck + ? END, luckRarity = ? WHERE userId = ?`,
            [luckIncrease, luckIncrease, luckRarity, userId]
        );
    } else {
        await run(
            `UPDATE userCoins SET luck = CASE WHEN luck + ? > 1 THEN 1 ELSE luck + ? END WHERE userId = ?`,
            [luckIncrease, luckIncrease, userId]
        );
    }
}

async function updateUserRolls(userId, rollsToAdd) {
    await run(
        `UPDATE userCoins SET rollsLeft = rollsLeft + ? WHERE userId = ?`,
        [rollsToAdd, userId]
    );
}

async function addToInventory(userId, itemName, quantity = 1) {
    const existing = await get(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName]
    );

    if (existing) {
        await run(
            `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
            [quantity, userId, itemName]
        );
    } else {
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
            [userId, itemName, quantity]
        );
    }
}

async function deleteFumoFromInventory(userId, fumoId, quantity = 1) {
    const existing = await get(
        `SELECT quantity FROM userInventory WHERE id = ?`,
        [fumoId]
    );

    if (!existing) return;

    if (existing.quantity > quantity) {
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
            [quantity, fumoId]
        );
    } else {
        await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);
    }
}

async function incrementDailyPray(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    await run(`
        INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
        VALUES (?, 'pray_5', 1, 0, ?)
        ON CONFLICT(userId, questId, date) DO UPDATE SET 
            progress = MIN(dailyQuestProgress.progress + 1, 5),
            completed = CASE 
                WHEN dailyQuestProgress.progress + 1 >= 5 THEN 1
                ELSE dailyQuestProgress.completed
            END
    `, [userId, today]);

    const weekKey = getWeekIdentifier();
    await run(`
        INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
        VALUES (?, 'pray_success_25', 1, 0, ?)
        ON CONFLICT(userId, questId, week) DO UPDATE SET 
            progress = MIN(weeklyQuestProgress.progress + 1, 25),
            completed = CASE 
                WHEN weeklyQuestProgress.progress + 1 >= 25 THEN 1
                ELSE weeklyQuestProgress.completed
            END
    `, [userId, weekKey]);

    await run(`
        INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
        VALUES (?, 'total_prays', 1, 0)
        ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + 1
    `, [userId]);
}

async function updateYukariData(userId, coinsAdded, gemsAdded, newMark) {
    await run(
        `UPDATE userCoins 
        SET coins = coins + ?, 
            gems = gems + ?, 
            yukariCoins = yukariCoins + ?, 
            yukariGems = yukariGems + ?, 
            yukariMark = ? 
        WHERE userId = ?`,
        [coinsAdded, gemsAdded, coinsAdded, gemsAdded, newMark, userId]
    );
}

async function updateReimuData(userId, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }

    values.push(userId);

    await run(
        `UPDATE userCoins SET ${fields.join(', ')} WHERE userId = ?`,
        values
    );
}

async function updateMarisaData(userId, donationCount, prayedStatus) {
    await run(
        `UPDATE userCoins 
         SET marisaDonationCount = ?, 
             prayedToMarisa = ? 
         WHERE userId = ?`,
        [donationCount, prayedStatus, userId]
    );
}

async function getSakuyaUsage(userId) {
    return await get(`SELECT * FROM sakuyaUsage WHERE userId = ?`, [userId]);
}

async function updateSakuyaUsage(userId, data) {
    const existing = await getSakuyaUsage(userId);
    
    if (existing) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }

        values.push(userId);

        await run(
            `UPDATE sakuyaUsage SET ${fields.join(', ')} WHERE userId = ?`,
            values
        );
    } else {
        await run(
            `INSERT INTO sakuyaUsage (userId, uses, firstUseTime, lastUsed, timeBlessing, blessingExpiry)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, data.uses || 0, data.firstUseTime || Date.now(), data.lastUsed || Date.now(), data.timeBlessing || 0, data.blessingExpiry || null]
        );
    }
}

async function getFarmingFumos(userId) {
    return await all(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
}

async function getActiveBoosts(userId, currentTime) {
    return await all(
        `SELECT type, multiplier FROM activeBoosts
         WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, currentTime]
    );
}

async function addSpiritTokens(userId, amount) {
    await run(
        `UPDATE userCoins SET spiritTokens = COALESCE(spiritTokens, 0) + ? WHERE userId = ?`,
        [amount, userId]
    );
}

module.exports = {
    consumeTicket,
    consumeShards,
    getUserInventory,
    getUserData,
    updateUserCoins,
    deductUserCurrency,
    updateUserLuck,
    updateUserRolls,
    addToInventory,
    deleteFumoFromInventory,
    incrementDailyPray,
    updateYukariData,
    updateReimuData,
    updateMarisaData,
    getSakuyaUsage,
    updateSakuyaUsage,
    getFarmingFumos,
    getActiveBoosts,
    addSpiritTokens
};