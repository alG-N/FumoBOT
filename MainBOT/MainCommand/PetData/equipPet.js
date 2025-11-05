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
const getPet = (petId) => new Promise((resolve, reject) => {
    db.get(`SELECT * FROM petInventory WHERE petId = ?`, [petId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});
const userBoostIntervals = new Map(); // Track all boost timers per user
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
        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20; // Dividing slows growth
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
        const passive = Math.min(base + level * 0.01, max);
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
module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        const userId = message.author.id;
        const content = message.content.trim().toLowerCase();

        // Equip pet(s)
        if (
            content.startsWith('.equippet') ||
            content.startsWith('.ep') ||
            content.startsWith('.equipbest') ||
            content.startsWith('.eb')
        ) {
            let args, petName, isEquipBest;
            if (content.startsWith('.equipbest') || content.startsWith('.eb')) {
            isEquipBest = true;
            args = [];
            petName = 'best';
            } else {
            args = message.content
                .replace(/^\.ep\b|^\.equippet\b/i, '')
                .trim()
                .split(/ +/);
            petName = args.join(" ").toLowerCase();
            isEquipBest = petName === 'best';
            }

            db.all(`SELECT * FROM petInventory WHERE userId = ?`, [userId], (err, pets) => {
            if (err) return message.reply("❌ Failed to fetch pets.");
            if (!pets || pets.length === 0) return message.reply("❌ You don't own any pets.");

            db.all(`SELECT petId FROM equippedPets WHERE userId = ?`, [userId], (err, equipped) => {
                if (err) return message.reply("❌ Failed to check equipped pets.");
                const equippedIds = equipped.map(e => e.petId);
                let petsToEquip = [];

                if (isEquipBest) {
                const scored = pets
                    .filter(p => !equippedIds.includes(p.petId))
                    .map(p => ({
                    ...p,
                    score: (p.quality + p.weight) * (p.age || 1) * (p.level || 1)
                    }));
                petsToEquip = scored.sort((a, b) => b.score - a.score).slice(0, 5);
                if (petsToEquip.length === 0)
                    return message.reply("❌ No unequipped pets available to equip as best.");
                } else {
                const matched = pets.filter(p => p.name.toLowerCase() === petName);
                if (matched.length === 0)
                    return message.reply("❌ You don't own a pet with that name.");
                const availablePet = matched.find(p => !equippedIds.includes(p.petId));
                if (!availablePet)
                    return message.reply(`❌ All of your **${petName}** pets are already equipped.`);
                if (equipped.length >= 5)
                    return message.reply("❌ You can only equip up to 5 pets.");
                petsToEquip = [availablePet];
                }

                db.serialize(() => {
                if (isEquipBest) {
                    db.run(`DELETE FROM equippedPets WHERE userId = ?`, [userId]);
                }
                petsToEquip.forEach(pet => {
                    db.run(`INSERT INTO equippedPets (userId, petId) VALUES (?, ?)`, [userId, pet.petId]);
                    const ability = calculateBoost(pet);
                    if (ability) {
                    db.run(`UPDATE petInventory SET ability = ? WHERE petId = ?`, [JSON.stringify(ability), pet.petId]);
                    }
                });
                clearPetBoosts(userId, () => {
                    applyPetBoosts(userId, petsToEquip);
                });
                const petNames = petsToEquip.map(p => `**${p.name}**`).join(', ');
                message.reply(`✅ Equipped ${isEquipBest ? 'your best pets' : petNames} successfully!`);
                });
            });
            });
        }

        // Unequip pet(s)
        else if (
            content.startsWith('.unequip') ||
            content.startsWith('.ue') ||
            content.startsWith('.unequipall') ||
            content.startsWith('.uea')
        ) {
            let args, isUnequipAll;
            if (content.startsWith('.unequipall') || content.startsWith('.uea')) {
            isUnequipAll = true;
            args = '';
            } else {
            args = message.content
                .replace(/^\.uea\b|^\.unequipall\b|^\.ue\b|^\.unequip\b/i, '')
                .trim()
                .toLowerCase();
            isUnequipAll = args === 'all';
            }

            if (isUnequipAll) {
            db.run(`DELETE FROM equippedPets WHERE userId = ?`, [userId], (err) => {
                if (err) return message.reply("❌ Failed to unequip all pets.");
                clearPetBoosts(userId);
                message.reply(`✅ All pets have been unequipped.`);
            });
            } else {
            if (!args) return message.reply("❌ Please provide a pet name to unequip.");
            db.all(`
                SELECT p.* FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE e.userId = ? AND LOWER(p.name) = LOWER(?)
            `, [userId, args], (err, pets) => {
                if (err) return message.reply("❌ Database error.");
                if (!pets || pets.length === 0) return message.reply("❌ No equipped pet found with that name.");
                const petToRemove = pets[0];
                db.run(`DELETE FROM equippedPets WHERE userId = ? AND petId = ?`, [userId, petToRemove.petId], (err) => {
                if (err) return message.reply("❌ Failed to unequip the pet.");
                db.all(`
                    SELECT p.* FROM equippedPets e
                    JOIN petInventory p ON e.petId = p.petId
                    WHERE e.userId = ?
                `, [userId], (err, updatedPets) => {
                    clearPetBoosts(userId, () => applyPetBoosts(userId, updatedPets));
                    message.reply(`✅ Unequipped **${petToRemove.name}**.`);
                });
                });
            });
            }
        }
    });

    // Apply boosts based on equipped pets' abilities
    function applyPetBoosts(userId, equippedPets = null) {
        if (equippedPets) {
            applyBoostLogic(userId, equippedPets);
        } else {
            db.all(`
                SELECT p.* FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE e.userId = ?
            `, [userId], (err, pets) => {
                if (err || !pets.length) return;
                applyBoostLogic(userId, pets);
            });
        }
    }

    function applyBoostLogic(userId, equippedPets) {
        const boostMap = {};
        equippedPets.forEach(pet => {
            if (!pet.ability) return;
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch { return; }
            const { type, amount, boostType } = ability;
            const key = type.toLowerCase();
            if (!boostMap[key]) boostMap[key] = { boostType, values: [], pets: [] };
            boostMap[key].values.push(amount);
            boostMap[key].pets.push({ petId: pet.petId, name: pet.name });
        });

        const insert = db.prepare(`
            INSERT OR REPLACE INTO activeBoosts (
                userId, type, source, multiplier, expiresAt, stack
            ) VALUES (?, ?, ?, ?, NULL, 1)
        `);

        Object.entries(boostMap).forEach(([type, { boostType, values, pets }]) => {
            const petNames = pets.map(p => p.name).join(', ');
            let multiplier = 1;
            if (boostType === 'multiplier') {
                values.forEach(val => multiplier *= val);
                db.run(`INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier) VALUES (?, ?, ?, ?)`, [userId, type, petNames, multiplier]);
                insert.run(userId, type, petNames, multiplier, function(err) {
                    if (err) {
                        // console.log(`[activeBoosts] Failed to add boost for user ${userId}, type ${type}:`, err);
                    } else {
                        console.log(`[activeBoosts] Added boost for user ${userId}, type ${type}, pets: ${petNames}, multiplier: ${multiplier}`);
                    }
                });
            }
            if (boostType === 'passive') {
                const total = values.reduce((a, b) => a + (b.passive || 0), 0);
                db.run(`INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier) VALUES (?, ?, ?, ?)`, [userId, type, petNames, 1 + total]);
                insert.run(userId, type, petNames, 1 + total, function(err) {
                    if (err) {
                        // console.log(`[activeBoosts] Failed to add passive boost for user ${userId}, type ${type}:`, err);
                    } else {
                        // console.log(`[activeBoosts] Added passive boost for user ${userId}, type ${type}, pets: ${petNames}, value: ${1 + total}`);
                    }
                });
            }
            if (boostType === 'interval-chance') {
                values.forEach((val, i) => {
                    const { chance, interval } = val;
                    setInterval(() => {
                        if (Math.random() * 100 < chance) {
                            giveRandomItem(userId);
                        }
                    }, interval);
                });
            }
            if (type === 'expbonus' && boostType === 'passive') {
                pets.forEach((pet, i) => {
                    const { activeInterval, activeGain } = values[i];
                    setInterval(() => {
                        db.run(`UPDATE petInventory SET ageXp = ageXp + ? WHERE petId = ?`, [activeGain, pet.petId]);
                    }, activeInterval);
                });
            }
            // Ensure Bunny, Cat, Dog buffs are applied (percent type)
            if (boostType === 'percent') {
                // For percent boosts, sum all values and apply as a multiplier (1 + percent/100)
                const totalPercent = values.reduce((a, b) => a + b, 0);
                db.run(`INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier) VALUES (?, ?, ?, ?)`, [userId, type, petNames, 1 + totalPercent / 100]);
                insert.run(userId, type, petNames, 1 + totalPercent / 100, function(err) {
                    if (err) {
                        // console.log(`[activeBoosts] Failed to add percent boost for user ${userId}, type ${type}:`, err);
                    } else {
                        // console.log(`[activeBoosts] Added percent boost for user ${userId}, type ${type}, pets: ${petNames}, value: ${1 + totalPercent / 100}`);
                    }
                });
            }
        });
        insert.finalize();
    }

    function clearPetBoosts(userId, callback) {
        db.all(`SELECT name FROM petInventory WHERE userId = ?`, [userId], (err, rows) => {
            if (err) {
                if (callback) callback();
                return;
            }
            const petNames = rows.map(r => r.name);
            if (!petNames.length) {
                if (callback) callback();
                return;
            }
            const query = `
                DELETE FROM activeBoosts
                WHERE userId = ? AND (${petNames.map(() => 'source LIKE ?').join(' OR ')})
            `;
            const values = [userId, ...petNames.map(name => `%${name}%`)];
            db.run(query, values, function (err) {
                if (callback) callback();
            });
        });
    }

    // Auto-refresh pet boosts every 10 seconds
    setInterval(() => {
        db.all(`SELECT DISTINCT userId FROM equippedPets`, [], (err, users) => {
            if (err) return;
            users.forEach(row => {
                const userId = row.userId;
                clearPetBoosts(userId, () => {
                    applyPetBoosts(userId);
                });
            });
        });
    }, 10000);
    
    // Helper to get the best boost source for a user and type
    client.getBestBoostSource = function(userId, type, callback) {
        db.get(`SELECT source, multiplier FROM activeBoosts WHERE userId = ? AND type = ?`, [userId, type], (err, row) => {
            if (err || !row) return callback(null);
            callback(row.source);
        });
    };

    function giveRandomItem(userId) {
        // Placeholder for item giving logic
        console.log(`Giving random item to user ${userId}`);
    }
};



