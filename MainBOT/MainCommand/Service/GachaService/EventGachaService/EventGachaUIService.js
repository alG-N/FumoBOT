const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { PITY_THRESHOLDS } = require('../../../Configuration/rarity');
const { EVENT_ROLL_LIMIT } = require('../../../Configuration/eventConfig');

function createEventShopEmbed(userData, boosts, chances, eventTimeRemaining) {
    const { gems, rollsInCurrentWindow, rollsSinceLastQuestionMark, rollsLeft } = userData;

    // Build boost lines with Sanae information
    const boostLines = [...(boosts.lines || [])];
    
    // Add Yuyuko rolls if present (Divine Blessing from Pray)
    if (rollsLeft > 0) {
        boostLines.unshift(`🌸 Yuyuko's Blessing: ${formatNumber(rollsLeft)} bonus rolls (2× luck)`);
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🎍 New Year 2026 Fumo Banner! 🎍')
        .setDescription(
            `💎 You're sitting on a treasure of ${formatNumber(gems)} gems. ` +
            `Celebrate the New Year with exclusive fumos! Each summon is just 100 gems for 1 festive fumo.`
        )
        .addFields([
            {
                name: '🌟 Rarity Chances 🌟',
                value: `Step right up and test your luck! Here are the odds for each rarity (with your luck applied):\n` +
                    `⚪ Common - ${chances.common.toFixed(2)}%\n` +
                    `🟢 Uncommon - ${chances.uncommon.toFixed(2)}%\n` +
                    `🔵 Rare - ${chances.rare.toFixed(2)}%\n` +
                    `❓ ??? - ${chances.question.toFixed(4)}%\n` +
                    `👑 Transcendent - 1 in ???`
            },
            { 
                name: '⏳ Time Left', 
                value: eventTimeRemaining, 
                inline: true 
            },
            { 
                name: '🔄 Roll Limit', 
                value: `${rollsInCurrentWindow} / ${EVENT_ROLL_LIMIT} rolls`, 
                inline: true 
            },
            { 
                name: '❓ ??? Pity', 
                value: `${rollsSinceLastQuestionMark || 0} / ${PITY_THRESHOLDS.EVENT_QUESTION}`, 
                inline: false 
            }
        ])
        .setColor(Colors.Gold)
        .setImage('https://media.discordapp.net/attachments/1454788676549742613/1454800657335980175/image.png?ex=69526831&is=695116b1&hm=4d46f9b88c0aa41e4f117fa9d7fd1906cb87123dbb4fb0bc8ed2523dea90f12e&=&format=webp&quality=lossless&width=949&height=536')
        .setFooter({ text: boostLines.join('\n') || 'No luck boost applied...' });

    return embed;
}

function createEventStatusEmbed(userData, boosts, chances, eventTimeRemaining, rollResetTime) {
    const { gems, rollsInCurrentWindow, rollsSinceLastQuestionMark, rollsLeft } = userData;

    const embed = new EmbedBuilder()
        .setTitle('🎍 New Year 2026 Event Status')
        .addFields([
            { name: 'Gems', value: formatNumber(gems), inline: true },
            { name: 'Rolls in Window', value: `${rollsInCurrentWindow || 0} / ${EVENT_ROLL_LIMIT}`, inline: true },
            { name: 'Window Reset', value: rollResetTime, inline: true },
            { 
                name: 'Pity', 
                value: `❓ ???: ${rollsSinceLastQuestionMark || 0} / ${PITY_THRESHOLDS.EVENT_QUESTION}`, 
                inline: false 
            },
            { name: 'Event Time Left', value: eventTimeRemaining, inline: false },
            {
                name: '🎲 Your Current Chances',
                value: `⚪ Common - ${chances.common.toFixed(2)}%\n` +
                    `🟢 Uncommon - ${chances.uncommon.toFixed(2)}%\n` +
                    `🔵 Rare - ${chances.rare.toFixed(2)}%\n` +
                    `❓ ??? - ${chances.question.toFixed(4)}%\n` +
                    `👑 Transcendent - 1 in ???`
            }
        ])
        .setColor(Colors.Gold)
        .setFooter({ text: boosts.lines.join('\n') || 'No luck boost applied...' });

    return embed;
}

function createEventShopButtons(userId, rollLimitReached, isAutoRollActive = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`eventbuy1fumo_${userId}`)
            .setLabel('Summon 1')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(rollLimitReached || isAutoRollActive),
        new ButtonBuilder()
            .setCustomId(`eventbuy10fumos_${userId}`)
            .setLabel('Summon 10')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(rollLimitReached || isAutoRollActive),
        new ButtonBuilder()
            .setCustomId(`eventbuy100fumos_${userId}`)
            .setLabel('Summon 100')
            .setStyle(ButtonStyle.Success)
            .setDisabled(rollLimitReached || isAutoRollActive),
        new ButtonBuilder()
            .setCustomId(isAutoRollActive ? `stopEventAuto_${userId}` : `startEventAuto_${userId}`)
            .setLabel(isAutoRollActive ? '🛑 Stop Auto' : '🤖 Auto Roll')
            .setStyle(isAutoRollActive ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(rollLimitReached && !isAutoRollActive)
    );
}

function createEventResultEmbed(result, numSummons, rollsInCurrentWindow, rollResetTime) {
    const { fumoList, rollsSinceLastQuestionMark, boostText } = result;

    let description = '';

    if (numSummons === 1) {
        const fumo = fumoList[0];
        description = `You acquired a ${fumo.rarity === 'TRANSCENDENT' ? '👑' : ''}${fumo.name} from the New Year Fumo Banner! 🎍🎊`;
    } else {
        // Use UPPERCASE rarities to match what selectEventRarity returns
        const rarityOrder = ['Common', 'UNCOMMON', 'RARE', '???', 'TRANSCENDENT'];
        const grouped = fumoList.reduce((acc, fumo) => {
            if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
            acc[fumo.rarity][fumo.name] = (acc[fumo.rarity][fumo.name] || 0) + 1;
            return acc;
        }, {});

        for (const rarity of rarityOrder) {
            if (!grouped[rarity]) continue;
            const total = Object.values(grouped[rarity]).reduce((sum, count) => sum + count, 0);
            const icon = rarity === 'TRANSCENDENT' ? '👑 ' : rarity === '???' ? '❓ ' : '';
            description += `**${icon}${rarity} (x${total}):**\n`;
            for (const [name, count] of Object.entries(grouped[rarity])) {
                description += `- ${name} x${count}\n`;
            }
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(
            numSummons === 1 
                ? "🎍🎊 Happy New Year! You've unlocked a festive fumo! 🎊🎍"
                : `🎍🎊 You've unlocked ${numSummons} festive fumos from the New Year Banner! 🎊🎍`
        )
        .setDescription(description)
        .addFields([
            { 
                name: '❓ ??? Pity', 
                value: `${rollsSinceLastQuestionMark} / ${PITY_THRESHOLDS.EVENT_QUESTION}` 
            },
            { 
                name: '🔄 Roll Limit', 
                value: `${rollsInCurrentWindow} / ${EVENT_ROLL_LIMIT} rolls. ${rollResetTime} until reset.` 
            }
        ])
        .setColor(Colors.Gold)
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

function createEventAutoRollSummary(summary, userId) {
    const { updateSummaryWithNotificationButton } = require('../NotificationButtonsService');
    
    // Updated rarity order for New Year banner
    const rarityOrder = ['TRANSCENDENT', '???', 'RARE', 'UNCOMMON', 'Common'];
    
    let bestFumoText = 'None';
    let bestFumoImage = null;

    if (summary.bestFumo) {
        let suffix = '';
        if (summary.bestFumo.name?.includes('[🌟alG]')) suffix = ' [🌟alG]';
        else if (summary.bestFumo.name?.includes('[✨SHINY]')) suffix = ' [✨SHINY]';

        const cleanName = summary.bestFumo.name?.replace(/\s*\(.*?\)$/, '').replace(/\[.*?\]/g, '').trim();
        bestFumoText = `🏆 Best: ${cleanName} (${summary.bestFumo.rarity})${suffix}`;

        if (summary.bestFumoRoll && summary.bestFumoAt) {
            bestFumoText += `\n🕒 Batch #${summary.bestFumoRoll}, at ${summary.bestFumoAt}`;
        }

        bestFumoImage = summary.bestFumo.picture || null;
    }

    const fumoSummary = {};
    (summary.specialFumos || []).forEach(f => {
        if (!fumoSummary[f.rarity]) fumoSummary[f.rarity] = [];
        fumoSummary[f.rarity].push(f);
    });

    // Only show special rarities (??? and Transcendent for New Year banner)
    const specialRarities = ['TRANSCENDENT', '???'];
    const summaryLines = specialRarities.map(rarity => {
        const arr = fumoSummary[rarity] || [];
        if (arr.length === 0) return `**${rarity}:** None`;
        
        arr.sort((a, b) => a.roll - b.roll);
        const first = arr[0];
        return `**${rarity}:** \`${arr.length}\` (first: Batch #${first.roll})`;
    });

    const gemsSpent = summary.totalFumosRolled * 100;
    const stopReason = summary.stoppedReason === 'LIMIT_REACHED' 
        ? '⚠️ Stopped: Roll limit reached (50,000)'
        : summary.stoppedReason === 'INSUFFICIENT_GEMS'
        ? '⚠️ Stopped: Ran out of gems'
        : summary.stoppedReason === 'ERROR'
        ? '⚠️ Stopped: Error occurred'
        : summary.stoppedReason === 'EVENT_ENDED'
        ? '⚠️ Stopped: Event ended'
        : '✅ Stopped: Manual stop';

    // Add Sanae blessing info if used
    let sanaeText = '';
    if (summary.sanaeGuaranteedUsed > 0) {
        sanaeText = `\n⛩️ **Sanae Guaranteed Used:** \`${summary.sanaeGuaranteedUsed}\``;
    }

    const statsField = [
        `🎲 **Total Batches:** \`${summary.rollCount}\``,
        `🎰 **Total Fumos:** \`${summary.totalFumosRolled.toLocaleString()}\``,
        `💎 **Gems Spent:** \`${gemsSpent.toLocaleString()}\``,
        bestFumoText,
        sanaeText,
        `\n${stopReason}\n`,
        `\n__**Special Fumos Obtained:**__\n${summaryLines.join('\n')}`
    ].filter(Boolean).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('🛑 New Year Event Auto Roll Stopped!')
        .setDescription('Your event auto roll session has ended.\n\nHere\'s your summary:')
        .addFields([{ name: '📊 Results', value: statsField }])
        .setColor(summary.stoppedReason === 'LIMIT_REACHED' ? 0xFFA500 : 0xCC3300)
        .setFooter({ text: 'New Year 2026 Event Auto Roll Summary' })
        .setTimestamp();

    if (bestFumoImage) embed.setImage(bestFumoImage);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`startEventAuto_${userId}`)
            .setLabel('🔄 Restart Auto Roll')
            .setStyle(ButtonStyle.Success)
            .setDisabled(summary.stoppedReason === 'LIMIT_REACHED')
    );

    let components = [row];
    components = updateSummaryWithNotificationButton(components, userId, 'event');

    return { embed, components };
}

module.exports = {
    createEventShopEmbed,
    createEventStatusEmbed,
    createEventShopButtons,
    createEventResultEmbed,
    createContinueButton,
    createEventAutoRollSummary
};