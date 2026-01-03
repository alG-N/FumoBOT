// Wealth pricing configuration for MarketService and ShopService
const COIN_WEALTH_TIERS = [
    { threshold: 1_000_000_000_000_000_000_000n, multiplier: 1000.0 },
    { threshold: 1_000_000_000_000_000_000n, multiplier: 500.0 },
    { threshold: 1_000_000_000_000_000n, multiplier: 250.0 },    
    { threshold: 1_000_000_000_000n, multiplier: 100.0 },       
    { threshold: 100_000_000_000n, multiplier: 50.0 },        
    { threshold: 10_000_000_000n, multiplier: 25.0 },    
    { threshold: 1_000_000_000n, multiplier: 10.0 },            
    { threshold: 100_000_000n, multiplier: 5.0 },          
    { threshold: 10_000_000n, multiplier: 3.5 },             
    { threshold: 1_000_000n, multiplier: 2.0 },             
    { threshold: 0n, multiplier: 1.0 }                   
];

const GEM_WEALTH_TIERS = [
    { threshold: 1_000_000_000_000_000_000n, multiplier: 1000.0 },
    { threshold: 1_000_000_000_000_000n, multiplier: 500.0 },
    { threshold: 1_000_000_000_000n, multiplier: 250.0 }, 
    { threshold: 100_000_000_000n, multiplier: 100.0 },   
    { threshold: 1_000_000_000n, multiplier: 50.0 },     
    { threshold: 100_000_000n, multiplier: 20.0 },     
    { threshold: 10_000_000n, multiplier: 10.0 },       
    { threshold: 1_000_000n, multiplier: 5.0 },       
    { threshold: 100_000n, multiplier: 2.5 },        
    { threshold: 10_000n, multiplier: 1.5 },       
    { threshold: 0n, multiplier: 1.0 }                 
];

// Wealth percentage rates (how much of wealth adds to price) - AGGRESSIVE
const WEALTH_PERCENT_RATES = {
    coins: 0.001,    // 0.1% of coin wealth
    gems: 0.0005     // 0.05% of gem wealth
};

// Max wealth addition caps (as multiplier of base price)
// Higher caps = more punishment for extreme wealth
const MAX_WEALTH_CAPS = {
    coins: 100,
    gems: 50
};

// Enable/disable wealth pricing per shop type
const WEALTH_PRICING_ENABLED = {
    itemShop: true,     // ShopService (items like MysteryBlock, etc.)
    coinMarket: true,   // MarketService coin shop
    gemMarket: true,    // MarketService gem shop
    eggShop: true,      // EggShopService
    globalMarket: false // Player-to-player trading (keep fair)
};

// Minimum wealth to start applying scaling (grace period for new players)
const MINIMUM_WEALTH_THRESHOLD = {
    coins: 100_000,     // Don't scale until 100K coins
    gems: 1_000         // Don't scale until 1K gems
};

module.exports = {
    COIN_WEALTH_TIERS,
    GEM_WEALTH_TIERS,
    WEALTH_PERCENT_RATES,
    MAX_WEALTH_CAPS,
    WEALTH_PRICING_ENABLED,
    MINIMUM_WEALTH_THRESHOLD
};
