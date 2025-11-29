const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { PITY_THRESHOLDS } = require('../../Configuration/rarity');

function createEventShopEmbed(userData, boosts, chances, eventTimeRemaining) {
    const { gems, rollsInCurrentWindow, rollsSinceLastMythical, rollsSinceLastQuestionMark } = userData;

    const embed = new EmbedBuilder()
        .setTitle('🎲 Jujutsu Kaisen turned into Marketable Fumo?!?! 🎲')
        .setDescription(
            `💎 You're sitting on a treasure of ${formatNumber(gems)} gems. ` +
            `Unleash the urge to gamble, each summon is just 100 gems for 1 marketable-fumo.`
        )
        .addFields([
            {
                name: '🌟 Rarity Chances 🌟',
                value: `Step right up and test your luck! Here are the odds for each rarity (with your luck applied):\n` +
                    `🔮 EPIC - ${chances.epic.toFixed(4)}%\n` +
                    `🟨 LEGENDARY - ${chances.legendary.toFixed(4)}%\n` +
                    `🟥 MYTHICAL - ${chances.mythical.toFixed(4)}%\n` +
                    `❓ ??? - ${chances.question.toFixed(5)}%\n` +
                    `👑 TRANSCENDENT - ???%`
            },
            { 
                name: '⏳ Time Left', 
                value: eventTimeRemaining, 
                inline: true 
            },
            { 
                name: '🔄 Roll Limit', 
                value: `${rollsInCurrentWindow} / 50,000 rolls`, 
                inline: true 
            },
            { 
                name: '🟥 Mythical Pity', 
                value: `${rollsSinceLastMythical || 0} / ${PITY_THRESHOLDS.EVENT_MYTHICAL}`, 
                inline: false 
            },
            { 
                name: '❓ ??? Pity', 
                value: `${rollsSinceLastQuestionMark || 0} / ${PITY_THRESHOLDS.EVENT_QUESTION}`, 
                inline: false 
            }
        ])
        .setColor(Colors.Blue)
        .setImage('https://cdn141.picsart.com/322879240181201.jpg')
        .setFooter({ text: boosts.lines.join('\n') || 'No luck boost applied...' });

    return embed;
}

function createEventStatusEmbed(userData, boosts, chances, eventTimeRemaining, rollResetTime) {
    const { gems, rollsInCurrentWindow, rollsSinceLastMythical, rollsSinceLastQuestionMark, rollsLeft } = userData;

    const embed = new EmbedBuilder()
        .setTitle('🎲 Event Gacha Status')
        .addFields([
            { name: 'Gems', value: formatNumber(gems), inline: true },
            { name: 'Rolls in Window', value: `${rollsInCurrentWindow || 0} / 50,000`, inline: true },
            { name: 'Window Reset', value: rollResetTime, inline: true },
            { 
                name: 'Pity', 
                value: `🟥 Mythical: ${rollsSinceLastMythical || 0} / ${PITY_THRESHOLDS.EVENT_MYTHICAL}\n` +
                    `❓ ???: ${rollsSinceLastQuestionMark || 0} / ${PITY_THRESHOLDS.EVENT_QUESTION}`, 
                inline: false 
            },
            { name: 'Event Time Left', value: eventTimeRemaining, inline: false },
            {
                name: '🎲 Your Current Chances',
                value: `🔮 EPIC - ${chances.epic.toFixed(4)}%\n` +
                    `🟨 LEGENDARY - ${chances.legendary.toFixed(4)}%\n` +
                    `🟥 MYTHICAL - ${chances.mythical.toFixed(4)}%\n` +
                    `❓ ??? - ${chances.question.toFixed(5)}%\n` +
                    `👑 TRANSCENDENT - ???%`
            }
        ])
        .setColor(Colors.Blue)
        .setFooter({ text: boosts.lines.join('\n') || 'No luck boost applied...' });

    return embed;
}

function createEventShopButtons(userId, rollLimitReached) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`eventbuy1fumo_${userId}`)
            .setLabel('Summon 1')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(rollLimitReached),
        new ButtonBuilder()
            .setCustomId(`eventbuy10fumos_${userId}`)
            .setLabel('Summon 10')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(rollLimitReached),
        new ButtonBuilder()
            .setCustomId(`eventbuy100fumos_${userId}`)
            .setLabel('Summon 100')
            .setStyle(ButtonStyle.Success)
            .setDisabled(rollLimitReached)
    );
}

function createEventResultEmbed(result, numSummons, rollsInCurrentWindow, rollResetTime) {
    const { fumoList, rollsSinceLastMythical, rollsSinceLastQuestionMark, boostText } = result;

    let description = '';

    if (numSummons === 1) {
        const fumo = fumoList[0];
        description = `You acquired a ${fumo.rarity === 'TRANSCENDENT' ? '👑' : ''}${fumo.name} from the exclusive Event Fumo Crate! 🎊🎉`;
    } else {
        const rarityOrder = ['EPIC', 'LEGENDARY', 'MYTHICAL', 'TRANSCENDENT', '???'];
        const grouped = fumoList.reduce((acc, fumo) => {
            if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
            acc[fumo.rarity][fumo.name] = (acc[fumo.rarity][fumo.name] || 0) + 1;
            return acc;
        }, {});

        for (const rarity of rarityOrder) {
            if (!grouped[rarity]) continue;
            const total = Object.values(grouped[rarity]).reduce((sum, count) => sum + count, 0);
            description += `**${rarity === 'TRANSCENDENT' ? '👑 ' : ''}${rarity} (x${total}):**\n`;
            for (const [name, count] of Object.entries(grouped[rarity])) {
                description += `- ${name} x${count}\n`;
            }
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(
            numSummons === 1 
                ? "🎉🎊 Woohoo! You've successfully unlocked a fantastic fumo! 🎊🎉"
                : `🎉🎊 You've successfully unlocked ${numSummons} fantastic fumos from the JJK's Fumo Crate! 🎊🎉`
        )
        .setDescription(description)
        .addFields([
            { 
                name: 'Mythical Pity', 
                value: `${rollsSinceLastMythical} / ${PITY_THRESHOLDS.EVENT_MYTHICAL}` 
            },
            { 
                name: '??? Pity', 
                value: `${rollsSinceLastQuestionMark} / ${PITY_THRESHOLDS.EVENT_QUESTION}` 
            },
            { 
                name: '🔄 Roll Limit', 
                value: `${rollsInCurrentWindow} / 50,000 rolls. ${rollResetTime} until reset.` 
            }
        ])
        .setFooter({ text: boostText });

    if (numSummons === 1 && fumoList[0]) {
        embed.setImage(fumoList[0].picture);
    }

    return embed;
}

function createContinueButton(userId, numSummons, rollLimitReached) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`continue${numSummons}_${userId}`)
            .setLabel('Continue')
            .setStyle(ButtonStyle.Success)
            .setDisabled(rollLimitReached)
    );
}

module.exports = {
    createEventShopEmbed,
    createEventStatusEmbed,
    createEventShopButtons,
    createEventResultEmbed,
    createContinueButton
};