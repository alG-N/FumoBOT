const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const PetEquip = require('../../Service/PetService/PetEquipService');
const PetDatabase = require('../../Service/PetService/PetDatabaseService');
const PetBoost = require('../../Service/PetService/PetBoostService');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const userId = message.author.id;
        const content = message.content.trim().toLowerCase();

        if (content.startsWith('.equippet') || content.startsWith('.ep') ||
            content.startsWith('.equipbest') || content.startsWith('.eb')) {

            const isEquipBest = content.startsWith('.equipbest') || content.startsWith('.eb');
            let petName = 'best';

            if (!isEquipBest) {
                petName = message.content
                    .replace(/^\.ep\b|^\.equippet\b/i, '')
                    .trim();
            }

            try {
                if (isEquipBest || petName === 'best') {
                    const result = await PetEquip.equipBestPets(userId);
                    if (!result.success) {
                        return message.reply(`❌ ${getErrorMessage(result.error)}`);
                    }
                    return message.reply(`✅ Equipped your best pets successfully!`);
                }

                const result = await PetEquip.equipByName(userId, petName);
                
                if (!result.success) {
                    if (result.error === 'MULTIPLE_FOUND') {
                        return await handleMultiplePetSelection(message, userId, result.pets);
                    }
                    return message.reply(`❌ ${getErrorMessage(result.error)}`);
                }

                message.reply(`✅ Equipped **${result.pet.name} "${result.pet.petName}"** successfully!`);

            } catch (error) {
                console.error("Error equipping pet:", error);
                message.reply("❌ Failed to equip pets.");
            }
        }

        else if (content.startsWith('.unequip') || content.startsWith('.ue') ||
            content.startsWith('.unequipall') || content.startsWith('.uea')) {

            const isUnequipAll = content.startsWith('.unequipall') || content.startsWith('.uea');

            if (isUnequipAll) {
                try {
                    await PetEquip.unequipAll(userId);
                    message.reply(`✅ All pets have been unequipped.`);
                } catch (error) {
                    console.error("Error unequipping all pets:", error);
                    message.reply("❌ Failed to unequip all pets.");
                }
            } else {
                const petName = message.content
                    .replace(/^\.uea\b|^\.unequipall\b|^\.ue\b|^\.unequip\b/i, '')
                    .trim();

                if (!petName) {
                    return message.reply("❌ Please provide a pet name to unequip.");
                }

                try {
                    const result = await PetEquip.unequipByName(userId, petName);
                    
                    if (!result.success) {
                        if (result.error === 'MULTIPLE_FOUND') {
                            return await handleMultiplePetUnequip(message, userId, result.pets);
                        }
                        return message.reply(`❌ ${getErrorMessage(result.error)}`);
                    }

                    message.reply(`✅ Unequipped **${petName}**.`);
                } catch (error) {
                    console.error("Error unequipping pet:", error);
                    message.reply("❌ Failed to unequip the pet.");
                }
            }
        }
    });

    setInterval(async () => {
        try {
            await PetBoost.refreshAllBoosts();
        } catch (error) {
            console.error("Error in auto-refresh boosts:", error);
        }
    }, 10000);
};

async function handleMultiplePetSelection(message, userId, availablePets) {
    const options = availablePets.slice(0, 25).map((pet, index) => ({
        label: `${pet.name} "${pet.petName}" #${index + 1}`,
        description: `Lv.${pet.level || 1} | Age ${pet.age || 1} | Weight: ${pet.weight.toFixed(2)}kg | Quality: ${pet.quality.toFixed(2)}/5`,
        value: pet.petId
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_pet_equip_${userId}`)
        .setPlaceholder('Choose which pet to equip')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle('🎯 Multiple Pets Found')
        .setDescription(`You have **${availablePets.length}** pets named **${availablePets[0].petName}**.\nSelect which one to equip:`)
        .setColor('#00BFFF');

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.customId === `select_pet_equip_${userId}` && i.user.id === userId;

    try {
        const interaction = await reply.awaitMessageComponent({ 
            filter, 
            componentType: ComponentType.StringSelect, 
            time: 60_000 
        });

        const selectedPetId = interaction.values[0];
        const result = await PetEquip.equipPet(userId, selectedPetId);

        if (!result.success) {
            return interaction.update({ 
                content: `❌ ${getErrorMessage(result.error)}`, 
                embeds: [], 
                components: [] 
            });
        }

        await interaction.update({
            content: `✅ Equipped **${result.pet.name} "${result.pet.petName}"** successfully!`,
            embeds: [],
            components: []
        });

    } catch (error) {
        await reply.edit({ content: '⏱️ Selection timed out.', embeds: [], components: [] }).catch(() => {});
    }
}

async function handleMultiplePetUnequip(message, userId, equippedPets) {
    const options = equippedPets.slice(0, 25).map((pet, index) => ({
        label: `${pet.name} "${pet.petName}" #${index + 1}`,
        description: `Lv.${pet.level || 1} | Age ${pet.age || 1} | Weight: ${pet.weight.toFixed(2)}kg | Quality: ${pet.quality.toFixed(2)}/5`,
        value: pet.petId
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_pet_unequip_${userId}`)
        .setPlaceholder('Choose which pet to unequip')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle('🎯 Multiple Equipped Pets Found')
        .setDescription(`You have **${equippedPets.length}** equipped pets named **${equippedPets[0].petName}**.\nSelect which one to unequip:`)
        .setColor('#FF9900');

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.customId === `select_pet_unequip_${userId}` && i.user.id === userId;

    try {
        const interaction = await reply.awaitMessageComponent({ 
            filter, 
            componentType: ComponentType.StringSelect, 
            time: 60_000 
        });

        const selectedPetId = interaction.values[0];
        const result = await PetEquip.unequipPet(userId, selectedPetId);

        if (!result.success) {
            return interaction.update({ 
                content: `❌ ${getErrorMessage(result.error)}`, 
                embeds: [], 
                components: [] 
            });
        }

        await interaction.update({
            content: `✅ Unequipped pet successfully.`,
            embeds: [],
            components: []
        });

    } catch (error) {
        await reply.edit({ content: '⏱️ Selection timed out.', embeds: [], components: [] }).catch(() => {});
    }
}

function getErrorMessage(error) {
    const messages = {
        'MAX_EQUIPPED': 'You can only equip up to 5 pets.',
        'PET_NOT_FOUND': "You don't own a pet with that ID.",
        'ALREADY_EQUIPPED': 'This pet is already equipped.',
        'NO_PETS_FOUND': "You don't own a pet with that name.",
        'ALL_EQUIPPED': 'All your pets with that name are already equipped.',
        'NOT_EQUIPPED': 'No equipped pet found with that name.',
        'NO_UNEQUIPPED': 'No unequipped pets available to equip as best.'
    };
    return messages[error] || 'An unknown error occurred.';
}