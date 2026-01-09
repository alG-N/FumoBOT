/**
 * Shared HTTP Client
 * Centralized axios wrapper with retry, timeout, and error handling
 */

const axios = require('axios');

const DEFAULT_CONFIG = {
    timeout: 15000,
    retries: 2,
    retryDelay: 1000,
    userAgent: 'FumoBOT/2.0 (Discord Bot)'
};

const USER_AGENTS = {
    default: 'FumoBOT/2.0 (Discord Bot)',
    browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    pixiv: 'PixivAndroidApp/5.0.234 (Android 11; Pixel 5)',
    reddit: 'DiscordBot/1.0'
};

class HttpClient {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.client = axios.create({
            timeout: this.config.timeout,
            headers: { 'User-Agent': this.config.userAgent }
        });
    }

    async get(url, options = {}) {
        return this._request('get', url, null, options);
    }

    async post(url, data, options = {}) {
        return this._request('post', url, data, options);
    }

    async _request(method, url, data = null, options = {}) {
        const maxRetries = options.retries ?? this.config.retries;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const config = {
                    method,
                    url,
                    timeout: options.timeout ?? this.config.timeout,
                    headers: {
                        'User-Agent': options.userAgent ?? this.config.userAgent,
                        ...options.headers
                    },
                    params: options.params
                };

                if (data) config.data = data;

                const response = await this.client.request(config);
                return { success: true, data: response.data, status: response.status };

            } catch (error) {
                lastError = error;
                if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
                    break;
                }
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, this.config.retryDelay * (attempt + 1)));
                }
            }
        }

        return this._handleError(lastError);
    }

    _handleError(error) {
        const status = error.response?.status;
        let errorMessage = 'Request failed. Please try again.';
        let errorCode = 'UNKNOWN_ERROR';

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            errorMessage = 'Request timed out.';
            errorCode = 'TIMEOUT';
        } else if (status === 404) {
            errorMessage = 'Not found.';
            errorCode = 'NOT_FOUND';
        } else if (status === 403) {
            errorMessage = 'Access denied.';
            errorCode = 'FORBIDDEN';
        } else if (status === 429) {
            errorMessage = 'Rate limited. Please wait.';
            errorCode = 'RATE_LIMITED';
        }

        return { success: false, error: errorMessage, errorCode, status };
    }
}

const clients = {
    default: new HttpClient(),
    browser: new HttpClient({ userAgent: USER_AGENTS.browser }),
    reddit: new HttpClient({ userAgent: USER_AGENTS.reddit }),
    pixiv: new HttpClient({ userAgent: USER_AGENTS.pixiv, timeout: 30000 })
};

module.exports = { HttpClient, clients, USER_AGENTS };
