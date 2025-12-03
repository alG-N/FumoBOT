const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { format } = require('date-fns');
const { VARIANT_CONFIG, SUMMON_PLACES } = require('../../../Configuration/informConfig');
const { calculateVariantChance } = require('./InformDataService');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');

function createVariantButtons(userId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('inform_variant_normal', userId))
                .setLabel('Normal')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('inform_variant_shiny', userId))
                .setLabel('✨ Shiny')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('inform_variant_alg', userId))
                .setLabel('🌟 alG')
                .setStyle(ButtonStyle.Danger)
        );
}

function createSelectionEmbed(fumo) {
    return new EmbedBuilder()
        .setTitle(`Select Variant for ${fumo.name}(${fumo.rarity})`)
        .setDescription('Choose which variant you want to view information for:')
        .setColor('#FFA500')
        .setThumbnail(fumo.picture);
}

function createInformEmbed(fumoData, ownershipData, variant) {
    const { fumo, summonPlace, baseChance } = fumoData;
    const variantConfig = VARIANT_CONFIG[variant];
    
    const fullName = `${fumo.name}(${fumo.rarity})${variantConfig.tag}`;
    const titleSuffix = variant !== 'NORMAL' ? ` - ${variantConfig.emoji} ${variant} Variant` : '';

    const embed = new EmbedBuilder()
        .setTitle(`Fumo Information: ${fumo.name}(${fumo.rarity})${titleSuffix}`)
        .setColor('#0099ff')
        .setImage(fumo.picture);

    if (fumo.origin) {
        embed.addFields({ name: 'Origin', value: fumo.origin, inline: true });
    }
    
    if (fumo.fact) {
        embed.addFields({ name: 'Interesting Fact', value: fumo.fact, inline: true });
    }

    let description = '';
    
    if (!ownershipData.userOwns) {
        description += `❌ You currently don't own this fumo.\n`;
    } else {
        description += `🎉 You are the proud owner of ${ownershipData.userQuantity} of this fumo. ✅\n`;
    }
    
    description += `🌐 Currently, there are ${formatNumber(ownershipData.totalExistence)} of this fumo in existence.`;
    
    if (ownershipData.userOwns && ownershipData.firstObtained) {
        const formattedDate = format(new Date(ownershipData.firstObtained), 'PPPppp');
        description += `\n📅 You welcomed your first fumo on ${formattedDate}.`;
    }

    if (summonPlace === SUMMON_PLACES.MARKET && fumo.marketPrice) {
        description += `\n🛍️ This fumo can be acquired at the ${summonPlace} for a mere ${formatNumber(fumo.marketPrice)} coins.`;
    } else if (baseChance) {
        const displayChance = variant !== 'NORMAL' 
            ? calculateVariantChance(baseChance, variantConfig.multiplier)
            : baseChance;
            
        description += `\n🔮 This fumo is summoned at the mystical ${summonPlace} using ${summonPlace === SUMMON_PLACES.GEMS_BANNER ? 'gems' : 'coins'} with a chance of ${displayChance}.`;
    }

    if (variant === 'SHINY') {
        description += `\n✨ This is a rare **SHINY** variant with a 1% base summon chance.`;
    } else if (variant === 'ALG') {
        description += `\n🌟 This is an **Extremely Rare alG** variant with a 0.001% base summon chance.`;
    }

    description += `\n👥 Owned by ${formatNumber(ownershipData.uniqueOwners)} unique users.`;

    embed.setDescription(description);
    
    return embed;
}

function createTutorialEmbed() {
    return new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📘 How to Use the .inform Command')
        .setDescription('Learn how to gather detailed information about your fumos.')
        .addFields(
            { name: '📌 Command Format', value: '`.inform <Fumo(Rarity)>` or `.in <Fumo(Rarity)>`' },
            { name: '🔧 Parameters', value: '**<fumo name>:** The exact name of the fumo to get information about.' },
            { name: '❗ Example', value: '`.inform Marisa(Common)`\nThis shows detailed information about the fumo named "Marisa".' }
        )
        .setFooter({ text: 'If you encounter any issues, please use .report' });
}

function createNotFoundEmbed() {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Fumo Not Found')
        .setDescription("I think you just typed nothing or you just typed a non-existent fumo, well that's okay! Please re-type again, or contact support if there is any problem using `.report`")
        .setFooter({ text: 'Tip: Make sure to include the rarity, e.g. Reimu(Common)' });
}

module.exports = {
    createVariantButtons,
    createSelectionEmbed,
    createInformEmbed,
    createTutorialEmbed,
    createNotFoundEmbed
};