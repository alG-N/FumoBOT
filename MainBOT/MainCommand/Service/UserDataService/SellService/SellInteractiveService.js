const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const db = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');
const SellValidationService = require('./SellValidationService');
const SellTransactionService = require('./SellTransactionService');

// ============================================================
// CONSTANTS
// ============================================================
const SELLABLE_RARITIES = ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE'];
const UNSELLABLE_RARITIES = ['ETERNAL', 'TRANSCENDENT'];
const TRAITS = [
    { id: 'base', label: 'Base', emoji: '📦' },
    { id: 'shiny', label: '✨SHINY', emoji: '✨', tag: '[✨SHINY]' },
    { id: 'alg', label: '🌟alG', emoji: '🌟', tag: '[🌟alG]' }
];

const ITEMS_PER_PAGE = 10;
const INTERACTION_TIMEOUT = 120000; // 2 minutes

// Store active sell sessions to prevent duplicates
const activeSellSessions = new Map();

// ============================================================
// SELL MENU SERVICE
// ============================================================
class SellInteractiveService {
    /**
     * Open the main sell menu
     */
    static async openSellMenu(message, userId) {
        // Check for existing session
        if (activeSellSessions.has(userId)) {
            return message.reply({
                embeds: [this.createErrorEmbed('You already have a sell menu open! Please close it first.')],
                ephemeral: true
            });
        }

        const inventory = await this.getUserSellableInventory(userId);
        
        if (inventory.totalItems === 0) {
            return message.reply({
                embeds: [this.createErrorEmbed('You have no sellable Fumos in your inventory!', 'NO_ITEMS')]
            });
        }

        const embed = await this.createMainMenuEmbed(userId, inventory);
        const components = this.createMainMenuComponents(userId, inventory);

        const msg = await message.reply({
            embeds: [embed],
            components
        });

        // Store session
        activeSellSessions.set(userId, {
            messageId: msg.id,
            state: 'main_menu',
            selectedRarity: null,
            selectedTrait: 'base',
            page: 0
        });

        // Setup collector
        this.setupCollector(msg, userId, message.author.username);

        return msg;
    }

    /**
     * Get user's sellable inventory grouped by rarity
     */
    static async getUserSellableInventory(userId) {
        const rows = await db.all(
            `SELECT fumoName, SUM(quantity) as count 
             FROM userInventory 
             WHERE userId = ? AND fumoName LIKE '%(%)%'
             GROUP BY fumoName`,
            [userId]
        );

        const grouped = {};
        let totalItems = 0;
        let totalValue = 0;

        for (const row of rows) {
            const rarity = SellValidationService.extractRarity(row.fumoName);
            if (!rarity || UNSELLABLE_RARITIES.includes(rarity)) continue;

            if (!grouped[rarity]) {
                grouped[rarity] = {
                    base: [],
                    shiny: [],
                    alg: [],
                    totalCount: 0
                };
            }

            const trait = row.fumoName.includes('[✨SHINY]') ? 'shiny' 
                        : row.fumoName.includes('[🌟alG]') ? 'alg' 
                        : 'base';

            grouped[rarity][trait].push({
                name: row.fumoName,
                count: row.count
            });
            grouped[rarity].totalCount += row.count;
            totalItems += row.count;

            // Calculate value
            const baseReward = SellValidationService.getBaseReward(rarity);
            let itemValue = baseReward * row.count;
            if (trait === 'shiny') itemValue *= 2;
            if (trait === 'alg') itemValue *= 150;
            totalValue += itemValue;
        }

        return { grouped, totalItems, totalValue };
    }

    /**
     * Create main menu embed
     */
    static async createMainMenuEmbed(userId, inventory) {
        const sellMultiplier = await SellTransactionService.getSellMultiplier(userId);
        
        const embed = new EmbedBuilder()
            .setTitle('💰 Fumo Marketplace')
            .setColor(0x28A745)
            .setDescription(
                '**Welcome to the interactive sell menu!**\n\n' +
                'Select a rarity from the dropdown to view your Fumos.\n' +
                'You can sell individual Fumos or bulk sell by rarity.\n\n' +
                `📦 **Total Sellable Items:** ${formatNumber(inventory.totalItems)}\n` +
                `💰 **Estimated Total Value:** ${formatNumber(Math.floor(inventory.totalValue * sellMultiplier))} coins/gems`
            );

        // Add rarity breakdown
        const rarityBreakdown = [];
        for (const rarity of SELLABLE_RARITIES) {
            if (inventory.grouped[rarity]) {
                const count = inventory.grouped[rarity].totalCount;
                const rewardType = SellValidationService.getRewardType(rarity);
                rarityBreakdown.push(`**${rarity}:** ${count}x → ${rewardType}`);
            }
        }

        if (rarityBreakdown.length > 0) {
            embed.addFields({
                name: '📊 Inventory by Rarity',
                value: rarityBreakdown.join('\n') || 'No sellable items',
                inline: false
            });
        }

        if (sellMultiplier !== 1) {
            embed.addFields({
                name: '⚖️ Active Modifier',
                value: `Sell value: x${sellMultiplier.toFixed(2)}`,
                inline: true
            });
        }

        embed.setFooter({ text: '💡 Tip: Select a rarity to see detailed options' });
        embed.setTimestamp();

        return embed;
    }

    /**
     * Create main menu components (dropdown + buttons)
     */
    static createMainMenuComponents(userId, inventory) {
        const rows = [];

        // Rarity dropdown
        const rarityOptions = [];
        for (const rarity of SELLABLE_RARITIES) {
            if (inventory.grouped[rarity] && inventory.grouped[rarity].totalCount > 0) {
                const rewardType = SellValidationService.getRewardType(rarity);
                rarityOptions.push({
                    label: `${rarity} (${inventory.grouped[rarity].totalCount}x)`,
                    value: rarity,
                    description: `Sells for ${rewardType}`,
                    emoji: rewardType === 'coins' ? '🪙' : '💎'
                });
            }
        }

        if (rarityOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`sell_rarity_select_${userId}`)
                .setPlaceholder('🔍 Select a rarity to view...')
                .addOptions(rarityOptions.slice(0, 25)); // Discord limit

            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Quick action buttons
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sell_quick_common_${userId}`)
                .setLabel('💨 Quick Sell Commons')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!inventory.grouped['Common'] || inventory.grouped['Common'].totalCount === 0),
            new ButtonBuilder()
                .setCustomId(`sell_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`sell_close_${userId}`)
                .setLabel('❌ Close')
                .setStyle(ButtonStyle.Danger)
        );

        rows.push(buttonRow);

        return rows;
    }

    /**
     * Create rarity detail view embed
     */
    static async createRarityDetailEmbed(userId, rarity, trait, inventory, page = 0) {
        const sellMultiplier = await SellTransactionService.getSellMultiplier(userId);
        const rarityData = inventory.grouped[rarity];
        const traitData = rarityData ? rarityData[trait] : [];
        const rewardType = SellValidationService.getRewardType(rarity);
        const baseReward = SellValidationService.getBaseReward(rarity);

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${rarity} Fumos ${trait !== 'base' ? `[${TRAITS.find(t => t.id === trait)?.label}]` : ''}`)
            .setColor(rewardType === 'coins' ? 0xFFD700 : 0x9B59B6);

        if (traitData.length === 0) {
            embed.setDescription(`You don't have any **${rarity}${trait !== 'base' ? ` ${TRAITS.find(t => t.id === trait)?.label}` : ''}** Fumos to sell.`);
            return { embed, totalPages: 0 };
        }

        // Pagination
        const totalPages = Math.ceil(traitData.length / ITEMS_PER_PAGE);
        const startIdx = page * ITEMS_PER_PAGE;
        const pageItems = traitData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

        // Calculate multipliers
        let traitMultiplier = 1;
        if (trait === 'shiny') traitMultiplier = 2;
        if (trait === 'alg') traitMultiplier = 150;

        const effectiveReward = Math.floor(baseReward * sellMultiplier * traitMultiplier);

        // Build item list
        let itemList = '';
        let totalCount = 0;
        let totalValue = 0;

        for (const item of pageItems) {
            const baseName = item.name.replace(/\(.*?\)/, '').replace(/\[.*?\]/g, '').trim();
            const itemValue = effectiveReward * item.count;
            itemList += `• **${baseName}** x${item.count} → ${formatNumber(itemValue)} ${rewardType}\n`;
            totalCount += item.count;
            totalValue += itemValue;
        }

        // Calculate total for ALL items of this type
        const allTotalCount = traitData.reduce((sum, item) => sum + item.count, 0);
        const allTotalValue = allTotalCount * effectiveReward;

        embed.setDescription(
            `**Base Price:** ${formatNumber(baseReward)} ${rewardType}/each\n` +
            (traitMultiplier > 1 ? `**Trait Bonus:** x${traitMultiplier}\n` : '') +
            (sellMultiplier !== 1 ? `**Sell Modifier:** x${sellMultiplier.toFixed(2)}\n` : '') +
            `**Effective Price:** ${formatNumber(effectiveReward)} ${rewardType}/each\n\n` +
            `**📦 Items (Page ${page + 1}/${totalPages}):**\n${itemList}`
        );

        embed.addFields({
            name: '💰 Total Value (This Rarity + Trait)',
            value: `**${allTotalCount}x** Fumos → **${formatNumber(allTotalValue)}** ${rewardType}`,
            inline: false
        });

        embed.setFooter({ 
            text: `Page ${page + 1}/${totalPages} | ${allTotalCount} total items` 
        });

        return { embed, totalPages };
    }

    /**
     * Create rarity detail components
     */
    static createRarityDetailComponents(userId, rarity, trait, inventory, page, totalPages) {
        const rows = [];
        const rarityData = inventory.grouped[rarity];

        // Trait filter buttons
        const traitRow = new ActionRowBuilder();
        for (const t of TRAITS) {
            const count = rarityData ? rarityData[t.id].length : 0;
            traitRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`sell_trait_${t.id}_${rarity}_${userId}`)
                    .setLabel(`${t.emoji} ${t.label} (${count})`)
                    .setStyle(trait === t.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(count === 0)
            );
        }
        rows.push(traitRow);

        // Pagination buttons
        if (totalPages > 1) {
            const pageRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sell_page_prev_${rarity}_${trait}_${userId}`)
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`sell_page_next_${rarity}_${trait}_${userId}`)
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1)
            );
            rows.push(pageRow);
        }

        // Action buttons
        const traitData = rarityData ? rarityData[trait] : [];
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sell_single_${rarity}_${trait}_${userId}`)
                .setLabel('🎯 Sell Specific')
                .setStyle(ButtonStyle.Success)
                .setDisabled(traitData.length === 0),
            new ButtonBuilder()
                .setCustomId(`sell_bulk_${rarity}_${trait}_${userId}`)
                .setLabel(`💨 Sell All ${rarity}${trait !== 'base' ? ` [${TRAITS.find(t => t.id === trait)?.label}]` : ''}`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(traitData.length === 0),
            new ButtonBuilder()
                .setCustomId(`sell_back_main_${userId}`)
                .setLabel('◀️ Back to Menu')
                .setStyle(ButtonStyle.Secondary)
        );
        rows.push(actionRow);

        return rows;
    }

    /**
     * Create specific fumo selection components
     */
    static createFumoSelectComponents(userId, rarity, trait, items) {
        const rows = [];

        // Fumo dropdown (max 25 options)
        const fumoOptions = items.slice(0, 25).map(item => {
            const baseName = item.name.replace(/\(.*?\)/, '').replace(/\[.*?\]/g, '').trim();
            return {
                label: `${baseName} (x${item.count})`,
                value: item.name,
                description: `You have ${item.count} available`
            };
        });

        if (fumoOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`sell_fumo_select_${rarity}_${trait}_${userId}`)
                .setPlaceholder('Select a Fumo to sell...')
                .addOptions(fumoOptions);

            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Back button
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sell_back_rarity_${rarity}_${trait}_${userId}`)
                .setLabel('◀️ Back')
                .setStyle(ButtonStyle.Secondary)
        );
        rows.push(backRow);

        return rows;
    }

    /**
     * Setup interaction collector for the sell menu
     */
    static setupCollector(msg, userId, username) {
        const collector = msg.createMessageComponentCollector({ 
            time: INTERACTION_TIMEOUT 
        });

        collector.on('collect', async (interaction) => {
            // Verify ownership
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '❌ This menu is not for you!',
                    ephemeral: true
                });
            }

            const session = activeSellSessions.get(userId);
            if (!session) {
                return interaction.reply({
                    content: '❌ Session expired. Please run `.sell` again.',
                    ephemeral: true
                });
            }

            try {
                await this.handleInteraction(interaction, userId, session, username);
            } catch (error) {
                console.error('[SellInteractive] Error handling interaction:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred. Please try again.',
                        ephemeral: true
                    });
                }
            }
        });

        collector.on('end', async () => {
            activeSellSessions.delete(userId);
            try {
                await msg.edit({ components: [] });
            } catch (error) {
                // Message might be deleted
            }
        });
    }

    /**
     * Handle all interactions
     */
    static async handleInteraction(interaction, userId, session, username) {
        const { customId } = interaction;

        // Handle close
        if (customId.startsWith('sell_close_')) {
            await interaction.deferUpdate();
            activeSellSessions.delete(userId);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('💰 Marketplace Closed')
                    .setDescription('Thanks for visiting! Run `.sell` again anytime.')
                    .setColor(0x808080)],
                components: []
            });
            return;
        }

        // Handle refresh
        if (customId.startsWith('sell_refresh_')) {
            await interaction.deferUpdate();
            const inventory = await this.getUserSellableInventory(userId);
            const embed = await this.createMainMenuEmbed(userId, inventory);
            const components = this.createMainMenuComponents(userId, inventory);
            await interaction.editReply({ embeds: [embed], components });
            session.state = 'main_menu';
            return;
        }

        // Handle rarity selection
        if (customId.startsWith('sell_rarity_select_')) {
            await interaction.deferUpdate();
            const rarity = interaction.values[0];
            session.selectedRarity = rarity;
            session.selectedTrait = 'base';
            session.page = 0;
            session.state = 'rarity_detail';

            const inventory = await this.getUserSellableInventory(userId);
            const { embed, totalPages } = await this.createRarityDetailEmbed(userId, rarity, 'base', inventory, 0);
            const components = this.createRarityDetailComponents(userId, rarity, 'base', inventory, 0, totalPages);
            await interaction.editReply({ embeds: [embed], components });
            return;
        }

        // Handle trait filter
        if (customId.startsWith('sell_trait_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const trait = parts[2];
            const rarity = parts[3];
            session.selectedTrait = trait;
            session.page = 0;

            const inventory = await this.getUserSellableInventory(userId);
            const { embed, totalPages } = await this.createRarityDetailEmbed(userId, rarity, trait, inventory, 0);
            const components = this.createRarityDetailComponents(userId, rarity, trait, inventory, 0, totalPages);
            await interaction.editReply({ embeds: [embed], components });
            return;
        }

        // Handle pagination
        if (customId.startsWith('sell_page_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const direction = parts[2]; // prev or next
            const rarity = parts[3];
            const trait = parts[4];

            session.page = direction === 'next' ? session.page + 1 : session.page - 1;

            const inventory = await this.getUserSellableInventory(userId);
            const { embed, totalPages } = await this.createRarityDetailEmbed(userId, rarity, trait, inventory, session.page);
            const components = this.createRarityDetailComponents(userId, rarity, trait, inventory, session.page, totalPages);
            await interaction.editReply({ embeds: [embed], components });
            return;
        }

        // Handle back to main
        if (customId.startsWith('sell_back_main_')) {
            await interaction.deferUpdate();
            session.state = 'main_menu';
            session.selectedRarity = null;
            session.selectedTrait = 'base';
            session.page = 0;

            const inventory = await this.getUserSellableInventory(userId);
            const embed = await this.createMainMenuEmbed(userId, inventory);
            const components = this.createMainMenuComponents(userId, inventory);
            await interaction.editReply({ embeds: [embed], components });
            return;
        }

        // Handle back to rarity
        if (customId.startsWith('sell_back_rarity_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const rarity = parts[3];
            const trait = parts[4];

            const inventory = await this.getUserSellableInventory(userId);
            const { embed, totalPages } = await this.createRarityDetailEmbed(userId, rarity, trait, inventory, session.page);
            const components = this.createRarityDetailComponents(userId, rarity, trait, inventory, session.page, totalPages);
            await interaction.editReply({ embeds: [embed], components });
            return;
        }

        // Handle quick sell commons
        if (customId.startsWith('sell_quick_common_')) {
            await this.handleBulkSell(interaction, userId, 'Common', 'base');
            return;
        }

        // Handle sell specific fumo selection mode
        if (customId.startsWith('sell_single_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const rarity = parts[2];
            const trait = parts[3];

            const inventory = await this.getUserSellableInventory(userId);
            const traitData = inventory.grouped[rarity]?.[trait] || [];

            const embed = new EmbedBuilder()
                .setTitle(`🎯 Select a ${rarity} Fumo to Sell`)
                .setDescription('Choose a specific Fumo from the dropdown below.')
                .setColor(0x28A745);

            const components = this.createFumoSelectComponents(userId, rarity, trait, traitData);
            await interaction.editReply({ embeds: [embed], components });
            return;
        }

        // Handle fumo selection
        if (customId.startsWith('sell_fumo_select_')) {
            const fumoName = interaction.values[0];
            await this.handleSingleSellModal(interaction, userId, fumoName);
            return;
        }

        // Handle bulk sell
        if (customId.startsWith('sell_bulk_')) {
            const parts = customId.split('_');
            const rarity = parts[2];
            const trait = parts[3];
            await this.handleBulkSell(interaction, userId, rarity, trait);
            return;
        }
    }

    /**
     * Show modal for quantity input
     */
    static async handleSingleSellModal(interaction, userId, fumoName) {
        // Get current quantity
        const row = await db.get(
            'SELECT SUM(quantity) as total FROM userInventory WHERE userId = ? AND fumoName = ?',
            [userId, fumoName]
        );
        const available = row?.total || 0;

        const modal = new ModalBuilder()
            .setCustomId(`sell_quantity_modal_${userId}`)
            .setTitle('Sell Quantity');

        const quantityInput = new TextInputBuilder()
            .setCustomId('sell_quantity')
            .setLabel(`How many? (You have ${available})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1-${available}`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(10);

        const fumoInput = new TextInputBuilder()
            .setCustomId('sell_fumo_name')
            .setLabel('Fumo Name (DO NOT EDIT)')
            .setStyle(TextInputStyle.Short)
            .setValue(fumoName)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(quantityInput),
            new ActionRowBuilder().addComponents(fumoInput)
        );

        await interaction.showModal(modal);
    }

    /**
     * Handle bulk sell with confirmation
     */
    static async handleBulkSell(interaction, userId, rarity, trait) {
        await interaction.deferUpdate();

        const inventory = await this.getUserSellableInventory(userId);
        const traitData = inventory.grouped[rarity]?.[trait] || [];
        
        if (traitData.length === 0) {
            return interaction.followUp({
                content: `❌ No ${rarity}${trait !== 'base' ? ` [${TRAITS.find(t => t.id === trait)?.label}]` : ''} Fumos to sell!`,
                ephemeral: true
            });
        }

        const tag = trait === 'shiny' ? '[✨SHINY]' : trait === 'alg' ? '[🌟alG]' : null;
        const calculation = await SellTransactionService.calculateBulkSellReward(
            userId,
            rarity,
            tag,
            traitData.map(f => ({ fumoName: f.name, count: f.count }))
        );

        // Show confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Bulk Sale')
            .setColor(0xFF6B6B)
            .setDescription(
                `You are about to sell **ALL** your **${rarity}${trait !== 'base' ? ` [${TRAITS.find(t => t.id === trait)?.label}]` : ''}** Fumos!\n\n` +
                `📦 **Total Fumos:** ${calculation.totalFumos}\n` +
                `💰 **Total Reward:** ${formatNumber(calculation.totalReward)} ${calculation.rewardType}\n\n` +
                `⚠️ **This action cannot be undone!**`
            );

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sell_confirm_bulk_${rarity}_${trait}_${userId}`)
                .setLabel('✅ Confirm Sale')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`sell_cancel_bulk_${rarity}_${trait}_${userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({
            embeds: [confirmEmbed],
            components: [confirmRow]
        });
    }

    /**
     * Create error embed
     */
    static createErrorEmbed(message, errorType = 'GENERIC') {
        return new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message)
            .setColor(0xFF0000)
            .setTimestamp();
    }

    /**
     * Clean up session
     */
    static clearSession(userId) {
        activeSellSessions.delete(userId);
    }

    /**
     * Check if user has active session
     */
    static hasActiveSession(userId) {
        return activeSellSessions.has(userId);
    }
}

module.exports = SellInteractiveService;
