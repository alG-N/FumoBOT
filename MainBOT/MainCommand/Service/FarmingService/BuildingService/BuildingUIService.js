const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { getAllBuildingsInfo, formatMultiplier, BUILDING_TYPES } = require('../../../Configuration/buildingConfig');
const { formatNumber } = require('../../../Ultility/formatting');

function createBuildingOverviewEmbed(userId, buildings) {
    const embed = new EmbedBuilder()
        .setTitle('🏗️ Farm Building Management')
        .setColor(Colors.Gold)
        .setDescription(
            '**Upgrade your farm buildings to boost production!**\n\n' +
            'Each building provides unique benefits to your farming operation.\n' +
            'Click the buttons below to upgrade individual buildings.'
        )
        .setThumbnail('https://i.imgur.com/AGQm5nR.jpeg');
    
    for (const [key, building] of Object.entries(buildings)) {
        const currentBonusText = building.currentLevel > 0 
            ? formatMultiplier(building.currentBonus, key)
            : 'Not upgraded';
        
        const nextBonusText = building.canUpgrade
            ? formatMultiplier(building.nextBonus, key)
            : 'MAX LEVEL';
        
        const costText = building.canUpgrade
            ? `💰 ${formatNumber(building.upgradeCost.coins)} coins | 💎 ${formatNumber(building.upgradeCost.gems)} gems`
            : 'N/A';
        
        embed.addFields({
            name: `${building.emoji} ${building.name} - Level ${building.currentLevel}/${building.maxLevel}`,
            value: 
                `${building.description}\n` +
                `**Current:** ${currentBonusText}\n` +
                `**Next Level:** ${nextBonusText}\n` +
                `**Upgrade Cost:** ${costText}`,
            inline: false
        });
    }
    
    embed.setFooter({ text: '💡 Tip: Buildings provide permanent passive bonuses!' });
    
    return embed;
}

function createBuildingButtons(userId, buildings) {
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    
    const buildingKeys = Object.keys(BUILDING_TYPES);
    
    row1.addComponents(
        new ButtonBuilder()
            .setCustomId(`upgrade_COIN_BOOST_${userId}`)
            .setLabel('💰 Upgrade Coins')
            .setStyle(buildings.COIN_BOOST?.canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!buildings.COIN_BOOST?.canUpgrade),
        new ButtonBuilder()
            .setCustomId(`upgrade_GEM_BOOST_${userId}`)
            .setLabel('💎 Upgrade Gems')
            .setStyle(buildings.GEM_BOOST?.canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!buildings.GEM_BOOST?.canUpgrade)
    );
    
    row2.addComponents(
        new ButtonBuilder()
            .setCustomId(`upgrade_CRITICAL_FARMING_${userId}`)
            .setLabel('⚡ Upgrade Critical')
            .setStyle(buildings.CRITICAL_FARMING?.canUpgrade ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(!buildings.CRITICAL_FARMING?.canUpgrade),
        new ButtonBuilder()
            .setCustomId(`upgrade_EVENT_BOOST_${userId}`)
            .setLabel('🌟 Upgrade Events')
            .setStyle(buildings.EVENT_BOOST?.canUpgrade ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(!buildings.EVENT_BOOST?.canUpgrade),
        new ButtonBuilder()
            .setCustomId(`building_close_${userId}`)
            .setLabel('❌ Close')
            .setStyle(ButtonStyle.Danger)
    );
    
    return [row1, row2];
}

function createUpgradeSuccessEmbed(buildingType, newLevel, newBonus) {
    const building = BUILDING_TYPES[buildingType];
    
    return new EmbedBuilder()
        .setTitle('✅ Upgrade Successful!')
        .setColor(Colors.Green)
        .setDescription(
            `${building.emoji} **${building.name}** upgraded to level **${newLevel}**!\n\n` +
            `**New Bonus:** ${formatMultiplier(newBonus, buildingType)}`
        )
        .setTimestamp();
}

function createUpgradeErrorEmbed(errorType, details = {}) {
    const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTimestamp();
    
    switch (errorType) {
        case 'INSUFFICIENT_COINS':
            embed.setTitle('❌ Insufficient Coins')
                .setDescription(
                    `You need **${formatNumber(details.required)}** coins but only have **${formatNumber(details.current)}**.\n\n` +
                    `Missing: **${formatNumber(details.required - details.current)}** coins`
                );
            break;
        
        case 'INSUFFICIENT_GEMS':
            embed.setTitle('❌ Insufficient Gems')
                .setDescription(
                    `You need **${formatNumber(details.required)}** gems but only have **${formatNumber(details.current)}**.\n\n` +
                    `Missing: **${formatNumber(details.required - details.current)}** gems`
                );
            break;
        
        case 'MAX_LEVEL':
            embed.setTitle('⚠️ Maximum Level Reached')
                .setDescription(
                    `This building is already at maximum level (**${details.maxLevel}**).\n\n` +
                    `No further upgrades available.`
                );
            break;
        
        case 'INVALID_BUILDING':
            embed.setTitle('❌ Invalid Building')
                .setDescription('The specified building type does not exist.');
            break;
        
        default:
            embed.setTitle('❌ Upgrade Failed')
                .setDescription('An unknown error occurred during the upgrade.');
    }
    
    return embed;
}

function createBuildingStatsEmbed(userId, buildings) {
    const coinBoost = buildings.COIN_BOOST;
    const gemBoost = buildings.GEM_BOOST;
    const critical = buildings.CRITICAL_FARMING;
    const eventBoost = buildings.EVENT_BOOST;
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Building Statistics')
        .setColor(Colors.Blue)
        .setDescription('Current bonuses from all buildings:')
        .addFields(
            {
                name: '💰 Coin Production',
                value: `Level ${coinBoost.currentLevel}: ${formatMultiplier(coinBoost.currentBonus, 'COIN_BOOST')}`,
                inline: true
            },
            {
                name: '💎 Gem Production',
                value: `Level ${gemBoost.currentLevel}: ${formatMultiplier(gemBoost.currentBonus, 'GEM_BOOST')}`,
                inline: true
            },
            {
                name: '⚡ Critical Chance',
                value: `Level ${critical.currentLevel}: ${formatMultiplier(critical.currentBonus, 'CRITICAL_FARMING')}`,
                inline: true
            },
            {
                name: '🌟 Event Amplification',
                value: `Level ${eventBoost.currentLevel}: ${formatMultiplier(eventBoost.currentBonus, 'EVENT_BOOST')}`,
                inline: true
            }
        )
        .setFooter({ text: 'Buildings provide permanent passive bonuses' })
        .setTimestamp();
    
    return embed;
}

module.exports = {
    createBuildingOverviewEmbed,
    createBuildingButtons,
    createUpgradeSuccessEmbed,
    createUpgradeErrorEmbed,
    createBuildingStatsEmbed
};