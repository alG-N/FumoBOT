const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { INTERACTION_TIMEOUT, PAGE_INFO, TOTAL_PAGES } = require('../../../Configuration/balanceConfig');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');

function createNavigationButtons(currentPage, totalPages, userId) {
    const firstButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_first', userId))
        .setLabel('⏮️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0);

    const previousButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_prev', userId))
        .setLabel('◀️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0);

    const nextButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_next', userId))
        .setLabel('▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1);
    
    const lastButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_last', userId))
        .setLabel('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages - 1);
    
    const refreshButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_refresh', userId))
        .setLabel('🔄')
        .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder().addComponents(
        firstButton,
        previousButton,
        refreshButton,
        nextButton,
        lastButton
    );
}

function createPageSelectMenu(currentPage, totalPages, userId) {
    const options = [];
    
    for (let i = 0; i < totalPages; i++) {
        const pageInfo = PAGE_INFO ? PAGE_INFO[i] : null;
        const emoji = pageInfo?.emoji || '📄';
        const name = pageInfo?.name || `Page ${i + 1}`;
        
        options.push({
            label: `${name}`,
            description: pageInfo?.desc || `Go to page ${i + 1}`,
            value: `page_${i}`,
            emoji: emoji,
            default: i === currentPage
        });
    }
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(buildSecureCustomId('balance_select', userId))
        .setPlaceholder('📑 Jump to page...')
        .addOptions(options);
    
    return new ActionRowBuilder().addComponents(selectMenu);
}

async function setupCollector(message, authorId, pages, onUpdate) {
    const collector = message.createMessageComponentCollector({
        time: INTERACTION_TIMEOUT,
        filter: i => i.user.id === authorId
    });

    let currentPage = 0;

    collector.on('collect', async interaction => {
        try {
            // Handle select menu
            if (interaction.isStringSelectMenu()) {
                const selected = interaction.values[0];
                if (selected.startsWith('page_')) {
                    currentPage = parseInt(selected.split('_')[1], 10);
                }
            } else {
                // Handle buttons
                const action = interaction.customId.split('_')[1];

                if (action === 'prev' && currentPage > 0) {
                    currentPage--;
                } else if (action === 'next' && currentPage < pages.length - 1) {
                    currentPage++;
                } else if (action === 'first') {
                    currentPage = 0;
                } else if (action === 'last') {
                    currentPage = pages.length - 1;
                } else if (action === 'refresh') {
                    if (onUpdate) {
                        const newPages = await onUpdate();
                        if (newPages && newPages.length > 0) {
                            pages = newPages;
                        }
                    }
                }
            }

            const buttonRow = createNavigationButtons(currentPage, pages.length, authorId);
            const selectRow = createPageSelectMenu(currentPage, pages.length, authorId);

            await interaction.update({
                embeds: [pages[currentPage]],
                components: [buttonRow, selectRow]
            });
        } catch (error) {
            console.error('[Balance Navigation] Interaction error:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while updating the page.',
                        ephemeral: true
                    });
                }
            } catch {}
        }
    });

    collector.on('end', async () => {
        try {
            const disabledButtonRow = createNavigationButtons(currentPage, pages.length, authorId);
            disabledButtonRow.components.forEach(button => button.setDisabled(true));
            
            const disabledSelectRow = createPageSelectMenu(currentPage, pages.length, authorId);
            disabledSelectRow.components.forEach(menu => menu.setDisabled(true));

            await message.edit({ components: [disabledButtonRow, disabledSelectRow] }).catch(() => {});
        } catch (error) {
            console.error('[Balance Navigation] Cleanup error:', error);
        }
    });

    return collector;
}

async function sendPaginatedBalance(channel, pages, authorId, onUpdate) {
    if (!pages || pages.length === 0) {
        return channel.send('❌ Failed to generate balance pages.');
    }

    const buttonRow = createNavigationButtons(0, pages.length, authorId);
    const selectRow = createPageSelectMenu(0, pages.length, authorId);

    const message = await channel.send({
        embeds: [pages[0]],
        components: [buttonRow, selectRow]
    });

    await setupCollector(message, authorId, pages, onUpdate);

    return message;
}

module.exports = {
    createNavigationButtons,
    createPageSelectMenu,
    setupCollector,
    sendPaginatedBalance
};