const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS } = require('../../../Configuration/prayConfig');
const {
    getUserData,
    updateUserCoins,
    deductUserCurrency,
    updateUserLuck,
    updateUserRolls,
    incrementDailyPray
} = require('../PrayDatabaseService');

async function handleYuyuko(userId, channel) {
    const config = PRAY_CHARACTERS.YUYUKO;
    const randomNumber = Math.floor(Math.random() * 100) + 1;
    const user = await getUserData(userId);

    if (!user) {
        await channel.send('❌ User data not found.');
        return;
    }

    const currentLuck = user.luck || 0;
    const isDevour = randomNumber <= (config.offers.devour.chance * 100);

    if (isDevour) {
        await handleDevourOutcome(userId, channel, user, currentLuck, config);
    } else {
        await handleNormalOutcome(userId, channel, user, currentLuck, config);
    }

    await incrementDailyPray(userId);
}

async function handleDevourOutcome(userId, channel, user, currentLuck, config) {
    const devourConfig = config.offers.devour;
    let bonusRolls = currentLuck >= 1 ? devourConfig.rollRewardWithShiny : devourConfig.rollReward;
    let newLuck = Math.min(currentLuck + devourConfig.luckBoost, 1);
    
    if (newLuck >= 1) bonusRolls = devourConfig.rollRewardWithShiny;
    bonusRolls = Math.min(bonusRolls, devourConfig.maxRolls);

    if (user.coins < devourConfig.coinCost || user.gems < devourConfig.gemCost) {
        await updateUserCoins(userId, -user.coins, -user.gems);
        
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🌸 Yuyuko\'s Feast 🌸')
                .setDescription('Yuyuko devoured *everything*. Coins, gems, all gone. She leaves you with nothing but ghostly regrets.')
                .setColor('#ff0000')
                .setTimestamp()]
        });
    } else {
        await deductUserCurrency(userId, devourConfig.coinCost, devourConfig.gemCost);
        await updateUserRolls(userId, bonusRolls);
        await updateUserLuck(userId, devourConfig.luckBoost);

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🍽️ Devoured! 🍽️')
                .setDescription(
                    `Yuyuko took 1.5M coins & 350k gems... but left ${bonusRolls} rolls` +
                    `${bonusRolls === devourConfig.rollRewardWithShiny ? ' thanks to ShinyMark+!' : ' as a ghostly favor.'}`
                )
                .setColor('#0099ff')
                .setTimestamp()]
        });
    }
}

async function handleNormalOutcome(userId, channel, user, currentLuck, config) {
    const normalConfig = config.offers.normal;
    let bonusRolls = currentLuck >= 1 ? normalConfig.rollRewardWithShiny : normalConfig.rollReward;
    let newLuck = Math.min(currentLuck + normalConfig.luckBoost, 1);
    
    if (newLuck >= 1) bonusRolls = normalConfig.rollRewardWithShiny;
    bonusRolls = Math.min(bonusRolls, 10000);

    if (user.coins < normalConfig.coinCost || user.gems < normalConfig.gemCost) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🔮 Insufficient Funds 🔮')
                .setDescription('You don\'t have enough coins or gems for Yuyuko\'s blessing.')
                .setColor('#ff0000')
                .setTimestamp()]
        });
        return;
    }

    await deductUserCurrency(userId, normalConfig.coinCost, normalConfig.gemCost);
    await updateUserRolls(userId, bonusRolls);
    await updateUserLuck(userId, normalConfig.luckBoost, normalConfig.luckRarities);

    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('🍀 Yuyuko\'s Blessing 🍀')
            .setDescription(
                `${bonusRolls === normalConfig.rollRewardWithShiny ? 'ShinyMark+ triggered! ' : ''}` +
                `150k coins & 30k gems lost... but luck shines on your next ${bonusRolls} rolls.`
            )
            .setColor('#0099ff')
            .setTimestamp()]
    });
}

module.exports = { handleYuyuko };