const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRarityColor, getRarityEmoji } = require('../../Configuration/prayConfig');

function createCharacterEmbed(character) {
    const rarityEmoji = getRarityEmoji(character.rarity);
    const rarityColor = getRarityColor(character.rarity);

    const embed = new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${character.name} Appears! ${rarityEmoji}`)
        .setDescription(
            `**Rarity:** ${character.rarity}\n\n` +
            `${character.description}\n\n` +
            `Will you accept their offer?`
        )
        .setImage(character.picture)
        .setColor(rarityColor)
        .setFooter({ text: `Character Rarity: ${character.rarity}` })
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
        .setTitle('🔮 Offer Declined')
        .setDescription(`You decided to decline ${characterName}'s offer. Nothing happened until you pray again...`)
        .setColor('#0099ff')
        .setTimestamp();
}

function createTimeoutEmbed() {
    return new EmbedBuilder()
        .setTitle('⏳ Time\'s Up!')
        .setDescription('You didn\'t respond in time, so they leave.')
        .setColor('#ff0000')
        .setTimestamp();
}

function createInfoEmbed(character) {
    const rarityEmoji = getRarityEmoji(character.rarity);
    const rarityColor = getRarityColor(character.rarity);

    let detailsText = '';

    switch (character.id) {
        case 'yuyuko':
            detailsText = 
                `**Normal Offer:**\n` +
                `• Cost: 150k coins, 30k gems\n` +
                `• Reward: 100-200 rolls (200 with ShinyMark+)\n` +
                `• Luck boost: +0.01\n` +
                `• Rare gacha boost active\n\n` +
                `**Devour Chance (15%):**\n` +
                `• Cost: 1.5M coins, 350k gems\n` +
                `• Reward: 1000-2000 rolls\n` +
                `• Luck boost: +0.1\n` +
                `• Risk: Everything consumed if you're broke`;
            break;

        case 'yukari':
            detailsText = 
                `**Trading System:**\n` +
                `• Trades your fumos for coins/gems\n` +
                `• Requirements increase with Yukari Mark\n` +
                `• Mark 1: 1500-2000 fumos (x1.5 multiplier)\n` +
                `• Mark 5: 1750-2500 fumos (x3.5 multiplier)\n` +
                `• Mark 7: 2000-3000 fumos (x5 multiplier)\n` +
                `• Mark 10: 3000-5000 fumos (x25 multiplier)\n\n` +
                `**Bonus Drops:**\n` +
                `• 20% chance for 15% extra coins & x1.5 gems\n` +
                `• 7% chance for Fumo Token\n` +
                `• Mysterious items based on Mark level\n` +
                `• 0.5% chance to be scammed (lose everything)`;
            break;

        case 'reimu':
            detailsText = 
                `**Donation Phase:**\n` +
                `• Base: 60k coins, 5k gems\n` +
                `• Penalty increases if you can't afford\n` +
                `• Pity multipliers: x2 (1-5), x5 (6-10), x10 (11-15)\n\n` +
                `**Gift Phase:**\n` +
                `• Receive rare fumos (EPIC to TRANSCENDENT)\n` +
                `• 18% shiny chance, 0.8% alG chance\n` +
                `• Pity system boosts ultra-rare chances\n` +
                `• Token drops: 1-25 tokens possible\n\n` +
                `**Limits:** 3 uses per 12 hours`;
            break;

        case 'marisa':
            detailsText = 
                `**Loan System:**\n` +
                `• Borrows 15k coins from you\n` +
                `• Returns 35k coins next time (20k profit)\n` +
                `• 15% chance she's absent\n` +
                `• 3% chance she steals extra (if not pity round)\n\n` +
                `**Return Rewards:**\n` +
                `• Potions (18-35% chance)\n` +
                `• Gems (35-70% chance)\n` +
                `• Special items (GoldenSigil, Fragment, Ticket)\n` +
                `• Every 5th donation: StarShard reward`;
            break;

        case 'sakuya':
            detailsText = 
                `**Time Skip:**\n` +
                `• Skips 12 hours of farming instantly\n` +
                `• Takes 10-60% of rewards as tribute\n` +
                `• Requires RARE+ fumos (scaling with uses)\n` +
                `• Max 6 uses per 24 hours\n\n` +
                `**Time Blessing:**\n` +
                `• Builds up by 10 per use\n` +
                `• At 100: Free skip + 24h cooldown boost\n` +
                `• Perfect skip chance: 1-3% (no cost)\n\n` +
                `**Bonus Items:**\n` +
                `• FragmentOfTime(E), TimeClock-Broken(L), PocketWatch(M)\n` +
                `• Rates doubled if you own Sakuya(UNCOMMON)`;
            break;
    }

    return new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${character.name} - Details`)
        .setDescription(detailsText)
        .setThumbnail(character.picture)
        .setColor(rarityColor)
        .setFooter({ text: `Rarity: ${character.rarity}` })
        .setTimestamp();
}

module.exports = {
    createCharacterEmbed,
    createActionButtons,
    disableButtons,
    createDeclineEmbed,
    createTimeoutEmbed,
    createInfoEmbed
};