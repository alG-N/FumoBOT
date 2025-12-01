const db = require('../../../Core/Database/dbSetting');
const { dbAll, dbRun } = require('../Utilities/dbUtils');
const { getXpRequired, calculateBoost } = require('../Utilities/petUtils');

class OwlAbility {
    constructor() {
        this.petType = 'Owl';
        this.passiveInterval = 1000; 
        this.activeInterval = 15 * 60 * 1000; 
    }

    initialize() {
        setInterval(async () => {
            await this.givePassiveExp();
        }, this.passiveInterval);

        setInterval(async () => {
            await this.giveActiveExp();
        }, this.activeInterval);

        console.log(`✅ ${this.petType} ability system initialized`);
    }

    async givePassiveExp() {
        try {
            const usersWithOwl = await dbAll(db, `
                SELECT DISTINCT e.userId
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE p.name = ?
            `, [this.petType]);

            for (const user of usersWithOwl) {
                const equippedOwls = await dbAll(db, `
                    SELECT p.*
                    FROM equippedPets e
                    JOIN petInventory p ON e.petId = p.petId
                    WHERE e.userId = ? AND p.name = ?
                `, [user.userId, this.petType]);

                let totalExpPerSec = 0;
                for (const owl of equippedOwls) {
                    let ability = owl.ability;
                    
                    if (!ability || typeof ability === "string") {
                        try {
                            ability = JSON.parse(ability);
                        } catch {
                            ability = calculateBoost(owl);
                        }
                    }

                    if (ability && ability.amount && typeof ability.amount.passive === "number") {
                        totalExpPerSec += ability.amount.passive;
                    }
                }

                if (totalExpPerSec === 0) continue;

                const userPets = await dbAll(db, `
                    SELECT * FROM petInventory
                    WHERE userId = ? AND type = 'pet'
                `, [user.userId]);

                for (let pet of userPets) {
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

                    await dbRun(db,
                        `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                        [pet.age, pet.ageXp, pet.petId]
                    );

                    if (agedUp) {
                        const ability = calculateBoost(pet);
                        if (ability) {
                            await dbRun(db,
                                `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                                [JSON.stringify(ability), pet.petId]
                            );
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error in ${this.petType} passive exp:`, error);
        }
    }

    async giveActiveExp() {
        try {
            const usersWithOwl = await dbAll(db, `
                SELECT DISTINCT e.userId
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE p.name = ?
            `, [this.petType]);

            for (const user of usersWithOwl) {
                const equippedOwls = await dbAll(db, `
                    SELECT p.*
                    FROM equippedPets e
                    JOIN petInventory p ON e.petId = p.petId
                    WHERE e.userId = ? AND p.name = ?
                `, [user.userId, this.petType]);

                for (let owl of equippedOwls) {
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

                    await dbRun(db,
                        `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                        [owl.age, owl.ageXp, owl.petId]
                    );

                    if (agedUp) {
                        const ability = calculateBoost(owl);
                        if (ability) {
                            await dbRun(db,
                                `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                                [JSON.stringify(ability), owl.petId]
                            );
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error in ${this.petType} active exp:`, error);
        }
    }
}

module.exports = OwlAbility;