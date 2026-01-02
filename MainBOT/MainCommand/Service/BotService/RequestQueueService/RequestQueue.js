const { EventEmitter } = require('events');

class RequestQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        this.queue = [];
        this.processing = false;
        this.maxConcurrent = options.maxConcurrent || 5;
        this.currentConcurrent = 0;
        this.rateLimitDelay = options.rateLimitDelay || 50; // ms between requests
        this.maxQueueSize = options.maxQueueSize || 100;
        this.stats = {
            processed: 0,
            failed: 0,
            dropped: 0
        };
    }

    /**
     * Add a request to the queue
     * @param {Function} requestFn - Async function to execute
     * @param {Object} options - Priority and timeout options
     * @returns {Promise} - Resolves when request completes
     */
    async enqueue(requestFn, options = {}) {
        return new Promise((resolve, reject) => {
            // Check queue size
            if (this.queue.length >= this.maxQueueSize) {
                this.stats.dropped++;
                reject(new Error('Queue full - request dropped'));
                return;
            }

            const request = {
                fn: requestFn,
                priority: options.priority || 0,
                timeout: options.timeout || 30000,
                resolve,
                reject,
                addedAt: Date.now()
            };

            // Insert based on priority
            const insertIndex = this.queue.findIndex(r => r.priority < request.priority);
            if (insertIndex === -1) {
                this.queue.push(request);
            } else {
                this.queue.splice(insertIndex, 0, request);
            }

            this.processQueue();
        });
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.currentConcurrent >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        const request = this.queue.shift();
        this.currentConcurrent++;

        try {
            // Check if request has timed out while waiting
            const waitTime = Date.now() - request.addedAt;
            if (waitTime > request.timeout) {
                throw new Error('Request timed out in queue');
            }

            // Execute with timeout
            const result = await Promise.race([
                request.fn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request execution timeout')), request.timeout - waitTime)
                )
            ]);

            this.stats.processed++;
            request.resolve(result);
        } catch (error) {
            this.stats.failed++;
            request.reject(error);
        } finally {
            this.currentConcurrent--;
            
            // Small delay to prevent rate limiting
            await new Promise(r => setTimeout(r, this.rateLimitDelay));
            
            // Continue processing
            this.processQueue();
        }
    }

    /**
     * Get queue statistics
     */
    getStats() {
        return {
            ...this.stats,
            queueLength: this.queue.length,
            currentConcurrent: this.currentConcurrent
        };
    }

    /**
     * Clear the queue
     */
    clear() {
        const dropped = this.queue.length;
        this.queue.forEach(r => r.reject(new Error('Queue cleared')));
        this.queue = [];
        this.stats.dropped += dropped;
        return dropped;
    }
}

// Global instance for database operations
const dbQueue = new RequestQueue({
    maxConcurrent: 3,
    rateLimitDelay: 10,
    maxQueueSize: 200
});

// Global instance for Discord API operations
const discordQueue = new RequestQueue({
    maxConcurrent: 5,
    rateLimitDelay: 50,
    maxQueueSize: 100
});

module.exports = {
    RequestQueue,
    dbQueue,
    discordQueue
};