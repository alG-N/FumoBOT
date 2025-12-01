/**
 * Trading System Configuration
 */

const TRADING_CONFIG = {
    // Timeouts
    INVITE_TIMEOUT: 60000,        // 60 seconds to accept trade invite
    TRADE_SESSION_TIMEOUT: 300000, // 5 minutes for entire trade session
    CONFIRM_TIMEOUT: 5000,         // 5 seconds final confirmation warning
    
    // Limits
    MAX_COIN_TRADE: 1000000000,    // 1 billion coins max
    MAX_GEM_TRADE: 100000000,      // 100 million gems max
    MAX_ITEMS_PER_TRADE: 10,       // Max 10 different items
    MAX_PETS_PER_TRADE: 5,         // Max 5 pets
    
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