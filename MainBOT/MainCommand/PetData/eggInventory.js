const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const db = require('../Database/db');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.setMaxListeners(150);
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
module.exports = async (client) => {
    const getAllAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    const getEggs = (userId) => new Promise((resolve, reject) => {
        db.all(`SELECT * FROM petInventory WHERE userId = ? AND type = 'egg'`, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const getPets = (userId) => new Promise((resolve, reject) => {
        db.all(`SELECT * FROM petInventory WHERE userId = ? AND type = 'pet'`, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const getEquipped = (userId) => new Promise((resolve, reject) => {
        db.all(`
            SELECT p.* 
            FROM equippedPets e
            JOIN petInventory p ON e.petId = p.petId
            WHERE e.userId = ?
        `, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    function getMaxHunger(rarity) {
        const hungerMap = {
            Common: 1500,
            Rare: 1800,
            Epic: 2160,
            Legendary: 2880,
            Mythical: 3600,
            Divine: 4320
        };
        return hungerMap[rarity] || 1500;
    }

    function getHungerDuration(rarity) {
        const durationMap = {
            Common: 12,
            Rare: 15,
            Epic: 18,
            Legendary: 24,
            Mythical: 30,
            Divine: 36
        };
        return durationMap[rarity] || 12;
    }

    function updateHunger(pet) {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - (pet.lastHungerUpdate || now);
        if (elapsed <= 0) return pet;

        const maxHunger = getMaxHunger(pet.rarity);
        const durationHours = getHungerDuration(pet.rarity);
        const hungerLossPerSecond = maxHunger / (durationHours * 3600);

        const startingHunger = typeof pet.hunger === "number" ? pet.hunger : maxHunger;
        const totalHungerLoss = elapsed * hungerLossPerSecond;

        const newHunger = Math.max(0, startingHunger - totalHungerLoss);
        pet.hunger = parseFloat(newHunger.toFixed(2));
        pet.lastHungerUpdate = now;

        db.run(
            `UPDATE petInventory 
         SET hunger = ?, lastHungerUpdate = ?
         WHERE petId = ?`,
            [pet.hunger, now, pet.petId]
        );

        return pet;
    }

    // Pagination helpers
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

    function generateInventoryEmbed(view, user, eggs = [], pets = [], equipped = [], page = 0, totalPages = 1) {
        const embed = new EmbedBuilder()
            .setTitle(`${user?.username || 'User'}'s ${view === 'eggs' ? 'Egg Inventory' : view === 'pets' ? 'Pet Inventory' : 'Equipped Pets'}`)
            .setColor(view === 'eggs' ? '#00FF00' : view === 'pets' ? '#00BFFF' : '#FFD700')
            .setTimestamp();

        if (view === 'eggs') {
            const eggMap = new Map();
            eggs.forEach(egg => {
                const key = `${egg.name}`;
                if (!eggMap.has(key)) eggMap.set(key, { count: 1, timestamp: egg.timestamp });
                else eggMap.get(key).count += 1;
            });

            if (eggMap.size === 0) embed.setDescription("You have no eggs.");
            else eggMap.forEach((data, name) => {
                embed.addFields({
                    name: data.count > 1 ? `${name} x${data.count}` : name,
                    value: `Latest Bought: <t:${Math.floor(data.timestamp / 1000)}:R>`,
                    inline: true
                });
            });
        }

        else if (view === 'pets') {
            if (pets.length === 0) {
                embed.setDescription("You have no pets.");
            } else {
                const rarityTiers = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine'];
                const equippedPetIds = equipped.map(e => e.petId);

                function getXpRequired(level, age, rarity) {
                    const base = 500;
                    const rarityIndex = rarityTiers.indexOf(rarity);
                    const rarityMultiplier = 1 + (rarityIndex * 0.4);
                    const ageFactor = Math.pow(age, 1.2);
                    const levelCurve = Math.pow(level, 1.75);
                    return Math.round(base * levelCurve * rarityMultiplier * ageFactor);
                }

                pets.forEach(pet => {
                    pet = updateHunger(pet);

                    if (!pet.rarity || !rarityTiers.includes(pet.rarity)) {
                        pet.rarity = 'Common';
                    }

                    const level = pet.level || 1;
                    const age = pet.age || 1;
                    const ageXp = pet.ageXp || 0;
                    const maxHunger = getMaxHunger(pet.rarity);
                    const hungerPercent = Math.round((pet.hunger / maxHunger) * 100);
                    const xpRequired = getXpRequired(level, age, pet.rarity);

                    const equippedTag = equippedPetIds.includes(pet.petId) ? ' [EQUIPPED]' : '';

                    embed.addFields({
                        name: `${pet.name} [Lv.${level}]: ${pet.rarity}${equippedTag}`,
                        value:
                            `Weight: ${pet.weight.toFixed(2)}kg, Quality: ${pet.quality.toFixed(2)} / 5\n` +
                            `Hunger: ${pet.hunger} / ${maxHunger} (${hungerPercent}%)\n` +
                            `Age ${age}: ${ageXp.toFixed(2)} / ${xpRequired} (${Math.floor((ageXp / xpRequired) * 100)}%)\n` +
                            `ID: \`${pet.petId}\``,
                        inline: false
                    });
                });

                // Add page info
                if (totalPages > 1) {
                    embed.setFooter({ text: `Page ${page + 1} / ${totalPages}` });
                }
            }
        }

        else if (view === "equipped") {
            let hasOwl = false;
            let owlExpBonus = 0;
            let hasPig = false;
            let pigCooldownMultiplier = 1;

            equipped.forEach(pet => {
                if (pet.name === "Owl" && pet.ability) {
                    try {
                        const ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                        if (ability.type === "ExpBonus" && ability.boostType === "passive") {
                            hasOwl = true;
                            owlExpBonus += (ability.amount.passive || 0);
                        }
                    } catch { }
                }
                if (pet.name === "Pig" && pet.ability) {
                    try {
                        const ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                        if (ability.type === "Cooldown" && ability.boostType === "multiplier") {
                            hasPig = true;
                            pigCooldownMultiplier *= (ability.amount || 1);
                        }
                    } catch { }
                }
            });

            if (!equipped || equipped.length === 0) {
                embed.setDescription("You have no equipped pets.");
            } else {
                equipped.forEach((pet, index) => {
                    let passiveDisplay = '';
                    let abilityDisplay = 'None';
                    if (pet.ability) {
                        try {
                            const ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                            const { type, amount, boostType } = ability;

                            if (boostType === 'multiplier' || boostType === 'percent') {
                                let displayAmount = Number(amount);
                                if (type === "Cooldown" && hasPig) {
                                    displayAmount = pigCooldownMultiplier;
                                }
                                abilityDisplay = `+${displayAmount.toFixed(2)}${boostType === 'percent' ? '%' : 'x'} ${type}`;
                            } else if (boostType === 'interval-chance') {
                                abilityDisplay = `+${amount.chance}% ${type} every ${Math.floor(amount.interval / 1000)}s`;
                            } else if (boostType === 'passive') {
                                if (type === "ExpBonus") {
                                    let totalExpBonus = amount.passive;
                                    passiveDisplay = `Passive: +${totalExpBonus.toFixed(2)} exp/s (this Owl)`;
                                    abilityDisplay = `Ability: +${amount.activeGain} exp every ${Math.floor(amount.activeInterval / 1000)}s (Owl only)`;
                                } else {
                                    passiveDisplay = `Passive: +${(amount.passive * 100).toFixed(0)}% ${type}`;
                                    abilityDisplay = `Ability: +${amount.activeGain} for every ${Math.floor(amount.activeInterval / 1000)}s`;
                                }
                            }
                        } catch (err) {
                            abilityDisplay = '❌ Invalid ability data';
                        }
                    }

                    embed.addFields({
                        name: `${pet.name || 'Unknown'} [Lv${pet.level || 1}] : ${pet.rarity || 'Common'}`,
                        value: [passiveDisplay, abilityDisplay].filter(Boolean).join('\n'),
                        inline: false
                    });
                });
            }
        }

        return embed;
    }

    function generateInventoryButtons(current, userId, disabled = false, page = 0, totalPages = 1) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`egginv_${userId}`)
                .setLabel('🥚 Egg Inventory')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled || current === 'eggs'),

            new ButtonBuilder()
                .setCustomId(`petinv_${userId}`)
                .setLabel('📦 Pet Inventory')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || current === 'pets'),

            new ButtonBuilder()
                .setCustomId(`petequipped_${userId}`)
                .setLabel('🎯 Pet Equipped')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || current === 'equipped')
        );

        // Add pagination buttons for pet inventory
        if (current === 'pets' && totalPages > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`petpageback_${userId}_${page}`)
                    .setLabel('⬅️ Back')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled || page === 0),
                new ButtonBuilder()
                    .setCustomId(`petpagenext_${userId}_${page}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled || page >= totalPages - 1)
            );
        }

        return row;
    }

    client.on("messageCreate", async message => {
        const command = message.content.trim().toLowerCase();
        if (message.author.bot || (command !== ".egginventory" && command !== ".ei")) return;

        const userId = message.author.id;

        // Check for maintenance mode or ban
        const banData = isBanned(message.author.id);
        if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && message.author.id !== developerID) {
                description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                footerText = "Thank you for your patience";
            } else if (banData) {
                description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                if (banData.expiresAt) {
                    const remaining = banData.expiresAt - Date.now();
                    const seconds = Math.floor((remaining / 1000) % 60);
                    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

                    const timeString = [
                        days ? `${days}d` : '',
                        hours ? `${hours}h` : '',
                        minutes ? `${minutes}m` : '',
                        seconds ? `${seconds}s` : ''
                    ].filter(Boolean).join(' ');

                    description += `\n**Time Remaining:** ${timeString}`;
                } else {
                    description += `\n**Ban Type:** Permanent`;
                }

                footerText = "Ban enforced by developer";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                .setDescription(description)
                .setFooter({ text: footerText })
                .setTimestamp();

            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

            return message.reply({ embeds: [embed] });
        }

        const eggs = await getEggs(userId);
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
            if (interaction.user.id !== userId)
                return interaction.reply({ content: "❌ You can't interact with this.", ephemeral: true });

            const [action, , pageStr] = interaction.customId.split("_");
            let updatedEmbed, updatedRow;

            if (action === "egginv") {
                const eggs = await getEggs(userId);
                updatedEmbed = generateInventoryEmbed("eggs", interaction.user, eggs);
                updatedRow = generateInventoryButtons("eggs", userId);
                petPage = 0;
            } else if (action === "petinv") {
                const pets = await getPets(userId);
                petsCache = pets;
                const equipped = await new Promise((resolve, reject) => {
                    db.all(`SELECT petId FROM equippedPets WHERE userId = ?`, [userId], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    });
                });
                equippedCache = pets.filter(p => equipped.some(e => e.petId === p.petId));
                const { pets: pagedPets, currentPage, totalPages: tp } = paginatePets(pets, 0, 5);
                petPage = 0;
                totalPages = tp;
                updatedEmbed = generateInventoryEmbed("pets", interaction.user, [], pagedPets, equippedCache, currentPage, tp);
                updatedRow = generateInventoryButtons("pets", userId, false, currentPage, tp);
            } else if (action === "petequipped") {
                const equipped = await getEquipped(userId);
                updatedEmbed = generateInventoryEmbed("equipped", interaction.user, [], [], equipped);
                updatedRow = generateInventoryButtons("equipped", userId);
                petPage = 0;
            } else if (action === "petpageback" || action === "petpagenext") {
                // Use cached pets if available
                let pets = petsCache;
                let equipped = equippedCache;
                if (!pets) {
                    pets = await getPets(userId);
                    petsCache = pets;
                }
                if (!equipped) {
                    const eq = await new Promise((resolve, reject) => {
                        db.all(`SELECT petId FROM equippedPets WHERE userId = ?`, [userId], (err, rows) => {
                            if (err) return reject(err);
                            resolve(rows || []);
                        });
                    });
                    equipped = pets.filter(p => eq.some(e => e.petId === p.petId));
                    equippedCache = equipped;
                }
                totalPages = Math.ceil(pets.length / 5) || 1;
                petPage = Number(pageStr) || 0;
                if (action === "petpageback") petPage = Math.max(0, petPage - 1);
                if (action === "petpagenext") petPage = Math.min(totalPages - 1, petPage + 1);
                const { pets: pagedPets, currentPage, totalPages: tp } = paginatePets(pets, petPage, 5);
                updatedEmbed = generateInventoryEmbed("pets", interaction.user, [], pagedPets, equipped, currentPage, tp);
                updatedRow = generateInventoryButtons("pets", userId, false, currentPage, tp);
            }

            await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
        });

        collector.on('end', async () => {
            const disabledRow = generateInventoryButtons("none", userId, true);
            await reply.edit({ components: [disabledRow] }).catch(() => { });
        });
    });

    // Calculate boost
    function calculateBoost(pet) {
        const quality = pet.quality || 1;
        const weight = pet.weight || 1;
        const level = pet.level || 1;
        const age = pet.age || 1;

        const baseBoosts = {
            Bunny: { stat: 'Luck', base: 1, max: 100, type: 'percent' },
            Cat: { stat: 'Gem', base: 2.5, max: 75, type: 'percent' },
            Dog: { stat: 'Coin', base: 5, max: 150, type: 'percent' },
            Monkey: { stat: 'Income', base: 1.01, max: 2, type: 'multiplier' },
            Pig: { stat: 'Cooldown', base: 0.99, max: 0.5, type: 'multiplier' },
            Chicken: { stat: 'HatchSpeed', base: 1.5, max: 3, type: 'multiplier' },
            Bear: { stat: 'ItemChance', base: 5, max: 20, type: 'interval-chance', interval: 5 * 60 * 1000 },
            Owl: {
                stat: 'ExpBonus',
                base: 0.1,
                max: 5,
                type: 'passive',
                activeInterval: 15 * 60 * 1000,
                activeGain: 150,
                maxGain: 750
            }
        };

        const boostData = baseBoosts[pet.name];
        if (!boostData) return null;

        const { base, max, type } = boostData;

        if (type === 'percent' || type === 'multiplier') {
            const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
            let boost = base + factor;
            boost = Math.min(boost, max);
            return { type: boostData.stat, amount: boost, boostType: type };
        }

        if (type === 'interval-chance') {
            const chance = Math.min(base + (weight + quality) * Math.sqrt(level), max);
            return {
                type: boostData.stat,
                amount: { interval: boostData.interval, chance },
                boostType: type
            };
        }

        if (type === 'passive') {
            // Each Owl's exp/sec is calculated individually
            const passive = Math.min(base + ((quality + weight) * Math.log(age + 1) * Math.sqrt(level)) / 30, max);
            const activeGain = Math.min(boostData.activeGain + level * 5, boostData.maxGain);
            return {
                type: boostData.stat,
                amount: {
                    passive,
                    activeInterval: boostData.activeInterval,
                    activeGain
                },
                boostType: type
            };
        }

        return null;
    }

    function getXpRequired(level, age, rarity) {
        const base = 500;
        const rarityTiers = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine'];
        const rarityIndex = rarityTiers.indexOf(rarity);
        const rarityMultiplier = 1 + (rarityIndex * 0.4);
        const ageFactor = Math.pow(age, 1.2);
        const levelCurve = Math.pow(level, 1.75);
        return Math.round(base * levelCurve * rarityMultiplier * ageFactor);
    }

    // Helper: Get all equipped Owls for a user
    async function getEquippedOwls(userId) {
        return await getAllAsync(`
            SELECT p.*
            FROM equippedPets e
            JOIN petInventory p ON e.petId = p.petId
            WHERE e.userId = ? AND p.name = 'Owl'
        `, [userId]);
    }

    // Owl passive exp gain: All pets gain exp/sec for each equipped Owl, each with its own scaling
    setInterval(async () => {
        let usersWithOwl;
        try {
            usersWithOwl = await getAllAsync(`
                SELECT DISTINCT e.userId
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE p.name = 'Owl'
            `);
            if (!Array.isArray(usersWithOwl)) return;
        } catch (err) {
            console.error("❌ Failed to load users with equipped Owl:", err);
            return;
        }

        for (const user of usersWithOwl) {
            // Get all equipped Owls for this user
            const equippedOwls = await getEquippedOwls(user.userId);

            // Calculate total exp/sec from all equipped Owls (each Owl's exp/sec is unique)
            let totalExpPerSec = 0;
            for (const owl of equippedOwls) {
                let ability = owl.ability;
                if (!ability || typeof ability === "string") {
                    try {
                        ability = JSON.parse(ability);
                    } catch {
                        ability = null;
                    }
                }
                if (!ability || ability.type !== "ExpBonus" || ability.boostType !== "passive") {
                    // Recalculate ability if missing or invalid
                    ability = calculateBoost(owl);
                }
                if (ability && ability.amount && typeof ability.amount.passive === "number") {
                    totalExpPerSec += ability.amount.passive;
                }
            }

            // Give exp to all pets (not eggs) owned by this user
            let userPets = [];
            try {
                userPets = await getAllAsync(`
                    SELECT * FROM petInventory
                    WHERE userId = ? AND type = 'pet'
                `, [user.userId]);
            } catch (err) {
                continue;
            }

            // Track which pets got exp
            const petsGainedExp = [];

            userPets.forEach(pet => {
                pet.ageXp = (pet.ageXp || 0) + totalExpPerSec;

                let agedUp = false;
                while (true) {
                    const xpRequired = getXpRequired(pet.level || 1, pet.age || 1, pet.rarity || 'Common');
                    if (pet.ageXp >= xpRequired) {
                        pet.ageXp -= xpRequired;
                        pet.age = (pet.age || 1) + 1;
                        agedUp = true;
                    } else {
                        break;
                    }
                }

                db.run(
                    `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                    [pet.age, pet.ageXp, pet.petId],
                    (err) => {
                        if (err) console.error("❌ Failed to update pet stats (Owl bonus):", err);
                    }
                );

                // Update ability if aged up
                if (agedUp) {
                    const ability = calculateBoost(pet);
                    if (ability) {
                        const abilityString = JSON.stringify(ability);
                        db.run(
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [abilityString, pet.petId],
                            (err) => {
                                if (err) console.error("❌ Failed to update pet ability (Owl bonus):", err);
                            }
                        );
                    }
                }

                // Only log if exp was actually added (i.e. totalExpPerSec > 0)
                if (totalExpPerSec > 0) {
                    petsGainedExp.push(pet.petId);
                }
            });

            // Console log for debugging
            if (totalExpPerSec > 0 && petsGainedExp.length > 0) {
                // console.log(`[Owl Bonus] userId: ${user.userId} | +${totalExpPerSec.toFixed(2)} exp to pets: [${petsGainedExp.join(", ")}]`);
            }
        }
    }, 1000);

    // Owl active ability: Every 15 mins, gain itself 150~750 exp (scaling)
    setInterval(async () => {
        let usersWithOwl;
        try {
            usersWithOwl = await getAllAsync(`
                SELECT DISTINCT e.userId
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE p.name = 'Owl'
            `);
            if (!Array.isArray(usersWithOwl)) return;
        } catch (err) {
            console.error("❌ Failed to load users with equipped Owl (active):", err);
            return;
        }

        for (const user of usersWithOwl) {
            const equippedOwls = await getEquippedOwls(user.userId);
            for (const owl of equippedOwls) {
                const level = owl.level || 1;
                let activeGain = 150 + level * 5;
                activeGain = Math.min(activeGain, 750);

                owl.ageXp = (owl.ageXp || 0) + activeGain;

                let agedUp = false;
                while (true) {
                    const xpRequired = getXpRequired(owl.level || 1, owl.age || 1, owl.rarity || 'Common');
                    if (owl.ageXp >= xpRequired) {
                        owl.ageXp -= xpRequired;
                        owl.age = (owl.age || 1) + 1;
                        agedUp = true;
                    } else {
                        break;
                    }
                }

                db.run(
                    `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                    [owl.age, owl.ageXp, owl.petId],
                    (err) => {
                        if (err) console.error("❌ Failed to update Owl stats (active ability):", err);
                    }
                );

                // Update ability if aged up
                if (agedUp) {
                    const ability = calculateBoost(owl);
                    if (ability) {
                        const abilityString = JSON.stringify(ability);
                        db.run(
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [abilityString, owl.petId],
                            (err) => {
                                if (err) console.error("❌ Failed to update Owl ability (active):", err);
                            }
                        );
                    }
                }
            }
        }
    }, 15 * 60 * 1000);

    // Existing pet passive aging/leveling
    setInterval(async () => {
        let pets;
        try {
            pets = await getAllAsync(`SELECT * FROM petInventory`);
            if (!Array.isArray(pets)) return;
        } catch (err) {
            console.error("❌ Failed to load pets from DB:", err);
            return;
        }

        const rarityTiers = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine'];
        const maxWeight = 5.0;
        const maxQuality = 5.0;

        for (let pet of pets) {
            if (pet.name === "Owl") continue;

            pet = updateHunger(pet);

            if (pet.hunger > 0) {
                const baseXp = 1;
                const xpGain = pet.hunger > 90 ? baseXp * 2 : baseXp;
                pet.ageXp = (pet.ageXp || 0) + xpGain;

                pet.age = pet.age || 1;
                pet.level = pet.level || 1;
                pet.rarity = pet.rarity || 'Common';

                let agedUp = false;

                while (true) {
                    const xpRequired = getXpRequired(pet.level, pet.age, pet.rarity);

                    if (pet.ageXp >= xpRequired) {
                        pet.ageXp -= xpRequired;
                        pet.age += 1;
                        agedUp = true;

                        if (pet.age % 5 === 0 && pet.weight < maxWeight) {
                            const weightGain = Math.random() * (5.0 - 0.1) + 0.1;
                            pet.weight = Math.min(pet.weight + weightGain, maxWeight);
                        }

                        if (pet.age % 10 === 0 && pet.quality < maxQuality) {
                            const qualityGain = Math.random() * (1.0 - 0.01) + 0.01;
                            pet.quality = Math.min(pet.quality + qualityGain, maxQuality);
                        }
                    } else {
                        break;
                    }
                }

                if (agedUp) {
                    const ability = calculateBoost(pet);

                    if (ability) {
                        const abilityString = JSON.stringify(ability);

                        db.run(
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [abilityString, pet.petId],
                            (err) => {
                                if (err) console.error("❌ Failed to update ability:", err);
                                else console.log(`🔁 Updated ability for ${pet.name}: ${abilityString}`);
                            }
                        );
                    }
                }

                db.run(
                    `UPDATE petInventory SET age = ?, ageXp = ?, weight = ?, quality = ? WHERE petId = ?`,
                    [pet.age, pet.ageXp, pet.weight, pet.quality, pet.petId],
                    (err) => {
                        if (err) console.error("❌ Failed to update pet stats:", err);
                    }
                );
            }
        }
    }, 1000);
}