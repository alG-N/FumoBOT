const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { getUserInventory } = require('../../../Service/UserDataService/UseService/UseDatabaseService');
const { sendErrorEmbed } = require('../../../Service/UserDataService/UseService/UseUIService');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const ItemHandlers = require('../../../Service/UserDataService/UseService/ItemUseHandler/SpecialItemHandler');
const { get, all, run } = require('../../../Core/database');

const UNUSABLE_ITEMS = new Set([
    'Stone(B)',
    'Stick(B)',
    'UniqueRock(C)',
    'Books(C)',
    'Wool(C)',
    'Wood(C)',
    'Dice(C)',
    'FragmentOf1800s(R)',
    'EnhancedScroll(E)',
    'RustedCore(E)',
    'RedShard(L)',
    'BlueShard(L)',
    'YellowShard(L)',
    'WhiteShard(L)',
    'DarkShard(L)',
    'ChromaShard(M)',
    'MonoShard(M)',
    'EquinoxAlloy(M)',
    'StarShard(M)',
    'Undefined(?)',
    'Null?(?)',
    'VoidFragment(?)',
    'ObsidianRelic(Un)',
    'ChaosEssence(Un)',
    'AbyssalShard(Un)'
]);

// Items that can only be used 1 at a time
const ONE_TIME_USE_ITEMS = new Set([
    'WeirdGrass(R)',
    'GoldenSigil(?)',
    'HakureiTicket(L)',
    'Lumina(M)',
    'FantasyBook(M)',
    'MysteriousCube(M)',
    'MysteriousDice(M)',
    'TimeClock(L)',
    'S!gil?(?)',
    'PetFoob(B)',
    'ShinyShard(?)',
    'alGShard(P)'
]);

async function getUsableInventory(userId) {
    try {
        // Match the exact query from ItemQueryService.js
        const rows = await all(
            `SELECT 
                COALESCE(itemName, fumoName) as itemName,
                SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             AND type = 'item'
             AND (itemName IS NOT NULL OR fumoName IS NOT NULL)
             AND (TRIM(COALESCE(itemName, '')) != '' OR TRIM(COALESCE(fumoName, '')) != '')
             GROUP BY COALESCE(itemName, fumoName)
             HAVING totalQuantity > 0
             ORDER BY COALESCE(itemName, fumoName)`,
            [userId]
        );

        if (!rows || rows.length === 0) {
            console.log('[USE_COMMAND] No items found in inventory');
            return [];
        }
        
        console.log(`[USE_COMMAND] Found ${rows.length} items in inventory`);
        
        // Filter to only usable items
        const usable = rows.filter(item => {
            if (!item.itemName || typeof item.itemName !== 'string' || item.itemName.trim() === '') {
                return false;
            }
            
            const quantity = parseInt(item.totalQuantity) || 0;
            if (quantity <= 0) return false;
            
            return ItemHandlers.isUsableItem(item.itemName) && !UNUSABLE_ITEMS.has(item.itemName);
        }).map(item => ({
            itemName: item.itemName,
            quantity: parseInt(item.totalQuantity) || 0
        }));
        
        console.log(`[USE_COMMAND] ${usable.length} items are usable`);
        
        return usable;
    } catch (error) {
        console.error('[USE_COMMAND] Error fetching inventory:', error);
        return [];
    }
}

async function getUsableInventoryByRarity(userId, rarity) {
    try {
        const { RARITY_SUFFIX_MAP } = require('../../../Configuration/itemConfig');
        const suffix = Object.entries(RARITY_SUFFIX_MAP).find(([_, r]) => r === rarity)?.[0];
        
        if (!suffix) {
            console.log(`[USE_COMMAND] No suffix found for rarity: ${rarity}`);
            return [];
        }

        // Match the exact query from ItemQueryService.js
        const rows = await all(
            `SELECT 
                COALESCE(itemName, fumoName) as itemName,
                SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             AND type = 'item'
             AND COALESCE(itemName, fumoName) LIKE ?
             AND (itemName IS NOT NULL OR fumoName IS NOT NULL)
             AND (TRIM(COALESCE(itemName, '')) != '' OR TRIM(COALESCE(fumoName, '')) != '')
             GROUP BY COALESCE(itemName, fumoName)
             HAVING totalQuantity > 0
             ORDER BY COALESCE(itemName, fumoName)`,
            [userId, `%${suffix}`]
        );

        if (!rows || rows.length === 0) {
            console.log(`[USE_COMMAND] No items found for rarity: ${rarity}`);
            return [];
        }
        
        console.log(`[USE_COMMAND] Found ${rows.length} items for rarity ${rarity}`);
        
        // Filter to only usable items
        const usable = rows.filter(item => {
            if (!item.itemName || typeof item.itemName !== 'string' || item.itemName.trim() === '') {
                return false;
            }
            
            const quantity = parseInt(item.totalQuantity) || 0;
            if (quantity <= 0) return false;
            
            return ItemHandlers.isUsableItem(item.itemName) && !UNUSABLE_ITEMS.has(item.itemName);
        }).map(item => ({
            itemName: item.itemName,
            quantity: parseInt(item.totalQuantity) || 0
        }));
        
        console.log(`[USE_COMMAND] ${usable.length} items are usable for rarity ${rarity}`);
        
        return usable;
    } catch (error) {
        console.error('[USE_COMMAND] Error fetching inventory by rarity:', error);
        return [];
    }
}

function getRarityFromItem(itemName) {
    const { RARITY_SUFFIX_MAP } = require('../../../Configuration/itemConfig');
    for (const [suffix, rarity] of Object.entries(RARITY_SUFFIX_MAP)) {
        if (itemName.endsWith(suffix)) {
            return rarity;
        }
    }
    return null;
}

function getItemCategory(itemName) {
    if (ItemHandlers.isCoinPotion(itemName)) return '💰 Coin Potion';
    if (ItemHandlers.isGemPotion(itemName)) return '💎 Gem Potion';
    if (ItemHandlers.isBoostPotion(itemName)) return '🧪 Boost Potion';
    
    const categories = {
        'WeirdGrass(R)': '🌿 Random',
        'GoldenSigil(?)': '✨ Stackable',
        'HakureiTicket(L)': '🎫 Reset',
        'Lumina(M)': '🔮 Permanent',
        'FantasyBook(M)': '📖 Unlock',
        'MysteriousCube(M)': '🧊 Mystery',
        'MysteriousDice(M)': '🎲 Dynamic',
        'TimeClock(L)': '⏰ Multi',
        'S!gil?(?)': '🪄 Ultimate',
        'Nullified(?)': '🎯 Override',
        'PetFoob(B)': '🍖 Pet Food',
        'ShinyShard(?)': '✨ Transform',
        'alGShard(P)': '🌟 Transform',
        'AncientRelic(E)': '🔮 Ancient'
    };
    
    return categories[itemName] || '📦 Special';
}

async function handleUseCommand(message) {
    const restriction = checkRestrictions(message.author.id);
    if (restriction.blocked) {
        return message.reply({ embeds: [restriction.embed] });
    }

    const userId = message.author.id;
    const usableItems = await getUsableInventory(userId);

    if (usableItems.length === 0) {
        return message.reply('❌ You don\'t have any usable items in your inventory.');
    }

    // Group items by rarity
    const { RARITY_ORDER, RARITY_EMOJI } = require('../../../Configuration/itemConfig');
    const itemsByRarity = {};
    
    for (const rarity of RARITY_ORDER) {
        itemsByRarity[rarity] = [];
    }

    for (const item of usableItems) {
        const rarity = getRarityFromItem(item.itemName);
        if (rarity && itemsByRarity[rarity]) {
            itemsByRarity[rarity].push(item);
        }
    }

    // Filter out empty rarities
    const availableRarities = RARITY_ORDER.filter(rarity => itemsByRarity[rarity].length > 0);

    if (availableRarities.length === 0) {
        return message.reply('❌ You don\'t have any usable items in your inventory.');
    }

    // Show rarity selection first
    await showRaritySelection(message, userId, availableRarities, itemsByRarity);
}

async function showRaritySelection(message, userId, availableRarities, itemsByRarity) {
    const { RARITY_EMOJI } = require('../../../Configuration/itemConfig');
    
    const options = availableRarities.map(rarity => {
        const count = itemsByRarity[rarity].length;
        const totalQty = itemsByRarity[rarity].reduce((sum, item) => sum + item.quantity, 0);
        
        return {
            label: rarity,
            value: `use_rarity_${rarity}`,
            description: `${count} type(s), ${totalQty} total`.slice(0, 100),
            emoji: RARITY_EMOJI[rarity] || '⚪'
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(buildSecureCustomId('use_rarity_select', userId))
        .setPlaceholder('Select a rarity')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📦 Use Item - Select Rarity')
        .setDescription(
            `Select a rarity to view available items.\n\n` +
            `**Total Usable Items:** ${availableRarities.reduce((sum, r) => sum + itemsByRarity[r].length, 0)}`
        )
        .setFooter({ text: 'Select a rarity from the dropdown menu' })
        .setTimestamp();

    await message.reply({ embeds: [embed], components: [row] });
}

async function handleItemSelection(interaction) {
    const { parseCustomId } = require('../../../Middleware/buttonOwnership');
    const { additionalData } = parseCustomId(interaction.customId);
    const rarity = additionalData?.rarity;

    if (!rarity) {
        return interaction.update({
            content: '❌ Invalid rarity data.',
            embeds: [],
            components: []
        });
    }

    const selectedIndex = parseInt(interaction.values[0].replace('use_item_', ''));
    const userId = interaction.user.id;

    const usableItems = await getUsableInventoryByRarity(userId, rarity);
    const selectedItem = usableItems[selectedIndex];

    if (!selectedItem) {
        return interaction.update({
            content: '❌ Invalid item selection.',
            embeds: [],
            components: []
        });
    }

    const { itemName, quantity } = selectedItem;
    const isOneTimeUse = ONE_TIME_USE_ITEMS.has(itemName);

    if (isOneTimeUse || quantity === 1) {
        // Show confirmation directly
        await showConfirmation(interaction, itemName, 1, userId);
    } else {
        // Ask for quantity
        await showQuantityInput(interaction, itemName, quantity, userId);
    }
}

async function handleRaritySelection(interaction) {
    const userId = interaction.user.id;
    const selectedRarity = interaction.values[0].replace('use_rarity_', '');

    const usableItems = await getUsableInventoryByRarity(userId, selectedRarity);

    if (usableItems.length === 0) {
        return interaction.update({
            content: `❌ No usable items found for rarity: ${selectedRarity}`,
            embeds: [],
            components: []
        });
    }

    // Create pages of 25 items each (Discord limit)
    const itemsPerPage = 25;
    const totalPages = Math.ceil(usableItems.length / itemsPerPage);

    await showItemSelectionPage(interaction, userId, selectedRarity, usableItems, 0, totalPages);
}

async function showItemSelectionPage(interaction, userId, rarity, usableItems, page, totalPages) {
    const startIdx = page * 25;
    const endIdx = Math.min(startIdx + 25, usableItems.length);
    const pageItems = usableItems.slice(startIdx, endIdx);

    const options = pageItems.map((item, idx) => {
        const category = getItemCategory(item.itemName);
        return {
            label: item.itemName.slice(0, 100),
            value: `use_item_${startIdx + idx}`,
            description: `${category} | Qty: ${item.quantity}`.slice(0, 100),
            emoji: category.split(' ')[0]
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(buildSecureCustomId('use_item_select', userId, { rarity, page }))
        .setPlaceholder('Select an item to use')
        .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const components = [row1];

    // Add pagination and back button
    const buttons = [];

    const backButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('use_back_to_rarity', userId))
        .setLabel('◀ Back to Rarities')
        .setStyle(ButtonStyle.Secondary);

    buttons.push(backButton);

    if (totalPages > 1) {
        const prevButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('use_item_page_prev', userId, { rarity, page }))
            .setLabel('◀ Prev')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0);

        const pageIndicator = new ButtonBuilder()
            .setCustomId('use_page_indicator')
            .setLabel(`${page + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const nextButton = new ButtonBuilder()
            .setCustomId(buildSecureCustomId('use_item_page_next', userId, { rarity, page }))
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages - 1);

        buttons.push(prevButton, pageIndicator, nextButton);
    }

    const row2 = new ActionRowBuilder().addComponents(buttons);
    components.push(row2);

    const { RARITY_EMOJI } = require('../../../Configuration/itemConfig');
    const rarityEmoji = RARITY_EMOJI[rarity] || '⚪';

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`📦 Use Item - ${rarityEmoji} ${rarity} Items`)
        .setDescription(
            `Select an item to use.\n\n` +
            `**Total Items:** ${usableItems.length}\n` +
            `**Showing:** ${startIdx + 1}-${endIdx}`
        )
        .setFooter({ text: 'Select an item from the dropdown menu' })
        .setTimestamp();

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components });
    } else {
        await interaction.update({ embeds: [embed], components });
    }
}

async function showQuantityInput(interaction, itemName, maxQuantity, userId) {
    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🔢 Use Item - Select Quantity')
        .setDescription(
            `**Item:** ${itemName}\n` +
            `**Available:** ${maxQuantity}\n\n` +
            `How many would you like to use?\n` +
            `Reply with a number between **1** and **${maxQuantity}**.`
        )
        .setFooter({ text: 'You have 30 seconds to respond' })
        .setTimestamp();

    const cancelButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('use_cancel', userId))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(cancelButton);

    await interaction.update({ embeds: [embed], components: [row] });

    // Wait for quantity input
    const filter = m => m.author.id === userId && !isNaN(m.content);
    const collected = await interaction.channel.awaitMessages({ 
        filter, 
        max: 1, 
        time: 30000, 
        errors: ['time'] 
    }).catch(() => null);

    if (!collected) {
        return interaction.editReply({
            content: '⏱️ Quantity input timed out. Use command cancelled.',
            embeds: [],
            components: []
        });
    }

    const inputQuantity = parseInt(collected.first().content);
    
    // Delete user's input message
    collected.first().delete().catch(() => {});

    if (inputQuantity <= 0 || inputQuantity > maxQuantity) {
        return interaction.editReply({
            content: `❌ Invalid quantity. Please enter a number between 1 and ${maxQuantity}.`,
            embeds: [],
            components: []
        });
    }

    await showConfirmation(interaction, itemName, inputQuantity, userId);
}

async function showConfirmation(interaction, itemName, quantity, userId) {
    const category = getItemCategory(itemName);
    
    const confirmButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('use_confirm', userId, { itemName, quantity }))
        .setLabel('✓ Confirm')
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('use_cancel', userId))
        .setLabel('✗ Cancel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('✅ Confirm Item Use')
        .setDescription(
            `**Item:** ${itemName}\n` +
            `**Category:** ${category}\n` +
            `**Quantity:** ${quantity}\n\n` +
            `Are you sure you want to use this item?`
        )
        .setFooter({ text: 'Click Confirm to proceed or Cancel to abort' })
        .setTimestamp();

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await interaction.update({ embeds: [embed], components: [row] });
    }
}

async function handleConfirmation(interaction) {
    const { parseCustomId } = require('../../../Middleware/buttonOwnership');
    const { additionalData } = parseCustomId(interaction.customId);
    
    if (!additionalData?.itemName || !additionalData?.quantity) {
        return interaction.update({
            content: '❌ Invalid confirmation data.',
            embeds: [],
            components: []
        });
    }

    const { itemName, quantity } = additionalData;
    const userId = interaction.user.id;

    console.log(`[USE_COMMAND] User ${userId} confirming use: ${itemName} x${quantity}`);

    try {
        // Get user inventory
        const inventory = await getUserInventory(userId, itemName);
        console.log(`[USE_COMMAND] Inventory check: ${JSON.stringify(inventory)}`);
        
        // Validate they have enough items
        if (!inventory || inventory.quantity < quantity) {
            return interaction.update({
                content: `❌ You don't have enough **${itemName}**. You need **${quantity}**, but only have **${inventory?.quantity || 0}**.`,
                embeds: [],
                components: []
            });
        }

        // Update inventory (consume items) - DO THIS FIRST
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
            [quantity, userId, itemName]
        );
        console.log(`[USE_COMMAND] Inventory updated, items consumed`);

        // Create a message-like object for the handler
        const messageProxy = {
            author: interaction.user,
            reply: async (content) => {
                if (typeof content === 'string') {
                    return interaction.followUp({ content, ephemeral: false });
                }
                return interaction.followUp({ ...content, ephemeral: false });
            },
            channel: interaction.channel
        };

        // Update the interaction to show processing
        await interaction.update({
            content: '⏳ Processing item use...',
            embeds: [],
            components: []
        });

        // Execute item handler - handlers should NOT consume items again
        console.log(`[USE_COMMAND] Executing handler for ${itemName}`);
        await ItemHandlers.handleItem(messageProxy, itemName, quantity);
        console.log(`[USE_COMMAND] Handler execution completed successfully`);

    } catch (error) {
        console.error('[USE_COMMAND] Error processing item use:', error);
        console.error('[USE_COMMAND] Error stack:', error.stack);
        
        // Try to restore items if something went wrong
        try {
            const inv = await getUserInventory(userId, itemName);
            if (inv !== null) {
                // Restore the consumed items
                await run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                    [quantity, userId, itemName]
                );
                console.log(`[USE_COMMAND] Items restored after error`);
            }
        } catch (restoreError) {
            console.error('[USE_COMMAND] Failed to restore items:', restoreError);
        }

        return interaction.editReply({
            content: `❌ Failed to use **${itemName}**. Your items have been returned.\n\n**Error:** ${error.message}\n\nIf this persists, contact support.`,
            embeds: [],
            components: []
        }).catch(() => {});
    }
}

async function handleCancellation(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Cancelled')
        .setDescription('Item use cancelled. No items were consumed.')
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handlePagination(interaction, direction) {
    const { parseCustomId } = require('../../../Middleware/buttonOwnership');
    const { additionalData } = parseCustomId(interaction.customId);
    let currentPage = additionalData?.page || 0;
    const rarity = additionalData?.rarity;

    if (!rarity) {
        return interaction.reply({
            content: '❌ Invalid pagination data.',
            ephemeral: true
        });
    }

    if (direction === 'next') {
        currentPage++;
    } else if (direction === 'prev') {
        currentPage--;
    }

    const userId = interaction.user.id;
    const usableItems = await getUsableInventoryByRarity(userId, rarity);
    const itemsPerPage = 25;
    const totalPages = Math.ceil(usableItems.length / itemsPerPage);

    // Clamp page
    currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));

    await showItemSelectionPage(interaction, userId, rarity, usableItems, currentPage, totalPages);
}

async function handleBackToRarity(interaction) {
    const userId = interaction.user.id;
    const usableItems = await getUsableInventory(userId);

    if (usableItems.length === 0) {
        return interaction.update({
            content: '❌ You don\'t have any usable items in your inventory.',
            embeds: [],
            components: []
        });
    }

    // Group items by rarity
    const { RARITY_ORDER, RARITY_EMOJI } = require('../../../Configuration/itemConfig');
    const itemsByRarity = {};
    
    for (const rarity of RARITY_ORDER) {
        itemsByRarity[rarity] = [];
    }

    for (const item of usableItems) {
        const rarity = getRarityFromItem(item.itemName);
        if (rarity && itemsByRarity[rarity]) {
            itemsByRarity[rarity].push(item);
        }
    }

    // Filter out empty rarities
    const availableRarities = RARITY_ORDER.filter(rarity => itemsByRarity[rarity].length > 0);

    const options = availableRarities.map(rarity => {
        const count = itemsByRarity[rarity].length;
        const totalQty = itemsByRarity[rarity].reduce((sum, item) => sum + item.quantity, 0);
        
        return {
            label: rarity,
            value: `use_rarity_${rarity}`,
            description: `${count} type(s), ${totalQty} total`.slice(0, 100),
            emoji: RARITY_EMOJI[rarity] || '⚪'
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(buildSecureCustomId('use_rarity_select', userId))
        .setPlaceholder('Select a rarity')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📦 Use Item - Select Rarity')
        .setDescription(
            `Select a rarity to view available items.\n\n` +
            `**Total Usable Items:** ${availableRarities.reduce((sum, r) => sum + itemsByRarity[r].length, 0)}`
        )
        .setFooter({ text: 'Select a rarity from the dropdown menu' })
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [row] });
}

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!message.content.match(/^\.u(se)?$/i)) return;
            
            await handleUseCommand(message);

        } catch (error) {
            console.error('[USE_COMMAND] Unexpected error:', error);
            console.error('[USE_COMMAND] Unexpected error stack:', error.stack);
            message.reply('❌ An unexpected error occurred while processing your command.').catch(() => {});
        }
    });

    // Handle interactions
    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

            const customId = interaction.customId;

            // Check ownership
            const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
            
            if (customId.startsWith('use_')) {
                const isOwner = await checkButtonOwnership(interaction, null, 
                    "❌ You can't use someone else's item menu.", true);
                
                if (!isOwner) return;

                if (customId.startsWith('use_rarity_select')) {
                    await handleRaritySelection(interaction);
                } else if (customId.startsWith('use_item_select')) {
                    await handleItemSelection(interaction);
                } else if (customId.startsWith('use_confirm')) {
                    await handleConfirmation(interaction);
                } else if (customId.startsWith('use_cancel')) {
                    await handleCancellation(interaction);
                } else if (customId.startsWith('use_item_page_next')) {
                    await handlePagination(interaction, 'next');
                } else if (customId.startsWith('use_item_page_prev')) {
                    await handlePagination(interaction, 'prev');
                } else if (customId.startsWith('use_back_to_rarity')) {
                    await handleBackToRarity(interaction);
                }
            }

        } catch (error) {
            console.error('[USE_COMMAND] Interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing your interaction.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    console.log('✅ Use command handler registered (Interactive Mode)');
};