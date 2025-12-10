const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { RARITY_COLORS, PET_ABILITIES } = require('../../Configuration/petConfig');
const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');
const PetStats = require('./PetStatsService');
const { formatNumber } = require('../../Ultility/formatting');

function createInventoryEmbed(view, user, eggs = [], pets = [], equippedIds = [], page = 0, totalPages = 1) {
    const embed = new EmbedBuilder()
        .setTitle(`${user?.username || 'User'}'s ${view === 'eggs' ? 'Egg Inventory' : view === 'pets' ? 'Pet Inventory' : 'Equipped Pets'}`)
        .setColor(view === 'eggs' ? '#00FF00' : view === 'pets' ? '#00BFFF' : '#FFD700')
        .setTimestamp();

    if (view === 'eggs') {
        if (eggs.length === 0) {
            embed.setDescription("You have no eggs.");
        } else {
            eggs.forEach(egg => {
                embed.addFields({
                    name: egg.count > 1 ? `${egg.name} x${egg.count}` : egg.name,
                    value: `Ready to hatch with \`.useegg ${egg.name}\``,
                    inline: true
                });
            });
        }
    } else if (view === 'pets') {
        if (pets.length === 0) {
            embed.setDescription("You have no pets.");
        } else {
            pets.forEach(pet => {
                const isEquipped = equippedIds.includes(pet.petId);
                const alterTag = PetStats.hasAlterGoldenBonus(pet.petName) ? ' ✨' : '';
                const equippedTag = isEquipped ? ' 🎯' : '';
                
                const abilityInfo = PET_ABILITIES[pet.name];
                const abilityDesc = abilityInfo ? `💫 **${abilityInfo.abilityName}**: ${abilityInfo.description}` : '❌ No ability';

                const maxWeight = PetStats.getMaxWeight(pet.weight);

                embed.addFields({
                    name: `${getRarityEmoji(pet.rarity)} ${pet.name} "${pet.petName}"${alterTag}${equippedTag}`,
                    value: `⚖️ Weight: **${pet.weight.toFixed(2)}kg / ${maxWeight.toFixed(2)}kg** | ⭐ Quality: **${pet.quality.toFixed(2)}/5**\n📅 Age: **${pet.age}/100**\n${abilityDesc}`,
                    inline: false
                });
            });

            if (totalPages > 1) {
                embed.setFooter({ text: `Page ${page + 1} / ${totalPages} • Use arrows to navigate` });
            }
        }
    } else if (view === 'equipped') {
        if (pets.length === 0) {
            embed.setDescription("You have no equipped pets.\n\nUse `.equippet <petName>` to equip a pet!");
        } else {
            pets.forEach(pet => {
                pet = PetStats.updateHunger(pet, true);

                const alterTag = PetStats.hasAlterGoldenBonus(pet.petName) ? ' ✨' : '';
                const maxHunger = PetStats.getMaxHunger(pet.rarity);
                const hungerPercent = Math.round((pet.hunger / maxHunger) * 100);
                const xpRequired = PetStats.getXpRequired(pet.level || 1, pet.age || 1, pet.rarity);
                const xpPercent = Math.floor(((pet.ageXp || 0) / xpRequired) * 100);

                const hungerBar = createProgressBar(hungerPercent, 10);
                const xpBar = createProgressBar(xpPercent, 10);

                const maxWeight = PetStats.getMaxWeight(pet.weight);

                let abilityDisplay = 'None';
                if (pet.ability) {
                    try {
                        const ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                        const { type, amount, boostType, abilityName, secondaryAbility } = ability;

                        if (boostType === 'multiplier' || boostType === 'percent') {
                            const symbol = boostType === 'percent' ? '%' : 'x';
                            abilityDisplay = `**${abilityName}**: +${Number(amount).toFixed(2)}${symbol} ${type}`;
                        } else if (boostType === 'interval-chance') {
                            abilityDisplay = `**${abilityName}**: +${amount.chance.toFixed(1)}% ${type} every ${Math.floor(amount.interval / 1000)}s`;
                        } else if (boostType === 'passive') {
                            abilityDisplay = `**${abilityName}**: +${amount.passive.toFixed(2)} exp/s to all pets`;
                            if (secondaryAbility) {
                                abilityDisplay += `\n${secondaryAbility}`;
                            }
                        }
                    } catch {
                        abilityDisplay = '❌ Invalid ability';
                    }
                }

                embed.addFields({
                    name: `${getRarityEmoji(pet.rarity)} ${pet.name} "${pet.petName}"${alterTag} [Lv.${pet.level || 1} | Age ${pet.age || 1}/100]`,
                    value:
                        `⚖️ Weight: **${pet.weight.toFixed(2)}kg / ${maxWeight.toFixed(2)}kg** | ⭐ Quality: **${pet.quality.toFixed(2)}/5**\n` +
                        `\n🍖 Hunger: ${hungerBar} ${hungerPercent}% (${pet.hunger.toFixed(0)}/${maxHunger})` +
                        `\n📊 Age XP: ${xpBar} ${xpPercent}% (${(pet.ageXp || 0).toFixed(0)}/${xpRequired})` +
                        `\n💫 ${abilityDisplay}`,
                    inline: false
                });
            });
            
            embed.setDescription(`You have **${pets.length}/5** pets equipped.`);
        }
    }

    return embed;
}

function createInventoryButtons(current, userId, disabled = false, page = 0, totalPages = 1) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('egginv', userId))
            .setLabel('🥚 Eggs')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || current === 'eggs'),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('petinv', userId))
            .setLabel('📦 Pets')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || current === 'pets'),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('petequipped', userId))
            .setLabel('🎯 Equipped')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled || current === 'equipped')
    ];

    if (current === 'pets' && totalPages > 1) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('petpageback', userId, { page }))
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || page === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('petpagenext', userId, { page }))
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || page >= totalPages - 1)
        );
    }

    return new ActionRowBuilder().addComponents(buttons);
}

function createHatchEmbed(pet, chosen, hasAlterGolden) {
    const maxWeight = PetStats.getMaxWeight(pet.weight);
    
    return new EmbedBuilder()
        .setTitle(`🎉 Egg Hatched!`)
        .setColor(RARITY_COLORS[chosen.rarity] || 0xFFFFFF)
        .addFields(
            { name: "Pet:", value: `${chosen.name} - **${chosen.rarity}**`, inline: false },
            { name: "🏷️ Name:", value: `**${pet.petName}**${hasAlterGolden ? ' ✨ (alterGolden Bonus!)' : ''}`, inline: false },
            { name: "Weight", value: `**${pet.weight.toFixed(2)} kg / ${maxWeight.toFixed(2)} kg**${hasAlterGolden ? ' (x2)' : ''}`, inline: true },
            { name: "⭐ Quality", value: `**${pet.quality.toFixed(2)} / 5**${hasAlterGolden ? ' (x2)' : ''}`, inline: true }
        )
        .setFooter({ text: `Take good care of ${pet.petName}!` })
        .setTimestamp();
}

function createProgressBar(percent, length = 10) {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clampedPercent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function getRarityEmoji(rarity) {
    const emojis = {
        'Common': '⚪',
        'Rare': '🔵',
        'Epic': '🟣',
        'Legendary': '🟠',
        'Mythical': '🔴',
        'Divine': '🟡'
    };
    return emojis[rarity] || '⚪';
}

module.exports = {
    createInventoryEmbed,
    createInventoryButtons,
    createHatchEmbed,
    createProgressBar,
    getRarityEmoji
};