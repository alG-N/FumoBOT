const { get } = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');

function validateItemUse(inventory, itemName, quantity) {
    if (!inventory || inventory.quantity < quantity) {
        return {
            valid: false,
            message: `❌ You don't have enough **${itemName}**. You need **${quantity}**, but only have **${inventory?.quantity || 0}**.`
        };
    }

    return { valid: true };
}

async function canUseItem(userId, itemName, quantity) {
    const specialChecks = {
        'WeirdGrass(R)': () => quantity === 1,
        'GoldenSigil(?)': () => quantity === 1,
        'HakureiTicket(L)': () => quantity === 1,
        'Lumina(M)': () => quantity === 1,
        'FantasyBook(M)': () => quantity === 1,
        'MysteriousCube(M)': () => quantity === 1,
        'MysteriousDice(M)': () => quantity === 1,
        'TimeClock(L)': () => quantity === 1,
        'S!gil?(?)': () => quantity === 1,
        'Nullified(?)': async () => {
            const row = await get(
                `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                [userId]
            );
            return true;
        }
    };

    const check = specialChecks[itemName];
    if (check) {
        const result = await check();
        if (!result) {
            return {
                valid: false,
                message: `❌ **${itemName}** is a one-time use item.`
            };
        }
    }

    return { valid: true };
}

async function checkBoostActive(userId, type, source) {
    const row = await get(
        `SELECT * FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
        [userId, type, source]
    );
    return !!row;
}

async function checkCooldown(userId, cooldownKey, cooldownMs) {
    const row = await get(
        `SELECT ${cooldownKey} FROM userCoins WHERE userId = ?`,
        [userId]
    );

    if (!row) return { onCooldown: false };

    const lastUsed = row[cooldownKey] || 0;
    const now = Date.now();

    if (lastUsed && now - lastUsed < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
        return {
            onCooldown: true,
            remaining,
            nextUse: Math.floor((lastUsed + cooldownMs) / 1000)
        };
    }

    return { onCooldown: false };
}

module.exports = {
    validateItemUse,
    canUseItem,
    checkBoostActive,
    checkCooldown
};