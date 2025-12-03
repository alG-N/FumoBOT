const { checkRestrictions } = require('../../Middleware/restrictions');
const { getUserCraftData } = require('../../Service/CraftService/CraftCacheService');
const { getAllRecipes } = require('../../Service/CraftService/CraftRecipeService');
const { validateFullCraft } = require('../../Service/CraftService/CraftValidationService');
const { processCraft } = require('../../Service/CraftService/CraftProcessService');
const { parseCraftCommand } = require('../../Ultility/craftParser');
const { get, all } = require('../../Core/database');
const { CRAFT_CATEGORIES, CRAFT_CONFIG } = require('../../Configuration/craftConfig');
const {
    createCraftMenuEmbed,
    createConfirmEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createHistoryEmbed,
    createNavigationButtons
} = require('../../Service/CraftService/CraftUIService');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (message.content !== '.itemCraft' && !message.content.startsWith('.itemCraft ') &&
                message.content !== '.ic' && !message.content.startsWith('.ic ')) return;

            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const args = message.content.split(' ').slice(1);
            const parsed = parseCraftCommand(args);
            const userId = message.author.id;

            if (parsed.type === 'HISTORY') {
                const history = await all(
                    `SELECT itemName, amount, craftedAt FROM craftHistory WHERE userId = ? AND craftType = ? ORDER BY craftedAt DESC LIMIT ?`,
                    [userId, 'item', CRAFT_CONFIG.HISTORY_LIMIT]
                );
                const embed = createHistoryEmbed(history, 'item');
                return message.reply({ embeds: [embed] });
            }

            if (parsed.type === 'MENU') {
                const userData = await getUserCraftData(userId, 'item');
                const recipes = getAllRecipes('item');
                const pages = CRAFT_CATEGORIES.ITEM.tiers;
                let currentPage = 0;

                const getEmbed = () => createCraftMenuEmbed('item', pages[currentPage], recipes, userData);
                const row = createNavigationButtons(userId);

                const sent = await message.reply({ embeds: [getEmbed()], components: [row] });
                const collector = sent.createMessageComponentCollector({
                    filter: i => i.user.id === userId,
                    time: 60000
                });

                collector.on('collect', async interaction => {
                    await interaction.deferUpdate();
                    if (interaction.customId === `next_page_${userId}`) {
                        currentPage = (currentPage + 1) % pages.length;
                    } else if (interaction.customId === `prev_page_${userId}`) {
                        currentPage = (currentPage - 1 + pages.length) % pages.length;
                    }
                    await sent.edit({ embeds: [getEmbed()], components: [row] });
                });

                collector.on('end', () => {
                    sent.edit({ components: [] }).catch(() => {});
                });

                return;
            }

            if (parsed.type === 'CRAFT') {
                const userData = await getUserCraftData(userId, 'item');
                const validation = validateFullCraft(parsed.itemName, parsed.amount, 'item', userData);

                if (!validation.valid) {
                    const errorEmbed = createErrorEmbed(validation.error, {
                        ...validation,
                        itemName: parsed.itemName,
                        max: CRAFT_CONFIG.MAX_CRAFT_AMOUNT
                    });
                    return message.reply({ embeds: [errorEmbed] });
                }

                const confirmEmbed = createConfirmEmbed(
                    parsed.itemName,
                    parsed.amount,
                    validation.recipe,
                    validation.totalCoins,
                    validation.totalGems,
                    userData
                );

                await message.reply({ embeds: [confirmEmbed] });

                const collector = message.channel.createMessageCollector({
                    filter: m => m.author.id === userId,
                    max: 1,
                    time: CRAFT_CONFIG.CONFIRM_TIMEOUT
                });

                collector.on('collect', async collected => {
                    if (collected.content.toLowerCase() === 'yes') {
                        const result = await processCraft(
                            userId,
                            parsed.itemName,
                            parsed.amount,
                            'item',
                            validation.recipe,
                            validation.totalCoins,
                            validation.totalGems
                        );

                        const successEmbed = createSuccessEmbed(
                            parsed.itemName,
                            parsed.amount,
                            result.queued,
                            result
                        );
                        message.reply({ embeds: [successEmbed] });
                    } else {
                        message.reply('❌ Crafting cancelled.');
                    }
                });

                collector.on('end', (collected) => {
                    if (collected.size === 0) {
                        message.reply('⌛ Crafting timed out.');
                    }
                });
            }
        } catch (err) {
            console.error('[itemCraft] Error:', err);
            message.reply('❌ An error occurred. Please try again later.');
        }
    });
};