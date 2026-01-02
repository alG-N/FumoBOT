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
                `**⚠️ WHAT YOU CAN LOSE:**\n` +
                `• Normal: 50,000 coins + 10,000 gems + 2% of wealth\n` +
                `• Devour: 600,000 coins + 140,000 gems\n` +
                `• ❌ If broke during Devour: **ALL COINS & GEMS GONE!**\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**👻 Normal Offer (75% chance):**\n` +
                `• Reward: 500 rolls (1,250 with ShinyMark+)\n` +
                `• Luck boost: +0.125 (boosts LEGENDARY+)\n` +
                `• Max rolls: 10,000\n\n` +
                `**🍽️ Devour Event (25% chance):**\n` +
                `• Reward: 15,000 rolls (30,000 with ShinyMark+)\n` +
                `• Luck boost: +1.5 (MASSIVE boost!)\n` +
                `• Max rolls: 50,000\n\n` +
                `**💡 Strategy:** Save up for Devour event for massive rolls!`;
            break;

        case 'yukari':
            detailsText = 
                `**⚠️ WHAT YOU CAN LOSE:**\n` +
                `• 500-2,100 of your fumos (based on Mark)\n` +
                `• Prioritizes: Common > Rare > Epic (consumes low first)\n` +
                `• ❌ 0.15% Scam chance: ALL FUMOS GONE, NO REWARD!\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**🌌 Trading System:**\n` +
                `Trades your fumos for coins & gems based on Yukari Mark.\n\n` +
                `**📊 Mark Progression:**\n` +
                `• Mark 1: 500-600 fumos → x3.6 multiplier\n` +
                `• Mark 5: 700-840 fumos → x6.3 multiplier\n` +
                `• Mark 7: 1,000-1,200 fumos → x9 multiplier\n` +
                `• Mark 10: 1,500-2,100 fumos → x45 multiplier\n\n` +
                `**🎁 Bonus Rewards:**\n` +
                `• 45% → Bonus coins & gems\n` +
                `• 35% → Fumo Token drop\n` +
                `• Guaranteed shards per mark\n\n` +
                `**💡 Strategy:** Reach Mark 10 for x45 mega multiplier!`;
            break;

        case 'reimu':
            detailsText = 
                `**⚠️ WHAT YOU CAN LOSE:**\n` +
                `• Base: 30,000 coins + 2,500 gems + 1.5% of wealth\n` +
                `• Penalty if broke: +5,000 coins, +1,000 gems per fail\n` +
                `• Higher pity = Higher cost multiplier (up to x2)\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**🙏 Donation Phase:**\n` +
                `• Pity 1-3: x1 cost | Pity 4-6: x1.5 | Pity 7-10: x2\n\n` +
                `**🎁 Gift Phase (After Donation):**\n` +
                `• Receive EPIC to TRANSCENDENT fumos!\n` +
                `• 35% Shiny | 10% alG chance\n` +
                `• 🌀 VOID chance (requires VoidCrystal)\n` +
                `• 🔮 GLITCHED chance (requires S!gil/CosmicCore)\n` +
                `• Token drops: 0-25 possible\n\n` +
                `**⏰ Limits:** 8 uses per 12 hours\n\n` +
                `**💡 Strategy:** Pity guaranteed ultra-rare at 10!`;
            break;

        case 'marisa':
            detailsText = 
                `**⚠️ WHAT YOU CAN LOSE:**\n` +
                `• Donation: 15,000 coins + 1% of total coins\n` +
                `• ❌ 15% chance she's absent (coins still taken!)\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**💰 Loan System:**\n` +
                `• Phase 1: Lend her coins\n` +
                `• Phase 2: She returns 35,000+ coins (profit!)\n\n` +
                `**🎁 Return Phase Rewards:**\n` +
                `• Rare/Legendary Potions\n` +
                `• Bonus gems (doubled during pity)\n` +
                `• Special Items:\n` +
                `  - GoldenSigil(?): 0.6%\n` +
                `  - FragmentOf1800s(R): 2.4%\n` +
                `  - HakureiTicket(L): 4.8%\n` +
                `• 1-3 random items per return\n\n` +
                `**🌟 Pity System (Every 5 donations):**\n` +
                `• Guaranteed StarShard(M)\n` +
                `• All rewards buffed\n\n` +
                `**💡 Strategy:** Low risk, steady profit!`;
            break;

        case 'sakuya':
            detailsText = 
                `**⚠️ WHAT YOU CAN LOSE:**\n` +
                `• 🪙 5 Fumo Tokens (MYTHICAL character requirement)\n` +
                `• 3-5% of coins + gems (scaling tribute)\n` +
                `• 1-4 RARE+ fumos consumed\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**⏰ Time Skip Mechanics:**\n` +
                `• Skip 12 hours of farming (24h during blessing!)\n` +
                `• Takes 3-5% tribute (scales with uses)\n` +
                `• Max 6 uses per 24 hours\n` +
                `• Perfect Skip: 2-6% chance (no cost!)\n\n` +
                `**🔮 Time Blessing System:**\n` +
                `• Builds +20 per use → 100 total\n` +
                `• At 100: Skip FULL DAY + 4x rewards!\n\n` +
                `**🎁 Bonus Items:**\n` +
                `• FragmentOfTime(E): 36-66%\n` +
                `• TimeClock-Broken(L): 9-21%\n` +
                `• PocketWatch(M): 1.5-4.5%\n\n` +
                `**💡 Strategy:** Keep 95-97% of rewards!`;
            break;

        case 'sanae':
            detailsText = 
                `**⚠️ WHAT YOU CAN LOSE:**\n` +
                `• 🪙 10 Fumo Tokens (DIVINE character requirement)\n` +
                `• Option A: 100,000 coins + 4% of coins\n` +
                `• Option B: 15,000 gems + 4% of gems\n` +
                `• Option C: 3 MYTHICAL+ fumos\n` +
                `• Option D: 50k coins + 5k gems + 1 LEGENDARY fumo\n` +
                `• ❌ 10% Training (no blessing, tokens gone)\n` +
                `• ❌ 3% Divine Scam (Kanako takes your FP!)\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**📊 Faith Point Milestones:**\n` +
                `• **5 FP:** Reroll one blessing\n` +
                `• **10 FP:** Unlock 4th blessing option\n` +
                `• **15 FP:** Upgrade ALL blessing tiers!\n` +
                `• **20 FP:** 🌟 DIVINE INTERVENTION!\n\n` +
                `**🎁 Blessing Tiers:**\n` +
                `⚪ Common (50%): 300k-500k coins\n` +
                `🔵 Rare (30%): 1.5M+ coins, MYTHICAL fumo\n` +
                `🟡 Legendary (15%): 5M+ coins, 7-day luck\n` +
                `🟣 Divine (4%): 50-100M coins, FrogSigil(?)\n` +
                `🌟 Miracle (1%): 500M coins, TRANSCENDENT fumo\n\n` +
                `**💡 Strategy:** Save to 20 FP for MIRACLE!`;
            break;

        default:
            detailsText = `No details available. This character is a mystery...`;
    }

    return new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${character.name} - Detailed Guide`)
        .setDescription(detailsText)
        .setThumbnail(character.picture)
        .setColor(rarityColor)
        .setFooter({ text: `Rarity: ${character.rarity} | ⚠️ Costs scale with your total wealth!` })
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