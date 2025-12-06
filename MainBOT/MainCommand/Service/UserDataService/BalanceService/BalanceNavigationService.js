const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { INTERACTION_TIMEOUT } = require('../../../Configuration/balanceConfig');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');

function createNavigationButtons(currentPage, totalPages, userId) {
    const previousButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_prev', userId))
        .setLabel('⬅️ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0);

    const nextButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_next', userId))
        .setLabel('Next ➡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1);
    
    const refreshButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_refresh', userId))
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary);
    
    const pageButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('balance_page', userId))
        .setLabel(`${currentPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

    return new ActionRowBuilder().addComponents(
        previousButton,
        pageButton,
        nextButton,
        refreshButton
    );
}

async function setupCollector(message, authorId, pages, onUpdate) {
    const collector = message.createMessageComponentCollector({
        time: INTERACTION_TIMEOUT,
        filter: i => i.user.id === authorId
    });

    let currentPage = 0;

    collector.on('collect', async interaction => {
        try {
            const action = interaction.customId.split('_')[1];

            if (action === 'prev' && currentPage > 0) {
                currentPage--;
            } else if (action === 'next' && currentPage < pages.length - 1) {
                currentPage++;
            } else if (action === 'refresh') {
                if (onUpdate) {
                    const newPages = await onUpdate();
                    if (newPages && newPages.length > 0) {
                        pages = newPages;
                    }
                }
            }

            const row = createNavigationButtons(currentPage, pages.length, authorId);

            await interaction.update({
                embeds: [pages[currentPage]],
                components: [row]
            });
        } catch (error) {
            console.error('[Balance Navigation] Interaction error:', error);
            try {
                await interaction.reply({
                    content: '❌ An error occurred while updating the page.',
                    ephemeral: true
                });
            } catch {}
        }
    });

    collector.on('end', async () => {
        try {
            const disabledRow = createNavigationButtons(currentPage, pages.length, authorId);
            disabledRow.components.forEach(button => button.setDisabled(true));

            await message.edit({ components: [disabledRow] }).catch(() => {});
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

    const row = createNavigationButtons(0, pages.length, authorId);

    const message = await channel.send({
        embeds: [pages[0]],
        components: [row]
    });

    await setupCollector(message, authorId, pages, onUpdate);

    return message;
}

module.exports = {
    createNavigationButtons,
    setupCollector,
    sendPaginatedBalance
};