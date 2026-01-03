/**
 * Starter Pack System Configuration
 * Reworked with path selection and welcome items
 */
const STARTER_CONFIG = {
    // Starter paths - player chooses one
    PATHS: {
        gambler: {
            id: 'gambler',
            name: '🎲 The Gambler',
            description: 'High risk, high reward! More coins to start gambling.',
            color: '#FF4444',
            coins: 5000,
            gems: 100,
            spiritTokens: 3,
            items: [
                { name: 'MysteriousDice(M)', quantity: 1 },
                { name: 'PrayTicket(B)', quantity: 3 }
            ],
            welcomeMessage: 'May luck be on your side, gambler!'
        },
        devotee: {
            id: 'devotee',
            name: '🙏 The Devotee',
            description: 'Balanced start with prayer-focused items.',
            color: '#9966FF',
            coins: 2500,
            gems: 250,
            spiritTokens: 5,
            items: [
                { name: 'PrayTicket(B)', quantity: 5 },
                { name: 'Incense(M)', quantity: 2 }
            ],
            welcomeMessage: 'The shrine awaits your prayers!'
        },
        farmer: {
            id: 'farmer',
            name: '🌾 The Farmer',
            description: 'More gems for steady growth and crafting.',
            color: '#44AA44',
            coins: 1500,
            gems: 500,
            spiritTokens: 2,
            items: [
                { name: 'WeirdGrass(R)', quantity: 5 },
                { name: 'FragmentOf1800s(R)', quantity: 3 }
            ],
            welcomeMessage: 'Time to grow your collection!'
        }
    },
    
    // Universal welcome bonus (everyone gets this)
    WELCOME_BONUS: {
        coins: 500,
        gems: 50,
        items: [
            { name: 'Welcome Gift Box', quantity: 1 }
        ]
    },
    
    // Selection timeout (30 seconds to choose)
    SELECTION_TIMEOUT: 30000,
    
    // Message settings
    MESSAGE_TIMEOUT: 60000,
    
    EMBED_CONFIG: {
        title: '🎁 Welcome to FumoBOT! 🎁',
        selectionTitle: '🌟 Choose Your Path 🌟',
        footer: 'Use .daily to claim daily rewards!',
        thumbnail: 'https://www.meme-arsenal.com/memes/64de2341d1ed532a646cc011ac582e1b.jpg'
    }
};

module.exports = { STARTER_CONFIG };