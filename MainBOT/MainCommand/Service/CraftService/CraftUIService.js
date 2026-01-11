const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { CRAFT_CATEGORIES, CRAFT_CONFIG, getCraftTimer } = require('../../Configuration/craftConfig');
const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');
const { formatDuration: formatTime, formatNumber } = require('../../Ultility/formatting');

function createQueueEmbed(queueItems, userId) {
    const embed = new EmbedBuilder()
        .setTitle('⚒️ Crafting Queue')
        .setColor('#5865F2')
        .setTimestamp();

    if (!queueItems || queueItems.length === 0) {
        embed.setDescription('```\n🔨 Your crafting queue is empty\n```\n\n> Start crafting items to see them here!');
        
        const returnButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                    .setLabel('Return to Main Menu')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return { embed, buttons: [returnButton] };
    }

    const now = Date.now();
    const readyCount = queueItems.filter(item => item.completesAt <= now).length;
    
    const description = queueItems.map((item, idx) => {
        const timeLeft = item.completesAt - now;
        const isReady = timeLeft <= 0;
        const progressBar = isReady ? '▰▰▰▰▰▰▰▰▰▰' : generateProgressBar(item.startedAt, item.completesAt, now);
        const status = isReady ? '`✓ READY`' : `\`⏱ ${formatTime(timeLeft)}\``;
        
        return `\`${idx + 1}.\` **${item.itemName}** × ${item.amount}\n${progressBar} ${status}`;
    }).join('\n\n');

    embed.setDescription(description);
    embed.setFooter({ text: `${queueItems.length}/5 slots • ${readyCount} ready to claim` });

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
        
        const claimButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('craft_claim', userId, { queueId: String(item.id) }))
            .setLabel(item.itemName.slice(0, 80))
            .setEmoji(isReady ? '✅' : '⏱️')
            .setStyle(isReady ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!isReady);
        
        currentRow.addComponents(claimButton);
        buttonCount++;
    }

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_queue_refresh', userId))
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                .setLabel('Main Menu')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );
    
    buttons.push(navRow);

    return { embed, buttons };
}

function generateProgressBar(startedAt, completesAt, now) {
    const total = completesAt - startedAt;
    const elapsed = now - startedAt;
    const progress = Math.min(Math.max(elapsed / total, 0), 1);
    const filled = Math.floor(progress * 10);
    const empty = 10 - filled;
    return '▰'.repeat(filled) + '▱'.repeat(empty);
}

function createCraftCategoryEmbed(craftType, page, recipes, userData) {
    const categories = craftType === 'item' 
        ? CRAFT_CATEGORIES.ITEM.tiers 
        : CRAFT_CATEGORIES.POTION.categories;
    
    const category = categories[page];
    
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTimestamp();

    if (category === 'How to Craft') {
        embed
            .setTitle('📖 Crafting Guide')
            .setDescription(
                '```\n' +
                '╔══════════════════════════════════════╗\n' +
                '║           CRAFTING SYSTEM            ║\n' +
                '╚══════════════════════════════════════╝\n' +
                '```\n' +
                '### 🎯 Features\n' +
                '> • **Smart Selection** - Browse all recipes, craft what you can\n' +
                '> • **Queue System** - Queue up to 5 crafts at once\n' +
                '> • **Timer System** - Higher tier items take longer\n' +
                '> • **Batch Crafting** - Craft multiple items at once\n\n' +
                '### 📊 Tier Progression\n' +
                '```\n' +
                'T1 → T2 → T3 → T4 → T5 → T6 → T7(MAX)\n' +
                '```\n' +
                '### ⚡ Quick Tips\n' +
                '> 🟢 Green = Can craft\n' +
                '> 🔴 Red = Missing materials\n' +
                '> ⏱️ Timer shown per item\n'
            );
        return { embed, items: [] };
    }

    if (category === 'Craft History') {
        embed.setTitle('📜 Craft History')
            .setDescription('Your recent crafting activity will appear here.');
        return { embed, items: [] };
    }

    // Filter recipes by category
    const categoryRecipes = Object.entries(recipes)
        .filter(([_, recipe]) => recipe.category === category)
        .map(([itemName, recipe]) => {
            const canCraft = checkCanCraft(recipe, userData);
            const maxCraftable = calculateMaxCraftable(recipe, userData.inventory, userData.coins, userData.gems);
            const timer = getCraftTimer(craftType, itemName);
            
            return {
                itemName,
                recipe,
                canCraft,
                maxCraftable,
                timer
            };
        });

    // Build the embed description with improved formatting
    const tierEmojis = {
        'Tier 1': '🥉',
        'Tier 2': '🥈',
        'Tier 3': '🥇',
        'Tier 4': '💎',
        'Tier 5': '👑',
        'Tier 6': '🌟',
        'Tier 7(MAX)': '🌌',
        'Coins Potion': '💰',
        'Gems Potion': '💎',
        'Other Potion': '🧪'
    };

    const tierEmoji = tierEmojis[category] || '📦';
    
    embed.setTitle(`${tierEmoji} ${category} Recipes`);

    if (categoryRecipes.length === 0) {
        embed.setDescription('No recipes found in this category.');
        return { embed, items: [] };
    }

    // Create a cleaner item list
    let description = '```\n';
    description += '┌─────────────────────────────────────┐\n';
    description += `│ ${category.padEnd(35)} │\n`;
    description += '├─────────────────────────────────────┤\n';
    description += '```\n';

    categoryRecipes.forEach((item, index) => {
        const statusEmoji = item.canCraft ? '🟢' : '🔴';
        const timerDisplay = item.timer > 0 ? formatTime(item.timer) : '⚡ Instant';
        const maxDisplay = item.canCraft ? `(Max: ${item.maxCraftable})` : '';
        
        // Truncate long item names
        const displayName = item.itemName.length > 20 
            ? item.itemName.substring(0, 17) + '...' 
            : item.itemName;
        
        description += `${statusEmoji} **${displayName}** ${maxDisplay}\n`;
        description += `> ⏱️ \`${timerDisplay}\`\n`;
        
        // Show brief effect preview
        if (item.recipe.effect) {
            const effectPreview = item.recipe.effect.split('\n')[0];
            const truncatedEffect = effectPreview.length > 40 
                ? effectPreview.substring(0, 37) + '...' 
                : effectPreview;
            description += `> 📝 *${truncatedEffect}*\n`;
        }
        
        if (index < categoryRecipes.length - 1) {
            description += '\n';
        }
    });

    // Add user resources footer
    description += '\n```\n';
    description += `💰 ${formatLargeNumber(userData.coins)} │ 💎 ${formatLargeNumber(userData.gems)}\n`;
    description += '```';

    embed.setDescription(description);
    embed.setFooter({ text: `Page ${page + 1}/${categories.length} • Select an item below to craft` });

    return { embed, items: categoryRecipes };
}

// Helper function to format large numbers
function formatLargeNumber(num) {
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
}

// Helper function to check if user can craft
function checkCanCraft(recipe, userData) {
    // Check coins
    if (recipe.resources?.coins && userData.coins < recipe.resources.coins) {
        return false;
    }
    // Check gems
    if (recipe.resources?.gems && userData.gems < recipe.resources.gems) {
        return false;
    }
    // Check materials
    if (recipe.requires) {
        for (const [material, amount] of Object.entries(recipe.requires)) {
            const owned = userData.inventory[material] || 0;
            if (owned < amount) {
                return false;
            }
        }
    }
    return true;
}

// Helper function to calculate max craftable
function calculateMaxCraftable(recipe, inventory, coins, gems) {
    let maxByCoins = Infinity;
    let maxByGems = Infinity;
    let maxByMaterials = Infinity;

    if (recipe.resources?.coins && recipe.resources.coins > 0) {
        maxByCoins = Math.floor(coins / recipe.resources.coins);
    }
    if (recipe.resources?.gems && recipe.resources.gems > 0) {
        maxByGems = Math.floor(gems / recipe.resources.gems);
    }
    if (recipe.requires) {
        for (const [material, amount] of Object.entries(recipe.requires)) {
            const owned = inventory[material] || 0;
            const maxByThis = Math.floor(owned / amount);
            maxByMaterials = Math.min(maxByMaterials, maxByThis);
        }
    }

    return Math.min(maxByCoins, maxByGems, maxByMaterials, CRAFT_CONFIG.MAX_CRAFT_AMOUNT);
}

// Improved select menu with better descriptions
function createCraftItemSelectMenu(userId, craftType, items) {
    if (!items || items.length === 0) {
        return null;
    }

    const options = items
        .slice(0, 25)
        .map(item => {
            const emoji = item.canCraft ? '🟢' : '🔴';
            const status = item.canCraft ? `Can craft (Max: ${item.maxCraftable})` : 'Missing materials';
            const timerDisplay = item.timer > 0 ? formatTime(item.timer) : 'Instant';
            
            // Create a more informative description
            let description = `${status} • ${timerDisplay}`;
            if (description.length > 100) {
                description = description.substring(0, 97) + '...';
            }
            
            return new StringSelectMenuOptionBuilder()
                .setLabel(item.itemName.slice(0, 100))
                .setValue(item.itemName)
                .setDescription(description)
                .setEmoji(emoji);
        });

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(buildSecureCustomId('craft_select_item', userId, { type: craftType }))
                .setPlaceholder('🔨 Select an item to craft...')
                .addOptions(options)
        );
}

// Improved recipe detail embed
function createRecipeDetailEmbed(itemName, recipe, userData, craftType, maxCraftable, canCraft) {
    const tierEmojis = {
        'Tier 1': '🥉',
        'Tier 2': '🥈',
        'Tier 3': '🥇',
        'Tier 4': '💎',
        'Tier 5': '👑',
        'Tier 6': '🌟',
        'Tier 7(MAX)': '🌌',
        'Coins Potion': '💰',
        'Gems Potion': '💎',
        'Other Potion': '🧪'
    };

    const tierEmoji = tierEmojis[recipe.category] || '📦';
    const statusEmoji = canCraft ? '✅' : '❌';
    const timer = getCraftTimer(craftType, itemName);
    const timerDisplay = timer > 0 ? formatTime(timer) : '⚡ Instant';

    const embed = new EmbedBuilder()
        .setColor(canCraft ? '#2ECC71' : '#E74C3C')
        .setTitle(`${tierEmoji} ${itemName}`)
        .setDescription(
            `**Category:** ${recipe.category}\n` +
            `**Status:** ${statusEmoji} ${canCraft ? 'Ready to craft!' : 'Missing requirements'}\n` +
            `**Craft Time:** ⏱️ ${timerDisplay}\n` +
            `**Max Craftable:** ${maxCraftable}\n\n` +
            `### 📝 Effect\n${recipe.effect || 'No effect description'}`
        );

    // Materials section
    if (recipe.requires && Object.keys(recipe.requires).length > 0) {
        let materialsText = '';
        for (const [material, amount] of Object.entries(recipe.requires)) {
            const owned = userData.inventory[material] || 0;
            const hasEnough = owned >= amount;
            const emoji = hasEnough ? '✅' : '❌';
            materialsText += `${emoji} \`${material}\`: **${owned}**/${amount}\n`;
        }
        embed.addFields({ name: '📦 Required Materials', value: materialsText, inline: true });
    }

    // Resources section
    if (recipe.resources) {
        let resourcesText = '';
        if (recipe.resources.coins) {
            const hasCoins = userData.coins >= recipe.resources.coins;
            const emoji = hasCoins ? '✅' : '❌';
            resourcesText += `${emoji} 💰 **${formatLargeNumber(recipe.resources.coins)}** coins\n`;
        }
        if (recipe.resources.gems) {
            const hasGems = userData.gems >= recipe.resources.gems;
            const emoji = hasGems ? '✅' : '❌';
            resourcesText += `${emoji} 💎 **${formatLargeNumber(recipe.resources.gems)}** gems\n`;
        }
        if (resourcesText) {
            embed.addFields({ name: '💵 Cost', value: resourcesText, inline: true });
        }
    }

    // Your resources
    embed.addFields({
        name: '🏦 Your Resources',
        value: `💰 **${formatLargeNumber(userData.coins)}** coins\n💎 **${formatLargeNumber(userData.gems)}** gems`,
        inline: true
    });

    embed.setFooter({ text: canCraft ? 'Click "Start Crafting" to begin!' : 'Gather more materials to craft this item' });
    embed.setTimestamp();

    return embed;
}

function createCraftNavigationButtons(userId, craftType, currentPage, totalPages, queueCount = 0) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_first', userId, { type: craftType }))
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_prev', userId, { type: craftType }))
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_next', userId, { type: craftType }))
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_last', userId, { type: craftType }))
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );

    return [row1];
}

function createAmountModal(itemName, userId, maxCraftable) {
    return new ModalBuilder()
        .setCustomId(`craft_amount_${userId}`)
        .setTitle(`Craft: ${itemName.slice(0, 40)}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel(`Enter amount (Max: ${maxCraftable})`)
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
                .setLabel('Confirm Craft')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_cancel', userId))
                .setLabel('Cancel')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );
}

function createConfirmEmbed(itemName, amount, recipe, totalCoins, totalGems, userData, craftType) {
    const timer = getCraftTimer(craftType, itemName, amount);
    const timerDisplay = timer > 0 ? formatTime(timer) : 'Instant';
    
    const requirements = Object.entries(recipe.requires).map(([reqItem, reqQty]) => {
        const totalRequired = reqQty * amount;
        return `• ${reqItem} × ${totalRequired}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('⚒️ Confirm Crafting')
        .setColor('#FEE75C')
        .setTimestamp();

    embed.setDescription(
        `\`\`\`\n🔨 Ready to craft ${amount}x ${itemName}\n\`\`\`\n\n` +
        `### ⏱️ Total Crafting Time\n> \`${timerDisplay}\`\n\n` +
        `### 📦 Materials Required\n${requirements}\n\n` +
        `### 💰 Total Cost\n` +
        `> Coins: ${formatNumber(totalCoins)} *(have ${formatNumber(userData.coins)})*\n` +
        `> Gems: ${formatNumber(totalGems)} *(have ${formatNumber(userData.gems)})*\n\n` +
        `> Click **Confirm Craft** to proceed`
    );

    return embed;
}

function createSuccessEmbed(itemName, amount, queued = false, queueData = null) {
    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTimestamp();

    if (queued && queueData) {
        const timeLeft = queueData.completesAt - Date.now();
        embed
            .setTitle('✅ Added to Queue')
            .setDescription(
                `\`\`\`\n⚒️ Crafting ${amount}x ${itemName}\n\`\`\`\n\n` +
                `### ⏱️ Completion Time\n> \`${formatTime(timeLeft)}\`\n\n` +
                `### 📊 Queue Status\n> Position: \`${queueData.position}/5\`\n\n` +
                `> Use the **Queue** button to track progress`
            );
    } else {
        embed
            .setTitle('✅ Crafting Complete')
            .setDescription(
                `\`\`\`\n🎉 Successfully crafted!\n\`\`\`\n\n` +
                `### 📦 Items Crafted\n> ${itemName} × ${amount}`
            );
    }

    return embed;
}

function createErrorEmbed(error, details = {}) {
    const messages = {
        INVALID_AMOUNT: '❌ Amount must be a positive number',
        AMOUNT_TOO_LARGE: `❌ Cannot craft more than ${details.max || 1000} at once`,
        RECIPE_NOT_FOUND: `❌ Recipe not found: "${details.itemName}"`,
        INSUFFICIENT_CURRENCY: `❌ Insufficient resources:\n${details.missing?.join('\n') || 'coins/gems'}`,
        INSUFFICIENT_MATERIALS: `❌ Missing materials:\n${details.missing?.map(m => `• ${m}`).join('\n') || 'materials'}`,
        QUEUE_FULL: `❌ Crafting queue is full (5/5)\n\nClaim or wait for items to finish first`,
        INVALID_QUEUE_ITEM: '❌ This crafting item no longer exists',
        NOT_READY: '❌ Item is not ready to claim yet'
    };

    return new EmbedBuilder()
        .setTitle('⚠️ Crafting Failed')
        .setColor('#ED4245')
        .setDescription(`\`\`\`\n${messages[error] || 'An unexpected error occurred'}\n\`\`\``)
        .setTimestamp();
}

function createHistoryEmbed(history, craftType) {
    const embed = new EmbedBuilder()
        .setTitle('📜 Crafting History')
        .setColor('#5865F2');

    if (!history || history.length === 0) {
        embed.setDescription('```\n📦 No crafting history yet\n```\n\n> Start crafting to build your history!');
    } else {
        const historyList = history.map((r, idx) =>
            `\`${idx + 1}.\` **${r.itemName}** × ${r.amount} • <t:${Math.floor(r.craftedAt / 1000)}:R>`
        ).join('\n');
        
        embed.setDescription(historyList);
    }
    
    embed.setFooter({ text: `Last ${history?.length || 0} crafts` });
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
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`next_page_${userId}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
        );
}

function createRecipeDetailButtons(userId, itemName, canCraft, craftType, maxCraftable) {
    const buttons = [];
    
    // Main action row with craft buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_start', userId, { 
                    item: itemName.slice(0, 50), 
                    type: craftType,
                    max: maxCraftable
                }))
                .setLabel('Start Crafting')
                .setEmoji('⚒️')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!canCraft || maxCraftable <= 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_quick_1', userId, { 
                    item: itemName.slice(0, 50), 
                    type: craftType 
                }))
                .setLabel('×1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!canCraft || maxCraftable < 1),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_quick_5', userId, { 
                    item: itemName.slice(0, 50), 
                    type: craftType 
                }))
                .setLabel('×5')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!canCraft || maxCraftable < 5),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_quick_max', userId, { 
                    item: itemName.slice(0, 50), 
                    type: craftType,
                    max: maxCraftable
                }))
                .setLabel(`×Max (${maxCraftable})`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!canCraft || maxCraftable <= 0)
        );
    
    buttons.push(actionRow);
    
    // Navigation row
    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_back', userId, { type: craftType }))
                .setLabel('Back to List')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_queue_view', userId))
                .setLabel('View Queue')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('craft_nav_return', userId))
                .setLabel('Main Menu')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );
    
    buttons.push(navRow);
    
    return buttons;
}

module.exports = {
    createCraftCategoryEmbed,
    createCraftNavigationButtons,
    createCraftItemSelectMenu,
    createRecipeDetailEmbed,
    createRecipeDetailButtons,
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