const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllCards, getCard, getCounteredBy, GAMBLE_CONFIG } = require('../../../Configuration/gambleConfig');
const { formatNumber } = require('../../../Ultility/formatting');

function createUsageEmbed() {
    return new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🎲 How to Use .gamble')
        .setDescription('Challenge another user to a gamble!')
        .addFields(
            { name: '📌 Format', value: '`.gamble @user coins/gems amount`' },
            { 
                name: '📋 Parameters', 
                value: '**@user:** Tag the user\n**coins/gems:** Currency\n**amount:** Wager amount' 
            },
            { name: '✅ Example', value: '`.gamble @alterGolden coins 50`' }
        )
        .setFooter({ text: 'Use valid parameters!' });
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        SELF_GAMBLE: '❌ Cannot gamble yourself! Select a different user.',
        BOT_GAMBLE: '🤖 Cannot gamble bots! Bots are not eligible.',
        INVALID_CURRENCY: '❌ Invalid currency. Use `coins` or `gems`.',
        BELOW_MINIMUM: `❌ Minimum bet is ${details.minBet || 'N/A'}.`,
        USER_NOT_FOUND: '❌ One or both users lack an account. Register first.',
        INSUFFICIENT_BALANCE_USER1: `❌ You don't have enough ${details.currency || 'currency'}.`,
        INSUFFICIENT_BALANCE_USER2: `❌ Your opponent doesn't have enough ${details.currency || 'currency'}.`
    };

    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Gamble Error')
        .setDescription(errorMessages[errorType] || '❌ An error occurred.')
        .setTimestamp();
}

async function sendInvitation(channel, challenger, opponent, currency, amount) {
    const embed = new EmbedBuilder()
        .setTitle('🎲 Gamble Invitation')
        .setDescription(
            `📣 ${challenger.username} challenges ${opponent.username} to a gamble!\n\n` +
            `**Currency:** ${currency}\n` +
            `**Amount:** ${formatNumber(amount)}`
        )
        .setColor('#0099ff')
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`accept_gamble_${Date.now()}`)
            .setLabel('🟢 Accept')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`decline_gamble_${Date.now()}`)
            .setLabel('🔴 Decline')
            .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({ embeds: [embed], components: [row] });

    // Wait for response
    const filter = i => i.user.id === opponent.id && i.customId.includes('gamble');
    
    try {
        const interaction = await message.awaitMessageComponent({ 
            filter, 
            time: GAMBLE_CONFIG.INVITATION_TIMEOUT 
        });

        const accepted = interaction.customId.startsWith('accept_');
        
        await interaction.update({
            content: accepted ? '🎉 Gamble accepted! Starting...' : '🔴 Gamble declined.',
            embeds: [],
            components: []
        });

        return { accepted };

    } catch (error) {
        await message.edit({
            content: '⏰ Invitation expired.',
            embeds: [],
            components: []
        }).catch(() => {});

        return { accepted: false };
    }
}

async function showCardGuide(channel, duration) {
    const cards = getAllCards();
    const fields = cards.map(card => {
        const counters = getCounteredBy(card.id).map(id => getCard(id)?.name || 'Unknown');
        return {
            name: `${card.emoji} ${card.name}`,
            value: `Counters: ${counters.join(', ')}`,
            inline: true
        };
    });

    const embed = new EmbedBuilder()
        .setTitle('📜 Gamble Guide')
        .setDescription('Each Fumo counters specific other Fumos.')
        .addFields(fields)
        .setColor('#0099ff')
        .setFooter({ text: `Starting in ${duration / 1000} seconds...` });

    const message = await channel.send({ embeds: [embed] });
    
    let remaining = duration / 1000;
    const interval = setInterval(async () => {
        remaining--;
        
        if (remaining <= 0) {
            clearInterval(interval);
            await message.delete().catch(() => {});
            return;
        }

        embed.setFooter({ text: `Starting in ${remaining} seconds...` });
        await message.edit({ embeds: [embed] }).catch(() => clearInterval(interval));
    }, 1000);
}

async function collectCardSelections(channel, user1, user2, sessionKey, duration) {
    const cards = getAllCards();
    const buttons = cards.map(card =>
        new ButtonBuilder()
            .setCustomId(`card_${card.id}_${sessionKey}`)
            .setLabel(`${card.emoji} ${card.name}`)
            .setStyle(ButtonStyle.Primary)
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    const message = await channel.send({
        content: `Choose your card (${duration / 1000} seconds):`,
        components: rows
    });

    const selections = new Map();
    let countdown = duration / 1000;

    const interval = setInterval(async () => {
        countdown--;
        
        if (countdown <= 0 || selections.size === 2) {
            clearInterval(interval);
            await message.delete().catch(() => {});
            return;
        }

        await message.edit({
            content: `Choose your card (${countdown}s left)`,
            components: rows
        }).catch(() => clearInterval(interval));
    }, 1000);

    const filter = i => 
        (i.user.id === user1.id || i.user.id === user2.id) && 
        i.customId.endsWith(sessionKey);

    const collector = message.createMessageComponentCollector({ 
        filter, 
        time: duration 
    });

    return new Promise((resolve) => {
        collector.on('collect', async (interaction) => {
            if (selections.has(interaction.user.id)) {
                return interaction.reply({ 
                    content: 'You already selected a card!', 
                    ephemeral: true 
                });
            }

            const cardId = parseInt(interaction.customId.split('_')[1]);
            const card = getCard(cardId);
            
            selections.set(interaction.user.id, cardId);

            await interaction.reply({
                content: `Selected: ${card.emoji} ${card.name}`,
                ephemeral: true
            });

            if (selections.size === 2) {
                clearInterval(interval);
                collector.stop();
                await message.delete().catch(() => {});
                
                resolve({
                    user1Card: selections.get(user1.id) || null,
                    user2Card: selections.get(user2.id) || null
                });
            }
        });

        collector.on('end', () => {
            clearInterval(interval);
            
            resolve({
                user1Card: selections.get(user1.id) || null,
                user2Card: selections.get(user2.id) || null
            });
        });
    });
}

async function displayResult(channel, user1, user2, result, currency, amount) {
    let embed;

    switch (result.outcome) {
        case 'NO_SELECTION':
            embed = new EmbedBuilder()
                .setTitle('❌ Invalid Gamble')
                .setDescription('Neither player selected a card. No changes.')
                .setColor('#808080');
            break;

        case 'DEFAULT_WIN':
            const defaultWinner = result.winner === user1.id ? user1 : user2;
            const defaultLoser = result.winner === user1.id ? user2 : user1;
            const defaultCard = getCard(result.card1 || result.card2);

            embed = new EmbedBuilder()
                .setTitle('🎲 Gamble Result')
                .setDescription(
                    `${defaultLoser.username} didn't select a card.\n` +
                    `${defaultWinner.username} wins by default!`
                )
                .addFields(
                    { name: 'Winner', value: defaultWinner.username, inline: true },
                    { name: 'Card', value: `${defaultCard.emoji} ${defaultCard.name}`, inline: true },
                    { name: 'Won', value: `${formatNumber(amount)} ${currency}`, inline: true }
                )
                .setColor('#4caf50');
            break;

        case 'SAME_CARD':
            const card = getCard(result.card1);
            embed = new EmbedBuilder()
                .setTitle('🎲 Unexpected Movement!')
                .setDescription('Same card chosen! Both lose 50% of bet.')
                .addFields(
                    { name: `${user1.username}'s Card`, value: `${card.emoji} ${card.name}`, inline: true },
                    { name: `${user2.username}'s Card`, value: `${card.emoji} ${card.name}`, inline: true },
                    { name: 'Lost', value: `${formatNumber(result.penalty)} ${currency}`, inline: true }
                )
                .setColor('#ff0000');
            break;

        case 'DRAW':
            const card1 = getCard(result.card1);
            const card2 = getCard(result.card2);
            embed = new EmbedBuilder()
                .setTitle('🎲 Draw!')
                .setDescription('No winner. No currency exchanged.')
                .addFields(
                    { name: `${user1.username}'s Card`, value: `${card1.emoji} ${card1.name}`, inline: true },
                    { name: `${user2.username}'s Card`, value: `${card2.emoji} ${card2.name}`, inline: true }
                )
                .setColor('#aaaaaa');
            break;

        case 'USER1_WIN':
        case 'USER2_WIN':
            const winner = result.outcome === 'USER1_WIN' ? user1 : user2;
            const loser = result.outcome === 'USER1_WIN' ? user2 : user1;
            const winCard = getCard(result.outcome === 'USER1_WIN' ? result.card1 : result.card2);
            const loseCard = getCard(result.outcome === 'USER1_WIN' ? result.card2 : result.card1);

            embed = new EmbedBuilder()
                .setTitle('🎲 Gamble Result')
                .setDescription('The gamble has ended!')
                .addFields(
                    { name: 'Winner', value: winner.username, inline: true },
                    { name: 'Loser', value: loser.username, inline: true },
                    { name: "Winner's Card", value: `${winCard.emoji} ${winCard.name}`, inline: true },
                    { name: "Loser's Card", value: `${loseCard.emoji} ${loseCard.name}`, inline: true },
                    { name: 'Amount', value: `${formatNumber(amount)} ${currency}`, inline: true }
                )
                .setColor('#0099ff');
            break;
    }

    const message = await channel.send({ embeds: [embed] });
    
    setTimeout(() => {
        message.delete().catch(() => {});
    }, GAMBLE_CONFIG.RESULT_DISPLAY_DURATION);
}

module.exports = {
    createUsageEmbed,
    createErrorEmbed,
    sendInvitation,
    showCardGuide,
    collectCardSelections,
    displayResult
};