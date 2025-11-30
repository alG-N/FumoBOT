const { createAnimationEmbed, createResultEmbed, createPlayAgainButtons } = require('./SlotUIService');

async function playAnimationSequence(interaction, spinResult, isTextCommand) {
    const embeds = [
        createAnimationEmbed(spinResult, 0),
        createAnimationEmbed(spinResult, 1),
        createAnimationEmbed(spinResult, 2)
    ];

    if (isTextCommand) {
        const sent = await interaction.reply({ embeds: [embeds[0]] });
        await wait(500);
        await sent.edit({ embeds: [embeds[1]] });
        await wait(500);
        await sent.edit({ embeds: [embeds[2]] });
    } else {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }
        for (let i = 0; i < embeds.length; i++) {
            await interaction.editReply({ embeds: [embeds[i]] });
            if (i < embeds.length - 1) await wait(500);
        }
    }
}

async function displayResult(interaction, result, isTextCommand) {
    const resultEmbed = createResultEmbed(result);
    const buttons = createPlayAgainButtons();

    if (isTextCommand) {
        const messages = await interaction.channel.messages.fetch({ limit: 5 });
        const botMsg = messages.find(m => 
            m.author.id === interaction.client.user.id && m.embeds.length > 0
        );
        
        if (botMsg) {
            await botMsg.edit({ embeds: [resultEmbed] });
        } else {
            await interaction.channel.send({ embeds: [resultEmbed] });
        }

        await interaction.channel.send({
            embeds: [createFollowupEmbed()],
            components: [buttons]
        });
    } else {
        await interaction.editReply({ embeds: [resultEmbed] });
        await interaction.followUp({
            embeds: [createFollowupEmbed()],
            components: [buttons]
        });
    }
}

function createFollowupEmbed() {
    const { EmbedBuilder } = require('discord.js');
    return new EmbedBuilder()
        .setDescription('Want to play again?')
        .setColor('#FFD700');
}

async function handleButtonInteraction(interaction, userBets) {
    const userId = interaction.user.id;
    const lastBet = userBets.get(userId);

    if (interaction.customId === 'playAgain') {
        if (!lastBet) {
            return await interaction.reply({
                embeds: [createNoBetEmbed()],
                ephemeral: true
            });
        }
        return { action: 'play', bet: lastBet, spins: 1 };
    }
    
    if (interaction.customId === 'autoSpin') {
        if (!lastBet) {
            return await interaction.reply({
                embeds: [createNoBetEmbed()],
                ephemeral: true
            });
        }
        return { action: 'play', bet: lastBet, spins: 5 };
    }
    
    if (interaction.customId === 'cancel') {
        await interaction.reply({
            embeds: [createCancelEmbed()],
            ephemeral: true
        });

        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 5000);

        return { action: 'cancel' };
    }

    return null;
}

function createNoBetEmbed() {
    const { EmbedBuilder } = require('discord.js');
    return new EmbedBuilder()
        .setDescription('No previous bet found. Use the `.slot` command to start a new game.')
        .setColor('#FFD700');
}

function createCancelEmbed() {
    const { EmbedBuilder } = require('discord.js');
    return new EmbedBuilder()
        .setDescription('Game cancelled, come back if you are ready to gamble again.')
        .setImage('https://life-stuff.org/wp-content/uploads/2022/02/gambling-poster.jpg')
        .setColor('#FFD700');
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    playAnimationSequence,
    displayResult,
    handleButtonInteraction,
    wait
};