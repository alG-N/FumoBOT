const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');

const INTERACTION_TIMEOUT = 30000;

class SellUIService {
    static createConfirmationEmbed(fumoName, quantity, reward, rewardType, multipliers) {
        const rarity = fumoName.match(/\((.+?)\)/)?.[1] || 'Unknown';
        
        let description = `You are about to sell **${quantity}x ${fumoName}** for **${formatNumber(reward)} ${rewardType}**.\n\n`;
        description += `💎 Fumo Rarity: **${rarity}**\n`;

        if (multipliers.shiny > 1) {
            description += `✨ SHINY Bonus: x${multipliers.shiny}\n`;
        }

        if (multipliers.alg > 1) {
            description += `🌟 alG Bonus: x${multipliers.alg}\n`;
        }

        if (multipliers.sellPenalty !== 1) {
            description += `⚖️ Sell Modifier: x${multipliers.sellPenalty.toFixed(2)}\n`;
        }

        description += `\n🔥 Are you sure you want to proceed?`;

        return new EmbedBuilder()
            .setTitle('💰 Confirm Sale')
            .setDescription(description)
            .setColor('#28A745')
            .setFooter({ text: 'Click Confirm to proceed or Cancel to abort.' });
    }

    static createBulkConfirmationEmbed(rarity, tag, totalFumos, totalReward, rewardType, multipliers) {
        let description = `You are about to sell all your **${rarity}${tag || ''}** Fumos for **${formatNumber(totalReward)} ${rewardType}**.\n\n`;
        description += `📦 Total Fumos: **${totalFumos}**\n`;

        if (multipliers.shiny > 1) {
            description += `✨ SHINY Bonus: x${multipliers.shiny}\n`;
        }

        if (multipliers.alg > 1) {
            description += `🌟 alG Bonus: x${multipliers.alg}\n`;
        }

        if (multipliers.sellPenalty !== 1) {
            description += `⚖️ Sell Modifier: x${multipliers.sellPenalty.toFixed(2)}\n`;
        }

        description += `💰 Total Reward: **${formatNumber(totalReward)} ${rewardType}**\n\n`;
        description += `Are you sure you want to proceed?`;

        return new EmbedBuilder()
            .setTitle('💎 Confirm Bulk Sale')
            .setDescription(description)
            .setColor('#28A745')
            .setFooter({ text: 'Click Confirm to proceed or Cancel to abort.' });
    }

    static createSuccessEmbed(fumoName, quantity, reward, rewardType) {
        return new EmbedBuilder()
            .setTitle('✅ Sale Successful')
            .setDescription(
                `You have successfully sold **${quantity}x ${fumoName}**.\n` +
                `You received **${formatNumber(reward)} ${rewardType}**.`
            )
            .setColor('#00ff00');
    }

    static createBulkSuccessEmbed(rarity, tag, totalFumos, totalReward, rewardType) {
        return new EmbedBuilder()
            .setTitle('✅ Sale Successful')
            .setDescription(
                `You have successfully sold all your **${rarity}${tag || ''}** Fumos.\n` +
                `Total Fumos: **${totalFumos}**\n` +
                `You received **${formatNumber(totalReward)} ${rewardType}**.`
            )
            .setColor('#00ff00');
    }

    static createErrorEmbed(errorType, details) {
        const errorMessages = {
            'INVALID_FORMAT': {
                title: '⚠️ Invalid Command Format',
                description: 
                    `Please use one of the following formats to sell your Fumos:\n\n` +
                    `🔹 **.sell <fumoName>(Rarity) quantity**\n` +
                    `Example: \`.sell Marisa(Common) 3\`\n\n` +
                    `🔹 **.sell <fumoName>(Rarity)[✨SHINY] quantity**\n` +
                    `Example: \`.sell Marisa(Common)[✨SHINY] 1\`\n\n` +
                    `🔹 **.sell (Rarity)**\n` +
                    `Example: \`.sell LEGENDARY\`\n\n` +
                    `🔹 **.sell (Rarity)[✨SHINY]**\n` +
                    `Example: \`.sell Common[✨SHINY]\``,
                footer: '📘 Tip: Double-check your command format before sending.'
            },
            'INVALID_RARITY': {
                title: '❌ Invalid Rarity Format',
                description: `The rarity **${details}** is not valid.\n\nValid rarities are:\n\nCommon, UNCOMMON, RARE, EPIC, OTHERWORLDLY, LEGENDARY, MYTHICAL, EXCLUSIVE, ???, ASTRAL, CELESTIAL, INFINITE, ETERNAL, TRANSCENDENT`,
                footer: 'Example: .sell Reimu(Common) 1'
            },
            'UNSELLABLE_RARITY': {
                title: '⛔ Cannot Sell',
                description: `You cannot sell Fumos of **${details}** rarity.`,
                footer: 'These rarities are too precious to sell!'
            },
            'INVALID_QUANTITY': {
                title: '❌ Invalid Quantity',
                description: 'Please enter a valid quantity (positive number).',
                footer: 'Example: .sell Reimu(Common) 5'
            },
            'INSUFFICIENT_FUMOS': {
                title: '😔 Not Enough Fumos',
                description: `You don't have enough of **${details.fumoName}** to sell.\n\nYou have: **${details.available}**\nYou need: **${details.requested}**`,
                footer: 'Check your inventory with .storage'
            },
            'NO_FUMOS_FOUND': {
                title: '😔 No Fumos Available',
                description: `No **${details.rarity}${details.tag || ''}** Fumos available to sell.`,
                footer: 'Try rolling for more fumos!'
            },
            'TRANSACTION_FAILED': {
                title: '❌ Transaction Failed',
                description: 'An error occurred while processing your sale. Please try again.',
                footer: 'Contact support if this persists'
            }
        };

        const error = errorMessages[errorType] || errorMessages['TRANSACTION_FAILED'];

        return new EmbedBuilder()
            .setTitle(error.title)
            .setDescription(error.description)
            .setColor('#FF0000')
            .setFooter({ text: error.footer });
    }

    static async awaitConfirmation(message, userId) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('sell_confirm', userId))
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('sell_cancel', userId))
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await message.edit({ components: [row] });

        return new Promise(resolve => {
            const filter = i => i.user.id === userId && ['sell_confirm', 'sell_cancel'].includes(i.customId.split('_').slice(0, 2).join('_'));
            const collector = message.channel.createMessageComponentCollector({ 
                filter, 
                max: 1, 
                time: INTERACTION_TIMEOUT 
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                await message.edit({ components: [] });
                resolve(i.customId.includes('confirm'));
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    await message.edit({ components: [] });
                    resolve(false);
                }
            });
        });
    }
}

module.exports = SellUIService;