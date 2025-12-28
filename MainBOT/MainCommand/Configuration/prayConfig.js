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
            normal: {
                coinCost: 50000,
                gemCost: 10000,
                baseRollsNoMark: 500,
                baseRollsWithMark: 1000,
                rollMultiplier: 2.5,
                maxRolls: 10000,
                luckBoost: 0.125,
                luckRarities: 'LEGENDARY,MYTHIC,EXCLUSIVE,???,ASTRAL,CELESTIAL,INFINITE,ETERNAL,TRANSCENDENT'
            },
            devour: {
                chance: 0.25,
                coinCost: 600000,
                gemCost: 140000,
                baseRollsNoMark: 5000,
                baseRollsWithMark: 10000,
                rollMultiplier: 3,
                maxRolls: 50000,
                luckBoost: 1.5,
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
            minFumos: {
                1: 750,
                5: 875,
                7: 1000,
                10: 1500
            },
            maxFumos: {
                1: 1200,
                5: 1500,
                7: 1800,
                10: 3000
            }
        },
        rewards: {
            multipliers: {
                1: 1.5,
                5: 3.5,
                7: 5,
                10: 25
            },
            bonusChance: 0.30,
            bonusMultiplier: {
                coins: 1.495,
                gems: 1.95
            },
            fumoTokenChance: 0.35,
            tokenAmount: [2, 6],
            scamChance: 0.0015
        },
        bonusItems: {
            1: { 
                'MysteriousShard(M)': { chance: 1.05, quantity: [3, 6] }
            },
            5: {
                'MysteriousShard(M)': { chance: 1.50, quantity: [3, 6] },
                'GoldenSigil(?)': { chance: 0.30, quantity: [3, 6] },
                'Nullified(?)': { chance: 0.30, quantity: [3, 6] },
                'Undefined(?)': { chance: 0.30, quantity: [3, 6] },
                'Null?(?)': { chance: 0.30, quantity: [3, 6] }
            },
            7: {
                'MysteriousShard(M)': { chance: 2.25, quantity: [4, 9] },
                'GoldenSigil(?)': { chance: 0.30, quantity: [4, 9] },
                'Nullified(?)': { chance: 0.21, quantity: [4, 9] },
                'Undefined(?)': { chance: 0.12, quantity: [4, 9] },
                'Null(?)': { chance: 0.12, quantity: [4, 9] }
            },
            10: {
                'MysteriousShard(M)': { chance: 3.0, quantity: [2, 6] },
                'GoldenSigil(?)': { chance: 0.15, quantity: [2, 6] },
                'S!gil?(?)': { chance: 0.09, quantity: [2, 6] },
                'Nullified(?)': { chance: 0.45, quantity: [2, 6] },
                'Undefined(?)': { chance: 0.90, quantity: [2, 6] },
                'Null?(?)': { chance: 0.90, quantity: [2, 6] }
            }
        },
        guaranteedShards: {
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
                baseCoinCost: 30000,
                baseGemCost: 2500,
                penaltyCoinIncrease: 5000,
                penaltyGemIncrease: 1000,
                pityMultipliers: {
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
                pityBoost: 1.08,
                maxPityCount: 10,
                ultraRares: ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'],
                shinyChance: 0.35,
                alGChance: 0.1,
                tokenChances: {
                    25: 0.08,
                    5: 0.12,
                    2: 0.15,
                    1: 0.15
                }
            }
        },
        maxUsagePerWindow: 8,
        resetWindow: 12 * 60 * 60 * 1000
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
            donation: 15000,
            return: 35000
        },
        chances: {
            absent: 0.15
        },
        rewards: {
            potions: {
                rare: {
                    name: 'GemPotionT1(R)',
                    baseChance: 0.18,
                    pityChance: 0.35
                },
                legendary: {
                    name: 'BoostPotionT1(L)',
                    baseChance: 0.04,
                    pityChance: 0.08
                }
            },
            gems: {
                chance: 0.35,
                pityChance: 0.7,
                bonus1Range: [0.25, 0.40],
                bonus1Base: 1000,
                bonus2Range: [0.08, 0.20],
                bonus2Base: [10000, 19000],
                pityMultiplier: 2
            },
            special: {
                goldenSigil: { baseChance: 0.0007, pityChance: 0.002 },
                fragment: { baseChance: 0.03, pityChance: 0.07 },
                ticket: { baseChance: 0.18, pityChance: 0.35 }
            }
        },
        itemDrops: {
            normalCount: [1, 3],
            pityCount: [3, 6],
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
            threshold: 5,
            reward: 'StarShard(M)',
            counterReset: true
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
            duration: 12 * 60 * 60 * 1000,
            costScaling: [0.03, 0.054, 0.084, 0.12, 0.15, 0.18],
            fumoRequirements: [0, 0, 1, 1, 1, 1],
            maxUses: 6,
            resetWindow: 24 * 60 * 60 * 1000,
            cooldownWindow: 12 * 60 * 60 * 1000
        },
        rarityRequirements: {
            normal: ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL'],
            high: ['ASTRAL', 'CELESTIAL', 'INFINITE']
        },
        rewards: {
            coinLimit: null,
            gemLimit: null,
            perfectSkipChance: 0.02,
            perfectSkipChanceWithSakuya: 0.06,
            perfectSkipBenefits: {
                noCost: true,
                noFumoLoss: true,
                bonusMultiplier: 1.5
            },
            bonusDrops: {
                fragment: { 
                    base: 0.36,
                    withSakuya: 0.66,
                    rolls: [1, 3]
                },
                clock: { 
                    base: 0.09,
                    withSakuya: 0.21,
                    rolls: [1, 2]
                },
                watch: { 
                    base: 0.015,
                    withSakuya: 0.045,
                    rolls: 1
                }
            }
        },
        blessing: {
            threshold: 100,
            duration: 48 * 60 * 60 * 1000,
            cooldownMultiplier: 0.125,
            increment: 20,
            benefits: {
                skipDuration: 24 * 60 * 60 * 1000,
                rewardMultiplier: 4,
                noCost: true
            }
        }
    },
    SANAE: {
        id: 'sanae',
        name: 'Sanae',
        rarity: 'Epic',
        weight: 22,
        enhancedWeight: 30,
        picture: 'https://vignette.wikia.nocookie.net/the-outsider-who-loved-gensokyo/images/2/25/SanaeSmile.png/revision/latest?cb=20190504003049',
        description: 'The living goddess of the Moriya Shrine offers divine blessings through faith.',
        color: 0x00CED1,
        
        faithPoints: {
            max: 20,
            rerollThreshold: 5,
            fourthBlessingThreshold: 10,
            upgradeTierThreshold: 15,
            divineInterventionThreshold: 20
        },
        
        faithScaling: {
            costMultiplier: {
                0: 1.0,
                5: 1.25,
                10: 1.5,
                15: 2.0,
                18: 2.5
            },
            rewardMultiplier: {
                0: 1.0,
                5: 1.5,
                10: 2.0,
                15: 3.0,
                18: 5.0
            },
            tierUpgradeChance: {
                0: 0,
                5: 0.10,
                10: 0.20,
                15: 0.35,
                18: 0.50
            }
        },
        
        donationOptions: {
            A: {
                label: 'Coin Offering',
                baseCost: { coins: 100000, gems: 0 },
                faithPoints: 1,
                description: 'coins → 1 Faith Point'
            },
            B: {
                label: 'Gem Offering',
                baseCost: { coins: 0, gems: 15000 },
                faithPoints: 2,
                description: 'gems → 2 Faith Points'
            },
            C: {
                label: 'Fumo Sacrifice',
                baseCost: { coins: 0, gems: 0 },
                fumoRequirement: { count: 3, minRarity: 'MYTHICAL' },
                faithPoints: 3,
                description: 'MYTHICAL+ fumos → 3 Faith Points'
            },
            D: {
                label: 'Combo Offering',
                baseCost: { coins: 50000, gems: 5000 },
                fumoRequirement: { count: 1, minRarity: 'LEGENDARY' },
                faithPoints: 4,
                description: 'coins + gems + LEGENDARY fumo → 4 Faith Points'
            }
        },
        
        blessingTiers: {
            COMMON: {
                weight: 50,
                faithWeightReduction: 3,
                minWeight: 20,
                blessings: [
                    {
                        name: "Wind's Fortune",
                        rewards: {
                            coins: 300000,
                            gems: 50000,
                            luck: { amount: 0.02, duration: 24 * 60 * 60 * 1000 }
                        }
                    },
                    {
                        name: "Miracle's Touch",
                        rewards: {
                            coins: 500000,
                            gems: 100000,
                            items: [{ name: 'MysteriousShard(M)', quantity: 3 }]
                        }
                    },
                    {
                        name: "Shrine's Protection",
                        rewards: {
                            craftDiscount: { percent: 30, duration: 48 * 60 * 60 * 1000 },
                            items: [{ name: 'TimeClock-Broken(L)', quantity: 5 }]
                        }
                    }
                ]
            },
            RARE: {
                weight: 30,
                faithWeightBonus: 1,
                maxWeight: 45,
                blessings: [
                    {
                        name: "Moriya's Favor",
                        rewards: {
                            coins: 1500000,
                            gems: 250000,
                            luck: { amount: 0.05, duration: 48 * 60 * 60 * 1000 },
                            boost: { type: 'coin', multiplier: 1.5, duration: 48 * 60 * 60 * 1000 }
                        }
                    },
                    {
                        name: "Divine Wind",
                        rewards: {
                            fumo: { rarity: 'MYTHICAL' },
                            items: [{ name: 'ChromaShard(M)', quantity: 10 }]
                        }
                    },
                    {
                        name: "Faith Resonance",
                        rewards: {
                            guaranteedRarity: { minRarity: 'EPIC', rolls: 100 },
                            luckForRolls: { amount: 0.10, rolls: 100 }
                        }
                    }
                ]
            },
            LEGENDARY: {
                weight: 15,
                faithWeightBonus: 0.75,
                maxWeight: 30,
                blessings: [
                    {
                        name: "Sanae's Miracle",
                        rewards: {
                            coins: 5000000,
                            gems: 1000000,
                            luck: { amount: 0.10, duration: 7 * 24 * 60 * 60 * 1000 },
                            craftProtection: { nullifyFails: 5 }
                        }
                    },
                    {
                        name: "Living God's Blessing",
                        rewards: {
                            boost: { type: 'income', multiplier: 3, duration: 72 * 60 * 60 * 1000 },
                            prayImmunity: { duration: 7 * 24 * 60 * 60 * 1000 },
                            items: [{ name: 'StarShard(M)', quantity: 20 }]
                        }
                    },
                    {
                        name: "Yasaka's Gambit",
                        rewards: {
                            gambit: { pulls: 50, keepTop: 10, convertRest: true }
                        }
                    }
                ]
            },
            DIVINE: {
                weight: 4,
                faithWeightBonus: 0.5,
                maxWeight: 12,
                blessings: [
                    {
                        name: "Suwako's Ancient Power",
                        rewards: {
                            coins: 50000000,
                            items: [{ name: 'FrogSigil(?)', quantity: 1 }]
                        }
                    },
                    {
                        name: "Kanako's Tempest",
                        rewards: {
                            coins: 100000000,
                            gems: 20000000,
                            luck: { amount: 0.25, permanent: true },
                            items: [{ name: 'EquinoxAlloy(M)', quantity: 50 }]
                        }
                    }
                ]
            },
            MIRACLE: {
                weight: 1,
                faithWeightBonus: 0.25,
                maxWeight: 5,
                blessings: [
                    {
                        name: "Living Goddess Incarnate",
                        rewards: {
                            coins: 500000000,
                            gems: 100000000,
                            luck: { amount: 0.75, duration: 7 * 24 * 60 * 60 * 1000 },
                            freeCrafts: { duration: 7 * 24 * 60 * 60 * 1000 },
                            boostMultiplier: { multiplier: 5, duration: 7 * 24 * 60 * 60 * 1000 },
                            fumo: { rarity: 'TRANSCENDENT' },
                            items: [{ name: 'DivineMantle(D)', quantity: 1 }]
                        }
                    }
                ]
            }
        },
        
        specialEvents: {
            trainingChance: 0.10,
            miracleSurgeChance: 0.05,
            divineScamChance: 0.03
        },
        
        mythicalPlusRarities: ['MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'],
        legendaryPlusRarities: ['LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT']
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

const PRAY_LIMITS = {
    maxUsagePerHour: 25,
    ticketRequired: 'PrayTicket(R)',
    cooldownDuration: 10 * 60 * 1000,
    interactionTimeout: 60000
};

const FUMO_PRICES = {
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
};

/**
 * Get the cost multiplier based on current faith points
 */
function getFaithCostMultiplier(faithPoints) {
    const scaling = PRAY_CHARACTERS.SANAE.faithScaling.costMultiplier;
    const thresholds = Object.keys(scaling).map(Number).sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
        if (faithPoints >= threshold) {
            return scaling[threshold];
        }
    }
    return 1.0;
}

/**
 * Get the reward multiplier based on current faith points
 */
function getFaithRewardMultiplier(faithPoints) {
    const scaling = PRAY_CHARACTERS.SANAE.faithScaling.rewardMultiplier;
    const thresholds = Object.keys(scaling).map(Number).sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
        if (faithPoints >= threshold) {
            return scaling[threshold];
        }
    }
    return 1.0;
}

/**
 * Get tier upgrade chance based on current faith points
 */
function getFaithTierUpgradeChance(faithPoints) {
    const scaling = PRAY_CHARACTERS.SANAE.faithScaling.tierUpgradeChance;
    const thresholds = Object.keys(scaling).map(Number).sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
        if (faithPoints >= threshold) {
            return scaling[threshold];
        }
    }
    return 0;
}

/**
 * Calculate scaled donation costs for Sanae
 */
function getSanaeDonationCosts(option, faithPoints) {
    const optionConfig = PRAY_CHARACTERS.SANAE.donationOptions[option];
    if (!optionConfig) return null;
    
    const costMult = getFaithCostMultiplier(faithPoints);
    
    return {
        coins: Math.floor((optionConfig.baseCost?.coins || 0) * costMult),
        gems: Math.floor((optionConfig.baseCost?.gems || 0) * costMult),
        fumoRequirement: optionConfig.fumoRequirement || null,
        faithPoints: optionConfig.faithPoints,
        label: optionConfig.label
    };
}

function getCharacterPool(enhanced = false) {
    const pool = [];
    const weightKey = enhanced ? 'enhancedWeight' : 'weight';
    for (const character of Object.values(PRAY_CHARACTERS)) {
        for (let i = 0; i < character[weightKey]; i++) {
            pool.push(character);
        }
    }
    return pool;
}

function selectRandomCharacter(enhanced = false) {
    const pool = getCharacterPool(enhanced);
    return pool[Math.floor(Math.random() * pool.length)];
}

function getRarityColor(rarity) {
    return RARITY_CONFIG[rarity]?.color || 0x808080;
}

function getRarityEmoji(rarity) {
    return RARITY_CONFIG[rarity]?.emoji || '⚪';
}

module.exports = {
    PRAY_CHARACTERS,
    RARITY_CONFIG,
    PRAY_LIMITS,
    FUMO_PRICES,
    getCharacterPool,
    selectRandomCharacter,
    getRarityColor,
    getRarityEmoji,
    getFaithCostMultiplier,
    getFaithRewardMultiplier,
    getFaithTierUpgradeChance,
    getSanaeDonationCosts
};
