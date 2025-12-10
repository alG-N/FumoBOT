const db = require('../../Core/database');
const PetDatabase = require('./PetDatabaseService');
const PetStats = require('./PetStatsService');

const ITEM_DROP_INTERVALS = new Map();

class PetAbilityHandler {
    static async handleItemChanceAbility(userId, petType, ability) {
        const { interval, chance } = ability.amount;
        
        if (Math.random() * 100 < chance) {
            const items = this.getRandomItems(petType);
            
            for (const { itemName, quantity } of items) {
                await db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity)
                     VALUES (?, ?, ?)
                     ON CONFLICT(userId, itemName) DO UPDATE SET
                     quantity = quantity + ?`,
                    [userId, itemName, quantity, quantity]
                );
            }
            
            return { success: true, items };
        }
        
        return { success: false };
    }

    static getRandomItems(petType) {
        const itemPools = {
            Bear: [
                { itemName: 'Stone(B)', quantity: [1, 3], weight: 40 },
                { itemName: 'Stick(B)', quantity: [1, 3], weight: 40 },
                { itemName: 'Wood(C)', quantity: [1, 2], weight: 15 },
                { itemName: 'UniqueRock(C)', quantity: 1, weight: 5 }
            ],
            PolarBear: [
                { itemName: 'Wood(C)', quantity: [1, 3], weight: 35 },
                { itemName: 'UniqueRock(C)', quantity: [1, 2], weight: 25 },
                { itemName: 'Wool(C)', quantity: [1, 2], weight: 20 },
                { itemName: 'WeirdGrass(R)', quantity: 1, weight: 15 },
                { itemName: 'FragmentOf1800s(R)', quantity: 1, weight: 5 }
            ]
        };

        const pool = itemPools[petType] || itemPools.Bear;
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        const roll = Math.random() * totalWeight;
        
        let cumulative = 0;
        for (const item of pool) {
            cumulative += item.weight;
            if (roll <= cumulative) {
                const quantity = Array.isArray(item.quantity)
                    ? Math.floor(Math.random() * (item.quantity[1] - item.quantity[0] + 1)) + item.quantity[0]
                    : item.quantity;
                
                return [{ itemName: item.itemName, quantity }];
            }
        }
        
        return [{ itemName: pool[0].itemName, quantity: 1 }];
    }

    static async applyCooldownReduction(userId, multiplier) {
        const boostData = {
            type: 'summonCooldown',
            amount: multiplier,
            boostType: 'multiplier'
        };

        await db.run(
            `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt)
             VALUES (?, ?, ?, ?, NULL)`,
            [userId, 'summonCooldown', 'Pig', multiplier]
        );

        return boostData;
    }

    static async applyHatchSpeedBoost(userId, multiplier) {
        await db.run(
            `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt)
             VALUES (?, ?, ?, ?, NULL)`,
            [userId, 'HatchSpeed', 'Chicken', multiplier]
        );

        return { type: 'HatchSpeed', multiplier };
    }

    static async applyAllStatsBoost(userId, multiplier) {
        const types = ['Coin', 'Gem', 'Income'];
        
        for (const type of types) {
            await db.run(
                `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                 VALUES (?, ?, ?, ?, NULL)`,
                [userId, type, 'Butterfly', multiplier]
            );
        }

        return { type: 'AllStats', multiplier };
    }

    static calculateHatchTimeReduction(baseTime, speedMultiplier) {
        return Math.floor(baseTime / speedMultiplier);
    }

    static async getActiveItemChancePets(userId) {
        const equipped = await PetDatabase.getEquippedPets(userId, false);
        
        return equipped.filter(pet => {
            if (!pet.ability) return false;
            
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                return false;
            }
            
            return ability.boostType === 'interval-chance';
        });
    }

    static async processAllItemChances(userId) {
        const pets = await this.getActiveItemChancePets(userId);
        const results = [];
        
        for (const pet of pets) {
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                continue;
            }
            
            const result = await this.handleItemChanceAbility(userId, pet.name, ability);
            if (result.success) {
                results.push({
                    petName: pet.petName,
                    petType: pet.name,
                    items: result.items
                });
            }
        }
        
        return results;
    }

    static async getCooldownMultiplier(userId) {
        const equipped = await PetDatabase.getEquippedPets(userId, false);
        let totalMultiplier = 1;
        
        for (const pet of equipped) {
            if (pet.name !== 'Pig') continue;
            
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                continue;
            }
            
            if (ability.type === 'Cooldown') {
                totalMultiplier *= ability.amount;
            }
        }
        
        return totalMultiplier;
    }

    static async getHatchSpeedMultiplier(userId) {
        const equipped = await PetDatabase.getEquippedPets(userId, false);
        let totalMultiplier = 1;
        
        for (const pet of equipped) {
            if (pet.name !== 'Chicken') continue;
            
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                continue;
            }
            
            if (ability.type === 'HatchSpeed') {
                totalMultiplier *= ability.amount;
            }
        }
        
        return totalMultiplier;
    }

    static async getPassiveExpPets(userId) {
        const equipped = await PetDatabase.getEquippedPets(userId, false);
        const expPets = [];
        
        for (const pet of equipped) {
            if (pet.name !== 'Owl' && pet.name !== 'NightOwl') continue;
            
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                continue;
            }
            
            if (ability.boostType === 'passive') {
                expPets.push({
                    pet,
                    passive: ability.amount.passive,
                    activeGain: ability.amount.activeGain,
                    activeInterval: ability.amount.activeInterval
                });
            }
        }
        
        return expPets;
    }

    static async applyPetAbilitiesToBoosts(userId) {
        const equipped = await PetDatabase.getEquippedPets(userId, false);
        
        for (const pet of equipped) {
            if (!pet.ability) continue;
            
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                continue;
            }

            if (ability.boostType === 'multiplier' || ability.boostType === 'percent') {
                await db.run(
                    `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                     VALUES (?, ?, ?, ?, NULL)`,
                    [userId, ability.type, pet.name, ability.amount]
                );
            }
        }
    }

    static async getEquippedPetsSummary(userId) {
        const equipped = await PetDatabase.getEquippedPets(userId, false);
        const summary = {
            coinBoost: 1,
            gemBoost: 1,
            luckBoost: 0,
            incomeMultiplier: 1,
            cooldownMultiplier: 1,
            hatchSpeedMultiplier: 1,
            passiveExp: 0,
            itemChancePets: [],
            allStatsBoost: 1
        };
        
        for (const pet of equipped) {
            if (!pet.ability) continue;
            
            let ability;
            try {
                ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
            } catch {
                continue;
            }

            switch (ability.type) {
                case 'Coin':
                    if (ability.boostType === 'percent') {
                        summary.coinBoost *= (1 + ability.amount / 100);
                    } else if (ability.boostType === 'multiplier') {
                        summary.coinBoost *= ability.amount;
                    }
                    break;
                    
                case 'Gem':
                    if (ability.boostType === 'percent') {
                        summary.gemBoost *= (1 + ability.amount / 100);
                    } else if (ability.boostType === 'multiplier') {
                        summary.gemBoost *= ability.amount;
                    }
                    break;
                    
                case 'Luck':
                    if (ability.boostType === 'percent') {
                        summary.luckBoost += ability.amount;
                    }
                    break;
                    
                case 'Income':
                    if (ability.boostType === 'multiplier') {
                        summary.incomeMultiplier *= ability.amount;
                    }
                    break;
                    
                case 'Cooldown':
                    if (ability.boostType === 'multiplier') {
                        summary.cooldownMultiplier *= ability.amount;
                    }
                    break;
                    
                case 'HatchSpeed':
                    if (ability.boostType === 'multiplier') {
                        summary.hatchSpeedMultiplier *= ability.amount;
                    }
                    break;
                    
                case 'ExpBonus':
                    if (ability.boostType === 'passive' && ability.amount.passive) {
                        summary.passiveExp += ability.amount.passive;
                    }
                    break;
                    
                case 'ItemChance':
                    if (ability.boostType === 'interval-chance') {
                        summary.itemChancePets.push({
                            name: pet.petName,
                            type: pet.name,
                            chance: ability.amount.chance,
                            interval: ability.amount.interval
                        });
                    }
                    break;
                    
                case 'AllStats':
                    if (ability.boostType === 'multiplier') {
                        summary.allStatsBoost *= ability.amount;
                    }
                    break;
            }
        }

        summary.coinBoost *= summary.allStatsBoost;
        summary.gemBoost *= summary.allStatsBoost;
        summary.incomeMultiplier *= summary.allStatsBoost;
        
        return summary;
    }
}

module.exports = PetAbilityHandler;