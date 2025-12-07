const fs = require('fs');
const path = require('path');
const FumoPool = require('../../../Data/FumoPool');

const REQUIREMENTS_FILE = path.join(__dirname, '../../../Data/limitBreakRequirements.json');

function initializeRequirementsFile() {
    if (!fs.existsSync(REQUIREMENTS_FILE)) {
        fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify({}), 'utf8');
    }
}

function loadRequirements() {
    initializeRequirementsFile();
    try {
        const data = fs.readFileSync(REQUIREMENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading limit break requirements:', error);
        return {};
    }
}

function saveRequirements(requirements) {
    try {
        fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify(requirements, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving limit break requirements:', error);
    }
}

function getFumoPoolByStage(stage) {
    const allFumos = FumoPool.getRaw();

    const availableFumos = allFumos.filter(f =>
        f.availability.crate || f.availability.pray
    );

    if (stage <= 50) {
        return availableFumos.filter(f =>
            ['Common', 'UNCOMMON', 'RARE', 'EPIC'].includes(f.rarity)
        );
    }

    if (stage <= 100) {
        return availableFumos.filter(f =>
            ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY'].includes(f.rarity)
        );
    }

    return availableFumos.filter(f =>
        ['EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL'].includes(f.rarity)
    );
}

function generateFumoRequirement(stage, includeShiny = false, includeAlg = false) {
    const pool = getFumoPoolByStage(stage);

    if (pool.length === 0) {
        console.warn(`No fumos available for stage ${stage}, falling back`);
        return 'Reimu(Common)';
    }

    const randomFumo = pool[Math.floor(Math.random() * pool.length)];
    let fumoName = `${randomFumo.name}(${randomFumo.rarity})`;

    if (includeAlg) {
        fumoName += '[🌟alG]';
    } else if (includeShiny) {
        fumoName += '[✨SHINY]';
    }

    return fumoName;
}

function generateStageRequirements(stage) {
    const requirements = {
        fumos: []
    };

    if (stage <= 50) {
        requirements.fumos.push({
            name: generateFumoRequirement(stage, false, false),
            allowAnyTrait: true
        });
    }
    else if (stage <= 100) {
        requirements.fumos.push({
            name: generateFumoRequirement(stage, false, false),
            allowAnyTrait: true,
            higherRarity: true
        });
    }
    else {
        const useAlg = Math.random() < 0.15;
        requirements.fumos.push({
            name: generateFumoRequirement(stage, !useAlg, useAlg),
            requireTrait: true,
            higherRarity: true
        });
    }

    return requirements;
}

function getRequirementForUser(userId, currentStage) {
    const allRequirements = loadRequirements();

    if (!allRequirements[userId] || allRequirements[userId].stage !== currentStage) {
        allRequirements[userId] = {
            stage: currentStage,
            requirements: generateStageRequirements(currentStage),
            generatedAt: Date.now()
        };
        saveRequirements(allRequirements);
    }

    return allRequirements[userId];
}

function clearRequirementForUser(userId) {
    const allRequirements = loadRequirements();
    delete allRequirements[userId];
    saveRequirements(allRequirements);
}

async function validateUserHasFumos(userId, requiredFumos) {
    const { all } = require('../../../Core/database');

    const results = [];

    for (const requirement of requiredFumos) {
        const baseName = requirement.name;

        if (requirement.allowAnyTrait) {
            const baseWithoutTrait = baseName.replace(/\[.*?\]/g, '');
            const variants = [
                baseWithoutTrait,
                baseWithoutTrait + '[✨SHINY]',
                baseWithoutTrait + '[🌟alG]'
            ];

            let found = false;
            let foundId = null;
            let foundName = null;

            for (const variant of variants) {
                const rows = await all(
                    `SELECT id, fumoName FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT 1`,
                    [userId, variant]
                );

                if (rows && rows.length > 0) {
                    found = true;
                    foundId = rows[0].id;
                    foundName = rows[0].fumoName;
                    break;
                }
            }

            results.push({
                required: baseWithoutTrait,
                found,
                id: foundId,
                actualName: foundName,
                allowAnyTrait: true
            });
        } else if (requirement.requireTrait) {
            const rows = await all(
                `SELECT id, fumoName FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT 1`,
                [userId, baseName]
            );

            results.push({
                required: baseName,
                found: rows && rows.length > 0,
                id: rows && rows.length > 0 ? rows[0].id : null,
                actualName: baseName,
                requireTrait: true
            });
        }
    }

    return results;
}

module.exports = {
    getRequirementForUser,
    clearRequirementForUser,
    validateUserHasFumos,
    generateStageRequirements,
    initializeRequirementsFile
};