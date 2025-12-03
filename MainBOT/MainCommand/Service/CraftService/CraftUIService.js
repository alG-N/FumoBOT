const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { calculateMaxCraftable } = require('./CraftValidationService');
const { getCraftTimer, formatTime, CRAFT_CATEGORIES } = require('../../Configuration/craftConfig');
const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');

function createQueueEmbed(queueItems, userId) {
    const embed = new EmbedBuilder()
        .setTitle('🔨 Crafting Queue')
        .setColor(Colors.Blue)
        .setTimestamp();

    if (!queueItems || queueItems.length === 0) {
        embed.setDescription('Your crafting queue is empty.\n\nStart crafting items to see them here!');
        
        const returnButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                    .setLabel('🏠 Return to Main Menu')
                    .setStyle(ButtonStyle.Primary)
            );
        
        return { embed, buttons: [returnButton] };
    }

    const now = Date.now();
    const description = queueItems.map((item, idx) => {
        const timeLeft = item.completesAt - now;
        const isReady = timeLeft <= 0;
        const status = isReady ? '✅ Ready to Claim' : `⏱️ ${formatTime(timeLeft)}`;
        
        return `**${idx + 1}.** ${item.amount}x **${item.itemName}**\n` +
               `   └ ${status}`;
    }).join('\n\n');

    embed.setDescription(description);
    embed.setFooter({ text: `${queueItems.length}/5 slots used` });

    const buttons = [];
    
    const maxButtonsPerRow = 5;
    const maxRows = 4;
    let buttonCount = 0;
    
    for (let i = 0; i < queueItems.length && buttonCount < (maxButtonsPerRow * maxRows); i++) {
        const item = queueItems[i];
        const isReady = item.completesAt <= now;
        
        if (buttonCount % maxButtonsPerRow === 0) {
            buttons.push(new ActionRowBuilder());
        }
        
        const currentRow = buttons[buttons.length - 1];
        
        // FIX: Use 'queueId' instead of 'id' to avoid key mapping conflicts
        const claimButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('craft_claim', userId, { queueId: String(item.id) }))
            .setLabel(`${isReady ? '✅' : '⏱️'} ${item.itemName.slice(0, 60)}`)
            .setStyle(isReady ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!isReady);
        
        currentRow.addComponents(claimButton);
        buttonCount++;
    }

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_queue_refresh', userId))
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                .setLabel('🏠 Main Menu')
                .setStyle(ButtonStyle.Secondary)
        );
    
    buttons.push(navRow);

    return { embed, buttons };
}

function createCraftCategoryEmbed(craftType, page, recipes, userData) {
    const categories = craftType === 'item' 
        ? CRAFT_CATEGORIES.ITEM.tiers 
        : CRAFT_CATEGORIES.POTION.categories;
    
    const category = categories[page];
    
    const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTimestamp();

    if (category === 'How to Craft') {
        embed
            .setTitle('📖 How to Craft')
            .setDescription(
                `**Enhanced Crafting System**\n\n` +
                `**Features:**\n` +
                `• Select items from dropdown to craft them\n` +
                `• Queue up to 5 items at once\n` +
                `• View crafting progress in real-time\n` +
                `• Timer multiplies by quantity crafted\n` +
                `• Individual claim buttons for each item\n\n` +
                `**Usage:**\n` +
                `1. Browse available recipes using navigation\n` +
                `2. Select item from dropdown menu\n` +
                `3. Enter amount to craft\n` +
                `4. Confirm and wait for timer completion\n` +
                `5. Claim when ready!\n\n` +
                `📊 Use the **Queue** button to view your crafting progress\n` +
                `⏱️ **Note:** Crafting 15x 1min items = 15min total wait time`
            );
        return { embed, items: [], hasRecipes: false };
    }

    if (category === 'Craft History') {
        embed
            .setTitle('🕑 Craft History')
            .setDescription('This page will show your recent crafting history.\n\nUse `.craft` to access the main menu.');
        return { embed, items: [], hasRecipes: false };
    }

    embed.setTitle(`🛠️ ${category} - Available Recipes`);

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
        const timer = getCraftTimer(craftType, itemName, 1);
        const timerDisplay = timer > 0 ? `⏱️ ${formatTime(timer)}` : '⚡ Instant';

        items.push({
            itemName,
            recipe,
            maxCraftable,
            canCraft,
            status,
            timerDisplay
        });
    }

    if (items.length === 0) {
        embed.setDescription(`No recipes available in **${category}**.`);
        return { embed, items: [], hasRecipes: false };
    }

    const description = items.map(item => 
        `${item.status} **\`${item.itemName}\`** ${item.timerDisplay} per item\n` +
        `> 📝 *${item.recipe.effect || 'No effect'}*\n` +
        `> 🧰 Max Craftable: **${item.maxCraftable || "None"}**\n` +
        `> 💰 ${formatNumber(item.recipe.resources.coins)} coins, ${formatNumber(item.recipe.resources.gems)} gems per item\n`
    ).join('\n');

    embed.setDescription(description);
    embed.setFooter({ text: `Page ${page + 1}/${categories.length} • Timer scales with quantity` });

    return { embed, items, hasRecipes: true };
}

function createCraftNavigationButtons(userId, craftType, currentPage, totalPages, queueCount = 0) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_first', userId, { type: craftType }))
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_prev', userId, { type: craftType }))
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_next', userId, { type: craftType }))
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_last', userId, { type: craftType }))
                .setLabel('⏭️ Last')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                .setLabel('🏠 Main Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    return [row1];
}

function createCraftItemSelectMenu(userId, craftType, items) {
    if (!items || items.length === 0) {
        return null;
    }

    const options = items
        .filter(item => item.canCraft)
        .slice(0, 25)
        .map(item => 
            new StringSelectMenuOptionBuilder()
                .setLabel(item.itemName.slice(0, 100))
                .setValue(item.itemName)
                .setDescription(`Max: ${item.maxCraftable} | ${item.timerDisplay} per item`.slice(0, 100))
                .setEmoji(item.canCraft ? '✅' : '❌')
        );

    if (options.length === 0) {
        return null;
    }

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(buildSecureCustomId('craft_select_item', userId, { type: craftType }))
                .setPlaceholder('Select an item to craft...')
                .addOptions(options)
        );
}

function createAmountModal(itemName, userId, maxCraftable) {
    return new ModalBuilder()
        .setCustomId(`craft_amount_${userId}`)
        .setTitle(`Craft ${itemName.slice(0, 40)}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel(`How many? (Max: ${maxCraftable})`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(`1 - ${maxCraftable}`)
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(10)
            )
        );
}

function createConfirmButtons(userId, itemName, amount) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_confirm', userId, { 
                    item: itemName.slice(0, 50), 
                    amt: amount 
                }))
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_cancel', userId))
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );
}

function createConfirmEmbed(itemName, amount, recipe, totalCoins, totalGems, userData, craftType) {
    const timer = getCraftTimer(craftType, itemName, amount);
    const timerDisplay = timer > 0 ? `⏱️ ${formatTime(timer)}` : '⚡ Instant';
    
    const requirements = Object.entries(recipe.requires).map(([reqItem, reqQty]) => {
        const owned = userData.inventory[reqItem] || 0;
        const totalRequired = reqQty * amount;
        return `📦 ${totalRequired}x ${reqItem} *(You have ${owned})*`;
    }).join('\n') || 'None';

    return new EmbedBuilder()
        .setTitle(`⚒️ Confirm Craft`)
        .setColor(Colors.Gold)
        .addFields(
            { name: '📦 Item', value: `**${amount}x ${itemName}**`, inline: true },
            { name: '⏱️ Total Time', value: timerDisplay, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '📋 Effect', value: recipe.effect || '*No effect description*' },
            { name: '📦 Required Materials', value: requirements },
            { name: '💰 Total Cost', value: `${formatNumber(totalCoins)} coins\n${formatNumber(totalGems)} gems` },
            { name: '🔔 Current Balance', value: `${formatNumber(userData.coins)} coins\n${formatNumber(userData.gems)} gems` }
        )
        .setFooter({ text: 'Click ✅ Confirm or ❌ Cancel' })
        .setTimestamp();
}

function createSuccessEmbed(itemName, amount, queued = false, queueData = null) {
    const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTimestamp();

    if (queued && queueData) {
        const timeLeft = queueData.completesAt - Date.now();
        embed
            .setTitle('✅ Added to Crafting Queue!')
            .setDescription(
                `Your craft of **${amount}x ${itemName}** has been queued!\n\n` +
                `⏱️ **Completes in:** ${formatTime(timeLeft)}\n` +
                `📋 **Queue Position:** ${queueData.position}/5\n\n` +
                `Use the **Queue** button to check progress.`
            );
    } else {
        embed
            .setTitle('✅ Crafting Complete!')
            .setDescription(`You have successfully crafted **${amount}x ${itemName}**!`);
    }

    return embed;
}

function createErrorEmbed(error, details = {}) {
    const messages = {
        INVALID_AMOUNT: 'Craft amount must be a positive integer.',
        AMOUNT_TOO_LARGE: `Cannot craft more than ${details.max || 1000} at once.`,
        RECIPE_NOT_FOUND: `Recipe for "${details.itemName}" does not exist.`,
        INSUFFICIENT_CURRENCY: `You are missing:\n${details.missing?.join('\n') || 'coins/gems'}`,
        INSUFFICIENT_MATERIALS: `You are missing:\n${details.missing?.map(m => `- ${m}`).join('\n') || 'materials'}`,
        QUEUE_FULL: `Your crafting queue is full (5/5 slots).\n\nClaim finished items first!`,
        INVALID_QUEUE_ITEM: 'This crafting item no longer exists or has already been claimed.',
        NOT_READY: 'This item is not ready to be claimed yet.'
    };

    return new EmbedBuilder()
        .setTitle('❌ Crafting Failed')
        .setColor(Colors.Red)
        .setDescription(messages[error] || 'An unexpected error occurred.')
        .setTimestamp();
}

function createHistoryEmbed(history, craftType) {
    const embed = new EmbedBuilder()
        .setTitle('🕑 Recent Crafting History')
        .setColor(Colors.Gold);

    if (!history || history.length === 0) {
        embed.setDescription('No crafting history yet.\n\nStart crafting to build your history!');
    } else {
        embed.setDescription(
            history.map((r, idx) =>
                `**${idx + 1}.** ${r.amount}x **${r.itemName}**\n` +
                `   └ <t:${Math.floor(r.craftedAt / 1000)}:R>`
            ).join('\n\n')
        );
    }
    
    embed.setFooter({ text: `Showing last ${history?.length || 0} crafts` });
    return embed;
}

function createCraftMenuEmbed(craftType, category, recipes, userData) {
    return createCraftCategoryEmbed(craftType, 0, recipes, userData).embed;
}

function createNavigationButtons(userId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_page_${userId}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`next_page_${userId}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
        );
}

module.exports = {
    createCraftCategoryEmbed,
    createCraftNavigationButtons,
    createCraftItemSelectMenu,
    createAmountModal,
    createConfirmButtons,
    createConfirmEmbed,
    createQueueEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createHistoryEmbed,
    createCraftMenuEmbed,
    createNavigationButtons
};