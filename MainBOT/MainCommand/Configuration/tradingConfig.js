/**
 * Trading System Configuration
 */

const TRADING_CONFIG = {
    // Timeouts
    INVITE_TIMEOUT: 60000,        // 60 seconds to accept trade invite
    TRADE_SESSION_TIMEOUT: 300000, // 5 minutes for entire trade session
    CONFIRM_TIMEOUT: 3000,         // 3 seconds final confirmation warning
    
    // Limits
    MAX_COIN_TRADE: 1000000000000000, // Max 1 Qa coins
    MAX_GEM_TRADE: 1000000000000000, // Max 1 Qa gems
    MAX_ITEMS_PER_TRADE: 10,       // Max 10 different items
    MAX_PETS_PER_TRADE: 5,         // Max 5 pets
    MAX_FUMOS_PER_TRADE: 15,       // Max 15 different fumo types
    
    // UI Settings
    UPDATE_DEBOUNCE: 500,          // 500ms debounce for UI updates
    
    // Trade states
    STATES: {
        PENDING_INVITE: 'pending_invite',
        ACTIVE: 'active',
        BOTH_ACCEPTED: 'both_accepted',
        CONFIRMING: 'confirming',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },
    
    // Colors
    COLORS: {
        INVITE: 0x3498DB,
        ACTIVE: 0xF39C12,
        ACCEPTED: 0x2ECC71,
        CANCELLED: 0xE74C3C,
        CONFIRMING: 0xE67E22
    }
};

module.exports = TRADING_CONFIG;