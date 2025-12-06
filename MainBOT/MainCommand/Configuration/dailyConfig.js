const DAILY_CONFIG = {
    COOLDOWN: 24 * 60 * 60 * 1000,
    
    STREAK_LOSS_THRESHOLD: 48 * 60 * 60 * 1000,
    
    MAX_STREAK_DISPLAY: 7,
    
    REWARD_TIERS: [
        {
            chance: 0.5,
            baseCoins: 1500,
            baseGems: 150,
            streakBonus: 150,
            spiritTokens: 1,
            description: '🎁 **Daily Bonus!** 🎁\n\nA solid reward to keep your journey going!',
            rarity: 'Common',
            color: '#0099ff',
            thumbnail: 'https://www.meme-arsenal.com/memes/64de2341d1ed532a646cc011ac582e1b.jpg'
        },
        {
            chance: 0.8,
            baseCoins: 3000,
            baseGems: 300,
            streakBonus: 300,
            spiritTokens: 2,
            description: '🎉 **Daily Bonus!** 🎉\n\nA generous bonus from the bot!',
            rarity: 'Uncommon',
            color: '#33cc33'
        },
        {
            chance: 0.95,
            baseCoins: 7000,
            baseGems: 700,
            streakBonus: 700,
            spiritTokens: 3,
            description: '💰 **Daily Bonus!** 💰\n\nJackpot! Your luck is shining bright today!',
            rarity: 'Rare',
            color: '#ffcc00'
        },
        {
            chance: 0.99,
            baseCoins: 15000,
            baseGems: 1500,
            streakBonus: 1500,
            spiritTokens: 5,
            description: '🎊 **Daily Bonus!** 🎊\n\nAn unexpected windfall!',
            rarity: 'Epic',
            color: '#ff66ff'
        },
        {
            chance: 1.0,
            baseCoins: 200000,
            baseGems: 20000,
            streakBonus: 0,
            spiritTokens: 10,
            description: '👑 **Daily Bonus!** 👑\n\nIncredible! You\'ve hit the ultimate jackpot!',
            rarity: 'Legendary',
            color: '#ff0000'
        }
    ],
    
    MESSAGE_TIMEOUT: 30000,
    
    DEFAULT_THUMBNAIL: 'https://www.meme-arsenal.com/memes/64de2341d1ed532a646cc011ac582e1b.jpg',
    
    COOLDOWN_FOOTER: {
        text: 'Come back tomorrow for even better rewards!',
        icon: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/edbbe96e-e6e4-4343-981d-7eaf881a1964/dg6bym4-429fca4d-11e6-4205-a749-5da24e2bf47f.png'
    }
};

module.exports = { DAILY_CONFIG };