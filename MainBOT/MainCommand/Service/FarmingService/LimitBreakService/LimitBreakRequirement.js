const fs = require('fs');
const path = require('path');
const FumoPool = require('../../../Data/FumoPool');

const REQUIREMENTS_FILE = path.join(__dirname, '../../../Data/limitBreakRequirements.json');
const MAX_LIMIT_BREAKS = 1000;

const TIER_CONFIG = {
    NOVICE: {
        name: 'Novice',
        emoji: '🌱',
        range: [1, 50],
        rarities: ['Common', 'UNCOMMON', 'RARE', 'EPIC'],
        traitChance: { shiny: 0, alg: 0, void: 0, glitched: 0 },
        fumoCount: 1,
        description: 'Beginning your journey'
    },
    ADEPT: {
        name: 'Adept',
        emoji: '⚔️',
        range: [51, 150],
        rarities: ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY'],
        traitChance: { shiny: 0.1, alg: 0, void: 0, glitched: 0 },
        fumoCount: 1,
        description: 'Gaining strength'
    },
    EXPERT: {
        name: 'Expert',
        emoji: '🔥',
        range: [151, 300],
        rarities: ['EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL'],
        traitChance: { shiny: 0.25, alg: 0.05, void: 0, glitched: 0 },
        fumoCount: 1,
        description: 'Mastering the craft'
    },
    MASTER: {
        name: 'Master',
        emoji: '💎',
        range: [301, 500],
        rarities: ['LEGENDARY', 'MYTHICAL', 'EXCLUSIVE'],
        traitChance: { shiny: 0.4, alg: 0.15, void: 0.05, glitched: 0 },
        fumoCount: 2,
        description: 'Power beyond limits'
    },
    GRANDMASTER: {
        name: 'Grandmaster',
        emoji: '👑',
        range: [501, 750],
        rarities: ['MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL'],
        traitChance: { shiny: 0.5, alg: 0.25, void: 0.1, glitched: 0.05 },
        fumoCount: 2,
        description: 'Among the elite'
    },
    TRANSCENDENT: {
        name: 'Transcendent',
        emoji: '🌌',
        range: [751, 1000],
        rarities: ['EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'],
        traitChance: { shiny: 0.3, alg: 0.35, void: 0.2, glitched: 0.15 },
        fumoCount: 3,
        description: 'Beyond mortal comprehension'
    }
};

// Trait tags mapping
const TRAIT_TAGS = {
    shiny: '[✨SHINY]',
    alg: '[🌟alG]',
    void: '[🌀VOID]',
    glitched: '[🔮GLITCHED]'
};

// Trait priority (highest = rarest, checked first)
// GLITCHED > VOID > alG > SHINY
const TRAIT_PRIORITY = ['glitched', 'void', 'alg', 'shiny'];

// Trait hierarchy levels (higher = rarer)
const TRAIT_HIERARCHY = {
    glitched: 4,  // Rarest
    void: 3,
    alg: 2,
    shiny: 1,
    none: 0
};

// Special milestone stages with unique requirements
const MILESTONE_STAGES = {
    100: { 
        name: 'Century Mark', 
        specialReq: { type: 'shiny_any', count: 1 },
        bonus: 'First major milestone!'
    },
    250: { 
        name: 'Quarter Thousand', 
        specialReq: { type: 'alg_any', count: 1 },
        bonus: 'alG sacrifice required'
    },
    500: { 
        name: 'Halfway Point', 
        specialReq: { type: 'exclusive_shiny', count: 2 },
        bonus: 'Double EXCLUSIVE SHINY sacrifice'
    },
    666: { 
        name: 'Devil\'s Number', 
        specialReq: { type: 'void_any', count: 1 },
        bonus: 'VOID sacrifice required'
    },
    750: { 
        name: 'Three Quarters', 
        specialReq: { type: 'glitched_any', count: 1 },
        bonus: 'GLITCHED sacrifice required'
    },
    888: { 
        name: 'Triple Fortune', 
        specialReq: { type: 'astral_alg', count: 1 },
        bonus: 'ASTRAL alG sacrifice'
    },
    900: { 
        name: 'Final Stretch', 
        specialReq: { type: 'multi_rare_trait', count: 2, traits: ['void', 'glitched'] },
        bonus: 'VOID + GLITCHED required'
    },
    950: { 
        name: 'Almost There', 
        specialReq: { type: 'celestial_any_trait', count: 2 },
        bonus: '2x CELESTIAL+ with traits'
    },
    999: { 
        name: 'The Penultimate', 
        specialReq: { type: 'glitched_or_void', count: 3 },
        bonus: '3x GLITCHED/VOID'
    },
    1000: { 
        name: 'ULTIMATE TRANSCENDENCE', 
        specialReq: { type: 'ultimate', count: 1 },
        bonus: 'The final challenge - TRANSCENDENT fumos with rarest traits'
    }
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

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

/**
 * Get the current tier based on stage
 */
function getTier(stage) {
    for (const [tierKey, tierData] of Object.entries(TIER_CONFIG)) {
        if (stage >= tierData.range[0] && stage <= tierData.range[1]) {
            return { key: tierKey, ...tierData };
        }
    }
    return { key: 'TRANSCENDENT', ...TIER_CONFIG.TRANSCENDENT };
}

/**
 * Get stage position within current tier (0-1 progress)
 */
function getStageProgressInTier(stage) {
    const tier = getTier(stage);
    const [min, max] = tier.range;
    return (stage - min) / (max - min);
}

/**
 * Get fumo pool filtered by tier's allowed rarities
 */
function getFumoPoolByTier(tier) {
    const allFumos = FumoPool.getRaw();
    
    const availableFumos = allFumos.filter(f =>
        f.availability.crate || f.availability.pray
    );

    return availableFumos.filter(f => tier.rarities.includes(f.rarity));
}

/**
 * Legacy function for backwards compatibility
 */
function getFumoPoolByStage(stage) {
    const tier = getTier(stage);
    return getFumoPoolByTier(tier);
}

/**
 * Roll for a trait based on tier configuration
 * Returns the trait tag or empty string
 */
function rollTrait(tier, stage) {
    const traitChances = tier.traitChance;
    
    // Apply stage progression bonus within tier (up to 50% bonus at tier end)
    const progressBonus = 1 + (getStageProgressInTier(stage) * 0.5);
    
    // Roll traits in priority order (rarest first)
    for (const trait of TRAIT_PRIORITY) {
        const baseChance = traitChances[trait] || 0;
        const adjustedChance = baseChance * progressBonus;
        
        if (adjustedChance > 0 && Math.random() < adjustedChance) {
            return { trait, tag: TRAIT_TAGS[trait] };
        }
    }
    
    return { trait: null, tag: '' };
}

/**
 * Generate a single fumo requirement with potential trait
 */
function generateFumoRequirement(stage, forceTrait = null) {
    const tier = getTier(stage);
    const pool = getFumoPoolByTier(tier);

    if (pool.length === 0) {
        console.warn(`No fumos available for stage ${stage}, falling back`);
        return { name: 'Reimu(Common)', trait: null };
    }

    const randomFumo = pool[Math.floor(Math.random() * pool.length)];
    let fumoName = `${randomFumo.name}(${randomFumo.rarity})`;
    
    let traitInfo = { trait: null, tag: '' };
    
    if (forceTrait) {
        traitInfo = { trait: forceTrait, tag: TRAIT_TAGS[forceTrait] };
    } else {
        traitInfo = rollTrait(tier, stage);
    }
    
    if (traitInfo.tag) {
        fumoName += traitInfo.tag;
    }

    return { 
        name: fumoName, 
        trait: traitInfo.trait,
        rarity: randomFumo.rarity,
        baseName: randomFumo.name
    };
}

/**
 * Generate special milestone requirements
 */
function generateMilestoneRequirement(stage, milestoneConfig) {
    const { specialReq } = milestoneConfig;
    const requirements = { fumos: [], special: true, milestoneName: milestoneConfig.name };
    
    switch (specialReq.type) {
        case 'shiny_any': {
            // Any SHINY fumo
            for (let i = 0; i < specialReq.count; i++) {
                const fumo = generateFumoRequirement(stage, 'shiny');
                requirements.fumos.push({
                    name: fumo.name,
                    requireTrait: true,
                    traitType: 'shiny',
                    allowHigherTrait: true // Can use alG/VOID/GLITCHED instead
                });
            }
            break;
        }
        case 'alg_any': {
            // Any alG fumo
            for (let i = 0; i < specialReq.count; i++) {
                const fumo = generateFumoRequirement(stage, 'alg');
                requirements.fumos.push({
                    name: fumo.name,
                    requireTrait: true,
                    traitType: 'alg',
                    allowHigherTrait: true // Can use VOID/GLITCHED instead
                });
            }
            break;
        }
        case 'exclusive_shiny': {
            // EXCLUSIVE with SHINY
            const pool = FumoPool.getRaw().filter(f => f.rarity === 'EXCLUSIVE' && (f.availability.crate || f.availability.pray));
            for (let i = 0; i < specialReq.count; i++) {
                const randomFumo = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : { name: 'BlueReimu', rarity: 'EXCLUSIVE' };
                requirements.fumos.push({
                    name: `${randomFumo.name}(EXCLUSIVE)[✨SHINY]`,
                    requireTrait: true,
                    traitType: 'shiny',
                    allowHigherTrait: true
                });
            }
            break;
        }
        case 'void_any': {
            // Any VOID fumo
            for (let i = 0; i < specialReq.count; i++) {
                const fumo = generateFumoRequirement(stage, 'void');
                requirements.fumos.push({
                    name: fumo.name,
                    requireTrait: true,
                    traitType: 'void',
                    allowHigherTrait: true // Can use GLITCHED instead
                });
            }
            break;
        }
        case 'glitched_any': {
            // Any GLITCHED fumo (rarest trait - no substitution)
            for (let i = 0; i < specialReq.count; i++) {
                const fumo = generateFumoRequirement(stage, 'glitched');
                requirements.fumos.push({
                    name: fumo.name,
                    requireTrait: true,
                    traitType: 'glitched',
                    allowHigherTrait: false // GLITCHED is the rarest, nothing can substitute
                });
            }
            break;
        }
        case 'astral_alg': {
            // ASTRAL with alG
            const pool = FumoPool.getRaw().filter(f => f.rarity === 'ASTRAL' && (f.availability.crate || f.availability.pray));
            for (let i = 0; i < specialReq.count; i++) {
                const randomFumo = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : { name: 'Athena', rarity: 'ASTRAL' };
                requirements.fumos.push({
                    name: `${randomFumo.name}(ASTRAL)[🌟alG]`,
                    requireTrait: true,
                    traitType: 'alg',
                    allowHigherTrait: true
                });
            }
            break;
        }
        case 'multi_rare_trait': {
            // Multiple different rare traits (VOID + GLITCHED)
            for (const trait of specialReq.traits) {
                const fumo = generateFumoRequirement(stage, trait);
                requirements.fumos.push({
                    name: fumo.name,
                    requireTrait: true,
                    traitType: trait,
                    allowHigherTrait: false // Must be exactly this trait
                });
            }
            break;
        }
        case 'celestial_any_trait': {
            // CELESTIAL or higher with any trait
            const highRarities = ['CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
            const pool = FumoPool.getRaw().filter(f => highRarities.includes(f.rarity) && (f.availability.crate || f.availability.pray));
            for (let i = 0; i < specialReq.count; i++) {
                const randomFumo = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : { name: 'Mostima', rarity: 'CELESTIAL' };
                const { trait, tag } = rollTrait(TIER_CONFIG.TRANSCENDENT, stage);
                const finalTrait = trait || 'shiny';
                const finalTag = tag || TRAIT_TAGS.shiny;
                requirements.fumos.push({
                    name: `${randomFumo.name}(${randomFumo.rarity})${finalTag}`,
                    requireTrait: true,
                    traitType: finalTrait,
                    allowHigherTrait: true
                });
            }
            break;
        }
        case 'glitched_or_void': {
            // GLITCHED or VOID (the two rarest traits)
            const traits = ['glitched', 'void', 'glitched']; // More GLITCHED required
            for (let i = 0; i < specialReq.count; i++) {
                const trait = traits[i % traits.length];
                const fumo = generateFumoRequirement(stage, trait);
                requirements.fumos.push({
                    name: fumo.name,
                    requireTrait: true,
                    traitType: trait,
                    allowHigherTrait: trait === 'void' // VOID can be replaced by GLITCHED
                });
            }
            break;
        }
        case 'ultimate': {
            // THE ULTIMATE REQUIREMENT - Stage 1000
            // Requires: 1x TRANSCENDENT[🔮GLITCHED] + 1x ETERNAL[🌀VOID] + 1x CELESTIAL[🌟alG]
            const transcendentPool = FumoPool.getRaw().filter(f => f.rarity === 'TRANSCENDENT' && (f.availability.crate || f.availability.pray));
            const eternalPool = FumoPool.getRaw().filter(f => f.rarity === 'ETERNAL' && (f.availability.crate || f.availability.pray));
            const celestialPool = FumoPool.getRaw().filter(f => f.rarity === 'CELESTIAL' && (f.availability.crate || f.availability.pray));
            
            // TRANSCENDENT with GLITCHED (rarest combo)
            const transcendentFumo = transcendentPool.length > 0 ? transcendentPool[Math.floor(Math.random() * transcendentPool.length)] : { name: 'Arisu', rarity: 'TRANSCENDENT' };
            requirements.fumos.push({
                name: `${transcendentFumo.name}(TRANSCENDENT)[🔮GLITCHED]`,
                requireTrait: true,
                traitType: 'glitched',
                allowHigherTrait: false
            });
            
            // ETERNAL with VOID
            const eternalFumo = eternalPool.length > 0 ? eternalPool[Math.floor(Math.random() * eternalPool.length)] : { name: 'UltraKillV2', rarity: 'ETERNAL' };
            requirements.fumos.push({
                name: `${eternalFumo.name}(ETERNAL)[🌀VOID]`,
                requireTrait: true,
                traitType: 'void',
                allowHigherTrait: false
            });
            
            // CELESTIAL with alG
            const celestialFumo = celestialPool.length > 0 ? celestialPool[Math.floor(Math.random() * celestialPool.length)] : { name: 'Mostima', rarity: 'CELESTIAL' };
            requirements.fumos.push({
                name: `${celestialFumo.name}(CELESTIAL)[🌟alG]`,
                requireTrait: true,
                traitType: 'alg',
                allowHigherTrait: false
            });
            break;
        }
        default:
            // Fallback to normal generation
            const fumo = generateFumoRequirement(stage);
            requirements.fumos.push({
                name: fumo.name,
                requireTrait: !!fumo.trait,
                traitType: fumo.trait
            });
    }
    
    return requirements;
}

/**
 * Generate stage requirements based on tier system
 */
function generateStageRequirements(stage) {
    // Check for milestone stages first
    if (MILESTONE_STAGES[stage]) {
        return generateMilestoneRequirement(stage, MILESTONE_STAGES[stage]);
    }
    
    const tier = getTier(stage);
    const requirements = {
        fumos: [],
        tier: tier.key,
        tierName: tier.name,
        tierEmoji: tier.emoji
    };
    
    // Generate required number of fumos for this tier
    for (let i = 0; i < tier.fumoCount; i++) {
        const fumo = generateFumoRequirement(stage);
        
        requirements.fumos.push({
            name: fumo.name,
            allowAnyTrait: !fumo.trait, // If no trait rolled, any trait is acceptable
            requireTrait: !!fumo.trait,
            traitType: fumo.trait,
            allowHigherTrait: true // Higher rarity traits can substitute
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
            generatedAt: Date.now(),
            tier: getTier(currentStage).key
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

/**
 * Check if a trait satisfies the requirement (including higher trait substitution)
 * Hierarchy: GLITCHED (4) > VOID (3) > alG (2) > SHINY (1)
 */
function traitSatisfiesRequirement(actualTrait, requiredTrait, allowHigherTrait) {
    if (!requiredTrait) return true;
    if (actualTrait === requiredTrait) return true;
    
    if (allowHigherTrait) {
        // Use the hierarchy defined at top
        const actualLevel = TRAIT_HIERARCHY[actualTrait] || 0;
        const requiredLevel = TRAIT_HIERARCHY[requiredTrait] || 0;
        return actualLevel >= requiredLevel;
    }
    
    return false;
}

/**
 * Extract trait from fumo name
 */
function extractTraitFromName(fumoName) {
    if (fumoName.includes('[🌀VOID]')) return 'void';
    if (fumoName.includes('[🔮GLITCHED]')) return 'glitched';
    if (fumoName.includes('[🌟alG]')) return 'alg';
    if (fumoName.includes('[✨SHINY]')) return 'shiny';
    return null;
}

/**
 * Remove trait from fumo name to get base name
 */
function getBaseNameWithoutTrait(fumoName) {
    return fumoName
        .replace('[🌀VOID]', '')
        .replace('[🔮GLITCHED]', '')
        .replace('[🌟alG]', '')
        .replace('[✨SHINY]', '');
}

/**
 * Validate user has required fumos with proper trait matching
 */
async function validateUserHasFumos(userId, requiredFumos) {
    const { all } = require('../../../Core/database');

    const results = [];

    for (const requirement of requiredFumos) {
        const baseName = requirement.name;
        const requiredBaseName = getBaseNameWithoutTrait(baseName);
        const requiredTrait = requirement.traitType || extractTraitFromName(baseName);

        if (requirement.allowAnyTrait) {
            // Any variant of this fumo is acceptable
            const variants = [
                requiredBaseName,
                requiredBaseName + '[✨SHINY]',
                requiredBaseName + '[🌟alG]',
                requiredBaseName + '[🔮GLITCHED]',
                requiredBaseName + '[🌀VOID]'
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
                required: requiredBaseName,
                found,
                id: foundId,
                actualName: foundName,
                allowAnyTrait: true
            });
        } else if (requirement.requireTrait) {
            // Specific trait required, but may allow higher traits
            const allowHigher = requirement.allowHigherTrait !== false;
            
            // Build list of acceptable variants based on trait hierarchy
            // Hierarchy: GLITCHED > VOID > alG > SHINY
            const acceptableVariants = [];
            
            if (allowHigher) {
                // Add all traits >= required trait level (rarer traits can substitute)
                const traitOrder = ['shiny', 'alg', 'void', 'glitched']; // Ascending rarity
                const requiredIdx = traitOrder.indexOf(requiredTrait);
                
                for (let i = requiredIdx; i < traitOrder.length; i++) {
                    acceptableVariants.push(requiredBaseName + TRAIT_TAGS[traitOrder[i]]);
                }
            } else {
                // Only exact trait match
                acceptableVariants.push(baseName);
            }
            
            let found = false;
            let foundId = null;
            let foundName = null;
            
            for (const variant of acceptableVariants) {
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
                required: baseName,
                found,
                id: foundId,
                actualName: foundName,
                requireTrait: true,
                traitType: requiredTrait,
                allowHigherTrait: allowHigher
            });
        } else {
            // Exact match required
            const rows = await all(
                `SELECT id, fumoName FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT 1`,
                [userId, baseName]
            );

            results.push({
                required: baseName,
                found: rows && rows.length > 0,
                id: rows && rows.length > 0 ? rows[0].id : null,
                actualName: baseName
            });
        }
    }

    return results;
}

/**
 * Get tier information for display
 */
function getTierInfo(stage) {
    return getTier(stage);
}

/**
 * Get milestone information if stage is a milestone
 */
function getMilestoneInfo(stage) {
    return MILESTONE_STAGES[stage] || null;
}

/**
 * Get next milestone from current stage
 */
function getNextMilestone(currentStage) {
    const milestones = Object.keys(MILESTONE_STAGES).map(Number).sort((a, b) => a - b);
    return milestones.find(m => m > currentStage) || null;
}

/**
 * Calculate resource requirements based on exponential scaling
 */
function calculateResourceRequirements(currentBreaks) {
    const tier = getTier(currentBreaks + 1);
    const progress = getStageProgressInTier(currentBreaks + 1);
    
    // Base values
    const baseFragments = 15;
    const baseNullified = 1;
    
    // Tier multipliers (exponential growth)
    const tierMultipliers = {
        NOVICE: 1,
        ADEPT: 1.5,
        EXPERT: 2.5,
        MASTER: 5,
        GRANDMASTER: 10,
        TRANSCENDENT: 25
    };
    
    const multiplier = tierMultipliers[tier.key] || 1;
    
    // Calculate with progression within tier
    const stageBonus = 1 + (progress * 0.5);
    
    // Fragment scaling: exponential with tier + linear within tier
    const fragments = Math.floor(
        baseFragments * multiplier * stageBonus + 
        Math.floor(currentBreaks / 10) * 5 * (multiplier / 2)
    );
    
    // Nullified scaling: step function every 20 stages with tier bonus
    const nullified = Math.floor(
        (baseNullified + Math.floor(currentBreaks / 20)) * 
        Math.sqrt(multiplier)
    );
    
    return {
        fragments: Math.min(fragments, 9999), // Cap at reasonable amount
        nullified: Math.min(nullified, 999)
    };
}

module.exports = {
    getRequirementForUser,
    clearRequirementForUser,
    validateUserHasFumos,
    generateStageRequirements,
    initializeRequirementsFile,
    // New exports for expanded system
    getTierInfo,
    getMilestoneInfo,
    getNextMilestone,
    calculateResourceRequirements,
    MAX_LIMIT_BREAKS,
    TIER_CONFIG,
    MILESTONE_STAGES,
    TRAIT_TAGS,
    TRAIT_HIERARCHY,
    TRAIT_PRIORITY,
    extractTraitFromName,
    getBaseNameWithoutTrait
};