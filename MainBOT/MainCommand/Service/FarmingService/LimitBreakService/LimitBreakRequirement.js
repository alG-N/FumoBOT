const fs = require('fs');
const path = require('path');
const FumoPool = require('../../../Data/FumoPool');

const REQUIREMENTS_FILE = path.join(__dirname, '../../../Data/limitBreakRequirements.json');

// Initialize requirements file if it doesn't exist
function initializeRequirementsFile() {
    if (!fs.existsSync(REQUIREMENTS_FILE)) {
        fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify({}), 'utf8');
    }
}

// Load all requirements
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

// Save requirements
function saveRequirements(requirements) {
    try {
        fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify(requirements, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving limit break requirements:', error);
    }
}

// Get fumo pool based on stage difficulty
function getFumoPoolByStage(stage) {
    const allFumos = FumoPool.getRaw();

    // Filter out fumos that are available in crate/pray pools
    const availableFumos = allFumos.filter(f =>
        f.availability.crate || f.availability.pray
    );

    // Stage 1-25: Easy (Common to Epic)
    if (stage <= 25) {
        return availableFumos.filter(f =>
            ['Common', 'UNCOMMON', 'RARE', 'EPIC'].includes(f.rarity)
        );
    }

    // Stage 26-50: Medium (Rare to Legendary)
    if (stage <= 50) {
        return availableFumos.filter(f =>
            ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY'].includes(f.rarity)
        );
    }

    // Stage 51-75: Hard (Epic to Mythical)
    if (stage <= 75) {
        return availableFumos.filter(f =>
            ['EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL'].includes(f.rarity)
        );
    }

    // Stage 76-100: Impossible (Mythical+)
    return availableFumos.filter(f =>
        ['MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(f.rarity)
    );
}

// Generate random fumo requirement based on stage
function generateFumoRequirement(stage, includeShiny = false, includeAlg = false) {
    const pool = getFumoPoolByStage(stage);

    if (pool.length === 0) {
        console.warn(`No fumos available for stage ${stage}, falling back`);
        return 'Reimu(Common)';
    }

    const randomFumo = pool[Math.floor(Math.random() * pool.length)];
    let fumoName = `${randomFumo.name}(${randomFumo.rarity})`;

    // Add traits based on flags
    if (includeAlg) {
        fumoName += '[🌟alG]';
    } else if (includeShiny) {
        fumoName += '[✨SHINY]';
    }

    return fumoName;
}

// Generate requirements for a specific stage
function generateStageRequirements(stage) {
    const requirements = {
        fumos: []
    };

    // Stage 1-25: Easy - 1 fumo, no trait required (but can accept trait)
    if (stage <= 25) {
        requirements.fumos.push({
            name: generateFumoRequirement(stage, false, false),
            allowAnyTrait: true // User can use trait or non-trait version
        });
    }
    // Stage 26-50: Medium - 1 higher rarity fumo, no trait required
    else if (stage <= 50) {
        requirements.fumos.push({
            name: generateFumoRequirement(stage, false, false),
            allowAnyTrait: true,
            higherRarity: true // Needs to be from higher rarity pool
        });
    }
    // Stage 51-75: Hard - 1 higher rarity fumo, MUST have trait
    else if (stage <= 75) {
        // 20% chance for alG, 80% chance for shiny
        const useAlg = Math.random() < 0.2;
        requirements.fumos.push({
            name: generateFumoRequirement(stage, !useAlg, useAlg),
            requireTrait: true,
            higherRarity: true
        });
    }
    // Stage 76-100: Very Hard - 2 fumos, MUST have trait
    else if (stage <= 100) {
        for (let i = 0; i < 2; i++) {
            // 20% chance for alG, 80% chance for shiny
            const useAlg = Math.random() < 0.2;
            requirements.fumos.push({
                name: generateFumoRequirement(stage, !useAlg, useAlg),
                requireTrait: true
            });
        }
    }
    // Stage 101-150: Impossible - 2-3 fumos, MUST have trait
    else {
        // Determine if 2 or 3 fumos (50/50 chance)
        const fumoCount = Math.random() < 0.5 ? 2 : 3;

        for (let i = 0; i < fumoCount; i++) {
            // 25% chance for alG, 75% chance for shiny
            const useAlg = Math.random() < 0.25;
            requirements.fumos.push({
                name: generateFumoRequirement(stage, !useAlg, useAlg),
                requireTrait: true
            });
        }
    }

    return requirements;
}

// Get or create requirement for a user at their current stage
function getRequirementForUser(userId, currentStage) {
    const allRequirements = loadRequirements();

    // If user doesn't have a requirement, or their requirement is for a different stage, generate new one
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

// Clear requirement for user (after successful break)
function clearRequirementForUser(userId) {
    const allRequirements = loadRequirements();
    delete allRequirements[userId];
    saveRequirements(allRequirements);
}

// Check if user has required fumos in inventory
async function validateUserHasFumos(userId, requiredFumos) {
    const { all } = require('../../../Core/database');

    const results = [];

    for (const requirement of requiredFumos) {
        const baseName = requirement.name;

        if (requirement.allowAnyTrait) {
            // Check for any version (base, shiny, or alG)
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
            // Must have exact trait version
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