/**
 * Main Quest Configuration
 * 
 * alterGolden's Main Quest system - A guided story-driven progression
 * that teaches players the mechanics of FumoBOT while providing
 * meaningful rewards (primarily EXP for leveling).
 * 
 * 30 Main Quests total, gradually increasing in difficulty.
 * Progress persists through rebirths.
 */

// ═══════════════════════════════════════════════════════════════════
// MAIN QUEST CHARACTER
// ═══════════════════════════════════════════════════════════════════
const QUEST_GIVER = {
    name: 'alterGolden',
    title: 'The Guide',
    emoji: '👤',
    avatar: null, // Can be set to a URL if you have an avatar image
    color: '#FFD700'
};

// ═══════════════════════════════════════════════════════════════════
// QUEST DIFFICULTY SCALING
// ═══════════════════════════════════════════════════════════════════
const DIFFICULTY = {
    TUTORIAL: { color: '#00FF00', expMultiplier: 1.0, name: 'Tutorial' },
    EASY: { color: '#7CFC00', expMultiplier: 1.0, name: 'Easy' },
    NORMAL: { color: '#FFFF00', expMultiplier: 1.2, name: 'Normal' },
    MEDIUM: { color: '#FFA500', expMultiplier: 1.5, name: 'Medium' },
    HARD: { color: '#FF4500', expMultiplier: 2.0, name: 'Hard' },
    EXPERT: { color: '#FF0000', expMultiplier: 2.5, name: 'Expert' },
    MASTER: { color: '#8B0000', expMultiplier: 3.0, name: 'Master' }
};

// ═══════════════════════════════════════════════════════════════════
// MAIN QUESTS (30 total)
// Each quest teaches a mechanic and provides EXP
// ═══════════════════════════════════════════════════════════════════
const MAIN_QUESTS = [
    // ===== TUTORIAL PHASE (Quests 1-5) =====
    {
        id: 1,
        title: 'Welcome, Collector',
        difficulty: 'TUTORIAL',
        teaches: '.starter',
        story: [
            "Ah, a new face! Welcome to the world of Fumo collecting.",
            "I am alterGolden, and I'll be your guide on this journey.",
            "Every collector needs their first Fumo. Use `.starter` to claim yours!"
        ],
        requirement: { type: 'command', command: 'starter', count: 1 },
        rewards: { exp: 50, coins: 1000 },
        hint: 'Type `.starter` to claim your first fumo!'
    },
    {
        id: 2,
        title: 'Daily Routine',
        difficulty: 'TUTORIAL',
        teaches: '.daily',
        story: [
            "Excellent! You've received your first Fumo.",
            "Did you know you can claim daily rewards?",
            "Use `.daily` once per day for free resources!"
        ],
        requirement: { type: 'command', command: 'daily', count: 1 },
        rewards: { exp: 75, coins: 1500 },
        hint: 'Type `.daily` to claim your daily bonus.'
    },
    {
        id: 3,
        title: 'First Summon',
        difficulty: 'TUTORIAL',
        teaches: '.crate',
        story: [
            "Now things get exciting!",
            "The gacha crate is where you'll find new Fumos.",
            "Try rolling 10 times to see what you can discover!"
        ],
        requirement: { type: 'tracking', trackingType: 'rolls', count: 10 },
        rewards: { exp: 100, coins: 2000 },
        hint: 'Use `.crate` or `.roll` to summon fumos!'
    },
    {
        id: 4,
        title: 'Check Your Wealth',
        difficulty: 'TUTORIAL',
        teaches: '.balance',
        story: [
            "You're collecting nicely!",
            "It's important to keep track of your resources.",
            "Use `.balance` to see your complete profile."
        ],
        requirement: { type: 'command', command: 'balance', count: 1 },
        rewards: { exp: 50, coins: 500 },
        hint: 'Type `.balance` or `.bal` to view your profile.'
    },
    {
        id: 5,
        title: 'Storage Keeper',
        difficulty: 'TUTORIAL',
        teaches: '.storage',
        story: [
            "Your collection is growing!",
            "Let's check your storage to see all your Fumos.",
            "Use `.storage` to view your collection."
        ],
        requirement: { type: 'command', command: 'storage', count: 1 },
        rewards: { exp: 50, coins: 500 },
        hint: 'Type `.storage` to see your fumo collection.'
    },
    
    // ===== EASY PHASE (Quests 6-10) =====
    {
        id: 6,
        title: 'The Library',
        difficulty: 'EASY',
        teaches: '.library',
        story: [
            "There's a vast library of Fumos waiting to be discovered.",
            "The Library tracks all Fumos you've ever obtained.",
            "You've discovered some already - let's see your progress!"
        ],
        requirement: { type: 'tracking', trackingType: 'library_discovered', count: 10 },
        rewards: { exp: 100, coins: 3000 },
        hint: 'Use `.library` to check your discovered fumos. Keep rolling to discover more!'
    },
    {
        id: 7,
        title: 'Know Your Fumo',
        difficulty: 'EASY',
        teaches: '.inform',
        story: [
            "Each Fumo has its own story and stats.",
            "Use `.inform [fumo name]` to learn about any Fumo.",
            "Knowledge is power, collector!"
        ],
        requirement: { type: 'command', command: 'inform', count: 3 },
        rewards: { exp: 75, coins: 2000 },
        hint: 'Type `.inform [fumo name]` to view fumo details.'
    },
    {
        id: 8,
        title: 'Daily Duties',
        difficulty: 'EASY',
        teaches: 'Daily Quests',
        story: [
            "Besides main quests, there are daily challenges!",
            "Complete daily quests for extra rewards.",
            "Finish at least one to prove yourself."
        ],
        requirement: { type: 'tracking', trackingType: 'quests_completed', count: 1 },
        rewards: { exp: 150, coins: 5000 },
        hint: 'Use `.quest` to see your daily quests and complete them!'
    },
    {
        id: 9,
        title: 'Farm Initiation',
        difficulty: 'EASY',
        teaches: '.farm',
        story: [
            "Here's where it gets interesting!",
            "You can put your Fumos to work on a farm.",
            "They'll earn coins and gems passively!"
        ],
        requirement: { type: 'tracking', trackingType: 'farming_add', count: 1 },
        rewards: { exp: 150, coins: 5000, gems: 500 },
        hint: 'Use `.farm add [fumo name]` to add a fumo to your farm.'
    },
    {
        id: 10,
        title: 'Building Basics',
        difficulty: 'EASY',
        teaches: 'Buildings',
        story: [
            "Your farm can be improved with buildings!",
            "Buildings provide permanent bonuses.",
            "Upgrade any building to boost your earnings."
        ],
        requirement: { type: 'tracking', trackingType: 'building_upgrades', count: 1 },
        rewards: { exp: 200, coins: 10000, gems: 1000 },
        hint: 'Use `.farm` and click on Buildings to upgrade them.'
    },
    
    // ===== NORMAL PHASE (Quests 11-15) =====
    {
        id: 11,
        title: 'Pray for Fortune',
        difficulty: 'NORMAL',
        teaches: '.pray',
        story: [
            "The shrine holds many blessings...",
            "Different characters offer different rewards.",
            "Try praying to see what fortune awaits!"
        ],
        requirement: { type: 'tracking', trackingType: 'prays', count: 3 },
        rewards: { exp: 200, coins: 8000, gems: 800 },
        hint: 'Use `.pray` to pray at the shrine. Try different characters!'
    },
    {
        id: 12,
        title: 'Shiny Hunter',
        difficulty: 'NORMAL',
        teaches: 'Variants',
        story: [
            "Did you know Fumos can come in special variants?",
            "Shiny Fumos are rare and valuable!",
            "Keep rolling until you find one!"
        ],
        requirement: { type: 'tracking', trackingType: 'shinies', count: 1 },
        rewards: { exp: 250, coins: 15000, gems: 1500 },
        hint: 'Shiny fumos are rare! Keep rolling with `.crate` to find one.'
    },
    {
        id: 13,
        title: "Crafter's Path",
        difficulty: 'NORMAL',
        teaches: '.craft',
        story: [
            "Raw materials can be refined into useful items.",
            "The crafting system lets you create boosts and more!",
            "Try crafting something."
        ],
        requirement: { type: 'tracking', trackingType: 'crafts', count: 1 },
        rewards: { exp: 200, coins: 10000, gems: 1000 },
        hint: 'Use `.craft` to see available recipes and craft items.'
    },
    {
        id: 14,
        title: 'Market Explorer',
        difficulty: 'NORMAL',
        teaches: '.market',
        story: [
            "The global market connects all collectors!",
            "You can buy and sell fumos here.",
            "Take a look at what's available."
        ],
        requirement: { type: 'command', command: 'market', count: 1 },
        rewards: { exp: 100, coins: 5000 },
        hint: 'Use `.market` to browse the global marketplace.'
    },
    {
        id: 15,
        title: 'Weekly Warrior',
        difficulty: 'NORMAL',
        teaches: 'Weekly Quests',
        story: [
            "Weekly quests offer bigger challenges...",
            "And bigger rewards!",
            "Complete a weekly quest this week."
        ],
        requirement: { type: 'tracking', trackingType: 'weekly_quest_completed', count: 1 },
        rewards: { exp: 300, coins: 20000, gems: 2000 },
        hint: 'Use `.quest` and check Weekly tab. These reset every Monday!'
    },
    
    // ===== MEDIUM PHASE (Quests 16-20) =====
    {
        id: 16,
        title: 'Fragment Seeker',
        difficulty: 'MEDIUM',
        teaches: 'Fragments',
        story: [
            "Some items come in fragments...",
            "Collect enough and combine them!",
            "Use a fragment to progress."
        ],
        requirement: { type: 'tracking', trackingType: 'fragment_used', count: 1 },
        rewards: { exp: 250, coins: 15000, gems: 1500 },
        hint: 'Fragments can be combined into full items. Check `.item`!'
    },
    {
        id: 17,
        title: 'Rare Discovery',
        difficulty: 'MEDIUM',
        teaches: 'Rarities',
        story: [
            "The rarest Fumos hold incredible power!",
            "LEGENDARY and above are truly special.",
            "Obtain one to prove your luck!"
        ],
        requirement: { type: 'tracking', trackingType: 'legendary_plus', count: 1 },
        rewards: { exp: 400, coins: 30000, gems: 3000 },
        hint: 'Keep rolling! Legendary+ fumos are rare but worth it.'
    },
    {
        id: 18,
        title: 'Prayer Devotion',
        difficulty: 'MEDIUM',
        teaches: 'Prayer Characters',
        story: [
            "Each prayer character has unique mechanics.",
            "Try praying to all different characters!",
            "Diversity brings the best rewards."
        ],
        requirement: { type: 'tracking', trackingType: 'prayer_variety', count: 4 },
        rewards: { exp: 350, coins: 25000, gems: 2500 },
        hint: 'Use `.pray reimu`, `.pray marisa`, `.pray yukari`, etc.'
    },
    {
        id: 19,
        title: 'Lucky Gambler',
        difficulty: 'MEDIUM',
        teaches: '.slots',
        story: [
            "Feeling lucky?",
            "The slot machine awaits brave souls.",
            "Win at least once!"
        ],
        requirement: { type: 'tracking', trackingType: 'gamble_wins', count: 1 },
        rewards: { exp: 300, coins: 20000, gems: 2000 },
        hint: 'Try `.slots` or `.flip` to gamble. Good luck!'
    },
    {
        id: 20,
        title: 'Building Empire',
        difficulty: 'MEDIUM',
        teaches: 'Building Synergy',
        story: [
            "Multiple buildings create powerful synergies!",
            "Reach a total of 10 building levels.",
            "Your farm will thrive!"
        ],
        requirement: { type: 'tracking', trackingType: 'total_building_levels', count: 10 },
        rewards: { exp: 500, coins: 50000, gems: 5000 },
        hint: 'Upgrade various buildings. Their levels add up!'
    },
    
    // ===== HARD PHASE (Quests 21-25) =====
    {
        id: 21,
        title: 'The Limit Breaker',
        difficulty: 'HARD',
        teaches: '.lb',
        story: [
            "When a Fumo reaches its limits...",
            "You can break through with Limit Break!",
            "This enhances their farming power."
        ],
        requirement: { type: 'tracking', trackingType: 'limit_breaks', count: 1 },
        rewards: { exp: 500, coins: 40000, gems: 4000 },
        hint: 'Use `.lb` to limit break a fumo. Requires duplicate fumos!'
    },
    {
        id: 22,
        title: 'Achievement Hunter',
        difficulty: 'HARD',
        teaches: 'Achievements',
        story: [
            "Achievements track your lifetime progress.",
            "They provide badges and permanent rewards!",
            "Claim 5 achievement milestones."
        ],
        requirement: { type: 'tracking', trackingType: 'achievements_claimed', count: 5 },
        rewards: { exp: 600, coins: 50000, gems: 5000 },
        hint: 'Use `.quest achievements` to see and claim achievements.'
    },
    {
        id: 23,
        title: 'Weather Watcher',
        difficulty: 'HARD',
        teaches: 'Seasons/Weather',
        story: [
            "The weather affects farming yields!",
            "Different weather brings different bonuses.",
            "Farm during a weather event for bonus rewards."
        ],
        requirement: { type: 'tracking', trackingType: 'weather_farm', count: 1 },
        rewards: { exp: 350, coins: 30000, gems: 3000 },
        hint: 'Wait for a weather event and farm during it. Check `.balance`!'
    },
    {
        id: 24,
        title: 'Elite Collector',
        difficulty: 'HARD',
        teaches: 'Collection Goals',
        story: [
            "A true collector owns many unique Fumos!",
            "Expand your collection to 50 unique Fumos.",
            "Quality AND quantity!"
        ],
        requirement: { type: 'tracking', trackingType: 'unique_fumos', count: 50 },
        rewards: { exp: 600, coins: 75000, gems: 7500 },
        hint: 'Check `.storage` - collect 50 different fumo types!'
    },
    {
        id: 25,
        title: 'Master Farmer',
        difficulty: 'HARD',
        teaches: 'Advanced Farming',
        story: [
            "Your farm should be bustling with activity!",
            "Have 10 different Fumos farming at once.",
            "Maximize your passive income!"
        ],
        requirement: { type: 'tracking', trackingType: 'farming_count', count: 10 },
        rewards: { exp: 500, coins: 60000, gems: 6000 },
        hint: 'Use `.farm add` to add more fumos. Get 10 farming!'
    },
    
    // ===== EXPERT PHASE (Quests 26-28) =====
    {
        id: 26,
        title: 'The Mythical Path',
        difficulty: 'EXPERT',
        teaches: 'High Rarity',
        story: [
            "Mythical Fumos are legends among collectors...",
            "Only the luckiest find them!",
            "Obtain a MYTHICAL or higher rarity Fumo."
        ],
        requirement: { type: 'tracking', trackingType: 'mythical_plus', count: 1 },
        rewards: { exp: 750, coins: 100000, gems: 10000 },
        hint: 'Keep rolling! Mythical+ is very rare but possible.'
    },
    {
        id: 27,
        title: 'Economy Master',
        difficulty: 'EXPERT',
        teaches: 'Wealth Building',
        story: [
            "True masters accumulate great wealth.",
            "Reach 10 million coins!",
            "Farm, trade, gamble - use every method!"
        ],
        requirement: { type: 'tracking', trackingType: 'coins_milestone', count: 10000000 },
        rewards: { exp: 600, coins: 0, gems: 10000 },
        hint: 'Accumulate 10,000,000 coins through any means!'
    },
    {
        id: 28,
        title: 'True Devotee',
        difficulty: 'EXPERT',
        teaches: 'Prayer Mastery',
        story: [
            "The shrine recognizes true devotion...",
            "Reach Yukari Mark 5 through faithful prayer.",
            "The rewards will be worth it!"
        ],
        requirement: { type: 'tracking', trackingType: 'yukari_mark', count: 5 },
        rewards: { exp: 800, coins: 150000, gems: 15000 },
        hint: 'Pray to Yukari repeatedly to increase your mark!'
    },
    
    // ===== MASTER PHASE (Quests 29-30) =====
    {
        id: 29,
        title: 'Transcendence Awaits',
        difficulty: 'MASTER',
        teaches: 'Level System',
        story: [
            "You've come so far, young collector...",
            "But the journey is not over.",
            "Reach Level 75 to prepare for what's next."
        ],
        requirement: { type: 'level', count: 75 },
        rewards: { exp: 1000, coins: 200000, gems: 20000 },
        hint: 'Keep gaining EXP to level up! Almost there!'
    },
    {
        id: 30,
        title: 'The Beginning',
        difficulty: 'MASTER',
        teaches: 'Rebirth',
        story: [
            "You have reached the pinnacle...",
            "Or have you?",
            "Rebirth awaits at Level 100.",
            "Complete your first rebirth to truly begin!",
            "",
            "This is not the end, collector...",
            "It's only the beginning."
        ],
        requirement: { type: 'rebirth', count: 1 },
        rewards: { exp: 2000, coins: 500000, gems: 50000 },
        hint: 'Reach Level 100 and use `.rebirth` to be reborn!'
    }
];

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get quest by ID
 * @param {number} questId 
 * @returns {Object|null}
 */
function getQuestById(questId) {
    return MAIN_QUESTS.find(q => q.id === questId) || null;
}

/**
 * Get next quest in sequence
 * @param {number} currentQuestId 
 * @returns {Object|null}
 */
function getNextQuest(currentQuestId) {
    return MAIN_QUESTS.find(q => q.id === currentQuestId + 1) || null;
}

/**
 * Get quest difficulty info
 * @param {string} difficultyKey 
 * @returns {Object}
 */
function getDifficultyInfo(difficultyKey) {
    return DIFFICULTY[difficultyKey] || DIFFICULTY.NORMAL;
}

/**
 * Calculate quest EXP with difficulty multiplier
 * @param {Object} quest 
 * @returns {number}
 */
function calculateQuestExp(quest) {
    const difficulty = getDifficultyInfo(quest.difficulty);
    return Math.floor(quest.rewards.exp * difficulty.expMultiplier);
}

/**
 * Get total main quests count
 * @returns {number}
 */
function getTotalMainQuests() {
    return MAIN_QUESTS.length;
}

/**
 * Get quests by difficulty
 * @param {string} difficulty 
 * @returns {Object[]}
 */
function getQuestsByDifficulty(difficulty) {
    return MAIN_QUESTS.filter(q => q.difficulty === difficulty);
}

/**
 * Format quest progress percentage
 * @param {number} completed - Number of completed quests
 * @returns {string}
 */
function formatMainQuestProgress(completed) {
    const total = MAIN_QUESTS.length;
    const percentage = ((completed / total) * 100).toFixed(1);
    return `${completed}/${total} (${percentage}%)`;
}

// ═══════════════════════════════════════════════════════════════════
// TRACKING TYPE REFERENCE
// All tracking types used in main quests that need to be tracked
// by the questMiddleware. This is a reference for integration.
// ═══════════════════════════════════════════════════════════════════
const TRACKING_TYPES = {
    // Gacha/Roll tracking
    rolls: 'Number of gacha rolls performed',
    multi_rolls: 'Number of multi-rolls performed',
    shinies: 'Number of shiny fumos obtained',
    legendary_plus: 'Legendary or higher rarity obtained',
    mythical_plus: 'Mythical or higher rarity obtained',
    
    // Library/Collection tracking
    library_discovered: 'Number of unique fumos discovered in library',
    unique_fumos: 'Number of unique fumos owned in storage',
    
    // Quest tracking
    quests_completed: 'Daily/weekly quests completed',
    weekly_quest_completed: 'Weekly quests specifically completed',
    
    // Farming tracking
    farming_add: 'Fumos added to farm',
    farming_count: 'Current number of fumos farming',
    building_upgrades: 'Building upgrades purchased',
    total_building_levels: 'Sum of all building levels',
    weather_farm: 'Farmed during weather event',
    
    // Prayer tracking
    prays: 'Total prayers performed',
    prayer_variety: 'Unique prayer characters used',
    yukari_mark: 'Current Yukari mark level',
    
    // Crafting tracking
    crafts: 'Items crafted',
    fragment_used: 'Fragments combined/used',
    
    // Gambling tracking
    gamble_wins: 'Gambling wins (slots, flip)',
    
    // Other tracking
    limit_breaks: 'Limit breaks performed',
    achievements_claimed: 'Achievement milestones claimed',
    coins_milestone: 'Highest coin balance reached',
    trades: 'Trades completed'
};

/**
 * Get all tracking types used in main quests
 * @returns {string[]}
 */
function getRequiredTrackingTypes() {
    const types = new Set();
    for (const quest of MAIN_QUESTS) {
        if (quest.requirement.type === 'tracking') {
            types.add(quest.requirement.trackingType);
        }
    }
    return Array.from(types);
}

module.exports = {
    // Constants
    QUEST_GIVER,
    DIFFICULTY,
    MAIN_QUESTS,
    TRACKING_TYPES,
    
    // Functions
    getQuestById,
    getNextQuest,
    getDifficultyInfo,
    calculateQuestExp,
    getTotalMainQuests,
    getQuestsByDifficulty,
    formatMainQuestProgress,
    getRequiredTrackingTypes
};
