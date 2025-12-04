const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getCoinMarket, getGemMarket } = require('../MarketCacheService');
const { getAllGlobalListings } = require('../MarketStorageService');
const {
    createMainShopEmbed,
    createCoinShopEmbed,
    createGemShopEmbed,
    createGlobalShopEmbed,
    createMainShopButtons,
    createShopSelectMenu,
    createBackButton,
    createGlobalShopButtons
} = require('../MarketUIService');

const CATEGORIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

async function handleCoinShop(interaction) {
    try {
        const market = getCoinMarket(interaction.user.id);
        const embed = await createCoinShopEmbed(interaction.user.id, market.market, market.resetTime);
        const selectMenu = createShopSelectMenu(interaction.user.id, market.market, 'coin');
        const backButton = createBackButton(interaction.user.id);

        await interaction.update({ embeds: [embed], components: [selectMenu, backButton] });
    } catch (error) {
        console.error('Coin shop error:', error);
        await interaction.reply({ content: '❌ Failed to load coin shop.', ephemeral: true });
    }
}

async function handleGemShop(interaction) {
    try {
        const market = getGemMarket(interaction.user.id);
        const embed = await createGemShopEmbed(interaction.user.id, market.market, market.resetTime);
        const selectMenu = createShopSelectMenu(interaction.user.id, market.market, 'gem');
        const backButton = createBackButton(interaction.user.id);

        await interaction.update({ embeds: [embed], components: [selectMenu, backButton] });
    } catch (error) {
        console.error('Gem shop error:', error);
        await interaction.reply({ content: '❌ Failed to load gem shop.', ephemeral: true });
    }
}

async function handleGlobalShop(interaction) {
    try {
        const allListings = await getAllGlobalListings();
        const shuffled = allListings.sort(() => Math.random() - 0.5);
        const display = shuffled.slice(0, 5);

        const embed = createGlobalShopEmbed(display);
        const buttons = createGlobalShopButtons(interaction.user.id);
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`global_purchase_select_${interaction.user.id}`)
            .setPlaceholder('Select a fumo to purchase')
            .setDisabled(display.length === 0);

        if (display.length > 0) {
            const options = display.map((listing, idx) => {
                let priceText = '';
                if (listing.coinPrice && listing.gemPrice) {
                    priceText = `🪙${listing.coinPrice.toLocaleString()} 💎${listing.gemPrice.toLocaleString()}`;
                } else if (listing.coinPrice) {
                    priceText = `🪙${listing.coinPrice.toLocaleString()}`;
                } else if (listing.gemPrice) {
                    priceText = `💎${listing.gemPrice.toLocaleString()}`;
                }
                return {
                    label: listing.fumoName.substring(0, 100),
                    value: `${listing.id}`,
                    description: priceText.substring(0, 100)
                };
            });
            selectMenu.addOptions(options);
        } else {
            selectMenu.addOptions({
                label: 'No listings available',
                value: 'none'
            });
        }

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({ embeds: [embed], components: [selectRow, buttons] });
    } catch (error) {
        console.error('Global shop error:', error);
        await interaction.reply({ content: '❌ Failed to load global shop.', ephemeral: true });
    }
}

async function handleBackToMain(interaction) {
    try {
        const embed = await createMainShopEmbed(interaction.user.id);
        const buttons = createMainShopButtons(interaction.user.id);
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Back to main error:', error);
    }
}

async function handleRefreshGlobal(interaction) {
    try {
        await interaction.deferUpdate();

        const allListings = await getAllGlobalListings();
        const shuffled = allListings.sort(() => Math.random() - 0.5);
        const display = shuffled.slice(0, 5);

        const embed = createGlobalShopEmbed(display);
        const buttons = createGlobalShopButtons(interaction.user.id);
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`global_purchase_select_${interaction.user.id}`)
            .setPlaceholder('Select a fumo to purchase')
            .setDisabled(display.length === 0);

        if (display.length > 0) {
            const options = display.map((listing, idx) => {
                const currencyEmoji = listing.currency === 'coins' ? '🪙' : '💎';
                return {
                    label: listing.fumoName.substring(0, 100),
                    value: `${listing.id}`,
                    description: `${currencyEmoji} ${listing.price.toLocaleString()}`.substring(0, 100)
                };
            });
            selectMenu.addOptions(options);
        } else {
            selectMenu.addOptions({
                label: 'No listings available',
                value: 'none'
            });
        }

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({ embeds: [embed], components: [selectRow, buttons] });
    } catch (error) {
        console.error('Refresh global error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to refresh.', ephemeral: true });
        }
    }
}

module.exports = {
    handleCoinShop,
    handleGemShop,
    handleGlobalShop,
    handleBackToMain,
    handleRefreshGlobal
};