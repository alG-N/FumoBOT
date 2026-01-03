/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services are down
 */

const { debugLog } = require('../Core/logger');

// Circuit states
const CIRCUIT_STATES = {
    CLOSED: 'CLOSED',     // Normal operation, requests pass through
    OPEN: 'OPEN',         // Failures exceeded threshold, block requests
    HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

// Store circuit breakers for different services
const circuits = new Map();

// Default configuration
const DEFAULT_CONFIG = {
    failureThreshold: 5,      // Number of failures before opening circuit
    successThreshold: 2,      // Number of successes to close circuit from half-open
    timeout: 30000,           // Time (ms) before attempting recovery (half-open)
    resetTimeout: 60000,      // Time (ms) to fully reset failure count after success
    monitorInterval: 10000    // Interval to check for stale circuits
};

/**
 * Create or get a circuit breaker for a service
 * @param {string} serviceName - Unique name for the service
 * @param {object} config - Circuit breaker configuration
 */
function getCircuit(serviceName, config = {}) {
    if (!circuits.has(serviceName)) {
        circuits.set(serviceName, {
            name: serviceName,
            state: CIRCUIT_STATES.CLOSED,
            failures: 0,
            successes: 0,
            lastFailure: null,
            lastSuccess: null,
            lastStateChange: Date.now(),
            config: { ...DEFAULT_CONFIG, ...config }
        });
    }
    return circuits.get(serviceName);
}

/**
 * Check if a request should be allowed through
 * @param {string} serviceName - Service to check
 * @returns {boolean} True if request should be allowed
 */
function canRequest(serviceName) {
    const circuit = getCircuit(serviceName);
    const now = Date.now();
    
    switch (circuit.state) {
        case CIRCUIT_STATES.CLOSED:
            return true;
            
        case CIRCUIT_STATES.OPEN:
            // Check if timeout has passed to move to half-open
            if (now - circuit.lastStateChange >= circuit.config.timeout) {
                circuit.state = CIRCUIT_STATES.HALF_OPEN;
                circuit.lastStateChange = now;
                debugLog('CIRCUIT_BREAKER', `${serviceName}: OPEN -> HALF_OPEN (attempting recovery)`);
                return true;
            }
            return false;
            
        case CIRCUIT_STATES.HALF_OPEN:
            // Only allow one request at a time in half-open
            return true;
            
        default:
            return true;
    }
}

/**
 * Record a successful request
 * @param {string} serviceName - Service name
 */
function recordSuccess(serviceName) {
    const circuit = getCircuit(serviceName);
    const now = Date.now();
    
    circuit.lastSuccess = now;
    
    switch (circuit.state) {
        case CIRCUIT_STATES.HALF_OPEN:
            circuit.successes++;
            if (circuit.successes >= circuit.config.successThreshold) {
                circuit.state = CIRCUIT_STATES.CLOSED;
                circuit.failures = 0;
                circuit.successes = 0;
                circuit.lastStateChange = now;
                debugLog('CIRCUIT_BREAKER', `${serviceName}: HALF_OPEN -> CLOSED (service recovered)`);
            }
            break;
            
        case CIRCUIT_STATES.CLOSED:
            // Reset failure count after period of success
            if (circuit.failures > 0 && now - circuit.lastFailure >= circuit.config.resetTimeout) {
                circuit.failures = 0;
            }
            break;
    }
}

/**
 * Record a failed request
 * @param {string} serviceName - Service name
 * @param {Error} error - The error that occurred
 */
function recordFailure(serviceName, error = null) {
    const circuit = getCircuit(serviceName);
    const now = Date.now();
    
    circuit.failures++;
    circuit.lastFailure = now;
    
    if (error) {
        debugLog('CIRCUIT_BREAKER', `${serviceName}: Failure recorded - ${error.message}`);
    }
    
    switch (circuit.state) {
        case CIRCUIT_STATES.HALF_OPEN:
            // Single failure in half-open opens the circuit again
            circuit.state = CIRCUIT_STATES.OPEN;
            circuit.successes = 0;
            circuit.lastStateChange = now;
            debugLog('CIRCUIT_BREAKER', `${serviceName}: HALF_OPEN -> OPEN (recovery failed)`);
            break;
            
        case CIRCUIT_STATES.CLOSED:
            if (circuit.failures >= circuit.config.failureThreshold) {
                circuit.state = CIRCUIT_STATES.OPEN;
                circuit.lastStateChange = now;
                debugLog('CIRCUIT_BREAKER', `${serviceName}: CLOSED -> OPEN (failure threshold reached: ${circuit.failures})`);
            }
            break;
    }
}

/**
 * Execute a function with circuit breaker protection
 * @param {string} serviceName - Service name
 * @param {Function} fn - Async function to execute
 * @param {object} options - Options including fallback
 * @returns {Promise<any>} Result of fn or fallback
 */
async function withCircuitBreaker(serviceName, fn, options = {}) {
    const { fallback = null, timeout = 10000 } = options;
    
    if (!canRequest(serviceName)) {
        const circuit = getCircuit(serviceName);
        const retryIn = Math.ceil((circuit.config.timeout - (Date.now() - circuit.lastStateChange)) / 1000);
        
        debugLog('CIRCUIT_BREAKER', `${serviceName}: Request blocked (circuit OPEN, retry in ${retryIn}s)`);
        
        if (fallback !== null) {
            return typeof fallback === 'function' ? fallback() : fallback;
        }
        
        throw new Error(`Service ${serviceName} is temporarily unavailable. Retry in ${retryIn}s.`);
    }
    
    try {
        // Add timeout wrapper
        const result = await Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`${serviceName} request timed out after ${timeout}ms`)), timeout)
            )
        ]);
        
        recordSuccess(serviceName);
        return result;
    } catch (error) {
        recordFailure(serviceName, error);
        
        if (fallback !== null) {
            return typeof fallback === 'function' ? fallback(error) : fallback;
        }
        
        throw error;
    }
}

/**
 * Get status of all circuit breakers
 * @returns {object} Status object
 */
function getCircuitStatus() {
    const status = {};
    
    for (const [name, circuit] of circuits) {
        const now = Date.now();
        status[name] = {
            state: circuit.state,
            failures: circuit.failures,
            lastFailure: circuit.lastFailure ? new Date(circuit.lastFailure).toISOString() : null,
            lastSuccess: circuit.lastSuccess ? new Date(circuit.lastSuccess).toISOString() : null,
            uptime: circuit.lastSuccess ? now - circuit.lastSuccess : null
        };
    }
    
    return status;
}

/**
 * Reset a specific circuit breaker
 * @param {string} serviceName - Service to reset
 */
function resetCircuit(serviceName) {
    if (circuits.has(serviceName)) {
        const circuit = circuits.get(serviceName);
        circuit.state = CIRCUIT_STATES.CLOSED;
        circuit.failures = 0;
        circuit.successes = 0;
        circuit.lastStateChange = Date.now();
        debugLog('CIRCUIT_BREAKER', `${serviceName}: Manually reset to CLOSED`);
    }
}

/**
 * Reset all circuit breakers
 */
function resetAllCircuits() {
    for (const serviceName of circuits.keys()) {
        resetCircuit(serviceName);
    }
    debugLog('CIRCUIT_BREAKER', 'All circuits reset');
}

// Cleanup stale circuits periodically
setInterval(() => {
    const now = Date.now();
    const staleThreshold = 3600000; // 1 hour
    
    for (const [name, circuit] of circuits) {
        // If no activity for an hour and circuit is closed, remove it
        const lastActivity = Math.max(circuit.lastSuccess || 0, circuit.lastFailure || 0);
        if (circuit.state === CIRCUIT_STATES.CLOSED && 
            lastActivity > 0 && 
            now - lastActivity > staleThreshold) {
            circuits.delete(name);
            debugLog('CIRCUIT_BREAKER', `${name}: Removed stale circuit`);
        }
    }
}, 300000); // Every 5 minutes

module.exports = {
    CIRCUIT_STATES,
    getCircuit,
    canRequest,
    recordSuccess,
    recordFailure,
    withCircuitBreaker,
    getCircuitStatus,
    resetCircuit,
    resetAllCircuits
};
