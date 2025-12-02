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
    const isDevour = randomNumber <= 25;

    if (isDevour) {
        await handleDevourOutcome(userId, channel, user, currentLuck, config);
    } else {
        await handleNormalOutcome(userId, channel, user, currentLuck, config);
    }

    await incrementDailyPray(userId);
}

async function handleDevourOutcome(userId, channel, user, currentLuck, config) {
    const devourConfig = config.offers.devour;
    let bonusRolls = currentLuck >= 1 ? 10000 : 5000;
    let newLuck = Math.min(currentLuck + 0.5, 1);
    
    if (newLuck >= 1) bonusRolls = 10000;
    bonusRolls = Math.min(bonusRolls, 50000);

    if (user.coins < 600000 || user.gems < 140000) {
        await updateUserCoins(userId, -user.coins, -user.gems);
        
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🌸 Yuyuko\'s Feast 🌸')
                .setDescription('Yuyuko devoured *everything*. Coins, gems, all gone. She leaves you with nothing but ghostly regrets.')
                .setColor('#ff0000')
                .setTimestamp()]
        });
    } else {
        await deductUserCurrency(userId, 600000, 140000);
        
        bonusRolls = Math.floor(bonusRolls * 3);
        
        await updateUserRolls(userId, bonusRolls);
        await updateUserLuck(userId, 1.5);

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🍽️ Devoured! 🍽️')
                .setDescription(
                    `Yuyuko took 600k coins & 140k gems... but left ${bonusRolls.toLocaleString()} rolls` +
                    `${bonusRolls === 30000 ? ' thanks to ShinyMark+!' : ' as a ghostly favor.'}\n\n` +
                    `✨ Luck boost has been massively increased!`
                )
                .setColor('#0099ff')
                .setTimestamp()]
        });
    }
}

async function handleNormalOutcome(userId, channel, user, currentLuck, config) {
    const normalConfig = config.offers.normal;
    let bonusRolls = currentLuck >= 1 ? 1000 : 500;
    let newLuck = Math.min(currentLuck + 0.05, 1);
    
    if (newLuck >= 1) bonusRolls = 1000;
    bonusRolls = Math.min(bonusRolls, 10000);

    if (user.coins < 50000 || user.gems < 10000) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🔮 Insufficient Funds 🔮')
                .setDescription('You don\'t have enough coins or gems for Yuyuko\'s blessing.')
                .setColor('#ff0000')
                .setTimestamp()]
        });
        return;
    }

    await deductUserCurrency(userId, 50000, 10000);
    
    bonusRolls = Math.floor(bonusRolls * 2.5);
    
    await updateUserRolls(userId, bonusRolls);
    await updateUserLuck(userId, 0.125, normalConfig.luckRarities);

    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('🍀 Yuyuko\'s Blessing 🍀')
            .setDescription(
                `${bonusRolls === 2500 ? 'ShinyMark+ triggered! ' : ''}` +
                `50k coins & 10k gems lost... but luck shines on your next ${bonusRolls.toLocaleString()} rolls.\n\n` +
                `✨ Enhanced luck boost applied!`
            )
            .setColor('#0099ff')
            .setTimestamp()]
    });
}

module.exports = { handleYuyuko };