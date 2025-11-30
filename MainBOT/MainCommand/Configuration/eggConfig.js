const EGG_POOL = [
    {
        name: "CommonEgg",
        emoji: "🥚",
        price: { coins: 150_000, gems: 1_000 },
        chance: 0.70,
        description: "A simple egg. Nothing special, but who knows what's inside?"
    },
    {
        name: "RareEgg",
        emoji: "✨",
        price: { coins: 1_750_000, gems: 150_000 },
        chance: 0.25,
        description: "A rare egg with a sparkling shell. Contains rare pets!"
    },
    {
        name: "DivineEgg",
        emoji: "🌟",
        price: { coins: 150_000_000, gems: 15_000_000 },
        chance: 0.05,
        description: "A legendary egg, glowing with divine energy. Only the luckiest will get this!"
    }
];

const RARITY_INFO = {
    CommonEgg: { display: "🥚 Common", color: 0x808080 },
    RareEgg: { display: "✨ Rare", color: 0x0099FF },
    DivineEgg: { display: "🌟 Divine", color: 0xFFD700 }
};

const SHOP_SIZE = 5;

const INTERACTION_TIMEOUT = 60_000;

module.exports = {
    EGG_POOL,
    RARITY_INFO,
    SHOP_SIZE,
    INTERACTION_TIMEOUT
};