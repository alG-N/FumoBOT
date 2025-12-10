const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const { RARITY_TIERS, RARITY_COLORS, PET_ABILITIES } = require('../../Configuration/petConfig');
const PetStats = require('../../Service/PetService/PetStatsService');
const PetDatabase = require('../../Service/PetService/PetDatabaseService');
const PetUI = require('../../Service/PetService/PetUIService');

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const cmd = message.content.trim().toLowerCase();
        if (message.author.bot || (cmd !== ".egginventory" && cmd !== ".ei")) return;

        const userId = message.author.id;

        try {
            const eggs = await PetDatabase.getUserEggs(userId, false);
            const embed = PetUI.createInventoryEmbed("eggs", message.author, eggs);
            const row = PetUI.createInventoryButtons("eggs", userId);

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
                    const eggs = await PetDatabase.getUserEggs(userId, false);
                    updatedEmbed = PetUI.createInventoryEmbed("eggs", interaction.user, eggs);
                    updatedRow = PetUI.createInventoryButtons("eggs", userId);
                    petPage = 0;
                } 
                else if (action === "petinv") {
                    const pets = await PetDatabase.getUserPets(userId, false);
                    petsCache = pets;
                    
                    const equipped = await PetDatabase.getEquippedPets(userId, false);
                    const equippedIds = equipped.map(e => e.petId);
                    equippedCache = equippedIds;
                    
                    const { pets: pagedPets, currentPage, totalPages: tp } = paginatePets(pets, 0, 5);
                    petPage = 0;
                    totalPages = tp;
                    updatedEmbed = PetUI.createInventoryEmbed("pets", interaction.user, [], pagedPets, equippedIds, currentPage, tp);
                    updatedRow = PetUI.createInventoryButtons("pets", userId, false, currentPage, tp);
                } 
                else if (action === "petequipped") {
                    const equipped = await PetDatabase.getEquippedPets(userId, false);
                    updatedEmbed = PetUI.createInventoryEmbed("equipped", interaction.user, [], equipped, [], 0, 1);
                    updatedRow = PetUI.createInventoryButtons("equipped", userId);
                    petPage = 0;
                } 
                else if (action === "petpageback" || action === "petpagenext") {
                    let pets = petsCache || await PetDatabase.getUserPets(userId, false);
                    let equippedIds = equippedCache;
                    
                    if (!equippedIds) {
                        const equipped = await PetDatabase.getEquippedPets(userId, false);
                        equippedIds = equipped.map(e => e.petId);
                        equippedCache = equippedIds;
                    }
                    
                    totalPages = Math.ceil(pets.length / 5) || 1;
                    petPage = Number(pageStr) || 0;
                    
                    if (action === "petpageback") petPage = Math.max(0, petPage - 1);
                    if (action === "petpagenext") petPage = Math.min(totalPages - 1, petPage + 1);
                    
                    const { pets: pagedPets, currentPage, totalPages: tp } = paginatePets(pets, petPage, 5);
                    updatedEmbed = PetUI.createInventoryEmbed("pets", interaction.user, [], pagedPets, equippedIds, currentPage, tp);
                    updatedRow = PetUI.createInventoryButtons("pets", userId, false, currentPage, tp);
                }

                await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
            });

            collector.on('end', async () => {
                const disabledRow = PetUI.createInventoryButtons("none", userId, true);
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