/**
 * Base API Service Class
 */

const { HttpClient, USER_AGENTS } = require('../utils/httpClient');

class BaseApiService {
    constructor(serviceName, config = {}) {
        this.serviceName = serviceName;
        this.baseUrl = config.baseUrl || '';
        this.client = new HttpClient({
            timeout: config.timeout || 15000,
            userAgent: config.userAgent || USER_AGENTS.default
        });
        this.cache = new Map();
    }

    async get(endpoint, options = {}) {
        return this.client.get(`${this.baseUrl}${endpoint}`, options);
    }

    async post(endpoint, data, options = {}) {
        return this.client.post(`${this.baseUrl}${endpoint}`, data, options);
    }

    log(message, level = 'info') {
        const prefix = `[${this.serviceName}]`;
        if (level === 'error') console.error(prefix, message);
        else console.log(prefix, message);
    }

    cacheGet(key) {
        const entry = this.cache.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    cacheSet(key, value, ttlMs = 300000) {
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
}

module.exports = { BaseApiService };
