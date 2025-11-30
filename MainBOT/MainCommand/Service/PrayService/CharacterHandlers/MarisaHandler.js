const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const {
    getUserData,
    updateUserCoins,
    deductUserCurrency,
    updateMarisaData,
    addToInventory,
    incrementDailyPray
} = require('../PrayDatabaseService');

async function handleMarisa(userId, channel) {
    const config = PRAY_CHARACTERS.MARISA;

    if (Math.random() < config.chances.absent) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🌟 Marisa\'s Absence 🌟')
                .setDescription('Marisa is not around right now. Try again later!')
                .setColor('#0099ff')
                .setTimestamp()]
        });
        return;
    }

    const user = await getUserData(userId);

    if (!user) {
        await channel.send('❌ User data not found.');
        return;
    }

    if (user.coins < config.costs.donation) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('⚠️ Not Enough Coins ⚠️')
                .setDescription('You need at least 15,000 coins to donate to Marisa.')
                .setColor('#ff0000')
                .setTimestamp()]
        });
        return;
    }

    const currentCount = user.marisaDonationCount || 0;
    const isPityRound = (currentCount + 1) % config.pity.threshold === 0;
    const donatedBefore = user.prayedToMarisa === 1;

    if (!isPityRound && Math.random() < config.chances.steal) {
        const extraStolenCoins = Math.floor((user.coins - config.costs.donation) * config.chances.stealMultiplier.coins);
        const stolenGems = Math.floor((user.gems || 0) * config.chances.stealMultiplier.gems);

        await deductUserCurrency(userId, config.costs.donation + extraStolenCoins, stolenGems);

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('💀 Marisa\'s Trick 💀')
                .setDescription(
                    `Marisa cackled and vanished!\n` +
                    `She stole your **15,000 coin donation**, an **extra ${formatNumber(extraStolenCoins)} coins**, and **${formatNumber(stolenGems)} gems**!`
                )
                .setColor('#8b0000')
                .setTimestamp()]
        });
        return;
    }

    if (donatedBefore) {
        await handleReturnPhase(userId, channel, user, config, isPityRound);
    } else {
        await handleDonationPhase(userId, channel, user, config);
    }
}

async function handleDonationPhase(userId, channel, user, config) {
    await deductUserCurrency(userId, config.costs.donation, 0);
    await updateMarisaData(userId, (user.marisaDonationCount || 0) + 1);

    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('🧪 Donation Received 🧪')
            .setDescription('You gave Marisa 15k coins. She smiles mysteriously...')
            .setColor('#0099ff')
            .setTimestamp()]
    });
}

async function handleReturnPhase(userId, channel, user, config, isPityRound) {
    await updateUserCoins(userId, config.costs.return, 0);

    const rewards = [];
    let embedDescription = `You donated 15k coins. She returned with 35k coins for you!\n(Net profit: 20k)\n\n**Rewards:**\n`;

    const potionReward = await rollPotion(userId, config, isPityRound);
    if (potionReward) rewards.push(potionReward);

    const gemReward = await rollGems(userId, config, isPityRound);
    if (gemReward) rewards.push(gemReward);

    const specialReward = await rollSpecialItem(userId, config, isPityRound);
    if (specialReward) rewards.push(specialReward);

    if (isPityRound) {
        await addToInventory(userId, config.pity.reward, 1);
        await updateMarisaData(userId, 0);

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🌟 Loyalty Reward: StarShard! 🌟')
                .setDescription('After 5 generous donations, Marisa gifts you a mysterious **StarShard(M)**.\nReward chances are also increased!')
                .setColor('#00ffff')
                .setTimestamp()]
        });
    }

    if (rewards.length > 0) {
        embedDescription += rewards.join('\n');
    } else {
        embedDescription += '(No additional rewards this time.)';
    }

    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('✨ Marisa\'s Blessing ✨')
            .setDescription(embedDescription)
            .setColor('#ffd700')
            .setTimestamp()]
    });

    await incrementDailyPray(userId);
}

async function rollPotion(userId, config, isPityRound) {
    const potionConfig = config.rewards.potions;
    const roll = Math.random();

    const rareChance = isPityRound ? potionConfig.rare.pityChance : potionConfig.rare.baseChance;
    const legendaryChance = isPityRound ? potionConfig.legendary.pityChance : potionConfig.legendary.baseChance;

    if (roll < rareChance) {
        await addToInventory(userId, potionConfig.rare.name, 1);
        return `🎁 **${potionConfig.rare.name}** (Rare)`;
    } else if (roll >= (1 - legendaryChance)) {
        await addToInventory(userId, potionConfig.legendary.name, 1);
        return `🎁 **${potionConfig.legendary.name}** (Legendary)`;
    }

    return null;
}

async function rollGems(userId, config, isPityRound) {
    const gemConfig = config.rewards.gems;
    const chance = isPityRound ? gemConfig.pityChance : gemConfig.chance;

    if (Math.random() < chance) {
        const bonus1 = Math.floor((Math.random() * (gemConfig.bonus1Range[1] - gemConfig.bonus1Range[0]) + gemConfig.bonus1Range[0]) * gemConfig.bonus1Base);
        let bonus2 = Math.floor((Math.random() * (gemConfig.bonus2Range[1] - gemConfig.bonus2Range[0]) + gemConfig.bonus2Range[0]) * (Math.random() * (gemConfig.bonus2Base[1] - gemConfig.bonus2Base[0]) + gemConfig.bonus2Base[0]));
        bonus2 = Math.floor(bonus2 / 10) * 10;

        const totalGems = isPityRound ? (bonus1 + bonus2) * gemConfig.pityMultiplier : (bonus1 + bonus2);

        await updateUserCoins(userId, 0, totalGems);
        return `💎 **${formatNumber(totalGems)} Gems** have been gifted!`;
    }

    return null;
}

async function rollSpecialItem(userId, config, isPityRound) {
    const specialConfig = config.rewards.special;
    const roll = Math.random();

    const goldenChance = isPityRound ? specialConfig.goldenSigil.pityChance : specialConfig.goldenSigil.baseChance;
    const fragChance = isPityRound ? specialConfig.fragment.pityChance : specialConfig.fragment.baseChance;
    const ticketChance = isPityRound ? specialConfig.ticket.pityChance : specialConfig.ticket.baseChance;

    if (roll < goldenChance) {
        await addToInventory(userId, 'GoldenSigil(?)', 1);
        return '✨ **GoldenSigil(?)** - Ultra rare drop!';
    } else if (roll < fragChance) {
        await addToInventory(userId, 'FragmentOf1800s(R)', 1);
        return '📜 **FragmentOf1800s(R)** - Rare drop!';
    } else if (roll < ticketChance) {
        await addToInventory(userId, 'HakureiTicket(L)', 1);
        return '🎫 **HakureiTicket(L)** - A legendary ticket!';
    }

    return null;
}

module.exports = { handleMarisa };