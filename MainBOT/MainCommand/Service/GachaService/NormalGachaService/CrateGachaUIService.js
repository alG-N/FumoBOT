const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { SPECIAL_RARITIES, RARITY_PRIORITY, isRarer } = require('../../../Configuration/rarity');
const { formatNumber } = require('../../../Ultility/formatting');

function createShopEmbed(userData, boosts, hasFantasyBook, isAutoRollActive) {
    const { coins, boostCharge, boostActive, boostRollsRemaining, rollsLeft, totalRolls } = userData;
    const { pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral } = userData;

    const baseChances = [
        { label: '👑 **TRANSCENDENT**', base: 0.0000667, gated: true },
        { label: '🌟 **ETERNAL**', base: 0.0002, gated: true },
        { label: '✨ **INFINITE**', base: 0.0005, gated: true },
        { label: '☀️ **CELESTIAL**', base: 0.001111, gated: true },
        { label: '🌙 **ASTRAL**', base: 0.003333, gated: true },
        { label: '❓ **???**', base: 0.006666 },
        { label: '🎁 **EXCLUSIVE**', base: 0.02 },
        { label: '🦄 **MYTHICAL**', base: 0.1 },
        { label: '🌈 **LEGENDARY**', base: 0.4 },
        { label: '👽 **OTHERWORLDLY**', base: 1.0, gated: true },
        { label: '🔮 **EPIC**', base: 6.0 },
        { label: '💎 **RARE**', base: 10.0 },
        { label: '💠 **UNCOMMON**', base: 25.0 },
        { label: '⚪ **Common**', base: 57.4681233 },
    ];

    const isBoostActive = boostActive && boostRollsRemaining > 0;

    function applyBoosts(baseChance) {
        let boosted = baseChance * boosts.ancientLuckMultiplier *
            boosts.mysteriousLuckMultiplier *
            boosts.mysteriousDiceMultiplier *
            boosts.petBoost;

        if (isBoostActive) {
            boosted *= 25;
        } else if (rollsLeft > 0) {
            boosted *= 2;
        }

        if (boosts.luminaActive && totalRolls % 10 === 0) {
            boosted *= 5;
        }

        return boosted;
    }

    function obscureChance(boosted) {
        if (boosted >= 0.1) return null;
        const zeros = boosted.toExponential().split('e-')[1];
        const level = parseInt(zeros) || 2;
        return '?'.repeat(level) + '%';
    }

    const shownRarityChances = [];
    const shownUnknownChances = [];

    baseChances.forEach(({ label, base, gated }) => {
        if (gated && !hasFantasyBook) return;

        let boosted = applyBoosts(base);
        const obscured = obscureChance(boosted);

        if (obscured) {
            shownUnknownChances.push(`${label} — ${obscured}`);
            return;
        }

        if (boosted > 100) boosted = 100;
        const display = boosted >= 100 ? `${label} — 100.00% 🔥` : `${label} — ${boosted.toFixed(2)}%`;
        (base >= 1 ? shownRarityChances : shownUnknownChances).push(display);
    });

    const rarityChances = shownRarityChances.join('\n');
    const unknownChances = shownUnknownChances.join('\n');

    const ancientNoteLines = [];
    if (boosts.ancientLuckMultiplier > 1) {
        ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${boosts.ancientLuckMultiplier}×`);
    }
    if (boosts.luminaActive) {
        ancientNoteLines.push(`🌟 Lumina active! Every 10th roll grants 5× Luck`);
    }
    if (rollsLeft > 0 && !isBoostActive) {
        ancientNoteLines.push(`✨ Bonus Roll active! Luck boosted by 2×`);
    }
    if (boosts.mysteriousLuckMultiplier > 1) {
        ancientNoteLines.push(`🧊 MysteriousCube active! Luck boosted by ${boosts.mysteriousLuckMultiplier.toFixed(2)}×`);
    }
    if (boosts.mysteriousDiceMultiplier !== 1) {
        ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${boosts.mysteriousDiceMultiplier.toFixed(4)}× (random per hour)`);
    }
    if (boosts.petBoost > 1) {
        ancientNoteLines.push(`🐰 Pet boost active! Luck boosted by ${boosts.petBoost.toFixed(4)}×`);
    }
    const ancientNote = ancientNoteLines.length > 0 ? ancientNoteLines.join('\n') : 'No luck boost applied...';

    const pitySection =
        `Each roll charges the mysterious **Boost**. At maximum charge, reality fractures and fate itself is rewritten...\n\n` +
        (boostActive
            ? `🔥 **BOOSTED MODE ACTIVE**\n➡️ Rolls Remaining: \`${boostRollsRemaining} / 250\`\n⚠️ Each roll costs **1 Energy**!\n\n`
            : `⚡ **Boost Charge**: \`${boostCharge} / 1,000\`\n`) +
        (hasFantasyBook ? `**🌙 Astral Pity**        → \`${pityAstral.toLocaleString()} / 30,000\`\n` : '') +
        (hasFantasyBook ? `**☀️ Celestial Pity**     → \`${pityCelestial.toLocaleString()} / 90,000\`\n` : '') +
        (hasFantasyBook ? `**✨ Infinite Pity**      → \`${pityInfinite.toLocaleString()} / 200,000\`\n` : '') +
        (hasFantasyBook ? `**🌟 Eternal Pity**       → \`${pityEternal.toLocaleString()} / 500,000\`\n` : '') +
        (hasFantasyBook ? `**👑 Transcendent Pity**  → \`${pityTranscendent.toLocaleString()} / 1,500,000\`` : '');

    const embed = new EmbedBuilder()
        .setTitle('🎉 Welcome to alterGolden\'s Fumo Crate Shop! 🎉')
        .setDescription(
            `👋 Hey there! I'm **alterGolden**, your friendly Fumo dealer, bringing you the mysterious and magical **Fumo Boxes**!  
✨ *"What's inside?"* you ask? — "**Fumo**, of course!"  
Take a chance—who knows what you'll get?

💰 **You currently have ${formatNumber(coins)} coins!**  
🎲 Each summon costs **100 coins** — choose wisely, and may luck be on your side!`
        )
        .addFields([
            { name: '🌈 Rarity Chances', value: rarityChances, inline: true },
            { name: '❓ Rare Chances:', value: unknownChances, inline: true },
            { name: '🌌 Booster/Pity Status:', value: pitySection, inline: false }
        ])
        .setColor(Colors.Blue)
        .setImage('https://pbs.twimg.com/media/EkXjV4sU0AIwSr5.png')
        .setFooter({ text: ancientNote });

    return embed;
}

function createShopButtons(userId, isAutoRollActive) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`buy1fumo_${userId}`)
            .setLabel('Summon 1')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`buy10fumos_${userId}`)
            .setLabel('Summon 10')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`buy100fumos_${userId}`)
            .setLabel('Summon 100')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(isAutoRollActive ? `stopAuto50_${userId}` : `autoRoll50_${userId}`)
            .setLabel(isAutoRollActive ? '🛑 Stop Auto 100' : 'Auto Roll 100')
            .setStyle(isAutoRollActive ? ButtonStyle.Danger : ButtonStyle.Success)
    );
}

async function displaySingleRollAnimation(interaction, fumo, rarity) {
    const hasRareFumo = SPECIAL_RARITIES.includes(rarity);
    
    const embed = new EmbedBuilder()
        .setTitle('🎁 Unleashing an extraordinary surprise box just for you... ✨-golden-✨')
        .setImage('https://img.freepik.com/premium-photo/gift-box-present-isolated_63260-45.jpg')
        .setColor(hasRareFumo ? Colors.Gold : Colors.White);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    setTimeout(async () => {
        embed.setImage('https://www.shutterstock.com/image-illustration/open-gift-box-3d-illustration-260nw-275157815.jpg');
        await interaction.editReply({ embeds: [embed] });

        setTimeout(async () => {
            if (hasRareFumo) embed.setTitle("💫 A radiant sparkle amidst the ordinary...?");
            embed.setImage(fumo.picture);
            await interaction.editReply({ embeds: [embed] });

            setTimeout(async () => {
                embed.setTitle(`🎉 Congrats! You've unlocked a ${fumo.name.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim()} from alterGolden's Common Fumo Box.`)
                    .setColor(hasRareFumo ? Colors.Gold : Colors.White);
                await interaction.editReply({ embeds: [embed] });
            }, 2000);
        }, 2000);
    }, 2000);
}

async function displayMultiRollResults(interaction, fumosBought, bestFumo, rollCount) {
    const isRareCutscene = isRarer(bestFumo.rarity, 'LEGENDARY');
    const embedColor = rollCount === 10 ? Colors.Yellow : Colors.Gold;

    const embed = new EmbedBuilder()
        .setTitle(`🌟💫 Opening the ${rollCount === 10 ? 'Golden' : 'Legendary'} Fumo Box... 💫🌟`)
        .setImage(rollCount === 10
            ? 'https://5.imimg.com/data5/HH/SX/MY-6137980/golden-gift-box-500x500.jpg'
            : 'https://media.istockphoto.com/id/610990634/photo/businessman-looking-at-huge-present.jpg?s=612x612&w=0&k=20&c=blc7bjEGc8pbmfYKnmqw7g5jp32rMTDAI5y5W9Z4ZOo=')
        .setColor(embedColor);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    setTimeout(async () => {
        embed.setImage(rollCount === 10
            ? 'https://img.freepik.com/premium-vector/open-golden-gift-box-gold-confetti_302982-1365.jpg'
            : 'https://media.istockphoto.com/id/494384016/photo/young-men-coming-up-from-a-big-box.jpg?s=612x612&w=0&k=20&c=LkQMIrS-CNqNARtscgK-lmijIt8ZyT4UFB9fqigSM1I=');
        await interaction.editReply({ embeds: [embed] });

        setTimeout(async () => {
            embed.setTitle(isRareCutscene
                ? "✨ A sudden burst of radiance... An extraordinary spectacle indeed! ✨"
                : `🎁 The ${rollCount === 10 ? 'golden box' : 'treasure chest'} reveals...`)
                .setImage(isRareCutscene
                    ? (rollCount === 10
                        ? 'https://previews.123rf.com/images/baks/baks1412/baks141200006/34220442-christmas-background-with-open-golden-box-with-stars-and-confetti.jpg'
                        : 'https://media.istockphoto.com/id/579738794/vector/open-gift-box-with-shiny-light.jpg?s=1024x1024&w=is&k=20&c=573dQ-4CGCMwQcKaha-zbqCBJrgj7cAf_cwNeBSHyoI=')
                    : (rollCount === 10
                        ? 'https://media.istockphoto.com/id/865744872/photo/golden-glowing-box-of-light.jpg?s=612x612&w=0&k=20&c=14_RsYdmgE8OLV70elc3sLQRuuK3i_IYA0M5aGPiTtA='
                        : 'https://boxfox.com.au/cdn/shop/products/Large_gift_box_-_Red_lid_open_2DC_2623_800x.jpg?v=1556515906'));
            await interaction.editReply({ embeds: [embed] });

            setTimeout(async () => {
                const fumoCounts = fumosBought.reduce((acc, fumo) => {
                    if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
                    const cleanName = fumo.name.replace(/\(.*?\)/g, '').trim();
                    acc[fumo.rarity][cleanName] = (acc[fumo.rarity][cleanName] || 0) + 1;
                    return acc;
                }, {});

                const sortedRarities = Object.keys(fumoCounts).sort((a, b) =>
                    RARITY_PRIORITY.indexOf(b.toUpperCase()) - RARITY_PRIORITY.indexOf(a.toUpperCase())
                );

                const fumoList = sortedRarities.map(rarity => {
                    const entries = Object.entries(fumoCounts[rarity])
                        .map(([name, count]) => `${name} (x${count})`);
                    const totalCount = Object.values(fumoCounts[rarity]).reduce((sum, count) => sum + count, 0);
                    return `**${rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()} (x${totalCount}):**\n${entries.join(', ')}`;
                }).join('\n\n');

                embed.setTitle(`🎉 You've unlocked ${rollCount} fumos!`)
                    .setDescription(`${fumoList}\n\n**Best fumo:** ${bestFumo.name}`)
                    .setColor(isRareCutscene ? Colors.Gold : Colors.White);

                await interaction.editReply({ embeds: [embed] });
            }, 2000);
        }, 2000);
    }, 2000);
}

function createAutoRollSummary(summary, userId) {
    const { updateSummaryWithNotificationButton } = require('../NotificationButtonsService');
    
    if (!summary) {
        throw new Error('Summary object is null or undefined');
    }
    
    let bestFumoText = 'None (N/A)';
    let bestFumoImage = null;

    if (summary.bestFumo && summary.bestFumo.name) {
        let suffix = '';
        if (summary.bestFumo.name.includes('[🌟alG]')) suffix = ' [🌟alG]';
        else if (summary.bestFumo.name.includes('[✨SHINY]')) suffix = ' [✨SHINY]';

        const cleanName = summary.bestFumo.name.replace(/\s*\(.*?\)$/, '').replace(/\[.*?\]/g, '').trim();
        bestFumoText = `🏆 Best Fumo: ${cleanName} (${summary.bestFumo.rarity || 'Unknown'})${suffix}\n`;

        if (summary.bestFumoRoll && summary.bestFumoAt) {
            bestFumoText += `🕒 Obtained at roll #${summary.bestFumoRoll}, at ${summary.bestFumoAt}`;
        }

        bestFumoImage = summary.bestFumo.picture || null;
    }

    let specialText = '';
    if (summary.specialFumoCount && summary.specialFumoCount > 0) {
        specialText = `\n__**Special Fumos (EXCLUSIVE+):**__\nTotal: \`${summary.specialFumoCount}\``;
        if (summary.specialFumoFirstAt && summary.specialFumoFirstRoll) {
            specialText += `\nFirst obtained at batch #${summary.specialFumoFirstRoll}, ${summary.specialFumoFirstAt}`;
        }
    }

    const rollCount = summary.rollCount || 0;
    const coinsSpent = rollCount * 10000;
    
    let stopReasonText = '';
    if (summary.stoppedReason === 'STORAGE_LIMIT_REACHED') {
        stopReasonText = '\n\n🛑 **Stopped:** Storage limit reached (100,000 fumos)\n⚠️ Please sell some fumos to continue rolling!';
    } else if (summary.stoppedReason === 'STORAGE_FULL') {
        stopReasonText = '\n\n🛑 **Stopped:** Storage is full\n💡 **Tip:** Enable auto-sell next time to continue automatically!';
    }
    
    const statsField = [
        `🎲 **Total Rolls:** \`${(rollCount * 100).toLocaleString()}\``,
        `💸 **Coins Spent:** \`${coinsSpent.toLocaleString()}\``,
        bestFumoText,
        specialText,
        stopReasonText
    ].filter(Boolean).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('🛑 Auto Roll Stopped!')
        .setDescription('Your auto roll was stopped manually.\n\nHere\'s a summary of your session: ')
        .addFields([{ name: '📊 Results', value: statsField }])
        .setColor(0xcc3300)
        .setFooter({ text: 'Auto Roll Summary' })
        .setTimestamp();

    if (bestFumoImage) embed.setImage(bestFumoImage);

    if (summary.bestFumo && SPECIAL_RARITIES.includes(summary.bestFumo.rarity)) {
        embed.setThumbnail('https://cdn.pixabay.com/photo/2017/01/31/13/14/confetti-2024631_1280.png');
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`autoRoll50_${userId}`)
            .setLabel('🔄 Restart Auto Roll')
            .setStyle(ButtonStyle.Success)
    );

    let components = [row];
    components = updateSummaryWithNotificationButton(components, userId, 'normal');

    return { embed, components };
}

module.exports = {
    createShopEmbed,
    createShopButtons,
    displaySingleRollAnimation,
    displayMultiRollResults,
    createAutoRollSummary
};