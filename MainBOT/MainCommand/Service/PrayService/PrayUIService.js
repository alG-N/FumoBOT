const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRarityColor, getRarityEmoji, PRAY_CHARACTERS } = require('../../Configuration/prayConfig');

function createRitualWelcomeEmbed(hasBasicShards, hasEnhancedShards) {
    const embed = new EmbedBuilder()
        .setTitle('🔮 Welcome to the Prayer Ritual 🔮')
        .setDescription(
            '**You stand before the sacred altar...**\n\n' +
            'The ancient ritual requires offerings to summon a character. Choose your path:\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '**📿 Basic Prayer Requirements:**\n' +
            '• 1x Prayer Ticket (Required)\n' +
            '• 1x RedShard(L) 🔴\n' +
            '• 1x BlueShard(L) 🔵\n' +
            '• 1x YellowShard(L) 🟡\n' +
            '• 1x WhiteShard(L) ⚪\n' +
            '• 1x DarkShard(L) ⚫\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '**✨ Enhanced Prayer Requirements:**\n' +
            '• All Basic Prayer items\n' +
            '• 1x DivineOrb(D) 🌟\n' +
            '• 5x CelestialEssence(D) ✨\n' +
            '• **Bonus:** Significantly increased rare character chances!\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '**🎲 Character Rarity Distribution:**\n' +
            getCharacterRarityInfo(false) + '\n\n' +
            '**💫 Enhanced Mode Boost:**\n' +
            getCharacterRarityInfo(true) + '\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        )
        .setColor(hasEnhancedShards ? '#FFD700' : '#9b59b6')
        .addFields(
            {
                name: '📦 Your Status',
                value: `${hasBasicShards ? '✅ Basic Shards Available' : '❌ Missing Basic Shards'}\n` +
                       `${hasEnhancedShards ? '✨ Enhanced Prayer Unlocked!' : '🔒 Enhanced Prayer Locked'}`,
                inline: false
            }
        )
        .setFooter({ text: 'Choose wisely... The ritual awaits your decision.' })
        .setTimestamp();

    return embed;
}

function getCharacterRarityInfo(enhanced = false) {
    const characters = Object.values(PRAY_CHARACTERS);
    const totalWeight = characters.reduce((sum, char) => 
        sum + (enhanced ? char.enhancedWeight : char.weight), 0
    );

    let info = '';
    
    // Sort by rarity weight (descending)
    const sorted = [...characters].sort((a, b) => {
        const weightA = enhanced ? a.enhancedWeight : a.weight;
        const weightB = enhanced ? b.enhancedWeight : b.weight;
        return weightB - weightA;
    });

    sorted.forEach(char => {
        const weight = enhanced ? char.enhancedWeight : char.weight;
        const chance = ((weight / totalWeight) * 100).toFixed(2);
        const emoji = getRarityEmoji(char.rarity);
        const bars = '█'.repeat(Math.ceil(weight / 5));
        info += `${emoji} **${char.name}** (${char.rarity}): ${chance}% ${bars}\n`;
    });

    return info;
}

function createPrayButtons(userId, hasBasicShards, hasEnhancedShards) {
    const basicButton = new ButtonBuilder()
        .setCustomId(`pray_basic_${userId}`)
        .setLabel('Basic Prayer')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🙏')
        .setDisabled(!hasBasicShards);

    const enhancedButton = new ButtonBuilder()
        .setCustomId(`pray_enhanced_${userId}`)
        .setLabel('Enhanced Prayer')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✨')
        .setDisabled(!hasEnhancedShards);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`pray_cancel_${userId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

    return new ActionRowBuilder().addComponents(basicButton, enhancedButton, cancelButton);
}

function createCharacterEmbed(character, enhancedMode = false) {
    const rarityEmoji = getRarityEmoji(character.rarity);
    const rarityColor = getRarityColor(character.rarity);

    // Calculate approximate chances for this character
    const characters = Object.values(PRAY_CHARACTERS);
    const totalWeight = characters.reduce((sum, char) => 
        sum + (enhancedMode ? char.enhancedWeight : char.weight), 0
    );
    const charWeight = enhancedMode ? character.enhancedWeight : character.weight;
    const chance = ((charWeight / totalWeight) * 100).toFixed(2);

    const embed = new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${character.name} Answers Your Call! ${rarityEmoji}`)
        .setDescription(
            `${enhancedMode ? '✨ **Enhanced Prayer** - The ritual was strengthened!\n\n' : ''}` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Character:** ${character.name}\n` +
            `**Rarity:** ${character.rarity} ${rarityEmoji}\n` +
            `**Summon Chance:** ${chance}%\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${character.description}\n\n` +
            `The character materializes before you with an otherworldly presence...\n` +
            `**Will you accept their offer?**`
        )
        .setImage(character.picture)
        .setColor(rarityColor)
        .setFooter({ 
            text: `Character Rarity: ${character.rarity}${enhancedMode ? ' | Enhanced Prayer Active' : ''} | Luck Favors the Bold`
        })
        .setTimestamp();

    return embed;
}

function createActionButtons(characterId, userId) {
    const acceptButton = new ButtonBuilder()
        .setCustomId(`pray_accept_${characterId}_${userId}`)
        .setLabel('Accept Offer')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

    const declineButton = new ButtonBuilder()
        .setCustomId(`pray_decline_${characterId}_${userId}`)
        .setLabel('Decline Offer')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

    const infoButton = new ButtonBuilder()
        .setCustomId(`pray_info_${characterId}_${userId}`)
        .setLabel('View Details')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('ℹ️');

    return new ActionRowBuilder().addComponents(acceptButton, declineButton, infoButton);
}

function disableButtons(row) {
    const components = row.components.map(button => 
        ButtonBuilder.from(button).setDisabled(true)
    );
    return new ActionRowBuilder().addComponents(components);
}

function createDeclineEmbed(characterName) {
    return new EmbedBuilder()
        .setTitle('🔮 Ritual Cancelled')
        .setDescription(
            `You decided to step away from ${characterName}.\n\n` +
            `The altar's light fades as the spiritual connection breaks...\n` +
            `Perhaps another time, when you're ready.`
        )
        .setColor('#95a5a6')
        .setFooter({ text: 'The ritual can be performed again when you\'re prepared.' })
        .setTimestamp();
}

function createTimeoutEmbed() {
    return new EmbedBuilder()
        .setTitle('⏳ Ritual Expired')
        .setDescription(
            'The spiritual energy dissipates into the ether...\n\n' +
            'You took too long to decide, and the connection was lost.\n' +
            'The character returns to their realm.'
        )
        .setColor('#e74c3c')
        .setFooter({ text: 'Rituals must be completed within 60 seconds.' })
        .setTimestamp();
}

function createInfoEmbed(character) {
    const rarityEmoji = getRarityEmoji(character.rarity);
    const rarityColor = getRarityColor(character.rarity);

    let detailsText = '';

    switch (character.id) {
        case 'yuyuko':
            detailsText = 
                `**👻 Normal Offer (85% chance):**\n` +
                `• Cost: 150,000 coins + 30,000 gems\n` +
                `• Reward: 100 rolls (200 with ShinyMark+)\n` +
                `• Luck boost: +0.01 (boosts LEGENDARY+)\n` +
                `• Duration: Next rolls only\n\n` +
                `**🍽️ Devour Event (15% chance):**\n` +
                `• Cost: 1,500,000 coins + 350,000 gems\n` +
                `• Reward: 1,000 rolls (2,000 with ShinyMark+)\n` +
                `• Luck boost: +0.1 (massive boost!)\n` +
                `• Max rolls: 10,000\n` +
                `• ⚠️ Risk: Everything consumed if broke!\n\n` +
                `**💡 Strategy:** Save up for potential Devour event!`;
            break;

        case 'yukari':
            detailsText = 
                `**🌌 Trading System:**\n` +
                `Trades your fumos for coins & gems based on Yukari Mark.\n\n` +
                `**📊 Mark Progression:**\n` +
                `• Mark 1: 1,500-2,000 fumos → x1.5 multiplier\n` +
                `• Mark 5: 1,750-2,500 fumos → x3.5 multiplier\n` +
                `• Mark 7: 2,000-3,000 fumos → x5 multiplier\n` +
                `• Mark 10: 3,000-5,000 fumos → x25 multiplier\n\n` +
                `**🎁 Bonus Rewards:**\n` +
                `• 20% → +15% coins & x1.5 gems\n` +
                `• 7% → Fumo Token drop\n` +
                `• Mark-based mystery items\n` +
                `• 0.5% → Scam (lose everything!)\n\n` +
                `**💡 Strategy:** Build up to Mark 10 for x25!`;
            break;

        case 'reimu':
            detailsText = 
                `**🙏 Donation Phase:**\n` +
                `• Base: 60,000 coins + 5,000 gems\n` +
                `• Penalty increases if can't afford\n` +
                `• Pity multipliers increase cost but boost next reward:\n` +
                `  - Pity 1-5: x2 multiplier\n` +
                `  - Pity 6-10: x5 multiplier\n` +
                `  - Pity 11-15: x10 multiplier\n\n` +
                `**🎁 Gift Phase (After Donation):**\n` +
                `• Receive EPIC to TRANSCENDENT fumos\n` +
                `• 18% Shiny chance | 0.8% alG chance\n` +
                `• Pity system: guaranteed ultra-rare at 15\n` +
                `• Token drops: 1-25 possible\n\n` +
                `**⏰ Limits:** 3 uses per 12 hours\n\n` +
                `**💡 Strategy:** Build pity for ultra-rares!`;
            break;

        case 'marisa':
            detailsText = 
                `**💰 Loan System:**\n` +
                `Phase 1: Lend her 15,000 coins\n` +
                `Phase 2: She returns 35,000 coins (20k profit!)\n\n` +
                `**🎲 Random Events:**\n` +
                `• 15% → She's absent, try later\n` +
                `• 3% → She steals extra (if not pity)\n\n` +
                `**🎁 Return Phase Rewards:**\n` +
                `• 18-35% → Gem/Boost Potions\n` +
                `• 35-70% → Bonus gems (pity doubles)\n` +
                `• Rare items: GoldenSigil, Fragment, Tickets\n\n` +
                `**🌟 Pity System:**\n` +
                `Every 5th donation: StarShard(M) + boosted chances\n\n` +
                `**💡 Strategy:** Always profitable over time!`;
            break;

        case 'sakuya':
            detailsText = 
                `**⏰ Time Skip Mechanics:**\n` +
                `• Instantly skip 12 hours of farming\n` +
                `• Takes 10-60% tribute (scales with uses)\n` +
                `• Requires RARE+ fumos (amount scales)\n` +
                `• Max 6 uses per 24 hours\n\n` +
                `**🔮 Time Blessing System:**\n` +
                `• Builds +10 per use → 100 total\n` +
                `• At 100: FREE skip + 24h cooldown buff\n` +
                `• Resets after activation\n\n` +
                `**✨ Perfect Skip:**\n` +
                `• 1-3% chance (3% with Sakuya(UNCOMMON))\n` +
                `• No cost, no fumo loss!\n\n` +
                `**🎁 Bonus Items:**\n` +
                `• FragmentOfTime(E) - 12% (22% w/ Sakuya)\n` +
                `• TimeClock-Broken(L) - 3% (7% w/ Sakuya)\n` +
                `• PocketWatch(M) - 0.5% (1.5% w/ Sakuya)\n\n` +
                `**💡 Strategy:** Build to 100 for blessing!`;
            break;
    }

    return new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${character.name} - Detailed Guide`)
        .setDescription(detailsText)
        .setThumbnail(character.picture)
        .setColor(rarityColor)
        .setFooter({ text: `Rarity: ${character.rarity} | Plan your strategy wisely!` })
        .setTimestamp();
}

module.exports = {
    createRitualWelcomeEmbed,
    createPrayButtons,
    createCharacterEmbed,
    createActionButtons,
    disableButtons,
    createDeclineEmbed,
    createTimeoutEmbed,
    createInfoEmbed
};