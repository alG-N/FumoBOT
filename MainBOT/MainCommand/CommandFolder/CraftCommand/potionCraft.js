const { checkRestrictions } = require('../../Middleware/restrictions');
const { all } = require('../../Core/database');
const { CRAFT_CONFIG } = require('../../Configuration/craftConfig');
const { createHistoryEmbed } = require('../../Service/CraftService/CraftUIService');
const { parseCraftCommand } = require('../../Ultility/craftParser');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const args = message.content.split(' ').slice(1);
            const parsed = parseCraftCommand(args);
            const userId = message.author.id;

            // Show history
            if (parsed.type === 'HISTORY') {
                const history = await all(
                    `SELECT itemName, amount, craftedAt FROM craftHistory WHERE userId = ? AND craftType = ? ORDER BY craftedAt DESC LIMIT ?`,
                    [userId, 'potion', CRAFT_CONFIG.HISTORY_LIMIT]
                );
                const embed = createHistoryEmbed(history, 'potion');
                return message.reply({ embeds: [embed] });
            }

            // For everything else, redirect to main craft menu
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');

            const embed = new EmbedBuilder()
                .setTitle('🛠️ Crafting Menu')
                .setDescription(
                    '**Welcome to the Crafting System!**\n\n' +
                    'Select a crafting category below to view available recipes.\n\n' +
                    '📊 **Queue Status:** Use the Queue button to view your crafting progress.\n' +
                    '⚠️ **Limit:** You can have up to 5 items crafting at once.\n\n' +
                    '**Categories:**\n' +
                    '💊 **Potions** - Boost your coin, gem, and income production\n' +
                    '🧰 **Items** - Craft powerful tools and materials\n' +
                    '🧸 **Fumos** - Coming soon!\n' +
                    '🌟 **Blessings** - Coming soon!'
                )
                .setColor('Random')
                .setFooter({ text: 'Select a category to begin crafting!' })
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId('craft_menu_potion', userId))
                        .setLabel('💊 Potions')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId('craft_menu_item', userId))
                        .setLabel('🧰 Items')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId('craft_menu_fumo', userId))
                        .setLabel('🧸 Fumos')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId('craft_menu_blessing', userId))
                        .setLabel('🌟 Blessings')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId('craft_menu_queue', userId))
                        .setLabel('📋 Queue')
                        .setStyle(ButtonStyle.Success)
                );

            await message.reply({ embeds: [embed], components: [buttons] });

        } catch (err) {
            console.error('[potionCraft] Error:', err);
            message.reply('❌ An error occurred. Please try again later.');
        }
    });
};