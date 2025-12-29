/**
 * Ticket Service
 * Handles all ticket-related business logic
 */

const fs = require('fs');
const path = require('path');
const { TICKET_TYPES, SUPPORT_GUILD_ID, REPORT_CHANNEL_ID, TICKET_EXPIRY_MS } = require('../Config/adminConfig');
const { truncate } = require('../Utils/adminUtils');

// File path for ticket counter
const TICKET_FILE = path.join(__dirname, '../Data/ticketCounter.txt');

// In-memory stores
let ticketCounter = 0;
const activeTickets = new Map();
const pendingTickets = new Map();

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the ticket system
 */
function initializeTicketSystem() {
    // Ensure data directory exists
    const dataDir = path.dirname(TICKET_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load or create counter
    if (fs.existsSync(TICKET_FILE)) {
        ticketCounter = parseInt(fs.readFileSync(TICKET_FILE, 'utf8'), 10) || 0;
    } else {
        fs.writeFileSync(TICKET_FILE, '0', 'utf8');
    }
    
    console.log(`🎟️ Ticket system initialized. Counter: ${ticketCounter}`);
}

/**
 * Increment and save the ticket counter
 * @returns {number} - New ticket number
 */
function incrementTicketCounter() {
    ticketCounter++;
    fs.writeFileSync(TICKET_FILE, ticketCounter.toString(), 'utf8');
    return ticketCounter;
}

/**
 * Get current ticket counter
 * @returns {number}
 */
function getTicketCounter() {
    return ticketCounter;
}

// ═══════════════════════════════════════════════════════════════
// TICKET TYPE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get ticket type configuration
 * @param {string} type - Ticket type key
 * @returns {Object} - Ticket type configuration
 */
function getTicketType(type) {
    return TICKET_TYPES[type] || TICKET_TYPES.other;
}

/**
 * Get emoji for ticket type
 * @param {string} type - Ticket type key
 * @returns {string} - Emoji
 */
function getTypeEmoji(type) {
    return getTicketType(type).emoji;
}

/**
 * Get display name for ticket type
 * @param {string} type - Ticket type key
 * @returns {string} - Display name
 */
function getTypeName(type) {
    return getTicketType(type).name;
}

/**
 * Get embed color for ticket type
 * @param {string} type - Ticket type key
 * @returns {number} - Color value
 */
function getTypeColor(type) {
    return getTicketType(type).color;
}

/**
 * Check if ticket type requires command field
 * @param {string} type - Ticket type key
 * @returns {boolean}
 */
function requiresCommand(type) {
    return getTicketType(type).requiresCommand;
}

/**
 * Get all ticket type options for select menu
 * @returns {Array} - Array of options for StringSelectMenuBuilder
 */
function getTicketTypeOptions() {
    return Object.values(TICKET_TYPES).map(type => ({
        label: type.label,
        value: type.value,
        description: type.description
    }));
}

// ═══════════════════════════════════════════════════════════════
// TICKET MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new ticket record
 * @param {Object} params - Ticket parameters
 * @returns {Object} - Ticket record
 */
function createTicket(params) {
    const { userId, ticketType, command, description, steps, expected, additional } = params;
    
    const ticketNumber = incrementTicketCounter();
    
    const ticket = {
        id: ticketNumber,
        userId,
        ticketType,
        command: command || 'N/A',
        description,
        steps: steps || 'N/A',
        expected: expected || 'N/A',
        additional: additional || 'N/A',
        createdAt: Date.now(),
        responded: false,
        closedAt: null
    };
    
    return ticket;
}

/**
 * Store active ticket
 * @param {string} messageId - Message ID of the ticket embed
 * @param {Object} ticketData - Ticket data
 */
function storeActiveTicket(messageId, ticketData) {
    activeTickets.set(messageId, ticketData);
}

/**
 * Get active ticket by message ID
 * @param {string} messageId - Message ID
 * @returns {Object|undefined} - Ticket data
 */
function getActiveTicket(messageId) {
    return activeTickets.get(messageId);
}

/**
 * Mark ticket as responded
 * @param {string} messageId - Message ID
 * @returns {boolean} - Success
 */
function markTicketResponded(messageId) {
    const ticket = activeTickets.get(messageId);
    if (ticket) {
        ticket.responded = true;
        activeTickets.set(messageId, ticket);
        return true;
    }
    return false;
}

/**
 * Store pending ticket (awaiting type selection)
 * @param {string} userId - User ID
 * @param {Object} data - Pending ticket data
 */
function storePendingTicket(userId, data) {
    pendingTickets.set(userId, data);
}

/**
 * Get pending ticket
 * @param {string} userId - User ID
 * @returns {Object|undefined} - Pending ticket data
 */
function getPendingTicket(userId) {
    return pendingTickets.get(userId);
}

/**
 * Remove pending ticket
 * @param {string} userId - User ID
 */
function removePendingTicket(userId) {
    pendingTickets.delete(userId);
}

// ═══════════════════════════════════════════════════════════════
// TICKET FIELD FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Format ticket fields for embed
 * @param {Object} ticket - Ticket data
 * @returns {Array} - Array of embed fields
 */
function formatTicketFields(ticket) {
    const fields = [
        { 
            name: '🙋 Reported by', 
            value: `<@${ticket.userId}> (\`${ticket.userId}\`)`, 
            inline: false 
        }
    ];
    
    if (ticket.command !== 'N/A') {
        fields.push({ 
            name: '⚙️ Command/Feature', 
            value: ticket.command, 
            inline: true 
        });
    }
    
    fields.push({
        name: '📝 Description',
        value: truncate(ticket.description, 1024),
        inline: false
    });
    
    if (ticket.steps !== 'N/A') {
        fields.push({
            name: '🔄 Steps to Reproduce',
            value: truncate(ticket.steps, 1024),
            inline: false
        });
    }
    
    if (ticket.expected !== 'N/A') {
        fields.push({
            name: '⚖️ Expected vs Actual',
            value: truncate(ticket.expected, 1024),
            inline: false
        });
    }
    
    if (ticket.additional !== 'N/A') {
        fields.push({
            name: 'ℹ️ Additional Info',
            value: truncate(ticket.additional, 1024),
            inline: false
        });
    }
    
    return fields;
}

/**
 * Get modal fields based on ticket type
 * @param {string} ticketType - Ticket type key
 * @returns {Array} - Array of field configurations
 */
function getModalFieldsForType(ticketType) {
    const baseFields = {
        command: {
            customId: 'command',
            label: 'Command/Feature Affected',
            style: 'Short',
            placeholder: 'e.g., .roll, .farm, .trade',
            required: requiresCommand(ticketType)
        },
        description: {
            customId: 'description',
            label: 'Detailed Description',
            style: 'Paragraph',
            placeholder: 'Describe your issue, suggestion, or appeal in detail...',
            required: true,
            maxLength: 1000
        },
        steps: {
            customId: 'steps',
            label: 'Steps to Reproduce (if applicable)',
            style: 'Paragraph',
            placeholder: '1. Use command...\n2. Click button...\n3. Error occurs...',
            required: false,
            maxLength: 500
        },
        expected: {
            customId: 'expected',
            label: 'Expected vs Actual Behavior',
            style: 'Paragraph',
            placeholder: 'Expected: Should work normally\nActual: Gets error message',
            required: false,
            maxLength: 500
        },
        additional: {
            customId: 'additional',
            label: 'Additional Information',
            style: 'Paragraph',
            placeholder: 'Screenshots URL, Discord user IDs involved, timestamps, etc.',
            required: false,
            maxLength: 500
        }
    };
    
    // Return fields based on ticket type
    if (ticketType === 'bug' || ticketType === 'exploit') {
        return ['command', 'description', 'steps', 'expected', 'additional'].map(f => baseFields[f]);
    } else if (ticketType === 'ban_appeal') {
        return ['description', 'steps', 'additional'].map(f => baseFields[f]);
    } else {
        return ['description', 'additional'].map(f => baseFields[f]);
    }
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    // Initialization
    initializeTicketSystem,
    
    // Counter operations
    incrementTicketCounter,
    getTicketCounter,
    
    // Type helpers
    getTicketType,
    getTypeEmoji,
    getTypeName,
    getTypeColor,
    requiresCommand,
    getTicketTypeOptions,
    
    // Ticket management
    createTicket,
    storeActiveTicket,
    getActiveTicket,
    markTicketResponded,
    storePendingTicket,
    getPendingTicket,
    removePendingTicket,
    
    // Formatting
    formatTicketFields,
    getModalFieldsForType,
    
    // Constants
    SUPPORT_GUILD_ID,
    REPORT_CHANNEL_ID,
    TICKET_EXPIRY_MS,
    TICKET_TYPES
};
