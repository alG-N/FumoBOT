const PRAY_CHARACTERS = {
    YUYUKO: {
        id: 'yuyuko',
        name: 'Yuyuko',
        rarity: 'Legendary',
        picture: 'https://wiki.koumakan.jp/images/hisouten/4/40/Swr-portrait-yuyuko.png',
        description: 'The Princess of the Netherworld offers ghostly blessings... or curses.',
        color: 0xFF69B4,
        offers: {
            normal: {
                coinCost: 150000,
                gemCost: 30000,
                rollReward: 100,
                rollRewardWithShiny: 200,
                luckBoost: 0.01,
                luckRarities: 'LEGENDARY,MYTHIC,EXCLUSIVE,???,ASTRAL,CELESTIAL,INFINITE,ETERNAL,TRANSCENDENT'
            },
            devour: {
                chance: 0.15,
                coinCost: 1500000,
                gemCost: 350000,
                rollReward: 1000,
                rollRewardWithShiny: 2000,
                luckBoost: 0.1,
                maxRolls: 10000
            }
        }
    },
    YUKARI: {
        id: 'yukari',
        name: 'Yukari',
        rarity: 'Mythical',
        picture: 'https://en.touhouwiki.net/images/thumb/e/e8/Th155Yukari.png/275px-Th155Yukari.png',
        description: 'The gap youkai trades your fumos for coins and gems. Better have enough collection!',
        color: 0x9932CC,
        requirements: {
            minFumos: {
                1: 1500,
                5: 1750,
                7: 2000,
                10: 3000
            },
            maxFumos: {
                1: 2000,
                5: 2500,
                7: 3000,
                10: 5000
            }
        },
        rewards: {
            multipliers: {
                1: 1.5,
                5: 3.5,
                7: 5,
                10: 25
            },
            bonusChance: 0.20,
            bonusMultiplier: {
                coins: 1.15,
                gems: 1.5
            },
            fumoTokenChance: 0.07,
            scamChance: 0.005
        },
        bonusItems: {
            1: { 'MysteriousShard(M)': 0.35 },
            5: {
                'MysteriousShard(M)': 0.50,
                'GoldenSigil(?)': 0.10,
                'Nullified(?)': 0.10,
                'Undefined(?)': 0.10,
                'Null?(?)': 0.10
            },
            7: {
                'MysteriousShard(M)': 0.75,
                'GoldenSigil(?)': 0.10,
                'Nullified(?)': 0.07,
                'Undefined(?)': 0.04,
                'Null(?)': 0.04
            },
            10: {
                'MysteriousShard(M)': 1.0,
                'GoldenSigil(?)': 0.05,
                'S!gil?(?)': 0.03,
                'Nullified(?)': 0.15,
                'Undefined(?)': 0.30,
                'Null?(?)': 0.30
            }
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
        picture: 'https://wiki.koumakan.jp/images/hisouten/4/4d/Swr-portrait-reimu.png',
        description: 'The shrine maiden accepts donations and gives rare fumos in return.',
        color: 0xFF0000,
        phases: {
            donation: {
                baseCoinCost: 60000,
                baseGemCost: 5000,
                penaltyCoinIncrease: 50000,
                penaltyGemIncrease: 5000,
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
                maxPityCount: 15,
                ultraRares: ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'],
                shinyChance: 0.18,
                alGChance: 0.008,
                tokenChances: {
                    1: 0.18,
                    2: 0.06,
                    5: 0.012,
                    25: 0.0004
                }
            }
        },
        maxUsagePerWindow: 3,
        resetWindow: 12 * 60 * 60 * 1000
    },
    MARISA: {
        id: 'marisa',
        name: 'Marisa',
        rarity: 'Rare',
        picture: 'https://static.wikia.nocookie.net/touhou/images/0/07/Th19Marisa.png',
        description: 'The ordinary magician borrows coins and returns them with interest... usually.',
        color: 0xFFD700,
        costs: {
            donation: 15000,
            return: 35000
        },
        chances: {
            absent: 0.15,
            steal: 0.03,
            stealMultiplier: {
                coins: 0.03,
                gems: 0.005
            }
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
        pity: {
            threshold: 5,
            reward: 'StarShard(M)'
        }
    },
    SAKUYA: {
        id: 'sakuya',
        name: 'Sakuya',
        rarity: 'Divine',
        picture: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/8fb402e5-c8cd-4bbe-a0ef-40b744424ab5/dg03t5g-acc5dd09-b613-4086-8c02-b673c79b57d8.png',
        description: 'The time-manipulating maid can skip time, but demands payment for her services.',
        color: 0x87CEEB,
        timeSkip: {
            duration: 12 * 60 * 60 * 1000,
            costScaling: [0.10, 0.18, 0.28, 0.40, 0.50, 0.60],
            fumoRequirements: [0, 1, 2, 2, 2, 2],
            maxUses: 6,
            resetWindow: 24 * 60 * 60 * 1000,
            cooldownWindow: 12 * 60 * 60 * 1000
        },
        rarityRequirements: {
            normal: ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL'],
            high: ['ASTRAL', 'CELESTIAL', 'INFINITE']
        },
        rewards: {
            coinLimit: 10000000000,
            gemLimit: 1000000000,
            perfectSkipChance: 0.01,
            perfectSkipChanceWithSakuya: 0.03,
            bonusDrops: {
                fragment: { base: 0.12, withSakuya: 0.22 },
                clock: { base: 0.03, withSakuya: 0.07 },
                watch: { base: 0.005, withSakuya: 0.015 }
            }
        },
        blessing: {
            threshold: 100,
            duration: 24 * 60 * 60 * 1000,
            cooldownMultiplier: 0.5,
            increment: 10
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

function getCharacterPool() {
    const pool = [];
    for (const [key, character] of Object.entries(PRAY_CHARACTERS)) {
        const rarityConfig = RARITY_CONFIG[character.rarity];
        for (let i = 0; i < rarityConfig.weight; i++) {
            pool.push(character);
        }
    }
    return pool;
}

function selectRandomCharacter() {
    const pool = getCharacterPool();
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
    getRarityEmoji
};