/**
 * Ticket Service
 * Handles ticket management
 */

const { getTicketCounter, incrementTicketCounter, TICKET_TYPES } = require('../Commands/ticket');

module.exports = {
    getTicketCounter,
    incrementTicketCounter,
    TICKET_TYPES
};
