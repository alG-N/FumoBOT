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
                `**👻 Normal Offer (75% chance):**\n` +
                `• Cost: 50,000 coins + 10,000 gems\n` +
                `• Reward: 500 rolls (1,250 with ShinyMark+)\n` +
                `• Luck boost: +0.125 (boosts LEGENDARY+)\n` +
                `• Duration: Next rolls only\n` +
                `• Max rolls: 10,000\n\n` +
                `**🍽️ Devour Event (25% chance):**\n` +
                `• Cost: 600,000 coins + 140,000 gems\n` +
                `• Reward: 15,000 rolls (30,000 with ShinyMark+)\n` +
                `• Luck boost: +1.5 (MASSIVE boost!)\n` +
                `• Max rolls: 50,000\n` +
                `• ⚠️ Risk: Everything consumed if broke!\n\n` +
                `**💡 Strategy:** All values TRIPLED from original! Save up for Devour event for massive rolls!`;
            break;

        case 'yukari':
            detailsText = 
                `**🌌 Trading System (HEAVILY BUFFED!):**\n` +
                `Trades your fumos for coins & gems based on Yukari Mark.\n` +
                `**Requirements reduced by 40-50%!**\n\n` +
                `**📊 Mark Progression:**\n` +
                `• Mark 1: 500-600 fumos → x3.6 multiplier\n` +
                `• Mark 5: 700-840 fumos → x6.3 multiplier\n` +
                `• Mark 7: 1,000-1,200 fumos → x9 multiplier\n` +
                `• Mark 10: 1,500-2,100 fumos → x45 multiplier\n\n` +
                `**🎁 Bonus Rewards:**\n` +
                `• 45% → +30% coins & x1.3 gems (tripled chance!)\n` +
                `• 35% → Fumo Token drop (5x chance!)\n` +
                `• Guaranteed 3-9 shards per mark\n` +
                `• Mark-based mystery items (tripled drops)\n` +
                `• 0.15% → Scam (70% reduced!)\n\n` +
                `**💡 Strategy:** Easier to reach Mark 10 for x45 mega multiplier!`;
            break;

        case 'reimu':
            detailsText = 
                `**🙏 Donation Phase:**\n` +
                `• Base: 30,000 coins + 2,500 gems\n` +
                `• Penalty increases if can't afford (+5k coins, +1k gems)\n` +
                `• Pity multipliers increase cost but boost rewards:\n` +
                `  - Pity 1-3: x1 multiplier\n` +
                `  - Pity 4-6: x1.5 multiplier\n` +
                `  - Pity 7-10: x2 multiplier\n\n` +
                `**🎁 Gift Phase (After Donation):**\n` +
                `• Receive EPIC to ??? rarity fumos\n` +
                `• 35% Shiny chance | 10% alG chance (DOUBLED!)\n` +
                `• Pity system: guaranteed ultra-rare at 10 (was 15)\n` +
                `• Token drops: 0-25 possible (50% chance for tokens)\n` +
                `• Pity boosts ultra-rare chances by x1.5 per count\n\n` +
                `**⏰ Limits:** 8 uses per 12 hours (was 3!)\n\n` +
                `**💡 Strategy:** Faster pity + more uses = easier ultra-rares!`;
            break;

        case 'marisa':
            detailsText = 
                `**💰 Loan System:**\n` +
                `Phase 1: Lend her 15,000 coins\n` +
                `Phase 2: She returns 35,000 coins (20k profit!)\n\n` +
                `**🎲 Random Events:**\n` +
                `• 15% → She's absent, try later\n` +
                `• Pity system removed theft mechanic\n\n` +
                `**🎁 Return Phase Rewards (BUFFED):**\n` +
                `• Rare/Legendary Potions (doubled chances!)\n` +
                `• Bonus gems: pity doubles amount\n` +
                `• Special Items:\n` +
                `  - GoldenSigil(?): 0.6%\n` +
                `  - FragmentOf1800s(R): 2.4%\n` +
                `  - HakureiTicket(L): 4.8%\n` +
                `• 1-3 random items per return (3-6 during pity!)\n\n` +
                `**🌟 Pity System (Every 5 donations):**\n` +
                `• Guaranteed StarShard(M)\n` +
                `• All rewards buffed significantly\n` +
                `• Pity counter resets to 0\n\n` +
                `**💡 Strategy:** Extremely profitable with buffed rewards!`;
            break;

        case 'sakuya':
            detailsText = 
                `**⏰ Time Skip Mechanics (MASSIVE BUFFS!):**\n` +
                `• Skip 12 hours of farming (24h during blessing!)\n` +
                `• Takes 10-18% tribute (was 10-60%!)\n` +
                `• Requires 1-4 RARE+ fumos (reduced!)\n` +
                `• Max 6 uses per 24 hours\n` +
                `• Perfect Skip: 2-6% chance (doubled!)\n\n` +
                `**🔮 Time Blessing System:**\n` +
                `• Builds +20 per use → 100 total (doubled rate!)\n` +
                `• At 100: Skip FULL DAY + 24h cooldown buff\n` +
                `• 4x coins & gems during blessing!\n` +
                `• Resets after activation\n\n` +
                `**✨ Perfect Skip Bonus:**\n` +
                `• No cost, no fumo loss!\n` +
                `• +50% bonus rewards\n\n` +
                `**🎁 Bonus Items (TRIPLED rates!):**\n` +
                `• FragmentOfTime(E):\n` +
                `  - Base: 36% | With Sakuya: 66%\n` +
                `• TimeClock-Broken(L):\n` +
                `  - Base: 9% | With Sakuya: 21%\n` +
                `• PocketWatch(M):\n` +
                `  - Base: 1.5% | With Sakuya: 4.5%\n` +
                `• 1-3 rolls per item type!\n\n` +
                `**💡 Strategy:** Much lower tribute = keep 82-90% of rewards!`;
            break;

        case 'sanae':
            detailsText = 
                `**🌊 Faith Exchange System:**\n` +
                `Sanae offers divine blessings in exchange for faith.\n\n` +
                `**💫 Donation Options:**\n` +
                `• **A:** 100,000 coins → 1 Faith Point\n` +
                `• **B:** 15,000 gems → 2 Faith Points\n` +
                `• **C:** 3 MYTHICAL+ fumos → 3 Faith Points\n` +
                `• **D:** 50k coins + 5k gems + 1 LEGENDARY fumo → 4 Faith Points\n\n` +
                `**📊 Faith Point Milestones:**\n` +
                `• **5 FP:** Reroll one blessing (once per visit)\n` +
                `• **10 FP:** Unlock 4th blessing option\n` +
                `• **15 FP:** Upgrade ALL blessing tiers by one level!\n` +
                `• **20 FP:** 🌟 DIVINE INTERVENTION - Guaranteed MIRACLE blessing!\n\n` +
                `**🎁 Blessing Tiers:**\n` +
                `⚪ **Common (50%):** 300k-500k coins, shards, small luck\n` +
                `🔵 **Rare (30%):** 1.5M+ coins, MYTHICAL fumo, 100 epic+ pulls\n` +
                `🟡 **Legendary (15%):** 5M+ coins, 7-day luck, craft protections\n` +
                `🟣 **Divine (4%):** 50-100M coins, permanent luck, FrogSigil(?)\n` +
                `🌟 **Miracle (1%):** 500M coins, TRANSCENDENT fumo, 7-day free crafts\n\n` +
                `**⚠️ Special Events:**\n` +
                `• 10% → Sanae training (no blessing but FP saved)\n` +
                `• 5% → Miracle Surge (all tiers upgraded!)\n` +
                `• 3% → Divine Scam (Kanako takes your FP!)\n\n` +
                `**💡 Strategy:**\n` +
                `Save to 20 FP for guaranteed MIRACLE, or spend FP for rerolls!\n` +
                `"Free crafts" means no coin/gem cost - items still required.`;
            break;

        default:
            detailsText = `No details available. This character is a mystery...`;
    }

    return new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${character.name} - Detailed Guide`)
        .setDescription(detailsText)
        .setThumbnail(character.picture)
        .setColor(rarityColor)
        .setFooter({ text: `Rarity: ${character.rarity}` })
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