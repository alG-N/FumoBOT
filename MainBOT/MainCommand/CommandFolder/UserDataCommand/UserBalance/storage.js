const StorageService = require('../../Service/UserDataService/StorageService/StorageService');
const StorageUIService = require('../../Service/UserDataService/StorageService/StorageUIService');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { STORAGE_CONFIG } = require('../../Configuration/storageConfig');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (!['.storage', '.st'].includes(message.content) || message.author.bot) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        let inventoryRows, userData;
        try {
            [inventoryRows, userData] = await Promise.all([
                StorageService.getUserInventory(message.author.id),
                StorageService.getUserMetadata(message.author.id)
            ]);
        } catch (err) {
            console.error('[Storage] Database error:', err);
            return message.reply({ 
                content: '⚠️ Database error occurred. Please try again later.',
                ephemeral: true 
            });
        }

        if (!inventoryRows || inventoryRows.length === 0) {
            return message.reply({ 
                content: '🛑 Your storage is empty! Start collecting some units!',
                ephemeral: true 
            });
        }

        const state = {
            showShinyPlus: false,
            sortBy: 'rarity',
            currentPage: 0,
            hasFantasyBook: userData?.hasFantasyBook === 1
        };

        function buildView() {
            const inventoryData = StorageService.buildInventoryData(inventoryRows, {
                showShinyPlus: state.showShinyPlus,
                hasFantasyBook: state.hasFantasyBook,
                sortBy: state.sortBy
            });

            const maxPage = Math.max(0, Math.ceil(inventoryData.visibleRarities.length / 3) - 1);
            state.currentPage = Math.min(state.currentPage, maxPage);

            return {
                embed: StorageUIService.createInventoryEmbed(
                    message.author.username,
                    inventoryData,
                    state
                ),
                components: StorageUIService.createButtons(
                    message.author.id,
                    state.currentPage,
                    maxPage,
                    state.showShinyPlus,
                    state.sortBy
                ),
                inventoryData
            };
        }

        let sentMessage;
        try {
            const view = buildView();
            sentMessage = await message.reply({
                embeds: [view.embed],
                components: view.components
            });
        } catch (err) {
            console.error('[Storage] Failed to send message:', err);
            return;
        }

        const collector = sentMessage.createMessageComponentCollector({ 
            time: STORAGE_CONFIG.COLLECTOR_TIMEOUT 
        });

        collector.on('collect', async (interaction) => {
            if (!checkButtonOwnership(interaction)) {
                return interaction.reply({ 
                    content: '❌ This is not your storage!',
                    ephemeral: true 
                }).catch(() => {});
            }

            const action = interaction.customId.split('_')[1];

            switch (action) {
                case 'first':
                    state.currentPage = 0;
                    break;
                case 'prev':
                    state.currentPage = Math.max(0, state.currentPage - 1);
                    break;
                case 'next':
                    state.currentPage++;
                    break;
                case 'last':
                    const view = buildView();
                    const maxPage = view.components[0].components.find(c => c.data.custom_id.includes('last')).data.disabled ? state.currentPage : state.currentPage + 1;
                    state.currentPage = maxPage;
                    break;
                case 'shiny':
                    state.showShinyPlus = !state.showShinyPlus;
                    state.currentPage = 0;
                    break;
                case 'sort':
                    state.sortBy = state.sortBy === 'rarity' ? 'quantity' : 'rarity';
                    state.currentPage = 0;
                    break;
                case 'stats':
                    const statsView = buildView();
                    const statsEmbed = StorageUIService.createStatsEmbed(
                        message.author.username,
                        statsView.inventoryData
                    );
                    return interaction.reply({
                        embeds: [statsEmbed],
                        ephemeral: true
                    }).catch(() => {});
                case 'search':
                    return interaction.reply({
                        content: '🔍 Search feature coming soon!',
                        ephemeral: true
                    }).catch(() => {});
            }

            try {
                const newView = buildView();
                await interaction.update({
                    embeds: [newView.embed],
                    components: newView.components
                });
            } catch (err) {
                console.error('[Storage] Failed to update:', err);
            }
        });

        collector.on('end', async () => {
            try {
                await sentMessage.edit({ components: [] });
            } catch (err) {}
        });
    });
};