const db = require('../../../Core/Database/dbSetting');
const { dbAll, dbRun } = require('../Utilities/dbUtils');
const { getXpRequired, calculateBoost } = require('../Utilities/petUtils');

class NightOwlAbility {
    constructor() {
        this.petType = 'NightOwl';
        this.passiveInterval = 1000;
        this.activeInterval = 12 * 60 * 1000; 
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
            const usersWithNightOwl = await dbAll(db, `
                SELECT DISTINCT e.userId
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE p.name = ?
            `, [this.petType]);

            for (const user of usersWithNightOwl) {
                const equippedNightOwls = await dbAll(db, `
                    SELECT p.*
                    FROM equippedPets e
                    JOIN petInventory p ON e.petId = p.petId
                    WHERE e.userId = ? AND p.name = ?
                `, [user.userId, this.petType]);

                let totalExpPerSec = 0;
                for (const nightOwl of equippedNightOwls) {
                    let ability = nightOwl.ability;
                    
                    if (!ability || typeof ability === "string") {
                        try {
                            ability = JSON.parse(ability);
                        } catch {
                            ability = calculateBoost(nightOwl);
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
            const usersWithNightOwl = await dbAll(db, `
                SELECT DISTINCT e.userId
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE p.name = ?
            `, [this.petType]);

            for (const user of usersWithNightOwl) {
                const equippedNightOwls = await dbAll(db, `
                    SELECT p.*
                    FROM equippedPets e
                    JOIN petInventory p ON e.petId = p.petId
                    WHERE e.userId = ? AND p.name = ?
                `, [user.userId, this.petType]);

                for (let nightOwl of equippedNightOwls) {
                    const level = nightOwl.level || 1;
                    let activeGain = 200 + level * 5;
                    activeGain = Math.min(activeGain, 1000);

                    nightOwl.ageXp = (nightOwl.ageXp || 0) + activeGain;
                    let agedUp = false;

                    while (true) {
                        const xpRequired = getXpRequired(nightOwl.level || 1, nightOwl.age || 1, nightOwl.rarity || 'Common');
                        
                        if (nightOwl.ageXp >= xpRequired) {
                            nightOwl.ageXp -= xpRequired;
                            nightOwl.age = (nightOwl.age || 1) + 1;
                            agedUp = true;
                        } else {
                            break;
                        }
                    }

                    await dbRun(db,
                        `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                        [nightOwl.age, nightOwl.ageXp, nightOwl.petId]
                    );

                    if (agedUp) {
                        const ability = calculateBoost(nightOwl);
                        if (ability) {
                            await dbRun(db,
                                `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                                [JSON.stringify(ability), nightOwl.petId]
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

module.exports = NightOwlAbility;