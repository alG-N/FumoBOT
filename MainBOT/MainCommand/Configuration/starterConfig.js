const STARTER_CONFIG = {
    REWARD_TIERS: [
        {
            chance: 70,
            coins: 1000,
            gems: 100,
            description: '💠 "You got the **Common** gift, quite average, isn\'t it?" - alterSliver',
            rarity: 'Common',
            color: '#808080'
        },
        {
            chance: 90,
            coins: 2000,
            gems: 200,
            description: '🔷 "An **Uncommon** gift! Better than the common one, at least." - alterSliver',
            rarity: 'Uncommon',
            color: '#00FF00'
        },
        {
            chance: 99,
            coins: 5000,
            gems: 500,
            description: '🔶 "A **Rare** gift! Luck is on your side today!" - alterSliver',
            rarity: 'Rare',
            color: '#0099FF'
        },
        {
            chance: 99.9,
            coins: 10000,
            gems: 1000,
            description: '✨ "Go buy a lottery ticket! This gift is 0.1% chance!" - alterSliver',
            rarity: 'Epic',
            color: '#9933FF'
        },
        {
            chance: 100,
            coins: 100000,
            gems: 10000,
            description: '💎 "The **Ultimate** gift! This was supposed to be impossible to obtain!" - alterSliver',
            rarity: 'Legendary',
            color: '#FFD700'
        }
    ],
    
    MESSAGE_TIMEOUT: 30000,
    
    EMBED_CONFIG: {
        title: '🎁 Starter Pack Reward 🎁',
        footer: 'Welcome to FumoBOT! Use .daily to claim daily rewards.',
        thumbnail: 'https://www.meme-arsenal.com/memes/64de2341d1ed532a646cc011ac582e1b.jpg'
    }
};

module.exports = { STARTER_CONFIG };