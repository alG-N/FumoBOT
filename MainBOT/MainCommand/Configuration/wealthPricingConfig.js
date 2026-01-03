/**
 * Wealth-Based Dynamic Pricing Configuration
 * 
 * Formula: FinalPrice = (BasePrice + WealthAddition) × WealthMultiplier
 * Where: WealthAddition = min(BasePrice × MaxWealthCap, Wealth × PercentRate)
 * 
 * This prevents nonillionaires from trivializing shops while keeping
 * prices fair for normal players.
 */

// Coin wealth multiplier tiers - AGGRESSIVE punishment for rich players
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

// Gem wealth multiplier tiers - AGGRESSIVE punishment for rich players
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
    coins: 0.00001,     // 0.001% of coin wealth (10x more aggressive)
    gems: 0.0001        // 0.01% of gem wealth (10x more aggressive)
};

// Max wealth addition caps (as multiplier of base price)
// Higher caps = more punishment for extreme wealth
const MAX_WEALTH_CAPS = {
    coins: 50,          // Wealth addition capped at 50x base price (was 10x)
    gems: 25            // Wealth addition capped at 25x base price (was 5x)
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
