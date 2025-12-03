const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { calculateMaxCraftable } = require('./CraftValidationService');
const { getAllRecipes } = require('./CraftRecipeService');

function formatRequirements(requires, userInventory, craftAmount = 1) {
    return Object.entries(requires).map(([reqItem, reqQty]) => {
        const owned = userInventory[reqItem] || 0;
        const totalRequired = reqQty * craftAmount;
        return `📦 ${totalRequired}x ${reqItem} — *(You have ${owned})*`;
    }).join('\n');
}

function formatResources(resources, userCoins, userGems, craftAmount = 1) {
    const coins = resources.coins * craftAmount;
    const gems = resources.gems * craftAmount;
    return `💰 Coins: ${formatNumber(coins)} *(You have ${formatNumber(userCoins)})*\n💎 Gems: ${formatNumber(gems)} *(You have ${formatNumber(userGems)})*`;
}

function createCraftMenuEmbed(craftType, category, recipes, userData) {
    const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTimestamp();

    if (category === 'How to Craft') {
        embed
            .setTitle('📖 How to Craft')
            .setDescription(
                `**Usage:**\n\`\`\`.${craftType}Craft <item name> <amount>\`\`\`\n\n` +
                'Make sure you have the required materials and coins/gems in your inventory.\n\n' +
                'Navigate the pages below to see what you can currently craft!\n\n' +
                '🆕 **Tip:** Type `.${craftType}Craft history` to see your last crafts!'
            );
        return embed;
    }

    embed.setTitle(`🛠️ ${category}`);

    const items = [];
    for (const [itemName, recipe] of Object.entries(recipes)) {
        if (recipe.category !== category) continue;

        const maxCraftable = calculateMaxCraftable(
            recipe,
            userData.inventory,
            userData.coins,
            userData.gems
        );

        const canCraft = maxCraftable > 0;
        const status = canCraft ? '✅' : '❌';

        items.push(
            `**${status} \`${itemName}\`**\n` +
            `> 📝 *${recipe.effect || 'No effect'}*\n` +
            `> 🧰 Craftable: **${maxCraftable || "None"}**\n` +
            `> 💰 Cost: ${formatNumber(recipe.resources.coins)} coins, ${formatNumber(recipe.resources.gems)} gems\n` +
            `-----------------------------------------`
        );
    }

    embed.setDescription(items.length > 0 ? items.join('\n') : `No craftable items in **${category}**.`);

    return embed;
}

function createConfirmEmbed(itemName, amount, recipe, totalCoins, totalGems, userData) {
    return new EmbedBuilder()
        .setTitle(`⚒️ Craft **${amount}x ${itemName}**?`)
        .setColor(Colors.Green)
        .addFields(
            { name: '📋 Effect:', value: recipe.effect || '*No effect description*' },
            { name: '📦 Required Materials:', value: formatRequirements(recipe.requires, userData.inventory, amount) || 'None' },
            { name: '💰 Cost:', value: formatResources(recipe.resources, userData.coins, userData.gems, amount) },
            { name: '🔔 Instruction:', value: 'Type **yes** to confirm or **no** to cancel.' }
        )
        .setFooter({ text: 'You have 15 seconds to respond.' })
        .setTimestamp();
}

function createSuccessEmbed(itemName, amount, queued = false, timerData = null) {
    const embed = new EmbedBuilder()
        .setTitle('✅ Crafting Successful!')
        .setColor(Colors.Green)
        .setTimestamp();

    if (queued && timerData) {
        const completesIn = Math.ceil(timerData.timerDuration / 60000);
        embed.setDescription(
            `Your craft of **${amount}x ${itemName}** has been queued!\n\n` +
            `⏱️ **Completes in:** ${completesIn} minute(s)\n` +
            `Use \`.craftQueue\` to check your crafting queue.`
        );
    } else {
        embed.setDescription(`You have crafted **${amount}x ${itemName}**!`);
    }

    return embed;
}

function createErrorEmbed(error, details = {}) {
    const messages = {
        INVALID_AMOUNT: 'Craft amount must be a positive integer.',
        AMOUNT_TOO_LARGE: `Cannot craft more than ${details.max || 1000} at once.`,
        RECIPE_NOT_FOUND: `Recipe for "${details.itemName}" does not exist.`,
        INSUFFICIENT_CURRENCY: `You are missing:\n${details.missing?.join('\n') || 'coins/gems'}`,
        INSUFFICIENT_MATERIALS: `You are missing:\n${details.missing?.map(m => `- ${m}`).join('\n') || 'materials'}`
    };

    return new EmbedBuilder()
        .setTitle('❌ Crafting Failed')
        .setColor(Colors.Red)
        .setDescription(messages[error] || 'An error occurred.')
        .setTimestamp();
}

function createHistoryEmbed(history, craftType) {
    const embed = new EmbedBuilder()
        .setTitle('🕑 Recent Crafting History')
        .setColor(Colors.Gold);

    if (!history.length) {
        embed.setDescription('No crafting history yet.');
    } else {
        embed.setDescription(
            history.map(r =>
                `• **${r.amount}x ${r.itemName}** at <t:${Math.floor(r.craftedAt / 1000)}:f>`
            ).join('\n')
        );
    }
    embed.setFooter({ text: `Use .${craftType}Craft <item> to craft more!` });

    return embed;
}

function createNavigationButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`prev_page_${userId}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`next_page_${userId}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
    );
}

module.exports = {
    formatRequirements,
    formatResources,
    createCraftMenuEmbed,
    createConfirmEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createHistoryEmbed,
    createNavigationButtons
};
