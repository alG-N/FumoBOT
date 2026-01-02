const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { format } = require('date-fns');
const { VARIANT_CONFIG } = require('../../../Configuration/informConfig');
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
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('inform_variant_void', userId))
                .setLabel('🌀 Void')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('inform_variant_glitched', userId))
                .setLabel('🔮 Glitched')
                .setStyle(ButtonStyle.Secondary)
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
    const { fumo, summonPlaces } = fumoData;
    const variantConfig = VARIANT_CONFIG[variant];

    const titleSuffix = variant !== 'NORMAL' ? ` - ${variantConfig.emoji} ${variant} Variant` : '';

    const embed = new EmbedBuilder()
        .setTitle(`Fumo Information: ${fumo.name}(${fumo.rarity})${titleSuffix}`)
        .setColor(getVariantColor(variant))
        .setImage(fumo.picture);

    if (fumo.origin) {
        embed.addFields({ name: '📖 Origin', value: fumo.origin, inline: false });
    }

    if (fumo.fact) {
        embed.addFields({ name: '💡 Interesting Fact', value: fumo.fact, inline: false });
    }

    // Ownership section
    let ownershipText = '';
    if (!ownershipData.userOwns) {
        ownershipText += `❌ You currently don't own this ${variant.toLowerCase()} variant.\n`;
    } else {
        ownershipText += `✅ You own **${ownershipData.userQuantity}** of this ${variant.toLowerCase()} variant.\n`;
        if (ownershipData.firstObtained) {
            const formattedDate = format(new Date(ownershipData.firstObtained), 'PPpp');
            ownershipText += `📅 First obtained: ${formattedDate}\n`;
        }
    }

    embed.addFields({
        name: '👤 Your Ownership',
        value: ownershipText,
        inline: false
    });

    // Existence statistics
    let existenceText = '';
    if (variant === 'NORMAL') {
        existenceText += `🔹 Normal: **${formatNumber(ownershipData.normalExistence)}**\n`;
        existenceText += `✨ Shiny: **${formatNumber(ownershipData.shinyExistence)}**\n`;
        existenceText += `🌟 alG: **${formatNumber(ownershipData.algExistence)}**\n`;
        existenceText += `🌀 Void: **${formatNumber(ownershipData.voidExistence)}**\n`;
        existenceText += `🔮 Glitched: **${formatNumber(ownershipData.glitchedExistence)}**\n`;
    } else {
        existenceText += `${variantConfig.emoji} **${formatNumber(ownershipData.variantExistence)}** exist\n`;
    }
    existenceText += `🌐 Total (all variants): **${formatNumber(ownershipData.totalExistence)}**\n`;
    existenceText += `👥 Unique owners: **${formatNumber(ownershipData.uniqueOwners)}**`;

    embed.addFields({
        name: '📊 Server Statistics',
        value: existenceText,
        inline: false
    });

    // How to obtain section
    if (summonPlaces && summonPlaces.length > 0) {
        let availabilityText = '';

        summonPlaces.forEach((summonPlace, index) => {
            if (index > 0) availabilityText += '\n\n';

            availabilityText += `**${summonPlace.place}**\n`;

            if (summonPlace.price !== undefined) {
                availabilityText += `💰 Price: **${formatNumber(summonPlace.price)}** coins`;
            } else if (summonPlace.chance) {
                const displayChance = variant !== 'NORMAL'
                    ? calculateVariantChance(summonPlace.chance, variantConfig.multiplier)
                    : summonPlace.chance;

                availabilityText += `🎲 Base chance: **${summonPlace.chance}**`;

                if (variant !== 'NORMAL') {
                    availabilityText += `\n${variantConfig.emoji} ${variant} chance: **${displayChance}**`;
                }

                availabilityText += `\n💎 Currency: **${summonPlace.currency}**`;
            }
        });

        embed.addFields({
            name: '🎯 How to Obtain',
            value: availabilityText,
            inline: false
        });
    }

    // Variant-specific info
    const variantInfo = getVariantInfoField(variant);
    if (variantInfo) {
        embed.addFields(variantInfo);
    }

    embed.setFooter({ text: 'Use the buttons below to view different variants' });

    return embed;
}

function getVariantColor(variant) {
    const colors = {
        'NORMAL': '#0099ff',
        'SHINY': '#FFD700',
        'ALG': '#FF4500',
        'VOID': '#8B008B',
        'GLITCHED': '#9932CC'
    };
    return colors[variant] || '#0099ff';
}

function getVariantInfoField(variant) {
    const variantInfos = {
        'SHINY': {
            name: '✨ Shiny Variant Info',
            value: 'This is a rare **SHINY** variant with a 1% base appearance chance when summoning this fumo.',
            inline: false
        },
        'ALG': {
            name: '🌟 alG Variant Info',
            value: 'This is an **Extremely Rare alG** variant with a 0.001% base appearance chance when summoning this fumo.',
            inline: false
        },
        'VOID': {
            name: '🌀 VOID Variant Info',
            value: 'This is a **Mysterious VOID** variant with a 0.1% base appearance chance when summoning this fumo (requires VoidCrystal active).\n\n**Note:** VOID trait can be activated in: Coin Banner, Gem Banner, Reimu Prayer, and Market purchases!',
            inline: false
        },
        'GLITCHED': {
            name: '🔮 Glitched Variant Info',
            value: 'This is a **Glitched** variant with a 0.002% base appearance chance when summoning this fumo (requires S!gil? or CosmicCore active).\n\n**Note:** GLITCHED trait can be activated in: Coin Banner, Gem Banner, Reimu Prayer, and Market purchases!',
            inline: false
        }
    };
    return variantInfos[variant] || null;
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
    createNotFoundEmbed,
    getVariantColor,
    getVariantInfoField
};