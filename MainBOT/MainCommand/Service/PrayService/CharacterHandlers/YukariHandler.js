const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS, FUMO_PRICES } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { getRarityFromFumoName } = require('../../../Ultility/characterStats');
const {
    getUserData,
    getUserInventory,
    deleteFumoFromInventory,
    updateYukariData,
    addToInventory,
    addSpiritTokens,
    incrementDailyPray
} = require('../PrayDatabaseService');

async function handleYukari(userId, channel) {
    const config = PRAY_CHARACTERS.YUKARI;
    const user = await getUserData(userId);

    if (!user) {
        await channel.send('❌ User data not found.');
        return;
    }

    const mark = ((user.yukariMark || 0) % 10) + 1;
    const minRequired = config.requirements.minFumos[mark] || 1000;
    const maxAllowed = config.requirements.maxFumos[mark] || 1500;

    const rows = await getUserInventory(userId);
    
    const groups = categorizeAndPriceFumos(rows, config);
    const totalFumos = groups.totalFumos;

    if (totalFumos < minRequired) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Too Few Fumos! ❌')
                .setDescription(`Mark ${mark} requires at least ${minRequired} fumos.\nYou only have ${totalFumos}.`)
                .setColor('#ff0000')
                .setTimestamp()]
        });
        return;
    }

    if (Math.random() < config.rewards.scamChance) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('😈 Yukari\'s Prank 😈')
                .setDescription('Yukari scammed you. Everything\'s gone. 💸')
                .setColor('#ff0000')
                .setTimestamp()]
        });
        await incrementDailyPray(userId);
        return;
    }

    const selectedFumos = selectFumosForTrade(groups, Math.min(totalFumos, maxAllowed), config);
    const rewardMultiplier = config.rewards.multipliers[mark] || 1;
    
    let coinsEarned = Math.floor(selectedFumos.totalValue * rewardMultiplier);
    let gemsEarned = Math.floor(coinsEarned / 100);

    if (Math.random() < config.rewards.bonusChance) {
        coinsEarned = Math.floor(coinsEarned * config.rewards.bonusMultiplier.coins);
        gemsEarned = Math.floor(gemsEarned * config.rewards.bonusMultiplier.gems);
    }

    for (const fumo of selectedFumos.fumos) {
        await deleteFumoFromInventory(userId, fumo.id, fumo.quantityToTake);
    }

    await updateYukariData(userId, coinsEarned, gemsEarned, mark);

    if (Math.random() < config.rewards.fumoTokenChance) {
        await addSpiritTokens(userId, 1);
    }

    const bonusItem = await rollBonusItem(userId, mark, config);

    const nextMark = mark === 10 ? 1 : mark + 1;
    const nextMin = config.requirements.minFumos[nextMark] || 1000;
    const nextMax = config.requirements.maxFumos[nextMark] || 1500;

    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('🌌 Yukari\'s Exchange 🌌')
            .setDescription(
                `Fumos traded! You earned:\n` +
                `💰 +${formatNumber(coinsEarned)} coins\n` +
                `💎 +${formatNumber(gemsEarned)} gems` +
                `${bonusItem ? `\n🎁 Bonus: **${bonusItem}**` : ''}`
            )
            .addFields(
                { name: '🌌 Yukari\'s Mark', value: `${mark}/10`, inline: true },
                { name: '⚠️ Next Requirement', value: `${nextMin}–${nextMax} Fumos`, inline: true }
            )
            .setColor('#0099ff')
            .setTimestamp()]
    });

    await incrementDailyPray(userId);
}

function categorizeAndPriceFumos(rows, config) {
    const groups = {
        group1: [],
        group2: [],
        group3: [],
        shiny: [],
        alg: [],
        totalFumos: 0
    };

    for (const row of rows) {
        if (!row.fumoName?.includes('(')) continue;

        const qty = row.quantity || 1;
        groups.totalFumos += qty;

        const rarity = getRarityFromFumoName(row.fumoName);
        let price = FUMO_PRICES[rarity] || 0;

        if (row.fumoName.includes('[✨SHINY]')) price *= 5;
        if (row.fumoName.includes('[🌟alG]')) price *= 150;

        const fumoData = { ...row, price, quantity: qty };

        if (row.fumoName.includes('[✨SHINY]')) groups.shiny.push(fumoData);
        if (row.fumoName.includes('[🌟alG]')) groups.alg.push(fumoData);

        if (config.rarityGroups.group1.includes(rarity)) groups.group1.push(fumoData);
        else if (config.rarityGroups.group2.includes(rarity)) groups.group2.push(fumoData);
        else if (config.rarityGroups.group3.includes(rarity)) groups.group3.push(fumoData);
    }

    return groups;
}

function selectFumosForTrade(groups, needed, config) {
    const selected = [];
    let totalValue = 0;

    function takeFromGroup(group, count) {
        for (const fumo of group) {
            if (count <= 0) break;
            const takeQty = Math.min(fumo.quantity, count);
            selected.push({ ...fumo, quantityToTake: takeQty });
            totalValue += fumo.price * takeQty;
            count -= takeQty;
        }
        return count;
    }

    for (const groupName of config.groupPriority) {
        if (needed <= 0) break;
        needed = takeFromGroup(groups[groupName], needed);
    }

    return { fumos: selected, totalValue };
}

async function rollBonusItem(userId, mark, config) {
    const bonusConfig = config.bonusItems[mark];
    if (!bonusConfig) return null;

    const roll = Math.random();
    let cumulative = 0;

    for (const [itemName, chance] of Object.entries(bonusConfig)) {
        cumulative += chance;
        if (roll < cumulative) {
            await addToInventory(userId, itemName, 1);
            return itemName;
        }
    }

    return null;
}

module.exports = { handleYukari };