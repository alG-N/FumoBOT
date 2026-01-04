const ItemQueryService = require('../../../Service/UserDataService/ItemService/ItemInfoService/ItemQueryService');
const ItemFormatter = require('../../../Service/UserDataService/ItemService/ItemInfoService/ItemFormatter');
const { checkRestrictions } = require('../../../Middleware/restrictions');

module.exports = async (discordClient) => {
    discordClient.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.trim().toLowerCase();
        const args = message.content.split(/ +/);

        if (content.startsWith('.iteminfo') || content.startsWith('.ii')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const query = args.slice(1).join(' ').trim();

            if (!query) {
                const helpEmbed = ItemFormatter.createHelpEmbed();
                return message.reply({ embeds: [helpEmbed] });
            }

            const item = ItemQueryService.getItemByName(query);

            if (item) {
                const embed = ItemFormatter.createItemEmbed(query, item, message.author.tag);
                return message.reply({ embeds: [embed] });
            }

            const searchResults = ItemQueryService.fuzzySearch(query, 0.5);

            if (searchResults.length > 0) {
                if (searchResults.length === 1 || searchResults[0].similarity > 0.9) {
                    const topResult = searchResults[0];
                    const embed = ItemFormatter.createItemEmbed(
                        topResult.name, 
                        topResult, 
                        message.author.tag
                    );
                    return message.reply({ embeds: [embed] });
                }

                const embed = ItemFormatter.createSearchResultsEmbed(
                    query, 
                    searchResults, 
                    message.author.tag
                );
                return message.reply({ embeds: [embed] });
            }

            const notFoundEmbed = ItemFormatter.createNotFoundEmbed(query);
            return message.reply({ embeds: [notFoundEmbed] });
        }

        if (content.startsWith('.itemlist') || content.startsWith('.il')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const rarity = args[1];

            if (!rarity) {
                return message.reply('❌ Please specify a rarity. Example: `.itemlist Mythical`');
            }

            const items = ItemQueryService.getItemsByRarity(rarity);

            if (items.length === 0) {
                return message.reply(`❌ No items found for rarity: **${rarity}**`);
            }

            const embed = ItemFormatter.createRarityListEmbed(
                rarity, 
                items, 
                message.author.tag
            );
            return message.reply({ embeds: [embed] });
        }

        if (content.startsWith('.randomitem') || content.startsWith('.ri')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const allItems = ItemQueryService.getAllItems();
            const randomItem = allItems[Math.floor(Math.random() * allItems.length)];

            const embed = ItemFormatter.createItemEmbed(
                randomItem.name, 
                randomItem, 
                message.author.tag
            );
            return message.reply({ embeds: [embed] });
        }

        if (content.startsWith('.itemstats')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const stats = {
                totalItems: ItemQueryService.getItemCount(),
                craftableCount: ItemQueryService.getCraftableItems().length,
                usableCount: ItemQueryService.getUsableItems().length,
                rarityDistribution: ItemQueryService.getRarityDistribution(),
                categoryDistribution: ItemQueryService.getCategoryDistribution()
            };

            const embed = ItemFormatter.createStatsEmbed(stats);
            return message.reply({ embeds: [embed] });
        }

        if (content.startsWith('.craftableitems')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const items = ItemQueryService.getCraftableItems();
            const embed = ItemFormatter.createCategoryListEmbed(
                'Craftable', 
                items, 
                message.author.tag
            );
            return message.reply({ embeds: [embed] });
        }

        if (content.startsWith('.usableitems')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const items = ItemQueryService.getUsableItems();
            const embed = ItemFormatter.createCategoryListEmbed(
                'Usable', 
                items, 
                message.author.tag
            );
            return message.reply({ embeds: [embed] });
        }

        if (content.startsWith('.itemsearch')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const query = args.slice(1).join(' ').trim();

            if (!query) {
                return message.reply('❌ Please provide a search query. Example: `.itemsearch potion`');
            }

            const results = ItemQueryService.searchItems(query);
            const embed = ItemFormatter.createSearchResultsEmbed(
                query, 
                results, 
                message.author.tag
            );
            return message.reply({ embeds: [embed] });
        }

        if (content.startsWith('.itemcategory')) {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const category = args[1];

            if (!category) {
                return message.reply('❌ Please specify a category. Example: `.itemcategory Potion`');
            }

            const items = ItemQueryService.getItemsByCategory(category);

            if (items.length === 0) {
                return message.reply(`❌ No items found in category: **${category}**`);
            }

            const embed = ItemFormatter.createCategoryListEmbed(
                category, 
                items, 
                message.author.tag
            );
            return message.reply({ embeds: [embed] });
        }
    });
};