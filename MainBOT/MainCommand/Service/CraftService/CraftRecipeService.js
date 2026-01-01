const ITEM_RECIPES = {
    "ForgottenBook(C)": {
        category: "Tier 1",
        requires: { "Books(C)": 1, "FragmentOf1800s(R)": 1 },
        resources: { coins: 5000, gems: 1000 },
        effect: "Unlock secret story of this bot and its developer..."
    },
    "FantasyBook(M)": {
        category: "Tier 1",
        requires: {
            "ForgottenBook(C)": 1,
            "RedShard(L)": 1,
            "WhiteShard(L)": 1,
            "DarkShard(L)": 1,
            "BlueShard(L)": 1,
            "YellowShard(L)": 1
        },
        resources: { coins: 2500, gems: 1000 },
        effect: "Enable other-fumo from otherworld.."
    },
    "Lumina(M)": {
        category: "Tier 2",
        requires: { "StarShard(M)": 5 },
        resources: { coins: 250000, gems: 15000 },
        effect: "x5 luck permanently for every 10th roll\n(applied to normal/event banner)."
    },
    "AncientRelic(E)": {
        category: "Tier 3",
        requires: {
            "ForgottenBook(C)": 15,
            "UniqueRock(C)": 25,
            "WhiteShard(L)": 15,
            "DarkShard(L)": 15
        },
        resources: { coins: 350000, gems: 50000 },
        effect: "-60% value on selling, +250% luck boost\n+350% coin boost, +500% gem boost for 1 day\n(applied to normal/event banner)"
    },
    "MysteriousCube(M)": {
        category: "Tier 3",
        requires: { "MysteriousShard(M)": 5 },
        resources: { coins: 705000, gems: 50000 },
        effect: "+???% luck, +??? coin boost, +??? gem boost for 1 day, applied to normal/event banner."
    },
    "TimeClock(L)": {
        category: "Tier 4",
        requires: {
            "TimeClock-Broken(L)": 5,
            "FragmentOfTime(E)": 25,
            "FragmentOf1800s(R)": 100
        },
        resources: { coins: 9500000, gems: 500000 },
        effect: "x2 speed on farming fumos, passive coins for 1 day(Cooldown: 1w)"
    },
    "MysteriousDice(M)": {
        category: "Tier 4",
        requires: {
            "MysteriousCube(M)": 1,
            "Dice(C)": 150
        },
        resources: { coins: 3500000, gems: 500000 },
        effect: "Dice that can be used to gamble your luck!\n\nBoost a random from 0.01% to 1000% every hour, lasted for 12 hours!\n\n**NOTE:**This item is not stackable!"
    },
    "Nullified(?)": {
        category: "Tier 5",
        requires: {
            "Undefined(?)": 2,
            "Null?(?)": 2
        },
        resources: { coins: 15000000, gems: 1000000 },
        effect: "Your rolls become nullified,\nrarity chance does not matter for 1 roll."
    },
    "CrystalSigil(?)": {
        category: "Tier 6",
        requires: {
            "Nullified(?)": 10,
            "GoldenSigil(?)": 25,
            "EquinoxAlloy(M)": 20,
            "ChromaShard(M)": 15,
            "MonoShard(M)": 15
        },
        resources: { coins: 50000000, gems: 5000000},
        effect: "Enhanced sigil with crystal properties.\n+500% coins boost\n+750% gems boost\nx1.1 to x1.5 rollspeed boost when activated"
    },
    "VoidCrystal(?)": {
        category: "Tier 6",
        requires: {
            "CrystalSigil(?)": 3,
            "Nullified(?)": 25,
            "VoidFragment(?)": 15,
            "ShinyShard(?)": 20
        },
        resources: { coins: 250000000, gems: 25000000 },
        effect: "Mysterious void energy contained in crystal.\n+1500% coins boost\n+2000% gems boost\nEnables void traits on rolls"
    },
    "EternalEssence(?)": {
        category: "Tier 6",
        requires: {
            "VoidCrystal(?)": 2,
            "CelestialEssence(D)": 10,
            "EtherealCore(D)": 5,
            "Nullified(?)": 50,
            "alGShard(P)": 15
        },
        resources: { coins: 10000000000, gems: 100000000 },
        effect: "Condensed eternal power.\n+5000% coins boost\n+7500% gems boost\nx2 variant luck (24h)"
    },
    "CosmicCore(?)": {
        category: "Tier 6",
        requires: {
            "EternalEssence(?)": 3,
            "VoidCrystal(?)": 5,
            "CrystalSigil(?)": 10,
            "alGShard(P)": 1
        },
        resources: { coins: 500000000000, gems: 5000000000 },
        effect: "Core of cosmic energy.\n+7500% coins boost\n+10000% gems boost\nEnables [GLITCHED] trait (1 in 50k)"
    },
    "S!gil?(?)": {
        category: "Tier 7(MAX)",
        requires: {
            "CosmicCore(?)": 2,
            "CrystalSigil(?)": 15,
            "GoldenSigil(?)": 5,
            "EquinoxAlloy(M)": 50,
            "Undefined(?)": 25,
            "Null?(?)": 25,
            "VoidFragment(?)": 3
        },
        resources: { coins: 95000000000000, gems: 950000000000 },
        effect: "**WONT CONSUME ITEM**\n\n+ x150 coins, x300 gems overall\n+ x1.25 to x2 luck for every GoldenSigil(?) boost applied\n+ x1.1 to x1.5 rollspeed for every CrystalSigil(?) boost applied\n+ x1.01 to x1.5 for variant luck\n+ Enabling [GLITCHED] trait, 1 in 50k\n+ 350% value when selling fumo, applied on all side\n+ 500% luck on Reimu's Praying\n\n**Downside:**\nEverytime you activate sigil, 15 Transcendent fumo[variant included] will be gone.\nEffect will apply for 12 hour"
    }
};

const POTION_RECIPES = {
    "CoinPotionT2(R)": {
        category: "Coins Potion",
        requires: { "CoinPotionT1(R)": 5 },
        resources: { coins: 15000, gems: 150 },
        effect: "+50% Coins for 60 min"
    },
    "CoinPotionT3(R)": {
        category: "Coins Potion",
        requires: { "CoinPotionT2(R)": 2 },
        resources: { coins: 30000, gems: 500 },
        effect: "+75% Coins for 60 min"
    },
    "CoinPotionT4(L)": {
        category: "Coins Potion",
        requires: { "CoinPotionT3(R)": 2 },
        resources: { coins: 65000, gems: 1000 },
        effect: "+100% Coins for 60 min"
    },
    "CoinPotionT5(M)": {
        category: "Coins Potion",
        requires: {
            "CoinPotionT1(R)": 10,
            "CoinPotionT2(R)": 5,
            "CoinPotionT3(R)": 3,
            "CoinPotionT4(L)": 1
        },
        resources: { coins: 175000, gems: 10000 },
        effect: "+150% Coins for 60 min"
    },
    "GemPotionT2(R)": {
        category: "Gems Potion",
        requires: { "GemPotionT1(R)": 4 },
        resources: { coins: 0, gems: 2000 },
        effect: "+20% Gems for 60 min"
    },
    "GemPotionT3(R)": {
        category: "Gems Potion",
        requires: { "GemPotionT2(R)": 2 },
        resources: { coins: 0, gems: 5000 },
        effect: "+45% Gems for 60 min"
    },
    "GemPotionT4(L)": {
        category: "Gems Potion",
        requires: { "GemPotionT3(R)": 2 },
        resources: { coins: 0, gems: 25000 },
        effect: "+90% Gems for 60 min"
    },
    "GemPotionT5(M)": {
        category: "Gems Potion",
        requires: {
            "GemPotionT1(R)": 10,
            "GemPotionT2(R)": 4,
            "GemPotionT3(R)": 2,
            "GemPotionT4(L)": 1
        },
        resources: { coins: 0, gems: 50000 },
        effect: "+125% Gems for 60 min"
    },
    "BoostPotionT1(L)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT1(R)": 1,
            "GemPotionT1(R)": 1
        },
        resources: { coins: 100000, gems: 1000 },
        effect: "+25% Coins & Gems for 30 min"
    },
    "BoostPotionT2(L)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT2(R)": 1,
            "GemPotionT2(R)": 1,
            "BoostPotionT1(L)": 2
        },
        resources: { coins: 250000, gems: 2500 },
        effect: "+50% Coins & Gems for 30 min"
    },
    "BoostPotionT3(L)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT3(R)": 1,
            "GemPotionT3(R)": 1,
            "BoostPotionT2(L)": 2
        },
        resources: { coins: 500000, gems: 5000 },
        effect: "+100% Coins & Gems for 30 min"
    },
    "BoostPotionT4(M)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT4(L)": 1,
            "GemPotionT4(L)": 1,
            "BoostPotionT3(L)": 2
        },
        resources: { coins: 1000000, gems: 10000 },
        effect: "+150% Coins & Gems for 30 min"
    },
    "BoostPotionT5(M)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT5(M)": 1,
            "GemPotionT5(M)": 1,
            "BoostPotionT4(M)": 1
        },
        resources: { coins: 2500000, gems: 25000 },
        effect: "+300% Coins & Gems for 60 min"
    }
};

function getRecipe(itemName, craftType) {
    const recipes = craftType === 'item' ? ITEM_RECIPES : POTION_RECIPES;
    return recipes[itemName] || null;
}

function getAllRecipes(craftType) {
    return craftType === 'item' ? ITEM_RECIPES : POTION_RECIPES;
}

function getRecipesByCategory(category, craftType) {
    const recipes = getAllRecipes(craftType);
    return Object.entries(recipes)
        .filter(([_, recipe]) => recipe.category === category)
        .reduce((acc, [name, recipe]) => {
            acc[name] = recipe;
            return acc;
        }, {});
}

module.exports = {
    getRecipe,
    getAllRecipes,
    getRecipesByCategory,
    ITEM_RECIPES,
    POTION_RECIPES
};