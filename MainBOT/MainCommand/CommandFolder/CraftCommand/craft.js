const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');
const { registerCraftInteractionHandler } = require('../../Service/CraftService/CraftInteractionHandler');

// Prevent duplicate registration
let isRegistered = false;

module.exports = (client) => {
    if (isRegistered) return;
    isRegistered = true;

    // Register the interaction handler for buttons
    registerCraftInteractionHandler(client);

    // ONLY handle .craft command
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (message.content !== '.craft' && message.content !== '.c') return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;
        const embed = createMainCraftEmbed();
        const buttons = createMainCraftButtons(userId);

        await message.reply({ embeds: [embed], components: [buttons] });
    });
};

function createMainCraftEmbed() {
    return new EmbedBuilder()
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
}

function createMainCraftButtons(userId) {
    return new ActionRowBuilder()
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
}