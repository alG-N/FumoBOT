const TRADING_CONFIG = {
    INVITE_TIMEOUT: 60000,  
    TRADE_SESSION_TIMEOUT: 300000, 
    CONFIRM_TIMEOUT: 3000,   
    
    MAX_COIN_TRADE: 1000000000000000,
    MAX_GEM_TRADE: 1000000000000000, 
    MAX_ITEMS_PER_TRADE: 10,      
    MAX_PETS_PER_TRADE: 5,       
    MAX_FUMOS_PER_TRADE: 15,    
    
    UPDATE_DEBOUNCE: 500,         
    
    STATES: {
        PENDING_INVITE: 'pending_invite',
        ACTIVE: 'active',
        BOTH_ACCEPTED: 'both_accepted',
        CONFIRMING: 'confirming',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },
    
    COLORS: {
        INVITE: 0x3498DB,
        ACTIVE: 0xF39C12,
        ACCEPTED: 0x2ECC71,
        CANCELLED: 0xE74C3C,
        CONFIRMING: 0xE67E22
    }
};

module.exports = TRADING_CONFIG;