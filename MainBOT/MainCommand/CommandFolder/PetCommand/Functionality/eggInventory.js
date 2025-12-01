const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
const { RARITY_TIERS, RARITY_COLORS, PET_ABILITIES } = require('../Configuration/petConfig');
const { updateHunger, getXpRequired, getMaxHunger, hasAlterGoldenBonus } = require('../Utilities/petUtils');
const { getUserEggs, getUserPets, getEquippedPets, dbAll } = require('../Utilities/dbUtils');

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const cmd = message.content.trim().toLowerCase();
        if (message.author.bot || (cmd !== ".egginventory" && cmd !== ".ei")) return;

        const userId = message.author.id;

        try {
            const eggs = await getUserEggs(db, userId);
            const embed = generateInventoryEmbed("eggs", message.author, eggs);
            const row = generateInventoryButtons("eggs", userId);

            const reply = await message.reply({ embeds: [embed], components: [row] });

            let petPage = 0;
            let petsCache = null;
            let equippedCache = null;
            let totalPages = 1;

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 2 * 60 * 1000
            });

            collector.on('collect', async interaction => {
                if (interaction.user.id !== userId) {
                    return interaction.reply({ content: "❌ You can't interact with this.", ephemeral: true });
                }

                const [action, , pageStr] = interaction.customId.split("_");
                let updatedEmbed, updatedRow;

                if (action === "egginv") {
                    const eggs = await getUserEggs(db, userId);
                    updatedEmbed = generateInventoryEmbed("eggs", interaction.user, eggs);
                    updatedRow = generateInventoryButtons("eggs", userId);
                    petPage = 0;
                } 
                else if (action === "petinv") {
                    const pets = await getUserPets(db, userId);
                    petsCache = pets;
                    
                    const equippedPetIds = await dbAll(db, `SELECT petId FROM equippedPets WHERE userId = ?`, [userId]);
                    const equippedIds = equippedPetIds.map(e => e.petId);
                    equippedCache = equippedIds;
                    
                    const { pets: pagedPets, currentPage, totalPages: tp } = paginatePets(pets, 0, 5);
                    petPage = 0;
                    totalPages = tp;
                    updatedEmbed = generateInventoryEmbed("pets", interaction.user, [], pagedPets, equippedIds, currentPage, tp);
                    updatedRow = generateInventoryButtons("pets", userId, false, currentPage, tp);
                } 
                else if (action === "petequipped") {
                    const equipped = await getEquippedPets(db, userId);
                    updatedEmbed = generateInventoryEmbed("equipped", interaction.user, [], equipped, [], 0, 1);
                    updatedRow = generateInventoryButtons("equipped", userId);
                    petPage = 0;
                } 
                else if (action === "petpageback" || action === "petpagenext") {
                    let pets = petsCache || await getUserPets(db, userId);
                    let equippedIds = equippedCache;
                    
                    if (!equippedIds) {
                        const eq = await dbAll(db, `SELECT petId FROM equippedPets WHERE userId = ?`, [userId]);
                        equippedIds = eq.map(e => e.petId);
                        equippedCache = equippedIds;
                    }
                    
                    totalPages = Math.ceil(pets.length / 5) || 1;
                    petPage = Number(pageStr) || 0;
                    
                    if (action === "petpageback") petPage = Math.max(0, petPage - 1);
                    if (action === "petpagenext") petPage = Math.min(totalPages - 1, petPage + 1);
                    
                    const { pets: pagedPets, currentPage, totalPages: tp } = paginatePets(pets, petPage, 5);
                    updatedEmbed = generateInventoryEmbed("pets", interaction.user, [], pagedPets, equippedIds, currentPage, tp);
                    updatedRow = generateInventoryButtons("pets", userId, false, currentPage, tp);
                }

                await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
            });

            collector.on('end', async () => {
                const disabledRow = generateInventoryButtons("none", userId, true);
                await reply.edit({ components: [disabledRow] }).catch(() => {});
            });

        } catch (error) {
            console.error("Error in eggInventory:", error);
            return message.reply("An error occurred. Please try again later.");
        }
    });
};

function paginatePets(pets, page = 0, pageSize = 5) {
    const totalPages = Math.ceil(pets.length / pageSize) || 1;
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return {
        pets: pets.slice(start, end),
        currentPage,
        totalPages
    };
}

function generateInventoryEmbed(view, user, eggs = [], pets = [], equippedIds = [], page = 0, totalPages = 1) {
    const embed = new EmbedBuilder()
        .setTitle(`${user?.username || 'User'}'s ${view === 'eggs' ? 'Egg Inventory' : view === 'pets' ? 'Pet Inventory' : 'Equipped Pets'}`)
        .setColor(view === 'eggs' ? '#00FF00' : view === 'pets' ? '#00BFFF' : '#FFD700')
        .setTimestamp();

    if (view === 'eggs') {
        const eggMap = new Map();
        eggs.forEach(egg => {
            const key = egg.name;
            if (!eggMap.has(key)) {
                eggMap.set(key, { count: egg.count || 1 });
            }
        });

        if (eggMap.size === 0) {
            embed.setDescription("You have no eggs.");
        } else {
            eggMap.forEach((data, name) => {
                embed.addFields({
                    name: data.count > 1 ? `${name} x${data.count}` : name,
                    value: `Ready to hatch with \`.useegg ${name}\``,
                    inline: true
                });
            });
        }
    } 
    else if (view === 'pets') {
        if (pets.length === 0) {
            embed.setDescription("You have no pets.");
        } else {
            pets.forEach(pet => {
                if (!pet.rarity || !RARITY_TIERS.includes(pet.rarity)) {
                    pet.rarity = 'Common';
                }

                const petName = pet.petName || 'Unnamed';
                const isEquipped = Array.isArray(equippedIds) && equippedIds.includes(pet.petId);
                const equippedTag = isEquipped ? ' 🎯' : '';
                const alterGoldenTag = hasAlterGoldenBonus(petName) ? ' ✨' : '';

                const abilityInfo = PET_ABILITIES[pet.name];
                const abilityDesc = abilityInfo ? `💫 **${abilityInfo.abilityName}**: ${abilityInfo.description}` : '❌ No ability';

                embed.addFields({
                    name: `${getRarityEmoji(pet.rarity)} ${pet.name} "${petName}"${alterGoldenTag}${equippedTag}`,
                    value:
                        `⚖️ Weight: **${pet.weight.toFixed(2)}kg** | ⭐ Quality: **${pet.quality.toFixed(2)}/5**\n` +
                        `${abilityDesc}`,
                    inline: false
                });
            });

            if (totalPages > 1) {
                embed.setFooter({ text: `Page ${page + 1} / ${totalPages} • Use arrows to navigate` });
            }
        }
    } 
    else if (view === "equipped") {
        if (!pets || pets.length === 0) {
            embed.setDescription("You have no equipped pets.\n\nUse `.equippet <petName>` to equip a pet!");
        } else {
            pets.forEach(pet => {
                pet = updateHunger(pet, db, true);

                const petName = pet.petName || 'Unnamed';
                const level = pet.level || 1;
                const age = pet.age || 1;
                const ageXp = pet.ageXp || 0;
                const maxHunger = getMaxHunger(pet.rarity);
                const hungerPercent = Math.round((pet.hunger / maxHunger) * 100);
                const xpRequired = getXpRequired(level, age, pet.rarity);
                const xpPercent = Math.floor((ageXp / xpRequired) * 100);
                const alterGoldenTag = hasAlterGoldenBonus(petName) ? ' ✨' : '';

                const hungerBar = createProgressBar(hungerPercent, 10);
                const xpBar = createProgressBar(xpPercent, 10);

                let abilityDisplay = 'None';
                if (pet.ability) {
                    try {
                        const ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                        const { type, amount, boostType, abilityName } = ability;

                        if (boostType === 'multiplier' || boostType === 'percent') {
                            const displayAmount = Number(amount);
                            const symbol = boostType === 'percent' ? '%' : 'x';
                            abilityDisplay = `**${abilityName}**: +${displayAmount.toFixed(2)}${symbol} ${type}`;
                        } else if (boostType === 'interval-chance') {
                            abilityDisplay = `**${abilityName}**: +${amount.chance.toFixed(1)}% ${type} every ${Math.floor(amount.interval / 1000)}s`;
                        } else if (boostType === 'passive') {
                            abilityDisplay = `**${abilityName}**: +${amount.passive.toFixed(2)} exp/s to all pets\nActive: +${amount.activeGain} exp every ${Math.floor(amount.activeInterval / 1000)}s`;
                        }
                    } catch {
                        abilityDisplay = '❌ Invalid ability';
                    }
                }

                const rarityColor = getRarityEmoji(pet.rarity || 'Common');

                embed.addFields({
                    name: `${rarityColor} ${pet.name} "${petName}"${alterGoldenTag} [Lv.${level} | Age ${age}]`,
                    value:
                        `⚖️ Weight: **${pet.weight.toFixed(2)}kg** | ⭐ Quality: **${pet.quality.toFixed(2)}/5**\n` +
                        `\n🍖 Hunger: ${hungerBar} ${hungerPercent}% (${pet.hunger.toFixed(0)}/${maxHunger})` +
                        `\n📊 Age XP: ${xpBar} ${xpPercent}% (${ageXp.toFixed(0)}/${xpRequired})` +
                        `\n💫 ${abilityDisplay}`,
                    inline: false
                });
            });
            
            embed.setDescription(`You have **${pets.length}/5** pets equipped.`);
        }
    }

    return embed;
}

function generateInventoryButtons(current, userId, disabled = false, page = 0, totalPages = 1) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(`egginv_${userId}`)
            .setLabel('🥚 Eggs')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || current === 'eggs'),
        new ButtonBuilder()
            .setCustomId(`petinv_${userId}`)
            .setLabel('📦 Pets')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || current === 'pets'),
        new ButtonBuilder()
            .setCustomId(`petequipped_${userId}`)
            .setLabel('🎯 Equipped')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled || current === 'equipped')
    ];

    if (current === 'pets' && totalPages > 1) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`petpageback_${userId}_${page}`)
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || page === 0),
            new ButtonBuilder()
                .setCustomId(`petpagenext_${userId}_${page}`)
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || page >= totalPages - 1)
        );
    }

    return new ActionRowBuilder().addComponents(buttons);
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