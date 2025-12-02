const PRAY_CHARACTERS = {
    YUYUKO: {
        id: 'yuyuko',
        name: 'Yuyuko',
        rarity: 'Legendary',
        weight: 7, 
        enhancedWeight: 20,
        picture: 'https://th.bing.com/th/id/R.0b8e747c85c844e21285070088e39298?rik=Gdm12AsVV%2fAH9A&pid=ImgRaw&r=0',
        description: 'The Princess of the Netherworld offers ghostly blessings... or curses.',
        color: 0xFF69B4,
        offers: {
            // 75% chance - Normal blessing
            normal: {
                coinCost: 50000,        // Actual deduction in handler
                gemCost: 10000,         // Actual deduction in handler
                // Base rolls: 500 (no ShinyMark+) or 1000 (with ShinyMark+)
                // Then multiplied by 2.5 in handler
                // ACTUAL REWARDS: 1,250 rolls or 2,500 rolls
                baseRollsNoMark: 500,
                baseRollsWithMark: 1000,
                rollMultiplier: 2.5,
                maxRolls: 10000,        // Hard cap in handler
                luckBoost: 0.125,       // Actual boost applied
                luckRarities: 'LEGENDARY,MYTHIC,EXCLUSIVE,???,ASTRAL,CELESTIAL,INFINITE,ETERNAL,TRANSCENDENT'
            },
            // 25% chance - Devour event (randomNumber <= 25)
            devour: {
                chance: 0.25,           // 25% trigger chance
                coinCost: 600000,       // Required or loses everything
                gemCost: 140000,        // Required or loses everything
                // Base rolls: 5000 (no ShinyMark+) or 10000 (with ShinyMark+)
                // Then multiplied by 3 in handler
                // ACTUAL REWARDS: 15,000 rolls or 30,000 rolls
                baseRollsNoMark: 5000,
                baseRollsWithMark: 10000,
                rollMultiplier: 3,
                maxRolls: 50000,        // Hard cap in handler
                luckBoost: 1.5,         // MASSIVE luck boost
                // If broke: loses ALL coins and gems, gets nothing
                consequenceIfBroke: 'LOSE_EVERYTHING'
            }
        }
    },
    YUKARI: {
        id: 'yukari',
        name: 'Yukari',
        rarity: 'Mythical',
        weight: 2,
        enhancedWeight: 10, 
        picture: 'https://th.bing.com/th/id/R.cfd0fe7d995179d74aa79180e02ac1d8?rik=B3rQ%2f9r4uo6g8g&riu=http%3a%2f%2fwww.stock2007.sakura.ne.jp%2fedp2016%2f03%2fYakumo+Yukari.png&ehk=J7T9Ekd6NnH2Lsj2HWEZ2QVHtgVOpe40gS5zEueckWc%3d&risl=&pid=ImgRaw&r=0',
        description: 'The gap youkai trades your fumos for coins and gems. Better have enough collection!',
        color: 0x9932CC,
        requirements: {
            // Handler: Math.floor(minFumos * 0.5) and Math.floor(maxFumos * 0.6)
            minFumos: {
                1: 750,   // 1500 * 0.5 = 750
                5: 875,   // 1750 * 0.5 = 875
                7: 1000,  // 2000 * 0.5 = 1000
                10: 1500  // 3000 * 0.5 = 1500
            },
            maxFumos: {
                1: 1200,  // 2000 * 0.6 = 1200
                5: 1500,  // 2500 * 0.6 = 1500
                7: 1800,  // 3000 * 0.6 = 1800
                10: 3000  // 5000 * 0.6 = 3000
            }
        },
        rewards: {
            multipliers: {
                // Handler: (multiplier * 1.8) * 2.5
                // Final multiplier = base * 4.5
                1: 1.5,   // Actual: 1.5 * 1.8 * 2.5 = 6.75x
                5: 3.5,   // Actual: 3.5 * 1.8 * 2.5 = 15.75x
                7: 5,     // Actual: 5 * 1.8 * 2.5 = 22.5x
                10: 25    // Actual: 25 * 1.8 * 2.5 = 112.5x
            },
            // Handler: Math.random() < bonusChance * 1.5
            bonusChance: 0.30,      // 0.20 * 1.5 = 0.30 (30% actual chance)
            bonusMultiplier: {
                // Handler: multiplier * 1.3
                coins: 1.495,       // 1.15 * 1.3 = 1.495
                gems: 1.95          // 1.5 * 1.3 = 1.95
            },
            // Handler: Math.random() < fumoTokenChance * 5
            fumoTokenChance: 0.35,  // 0.07 * 5 = 0.35 (35% actual chance)
            tokenAmount: [2, 6],    // Random 2-6 tokens (Math.floor(Math.random() * 5) + 2)
            // Handler: Math.random() < scamChance * 0.3
            scamChance: 0.0015      // 0.005 * 0.3 = 0.0015 (0.15% actual chance)
        },
        bonusItems: {
            // All chances TRIPLED in handler (* 3)
            // Quantities also increased based on mark
            1: { 
                'MysteriousShard(M)': { chance: 1.05, quantity: [3, 6] }  // 0.35 * 3, qty 3-6
            },
            5: {
                'MysteriousShard(M)': { chance: 1.50, quantity: [3, 6] },  // 0.50 * 3
                'GoldenSigil(?)': { chance: 0.30, quantity: [3, 6] },
                'Nullified(?)': { chance: 0.30, quantity: [3, 6] },
                'Undefined(?)': { chance: 0.30, quantity: [3, 6] },
                'Null?(?)': { chance: 0.30, quantity: [3, 6] }
            },
            7: {
                'MysteriousShard(M)': { chance: 2.25, quantity: [4, 9] },  // 0.75 * 3, qty 4-9
                'GoldenSigil(?)': { chance: 0.30, quantity: [4, 9] },
                'Nullified(?)': { chance: 0.21, quantity: [4, 9] },
                'Undefined(?)': { chance: 0.12, quantity: [4, 9] },
                'Null(?)': { chance: 0.12, quantity: [4, 9] }
            },
            10: {
                'MysteriousShard(M)': { chance: 3.0, quantity: [2, 6] },   // 1.0 * 3, qty 2-6
                'GoldenSigil(?)': { chance: 0.15, quantity: [2, 6] },
                'S!gil?(?)': { chance: 0.09, quantity: [2, 6] },
                'Nullified(?)': { chance: 0.45, quantity: [2, 6] },
                'Undefined(?)': { chance: 0.90, quantity: [2, 6] },
                'Null?(?)': { chance: 0.90, quantity: [2, 6] }
            }
        },
        guaranteedShards: {
            // Guaranteed shards per mark (3-9 quantity for mark 7+, 3-6 for others)
            1: ['RedShard(L)', 'BlueShard(L)'],
            5: ['RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)'],
            7: ['RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)', 'ChromaShard(M)'],
            10: ['RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)', 'ChromaShard(M)', 'MonoShard(M)', 'EquinoxAlloy(M)']
        },
        groupPriority: ['group1', 'group2', 'group3', 'shiny', 'alg'],
        rarityGroups: {
            group1: ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE'],
            group2: ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE'],
            group3: ['ETERNAL', 'TRANSCENDENT']
        }
    },
    REIMU: {
        id: 'reimu',
        name: 'Reimu',
        rarity: 'Epic',
        weight: 15,
        enhancedWeight: 25, 
        picture: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/00f39406-ea15-4816-a71f-48c412d96de6/dfaxgup-4dc13bb7-2c07-4856-b6e6-069cbc57dc07.png/v1/fill/w_1280,h_2273/reimu_hakurei__render__1__by_wtfbooomsh_dfaxgup-fullview.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MjI3MyIsInBhdGgiOiJcL2ZcLzAwZjM5NDA2LWVhMTUtNDgxNi1hNzFmLTQ4YzQxMmQ5NmRlNlwvZGZheGd1cC00ZGMxM2JiNy0yYzA3LTQ4NTYtYjZlNi0wNjljYmM1N2RjMDcucG5nIiwid2lkdGgiOiI8PTEyODAifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.ZwsnkThzOy7bqMkPetnLOWCspac2geguh11VLirZU08',
        description: 'The shrine maiden accepts donations and gives rare fumos in return.',
        color: 0xFF0000,
        phases: {
            donation: {
                baseCoinCost: 30000,  // Handler uses 30k base, not 60k
                baseGemCost: 2500,    // Handler uses 2.5k base, not 5k
                penaltyCoinIncrease: 5000,  // Handler adds 5k per penalty
                penaltyGemIncrease: 1000,   // Handler adds 1k per penalty
                pityMultipliers: {
                    // Applied to cost: (baseCost + penalty * increase) * multiplier
                    low: { min: 1, max: 5, multiplier: 2 },
                    medium: { min: 6, max: 10, multiplier: 5 },
                    high: { min: 11, max: 15, multiplier: 10 }
                }
            },
            gift: {
                rarities: {
                    EPIC: 40.0,
                    LEGENDARY: 18.0,
                    OTHERWORLDLY: 13.0,
                    MYTHICAL: 7.0,
                    EXCLUSIVE: 5.0,
                    '???': 2.5,
                    ASTRAL: 2.0,
                    CELESTIAL: 1.5,
                    INFINITE: 0.8,
                    ETERNAL: 0.5,
                    TRANSCENDENT: 0.2
                },
                pityBoost: 1.08,        // Math.pow(1.08, pityCount * 1.5) applied to ultra-rares
                maxPityCount: 10,       // At 10+, guaranteed ultra-rare (not 15)
                ultraRares: ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'],
                shinyChance: 0.35,      // Handler: Math.random() < 0.35 (DOUBLED from 0.18)
                alGChance: 0.1,         // Handler: Math.random() < 0.1 (not 0.008)
                // Handler token logic:
                // rng < 0.08 → 25 tokens
                // rng < 0.20 → 5 tokens  
                // rng < 0.35 → 2 tokens
                // rng < 0.50 → 1 token
                tokenChances: {
                    25: 0.08,   // 8% for 25 tokens
                    5: 0.12,    // 12% for 5 tokens (0.20 - 0.08)
                    2: 0.15,    // 15% for 2 tokens (0.35 - 0.20)
                    1: 0.15     // 15% for 1 token (0.50 - 0.35)
                    // 50% chance for 0 tokens
                }
            }
        },
        maxUsagePerWindow: 8,  // Handler checks: if (user.reimuUsageCount >= 8)
        resetWindow: 12 * 60 * 60 * 1000  // 12 hours
    },
    MARISA: {
        id: 'marisa',
        name: 'Marisa',
        rarity: 'Rare',
        weight: 25,
        enhancedWeight: 30,  
        picture: 'https://www.pikpng.com/pngl/b/445-4450104_png-touhou-project-marisa-png-clipart.png',
        description: 'The ordinary magician borrows coins and returns them with interest... usually.',
        color: 0xFFD700,
        costs: {
            donation: 15000,    // Phase 1: Give 15k coins
            return: 35000       // Phase 2: Get 35k coins (net +20k profit)
        },
        chances: {
            absent: 0.15        // 15% chance she's not around
            // NO steal mechanic in current implementation
        },
        rewards: {
            potions: {
                rare: {
                    name: 'GemPotionT1(R)',
                    baseChance: 0.18,
                    pityChance: 0.35    // Almost doubled during pity
                },
                legendary: {
                    name: 'BoostPotionT1(L)',
                    baseChance: 0.04,
                    pityChance: 0.08    // Doubled during pity
                }
            },
            gems: {
                chance: 0.35,
                pityChance: 0.7,        // Doubled during pity
                bonus1Range: [0.25, 0.40],
                bonus1Base: 1000,
                bonus2Range: [0.08, 0.20],
                bonus2Base: [10000, 19000],
                pityMultiplier: 2       // Total gems * 2 during pity
            },
            special: {
                goldenSigil: { baseChance: 0.0007, pityChance: 0.002 },
                fragment: { baseChance: 0.03, pityChance: 0.07 },
                ticket: { baseChance: 0.18, pityChance: 0.35 }
            }
        },
        itemDrops: {
            // Handler: Math.floor(Math.random() * 3) + 1 or (random * 4) + 3 for pity
            normalCount: [1, 3],    // 1-3 items normally
            pityCount: [3, 6],      // 3-6 items during pity
            // Item rarities have separate weight system (see RARITY_WEIGHTS in handler)
            rarityWeights: {
                normal: {
                    Basic: 45,
                    Common: 30,
                    Rare: 15,
                    Epic: 8,
                    Legendary: 6,
                    Mythical: 3.5,
                    Secret: 1.8,
                    Unknown: 0.15,
                    Prime: 0.05
                },
                pity: {
                    Basic: 25,
                    Common: 20,
                    Rare: 18,
                    Epic: 15,
                    Legendary: 12,
                    Mythical: 8,
                    Secret: 4,
                    Unknown: 0.8,
                    Prime: 0.2
                }
            }
        },
        pity: {
            threshold: 5,               // Every 5 donations
            reward: 'StarShard(M)',     // Guaranteed reward
            counterReset: true          // Counter resets to 0 after pity
        }
    },
    SAKUYA: {
        id: 'sakuya',
        name: 'Sakuya',
        rarity: 'Divine',
        weight: 1,
        enhancedWeight: 15, 
        picture: 'https://vignette.wikia.nocookie.net/death-battle-en-espanol/images/4/4e/Sakuya.png/revision/latest?cb=20180504021545&path-prefix=es',
        description: 'The time-manipulating maid can skip time, but demands payment for her services.',
        color: 0x87CEEB,
        timeSkip: {
            duration: 12 * 60 * 60 * 1000,  // 12 hours (24h during blessing)
            // Handler: Math.max(0, costScaling[useCount] || 0.60) * 0.3
            // This means REDUCED tribute, player keeps 70-97% of rewards
            costScaling: [0.03, 0.054, 0.084, 0.12, 0.15, 0.18],  // 3-18% tribute (was 10-60%)
            // Handler: Math.max(0, fumoRequirements[useCount] || 2) - 1
            // This means REDUCED by 1 from original
            fumoRequirements: [0, 0, 1, 1, 1, 1],  // Actual requirements after -1
            maxUses: 6,                 // NO LONGER ENFORCED - handler allows infinite uses!
            resetWindow: 24 * 60 * 60 * 1000,       // Only for blessing reset
            cooldownWindow: 12 * 60 * 60 * 1000     // Resets use count to 0
        },
        rarityRequirements: {
            normal: ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL'],
            high: ['ASTRAL', 'CELESTIAL', 'INFINITE']  // Used when useCount >= 5
        },
        rewards: {
            // NO LIMITS ENFORCED - Handler never checks caps, calculates and adds directly
            coinLimit: null,        // UNLIMITED - no cap enforcement in handler
            gemLimit: null,         // UNLIMITED - no cap enforcement in handler
            // Handler: perfectSkipChance * 2 (DOUBLED)
            perfectSkipChance: 0.02,            // 0.01 * 2 = 2%
            perfectSkipChanceWithSakuya: 0.06,  // 0.03 * 2 = 6%
            perfectSkipBenefits: {
                noCost: true,           // No tribute taken
                noFumoLoss: true,       // Fumos not consumed
                bonusMultiplier: 1.5    // +50% rewards
            },
            bonusDrops: {
                // All rates TRIPLED in handler (* 3)
                // Multiple rolls: 1-3 for fragments, 1-2 for clocks, 1 for watch
                fragment: { 
                    base: 0.36,         // 0.12 * 3
                    withSakuya: 0.66,   // 0.22 * 3
                    rolls: [1, 3]       // 1-3 attempts
                },
                clock: { 
                    base: 0.09,         // 0.03 * 3
                    withSakuya: 0.21,   // 0.07 * 3
                    rolls: [1, 2]       // 1-2 attempts
                },
                watch: { 
                    base: 0.015,        // 0.005 * 3
                    withSakuya: 0.045,  // 0.015 * 3
                    rolls: 1            // 1 attempt
                }
            }
        },
        blessing: {
            threshold: 100,                     // Need 100 points for blessing
            duration: 48 * 60 * 60 * 1000,      // DOUBLED: 24h * 2 = 48 hours
            cooldownMultiplier: 0.125,          // REDUCED: 0.5 * 0.25 = 0.125 (87.5% cooldown reduction)
            increment: 20,                      // DOUBLED: 10 * 2 = 20 per use
            benefits: {
                skipDuration: 24 * 60 * 60 * 1000,  // Skip FULL DAY (not 12h)
                rewardMultiplier: 4,                 // 4x coins and gems
                noCost: true                         // No tribute/fumo cost
            }
        },
        // IMPORTANT: Handler no longer enforces maxUses limit!
        // Only cooldown reset (12h) and blessing reset (24h) apply
        actualLimits: {
            usesPerCooldown: 'UNLIMITED',   // Was 6, now infinite
            cooldownReset: '12 hours',      // Resets use counter to 0
            blessingReset: '24 hours'       // Resets blessing timer
        }
    }
};

const RARITY_CONFIG = {
    Common: { color: 0x808080, weight: 50, emoji: '⚪' },
    Rare: { color: 0x0099FF, weight: 25, emoji: '🔵' },
    Epic: { color: 0x9933FF, weight: 15, emoji: '🟣' },
    Legendary: { color: 0xFFAA00, weight: 7, emoji: '🟠' },
    Mythical: { color: 0xFF0000, weight: 2, emoji: '🔴' },
    Divine: { color: 0xFFFF66, weight: 1, emoji: '✨' }
};

const characters = Object.values(PRAY_CHARACTERS);
const totalNormalWeight = characters.reduce((sum, char) => sum + char.weight, 0);
const totalEnhancedWeight = characters.reduce((sum, char) => sum + char.enhancedWeight, 0);

// Log probabilities on startup
console.log('=== Normal Prayer Chances ===');
characters.forEach(char => {
    const chance = ((char.weight / totalNormalWeight) * 100).toFixed(2);
    console.log(`${char.name} (${char.rarity}): ${chance}%`);
});

console.log('\n=== Enhanced Prayer Chances ===');
characters.forEach(char => {
    const chance = ((char.enhancedWeight / totalEnhancedWeight) * 100).toFixed(2);
    console.log(`${char.name} (${char.rarity}): ${chance}%`);
});

module.exports = {
    PRAY_CHARACTERS,
    RARITY_CONFIG,
    PRAY_LIMITS: {
        maxUsagePerHour: 25,
        ticketRequired: 'PrayTicket(R)',
        cooldownDuration: 10 * 60 * 1000,
        interactionTimeout: 60000
    },
    FUMO_PRICES: {
        Common: 113,
        UNCOMMON: 270,
        RARE: 675,
        EPIC: 1125,
        OTHERWORLDLY: 1800,
        LEGENDARY: 18000,
        MYTHICAL: 168750,
        EXCLUSIVE: 1125000,
        '???': 22500000,
        ASTRAL: 45000000,
        CELESTIAL: 90000000,
        INFINITE: 180000000,
        ETERNAL: 360000000,
        TRANSCENDENT: 720000000
    },
    getCharacterPool: function(enhanced = false) {
        const pool = [];
        const weightKey = enhanced ? 'enhancedWeight' : 'weight';
        
        for (const [key, character] of Object.entries(PRAY_CHARACTERS)) {
            const weight = character[weightKey];
            for (let i = 0; i < weight; i++) {
                pool.push(character);
            }
        }
        return pool;
    },
    selectRandomCharacter: function(enhanced = false) {
        const pool = this.getCharacterPool(enhanced);
        return pool[Math.floor(Math.random() * pool.length)];
    },
    getRarityColor: function(rarity) {
        return RARITY_CONFIG[rarity]?.color || 0x808080;
    },
    getRarityEmoji: function(rarity) {
        return RARITY_CONFIG[rarity]?.emoji || '⚪';
    }
};