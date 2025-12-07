const VALID_CODES = {
    "Welcome": {
        coins: 10000,
        gems: 500,
        expires: null,
        maxUses: null,
        description: "A warm welcome gift for new users!",
        category: "starter"
    },
    "BugFix": {
        items: [
            { item: "alGShard(P)", quantity: 1 },
            { item: "ShinyShard(?)", quantity: 10 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Updated server lets gooo!",
        category: "event"
    },
    "BetaTest3322": {
        items: [
            { item: "Lumina(M)", quantity: 150 },
            { item: "ForgottenBook(C)", quantity: 500 },
            { item: "RedShard(L)", quantity: 150 },
            { item: "WhiteShard(L)", quantity: 150 },
            { item: "YellowShard(L)", quantity: 150 },
            { item: "BlueShard(L)", quantity: 150 },
            { item: "DarkShard(L)", quantity: 150 },
            { item: "AncientRelic(E)", quantity: 150 },
            { item: "FragmentOf1800s(R)", quantity: 150 },
            { item: "Nullified(?)", quantity: 150 },
            { item: "HakureiTicket(L)", quantity: 150 },
            { item: "TimeClock(L)", quantity: 150 },
            { item: "MysteriousDice(M)", quantity: 150 },
            { item: "PrayTicket(R)", quantity: 150 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Beta tester exclusive!",
        category: "beta"
    },
    "golden_exist": {
        coins: 99999,
        gems: 9999,
        expires: null,
        maxUses: 1,
        description: "Only the first to find this gets the gold!",
        category: "limited"
    },
    "JACKPOT": {
        coins: 7777,
        gems: 777,
        expires: null,
        maxUses: null,
        description: "Lucky jackpot code!",
        category: "regular"
    },
    "HOLIDAY2025": {
        coins: 50000,
        gems: 5000,
        items: [
            { item: "GoldenSigil(?)", quantity: 1 },
            { item: "TimeClock(L)", quantity: 2 }
        ],
        expires: "2026-01-15T23:59:59Z",
        maxUses: null,
        description: "Happy Holidays from FumoBOT!",
        category: "seasonal"
    },
    "NEWUSER100": {
        coins: 15000,
        gems: 1500,
        items: [
            { item: "PrayTicket(R)", quantity: 10 },
            { item: "BoostPotionT1(L)", quantity: 5 }
        ],
        expires: null,
        maxUses: null,
        description: "Perfect starter pack for new players!",
        category: "starter"
    },
    "RARETREASURE": {
        items: [
            { item: "MysteriousCube(M)", quantity: 3 },
            { item: "AncientRelic(E)", quantity: 5 },
            { item: "Lumina(M)", quantity: 1 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: 100,
        description: "Rare treasure for dedicated players!",
        category: "limited"
    },
    "BOOSTME": {
        items: [
            { item: "BoostPotionT3(L)", quantity: 3 },
            { item: "CoinPotionT4(L)", quantity: 2 },
            { item: "GemPotionT4(L)", quantity: 2 }
        ],
        expires: null,
        maxUses: null,
        description: "Ultimate boost package!",
        category: "regular"
    },
    "SHINYMASTER": {
        coins: 100000,
        gems: 10000,
        items: [
            { item: "ShinyShard(?)", quantity: 5 },
            { item: "alGShard(P)", quantity: 1 }
        ],
        expires: "2026-06-30T23:59:59Z",
        maxUses: 50,
        description: "Transform your collection with shiny power!",
        category: "limited"
    },
    "DAILYGRIND": {
        coins: 25000,
        gems: 2500,
        items: [
            { item: "PrayTicket(R)", quantity: 15 },
            { item: "HakureiTicket(L)", quantity: 3 }
        ],
        expires: null,
        maxUses: null,
        description: "Boost your daily routine!",
        category: "regular"
    },
    "SECRETVAULT": {
        coins: 500000,
        gems: 50000,
        items: [
            { item: "GoldenSigil(?)", quantity: 3 },
            { item: "S!gil?(?)", quantity: 1 },
            { item: "Nullified(?)", quantity: 10 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: 10,
        description: "Ultra rare vault unlock!",
        category: "ultra"
    },
    "PETLOVER": {
        coins: 30000,
        items: [
            { item: "PetFoob(B)", quantity: 50 },
            { item: "CommonEgg", quantity: 5 },
            { item: "RareEgg", quantity: 2 }
        ],
        expires: null,
        maxUses: null,
        description: "Take care of your pets!",
        category: "regular"
    },
    "CRAFTMASTER": {
        items: [
            { item: "ForgottenBook(C)", quantity: 100 },
            { item: "FantasyBook(M)", quantity: 10 },
            { item: "MysteriousCube(M)", quantity: 5 },
            { item: "RedShard(L)", quantity: 50 },
            { item: "BlueShard(L)", quantity: 50 },
            { item: "YellowShard(L)", quantity: 50 }
        ],
        expires: "2026-03-31T23:59:59Z",
        maxUses: null,
        description: "Master crafter's resource pack!",
        category: "event"
    },
    "LUCKYROLL": {
        coins: 77777,
        gems: 7777,
        items: [
            { item: "Nullified(?)", quantity: 7 },
            { item: "MysteriousDice(M)", quantity: 2 }
        ],
        expires: null,
        maxUses: 77,
        description: "Lucky number 7!",
        category: "limited"
    },
    "TIMEKEEPER": {
        items: [
            { item: "TimeClock(L)", quantity: 10 },
            { item: "MysteriousDice(M)", quantity: 5 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Control time itself!",
        category: "event"
    },
    "ROLLBACKCOMPENSATION": {
        items: [
            { item: "alGShard(P)", quantity: 3 },
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Compensation for the huge admin weather abuse that cause economy break",
        category: "limited"
    }
};

const ADMIN_IDS = ['1128296349566251068', '1362450043939979378'];

const CODE_CATEGORIES = {
    starter: { emoji: '🌱', name: 'Starter', color: 0x00FF00 },
    regular: { emoji: '📦', name: 'Regular', color: 0x3498DB },
    event: { emoji: '🎉', name: 'Event', color: 0xE74C3C },
    seasonal: { emoji: '🎄', name: 'Seasonal', color: 0xF39C12 },
    limited: { emoji: '⏰', name: 'Limited', color: 0x9B59B6 },
    beta: { emoji: '🧪', name: 'Beta', color: 0x1ABC9C },
    ultra: { emoji: '💎', name: 'Ultra Rare', color: 0xFFD700 }
};

const CODE_LIMITS = {
    MAX_REDEMPTIONS_PER_DAY: 10,
    COOLDOWN_BETWEEN_CODES: 5000,
    MAX_CODES_PER_USER: 1000
};

const CODE_MESSAGES = {
    ALREADY_REDEEMED: 'You have already redeemed this code.',
    EXPIRED: 'This code has expired.',
    MAX_USES_REACHED: 'This code has reached its maximum usage limit.',
    INVALID_CODE: 'Invalid code. Please check your spelling and try again.',
    RATE_LIMITED: 'You are redeeming codes too quickly. Please wait a moment.',
    SUCCESS: 'Code redeemed successfully!',
    DAILY_LIMIT: 'You have reached your daily code redemption limit.'
};

module.exports = {
    VALID_CODES,
    ADMIN_IDS,
    CODE_CATEGORIES,
    CODE_LIMITS,
    CODE_MESSAGES
};