const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const ItemHandlers = require('./ItemUseHandler/SpecialItemHandler');
const { all, get, run } = require('../../../Core/database');

const UNUSABLE_ITEMS = new Set([
    'Stone(B)', 'Stick(B)', 'UniqueRock(C)', 'Books(C)', 'Wool(C)', 
    'Wood(C)', 'Dice(C)', 'FragmentOf1800s(R)', 'EnhancedScroll(E)', 
    'RustedCore(E)', 'RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 
    'WhiteShard(L)', 'DarkShard(L)', 'ChromaShard(M)', 'MonoShard(M)', 
    'EquinoxAlloy(M)', 'StarShard(M)', 'Undefined(?)', 'Null?(?)', 
    'VoidFragment(?)', 'ObsidianRelic(Un)', 'ChaosEssence(Un)', 'AbyssalShard(Un)'
]);

const ONE_TIME_USE_ITEMS = new Set([
    'WeirdGrass(R)', 'GoldenSigil(?)', 'HakureiTicket(L)', 'Lumina(M)', 
    'FantasyBook(M)', 'MysteriousCube(M)', 'MysteriousDice(M)', 'TimeClock(L)', 
    'S!gil?(?)', 'PetFoob(B)', 'ShinyShard(?)', 'alGShard(P)'
]);

/**
 * Get all usable items from user's inventory
 */
async function getUsableInventory(userId) {
    try {
        const rows = await all(
            `SELECT 
                COALESCE(itemName, fumoName) as itemName,
                SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             AND (itemName IS NOT NULL OR fumoName IS NOT NULL)
             AND (TRIM(COALESCE(itemName, '')) != '' OR TRIM(COALESCE(fumoName, '')) != '')
             GROUP BY COALESCE(itemName, fumoName)
             HAVING totalQuantity > 0
             ORDER BY COALESCE(itemName, fumoName)`,
            [userId]
        );

        if (!rows || rows.length === 0) return [];
        
        return rows.filter(item => {
            if (!item.itemName || typeof item.itemName !== 'string' || item.itemName.trim() === '') {
                return false;
            }
            const quantity = parseInt(item.totalQuantity) || 0;
            return quantity > 0 && ItemHandlers.isUsableItem(item.itemName) && !UNUSABLE_ITEMS.has(item.itemName);
        }).map(item => ({
            itemName: item.itemName,
            quantity: parseInt(item.totalQuantity) || 0
        }));
    } catch (error) {
        console.error('[USE_SERVICE] Error fetching inventory:', error);
        return [];
    }
}

/**
 * Get usable items filtered by rarity
 */
async function getUsableInventoryByRarity(userId, rarity) {
    try {
        const { RARITY_SUFFIX_MAP } = require('../../../Configuration/itemConfig');
        const suffix = Object.entries(RARITY_SUFFIX_MAP).find(([_, r]) => r === rarity)?.[0];
        
        if (!suffix) return [];

        const rows = await all(
            `SELECT 
                COALESCE(itemName, fumoName) as itemName,
                SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             AND COALESCE(itemName, fumoName) LIKE ?
             AND (itemName IS NOT NULL OR fumoName IS NOT NULL)
             AND (TRIM(COALESCE(itemName, '')) != '' OR TRIM(COALESCE(fumoName, '')) != '')
             GROUP BY COALESCE(itemName, fumoName)
             HAVING totalQuantity > 0
             ORDER BY COALESCE(itemName, fumoName)`,
            [userId, `%${suffix}`]
        );

        if (!rows || rows.length === 0) return [];
        
        return rows.filter(item => {
            if (!item.itemName || typeof item.itemName !== 'string' || item.itemName.trim() === '') {
                return false;
            }
            const quantity = parseInt(item.totalQuantity) || 0;
            return quantity > 0 && ItemHandlers.isUsableItem(item.itemName) && !UNUSABLE_ITEMS.has(item.itemName);
        }).map(item => ({
            itemName: item.itemName,
            quantity: parseInt(item.totalQuantity) || 0
        }));
    } catch (error) {
        console.error('[USE_SERVICE] Error fetching inventory by rarity:', error);
        return [];
    }
}

/**
 * Extract rarity from item name
 */
function getRarityFromItem(itemName) {
    const { RARITY_SUFFIX_MAP } = require('../../../Configuration/itemConfig');
    for (const [suffix, rarity] of Object.entries(RARITY_SUFFIX_MAP)) {
        if (itemName.endsWith(suffix)) return rarity;
    }
    return null;
}

/**
 * Get item category for display
 */
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
        'PetFoob(B)': '🐾 Pet',
        'ShinyShard(?)': '✨ Transform',
        'alGShard(P)': '👑 Prime',
        'AncientRelic(E)': '🏛️ Ancient',
        // Tier 6 items
        'CrystalSigil(?)': '💎 Tier 6',
        'VoidCrystal(?)': '🌀 Tier 6',
        'EternalEssence(?)': '✨ Tier 6',
        'CosmicCore(?)': '🌌 Tier 6'
    };
    
    return categories[itemName] || '📦 Item';
}

/**
 * Group items by rarity
 */
function groupItemsByRarity(usableItems) {
    const { RARITY_ORDER } = require('../../../Configuration/itemConfig');
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

    return itemsByRarity;
}

/**
 * Build rarity selection embed and menu
 */
function buildRaritySelection(userId, availableRarities, itemsByRarity) {
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

    return { embed, components: [row] };
}

/**
 * Build item selection page with pagination
 */
function buildItemSelectionPage(userId, rarity, usableItems, page, totalPages) {
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

    // Build pagination buttons
    const buttons = [];
    const backButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('use_back_to_rarity', userId))
        .setLabel('◀ Back to Rarities')
        .setStyle(ButtonStyle.Secondary);
    buttons.push(backButton);

    if (totalPages > 1) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('use_item_page_prev', userId, { rarity, page }))
                .setLabel('◀ Prev')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('use_page_indicator')
                .setLabel(`${page + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('use_item_page_next', userId, { rarity, page }))
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1)
        );
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

    return { embed, components };
}

/**
 * Build confirmation embed and buttons
 */
function buildConfirmation(userId, itemName, quantity) {
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

    return { embed, components: [row] };
}

/**
 * Execute item use - consume items and call handler
 */
async function executeItemUse(userId, itemName, quantity, messageProxy) {
    try {
        // Verify inventory
        const inventory = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, itemName]
        );
        
        if (!inventory || inventory.quantity < quantity) {
            throw new Error(`You don't have enough **${itemName}**. You need **${quantity}**, but only have **${inventory?.quantity || 0}**.`);
        }

        // Consume items FIRST
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
            [quantity, userId, itemName]
        );

        // Execute handler (handlers should NOT consume items)
        await ItemHandlers.handleItem(messageProxy, itemName, quantity);
        
        return { success: true };
    } catch (error) {
        // Restore items on error
        try {
            await run(
                `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                [quantity, userId, itemName]
            );
        } catch (restoreError) {
            console.error('[USE_SERVICE] Failed to restore items:', restoreError);
        }
        throw error;
    }
}

module.exports = {
    getUsableInventory,
    getUsableInventoryByRarity,
    getRarityFromItem,
    getItemCategory,
    groupItemsByRarity,
    buildRaritySelection,
    buildItemSelectionPage,
    buildConfirmation,
    executeItemUse,
    UNUSABLE_ITEMS,
    ONE_TIME_USE_ITEMS
};