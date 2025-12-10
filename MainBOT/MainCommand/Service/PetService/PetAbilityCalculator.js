const { PET_ABILITIES } = require('../../Configuration/petConfig');

class PetAbilityCalculator {
    static calculateCoinBoost(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'Coin') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const boost = Math.min(abilityData.base + factor, abilityData.max);

        return {
            type: 'Coin',
            amount: boost,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculateGemBoost(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'Gem') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const boost = Math.min(abilityData.base + factor, abilityData.max);

        return {
            type: 'Gem',
            amount: boost,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculateLuckBoost(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'Luck') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const boost = Math.min(abilityData.base + factor, abilityData.max);

        return {
            type: 'Luck',
            amount: boost,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculateIncomeMultiplier(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'Income') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const boost = Math.min(abilityData.base + factor, abilityData.max);

        return {
            type: 'Income',
            amount: boost,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculateItemChance(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'ItemChance') return null;

        const chance = Math.min(
            abilityData.base + (weight + quality) * Math.sqrt(level),
            abilityData.max
        );

        return {
            type: 'ItemChance',
            amount: {
                interval: abilityData.interval,
                chance
            },
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculateCooldownReduction(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'Cooldown') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const reduction = Math.max(
            abilityData.max,
            abilityData.base - (factor * 0.01)
        );

        return {
            type: 'Cooldown',
            amount: reduction,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculateHatchSpeed(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'HatchSpeed') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const speed = Math.min(abilityData.base + factor * 0.1, abilityData.max);

        return {
            type: 'HatchSpeed',
            amount: speed,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static calculatePassiveExp(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'ExpBonus') return null;

        const passive = Math.min(
            abilityData.base + ((quality + weight) * Math.log(age + 1) * Math.sqrt(level)) / 30,
            abilityData.max
        );

        const activeGain = Math.min(
            abilityData.activeGain + level * 5,
            abilityData.maxGain
        );

        return {
            type: 'ExpBonus',
            amount: {
                passive,
                activeInterval: abilityData.activeInterval,
                activeGain
            },
            boostType: abilityData.type,
            abilityName: abilityData.abilityName,
            secondaryAbility: `Active Gain: +${activeGain} exp every ${Math.floor(abilityData.activeInterval / 1000)}s`
        };
    }

    static calculateAllStatsBoost(pet) {
        const quality = (pet.quality || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const weight = (pet.weight || 1) * (this.hasAlterGolden(pet.petName) ? 2 : 1);
        const level = pet.level || 1;
        const age = pet.age || 1;

        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData || abilityData.stat !== 'AllStats') return null;

        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 50;
        const boost = Math.min(abilityData.base + factor * 0.01, abilityData.max);

        return {
            type: 'AllStats',
            amount: boost,
            boostType: abilityData.type,
            abilityName: abilityData.abilityName
        };
    }

    static hasAlterGolden(petName) {
        return petName === 'alterGolden';
    }

    static calculateAbilityForPet(pet) {
        const abilityData = PET_ABILITIES[pet.name];
        if (!abilityData) return null;

        switch (abilityData.stat) {
            case 'Coin':
                return this.calculateCoinBoost(pet);
            case 'Gem':
                return this.calculateGemBoost(pet);
            case 'Luck':
                return this.calculateLuckBoost(pet);
            case 'Income':
                return this.calculateIncomeMultiplier(pet);
            case 'ItemChance':
                return this.calculateItemChance(pet);
            case 'Cooldown':
                return this.calculateCooldownReduction(pet);
            case 'HatchSpeed':
                return this.calculateHatchSpeed(pet);
            case 'ExpBonus':
                return this.calculatePassiveExp(pet);
            case 'AllStats':
                return this.calculateAllStatsBoost(pet);
            default:
                return null;
        }
    }

    static getAbilityDescription(ability) {
        if (!ability) return 'No ability';

        const { abilityName, type, amount, boostType, secondaryAbility } = ability;

        let description = `**${abilityName}**:`;

        if (boostType === 'percent') {
            description += ` +${amount.toFixed(2)}% ${type}`;
        } else if (boostType === 'multiplier') {
            description += ` x${amount.toFixed(2)} ${type}`;
        } else if (boostType === 'interval-chance') {
            description += ` ${amount.chance.toFixed(1)}% chance every ${Math.floor(amount.interval / 1000)}s`;
        } else if (boostType === 'passive') {
            description += ` +${amount.passive.toFixed(2)} exp/s to all pets`;
            if (secondaryAbility) {
                description += `\n${secondaryAbility}`;
            }
        }

        return description;
    }

    static getAbilityUpgradePreview(pet, targetLevel, targetAge) {
        const currentAbility = this.calculateAbilityForPet(pet);
        
        const upgradedPet = {
            ...pet,
            level: targetLevel || pet.level,
            age: targetAge || pet.age
        };
        const upgradedAbility = this.calculateAbilityForPet(upgradedPet);

        return {
            current: currentAbility,
            upgraded: upgradedAbility,
            improvement: this.calculateImprovement(currentAbility, upgradedAbility)
        };
    }

    static calculateImprovement(current, upgraded) {
        if (!current || !upgraded) return null;

        if (current.boostType === 'percent' || current.boostType === 'multiplier') {
            const diff = upgraded.amount - current.amount;
            const percentIncrease = ((diff / current.amount) * 100).toFixed(2);
            return {
                absolute: diff.toFixed(2),
                percent: percentIncrease
            };
        } else if (current.boostType === 'interval-chance') {
            const diff = upgraded.amount.chance - current.amount.chance;
            return {
                absolute: diff.toFixed(2),
                percent: ((diff / current.amount.chance) * 100).toFixed(2)
            };
        } else if (current.boostType === 'passive') {
            const passiveDiff = upgraded.amount.passive - current.amount.passive;
            const activeDiff = upgraded.amount.activeGain - current.amount.activeGain;
            return {
                passive: passiveDiff.toFixed(2),
                active: activeDiff.toFixed(0)
            };
        }

        return null;
    }
}

module.exports = PetAbilityCalculator;