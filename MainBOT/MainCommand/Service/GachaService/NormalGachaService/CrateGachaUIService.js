const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { SPECIAL_RARITIES, RARITY_PRIORITY, isRarer } = require('../../../Configuration/rarity');
const { formatNumber } = require('../../../Ultility/formatting');
const { getSanaeBoostDisplay, getTraitBoostDisplay, isSigilActive } = require('./BoostService');

async function createShopEmbed(userData, boosts, hasFantasyBook, isAutoRollActive, userId) {
    const { coins, boostCharge, boostActive, boostRollsRemaining, rollsLeft, totalRolls, luck } = userData;
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
        // Start with base luck multiplier
        const baseLuckMult = Math.max(1, 1 + (luck || 0));
        
        let boosted = baseChance * baseLuckMult * boosts.ancientLuckMultiplier *
            boosts.mysteriousLuckMultiplier *
            boosts.mysteriousDiceMultiplier *
            boosts.petBoost;

        // Apply Sanae direct luck multiplier
        if (boosts.sanaeTempLuckMultiplier > 1) {
            boosted *= boosts.sanaeTempLuckMultiplier;
        }

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
    const sigilActive = await isSigilActive(userId);
    
    // When S!gil is active, show S!gil luck boost and freeze other boosts
    if (sigilActive) {
        // S!gil provides its own luck multiplier - show it as "S!gil Luck Boost"
        if (boosts.sigilLuckMultiplier && boosts.sigilLuckMultiplier > 1) {
            ancientNoteLines.push(`🪄 S!gil Luck Boost active! Luck boosted by ${boosts.sigilLuckMultiplier.toFixed(2)}×`);
        }
        
        // Show frozen/disabled boosts
        if (boosts.ancientLuckMultiplier > 1) {
            ancientNoteLines.push(`❄️ ~~🎇 AncientRelic ${boosts.ancientLuckMultiplier}×~~ (FROZEN)`);
        }
        if (boosts.luminaActive) {
            ancientNoteLines.push(`❄️ ~~🌟 Lumina 5× every 10th roll~~ (FROZEN)`);
        }
        if (rollsLeft > 0 && !isBoostActive) {
            ancientNoteLines.push(`❄️ ~~🌸 Yuyuko's Blessing: ${formatNumber(rollsLeft)} bonus rolls~~ (FROZEN)`);
        }
        if (boosts.mysteriousLuckMultiplier && boosts.mysteriousLuckMultiplier > 1) {
            ancientNoteLines.push(`❄️ ~~🧊 MysteriousCube ${boosts.mysteriousLuckMultiplier.toFixed(2)}×~~ (FROZEN)`);
        }
        if (boosts.mysteriousDiceMultiplier && boosts.mysteriousDiceMultiplier !== 1) {
            ancientNoteLines.push(`❄️ ~~🎲 MysteriousDice ${boosts.mysteriousDiceMultiplier.toFixed(4)}×~~ (FROZEN)`);
        }
        if (boosts.petBoost && boosts.petBoost > 1) {
            ancientNoteLines.push(`❄️ ~~🐰 Pet boost ${boosts.petBoost.toFixed(4)}×~~ (FROZEN)`);
        }
        if (luck > 0) {
            ancientNoteLines.push(`❄️ ~~🍀 Base Luck +${(luck * 100).toFixed(1)}%~~ (FROZEN)`);
        }
        if (boosts.sanaeTempLuckMultiplier > 1) {
            ancientNoteLines.push(`❄️ ~~⛩️ SanaeBlessing ${boosts.sanaeTempLuckMultiplier}×~~ (FROZEN)`);
        }
        if (boosts.sanaeGlobalMultiplier > 1) {
            ancientNoteLines.push(`❄️ ~~✨ Sanae Blessing ${boosts.sanaeGlobalMultiplier}×~~ (FROZEN)`);
        }
    } else {
        // Normal display when S!gil is not active
        if (boosts.ancientLuckMultiplier > 1) {
            ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${boosts.ancientLuckMultiplier}×`);
        }
        if (boosts.luminaActive) {
            ancientNoteLines.push(`🌟 Lumina active! Every 10th roll grants 5× Luck`);
        }
        // Show Yuyuko bonus rolls with count (Divine Blessing from Pray)
        if (rollsLeft > 0 && !isBoostActive) {
            ancientNoteLines.push(`🌸 Yuyuko's Blessing: ${formatNumber(rollsLeft)} bonus rolls (2× luck)`);
        }
        if (boosts.mysteriousLuckMultiplier && boosts.mysteriousLuckMultiplier > 1) {
            ancientNoteLines.push(`🧊 MysteriousCube active! Luck boosted by ${boosts.mysteriousLuckMultiplier.toFixed(2)}×`);
        }
        if (boosts.mysteriousDiceMultiplier && boosts.mysteriousDiceMultiplier !== 1) {
            ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${boosts.mysteriousDiceMultiplier.toFixed(4)}× (random per hour)`);
        }
        if (boosts.petBoost && boosts.petBoost > 1) {
            ancientNoteLines.push(`🐰 Pet boost active! Luck boosted by ${boosts.petBoost.toFixed(4)}×`);
        }
        if (luck > 0) {
            ancientNoteLines.push(`🍀 Base Luck: +${(luck * 100).toFixed(1)}% (permanent)`);
        }
        // Sanae direct luck multiplier (x10, etc.)
        if (boosts.sanaeTempLuckMultiplier > 1) {
            ancientNoteLines.push(`⛩️ SanaeBlessing active! Luck boosted by ${boosts.sanaeTempLuckMultiplier}×`);
        }
        // Sanae global boost multiplier (x5 all boosts)
        if (boosts.sanaeGlobalMultiplier > 1) {
            ancientNoteLines.push(`✨ Sanae Blessing: All boosts multiplied by ${boosts.sanaeGlobalMultiplier}×`);
        }
    }

    // Build Sanae blessing text for footer (show as frozen when S!gil is active)
    const sanaeBoosts = getSanaeBoostDisplay(boosts);
    if (sanaeBoosts.length > 0) {
        ancientNoteLines.push(''); // Empty line separator
        if (sigilActive) {
            ancientNoteLines.push('❄️ ~~⛩️ Sanae Blessings~~ (FROZEN):');
            sanaeBoosts.forEach(boost => ancientNoteLines.push(`  ~~${boost}~~`));
        } else {
            ancientNoteLines.push('⛩️ Sanae Blessings Active:');
            sanaeBoosts.forEach(boost => ancientNoteLines.push(`  ${boost}`));
        }
    }

    // Build VOID/GLITCHED trait boosts for footer
    const traitBoosts = userId ? await getTraitBoostDisplay(userId) : [];
    if (traitBoosts.length > 0) {
        ancientNoteLines.push(''); // Empty line separator
        ancientNoteLines.push('🌌 Special Traits Active:');
        traitBoosts.forEach(trait => ancientNoteLines.push(`  ${trait}`));
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
        .setImage('https://media1.tenor.com/m/61n1xggC5tEAAAAd/gift-present.gif')
        .setColor(hasRareFumo ? Colors.Gold : Colors.White);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    setTimeout(async () => {
        embed.setImage('https://media1.tenor.com/m/K6j0cFLkHhcAAAAC/gift-surprise.gif');
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
    // Safety check for empty results
    if (!fumosBought || fumosBought.length === 0 || !bestFumo) {
        const errorMsg = '❌ No fumos were obtained. This might be a storage or pool issue.';
        if (interaction.deferred) {
            return await interaction.editReply({ content: errorMsg });
        }
        return await interaction.reply({ content: errorMsg, ephemeral: true });
    }
    
    const isRareCutscene = isRarer(bestFumo.rarity, 'LEGENDARY');
    const embedColor = rollCount === 10 ? Colors.Yellow : Colors.Gold;

    const embed = new EmbedBuilder()
        .setTitle(`🌟💫 Opening the ${rollCount === 10 ? 'Golden' : 'Legendary'} Fumo Box... 💫🌟`)
        .setImage(rollCount === 10
            ? 'https://png.pngtree.com/png-vector/20231102/ourmid/pngtree-beautiful-golden-box-christmas-gift-with-golden-ribbon-on-dark-png-image_10359902.png'
            : 'https://media.sketchfab.com/models/5a78675f36934f67a3cf55f49c7d56ad/thumbnails/358aef2210684655bf67f05a1619a56b/d4f173afe2874179824dd92709f3e36d.jpeg')
        .setColor(embedColor);

    // Handle deferred vs non-deferred interactions
    if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    setTimeout(async () => {
        embed.setImage(rollCount === 10
            ? 'https://img.freepik.com/premium-vector/open-golden-gift-box-gold-confetti_302982-1365.jpg'
            : 'https://slm-assets.secondlife.com/assets/13000381/view_large/xmas_box_open.jpg?1450370805');
        await interaction.editReply({ embeds: [embed] });

        setTimeout(async () => {
            embed.setTitle(isRareCutscene
                ? "✨ A sudden burst of radiance... An extraordinary spectacle indeed! ✨"
                : `🎁 The ${rollCount === 10 ? 'golden box' : 'treasure chest'} reveals...`)
                .setImage(isRareCutscene
                    ? 'https://img.freepik.com/premium-vector/christmas-background-with-open-golden-box-with-confetti_272787-610.jpg?w=740'
                    : 'https://progameguides.com/wp-content/uploads/2022/01/featured-pokemon-legends-arceus-mystery-gift.jpg?w=900');
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

    // Add Sanae blessing info if used
    let sanaeText = '';
    if (summary.sanaeGuaranteedUsed > 0) {
        sanaeText = `\n⛩️ **Sanae Guaranteed Used:** \`${summary.sanaeGuaranteedUsed}\``;
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
    sanaeText,
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