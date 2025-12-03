const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { calculateMaxCraftable } = require('./CraftValidationService');
const { getCraftTimer, formatTime } = require('../../Configuration/craftConfig');
const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');

function createCraftableItemsEmbed(craftType, category, recipes, userData) {
    const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTimestamp();

    if (category === 'How to Craft') {
        embed
            .setTitle('📖 How to Craft')
            .setDescription(
                `**Enhanced Crafting System**\n\n` +
                `**Features:**\n` +
                `• Click on items to craft them\n` +
                `• Queue up to 5 items at once\n` +
                `• View crafting progress in real-time\n` +
                `• Claim finished items instantly\n\n` +
                `**Usage:**\n` +
                `1. Browse available recipes\n` +
                `2. Click "Craft" button on desired item\n` +
                `3. Enter amount to craft\n` +
                `4. Confirm and wait for timer\n` +
                `5. Claim when ready!\n\n` +
                `📊 Use \`.craftQueue\` to view your crafting progress`
            );
        return embed;
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
        const timer = getCraftTimer(craftType, itemName);
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
        return { embed, items: [] };
    }

    embed.setDescription(
        items.map(item => 
            `${item.status} **\`${item.itemName}\`** ${item.timerDisplay}\n` +
            `> 📝 *${item.recipe.effect || 'No effect'}*\n` +
            `> 🧰 Max Craftable: **${item.maxCraftable || "None"}**\n` +
            `> 💰 ${formatNumber(item.recipe.resources.coins)} coins, ${formatNumber(item.recipe.resources.gems)} gems\n`
        ).join('\n')
    );

    return { embed, items };
}

function createCraftButtons(userId, craftableItems, startIndex = 0) {
    const rows = [];
    const itemsPerRow = 5;
    const maxButtons = 10;
    
    const itemsToShow = craftableItems.slice(startIndex, startIndex + maxButtons);
    
    for (let i = 0; i < itemsToShow.length; i += itemsPerRow) {
        const row = new ActionRowBuilder();
        const chunk = itemsToShow.slice(i, i + itemsPerRow);
        
        chunk.forEach((item, idx) => {
            const globalIndex = startIndex + i + idx;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId('craft_item', userId, { 
                        idx: globalIndex,
                        item: item.itemName 
                    }))
                    .setLabel(item.itemName.slice(0, 20))
                    .setStyle(item.canCraft ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setDisabled(!item.canCraft)
            );
        });
        
        rows.push(row);
    }
    
    // Navigation row
    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_prev', userId))
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(startIndex === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_next', userId))
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(startIndex + maxButtons >= craftableItems.length),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_queue_view', userId))
                .setLabel('📋 View Queue')
                .setStyle(ButtonStyle.Secondary)
        );
    
    rows.push(navRow);
    return rows;
}

function createAmountModal(itemName, userId, maxCraftable) {
    return new ModalBuilder()
        .setCustomId(`craft_amount_${userId}`)
        .setTitle(`Craft ${itemName}`)
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
                    item: itemName, 
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
    const timer = getCraftTimer(craftType, itemName);
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
            { name: '⏱️ Time', value: timerDisplay, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '📋 Effect', value: recipe.effect || '*No effect description*' },
            { name: '📦 Required Materials', value: requirements },
            { name: '💰 Cost', value: `${formatNumber(totalCoins)} coins\n${formatNumber(totalGems)} gems` },
            { name: '🔔 Current Balance', value: `${formatNumber(userData.coins)} coins\n${formatNumber(userData.gems)} gems` }
        )
        .setFooter({ text: 'Click ✅ Confirm or ❌ Cancel' })
        .setTimestamp();
}

function createQueueEmbed(queueItems, userData) {
    const embed = new EmbedBuilder()
        .setTitle('🔨 Crafting Queue')
        .setColor(Colors.Blue)
        .setTimestamp();

    if (!queueItems || queueItems.length === 0) {
        embed.setDescription('Your crafting queue is empty.\n\nStart crafting items to see them here!');
        return { embed, buttons: [] };
    }

    const now = Date.now();
    const description = queueItems.map((item, idx) => {
        const timeLeft = item.completesAt - now;
        const isReady = timeLeft <= 0;
        const status = isReady ? '✅ Ready' : `⏱️ ${formatTime(timeLeft)}`;
        
        return `**${idx + 1}.** ${item.amount}x **${item.itemName}**\n` +
               `   └ ${status}`;
    }).join('\n\n');

    embed.setDescription(description);
    embed.setFooter({ text: `${queueItems.length}/5 slots used` });

    // Create claim buttons for ready items
    const readyItems = queueItems.filter(item => item.completesAt <= now);
    const buttons = [];
    
    if (readyItems.length > 0) {
        const row = new ActionRowBuilder();
        readyItems.slice(0, 5).forEach((item, idx) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId('craft_claim', userData.userId || 'user', { 
                        id: item.id 
                    }))
                    .setLabel(`Claim ${item.itemName}`)
                    .setStyle(ButtonStyle.Success)
            );
        });
        buttons.push(row);
    }

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_queue_refresh', userData.userId || 'user'))
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_back', userData.userId || 'user'))
                .setLabel('◀ Back to Crafting')
                .setStyle(ButtonStyle.Secondary)
        );
    
    buttons.push(navRow);

    return { embed, buttons };
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
                `Use \`.craftQueue\` or click the button below to check progress.`
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
        INVALID_QUEUE_ITEM: 'This crafting item no longer exists or has already been claimed.'
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

module.exports = {
    createCraftableItemsEmbed,
    createCraftButtons,
    createAmountModal,
    createConfirmButtons,
    createConfirmEmbed,
    createQueueEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createHistoryEmbed
};