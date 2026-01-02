const { EmbedBuilder } = require('discord.js');

class ConnectionMonitor {
    constructor(client) {
        this.client = client;
        this.healthStatus = {
            discord: { status: 'unknown', lastCheck: null, latency: null },
            database: { status: 'unknown', lastCheck: null, responseTime: null },
            lastDisconnect: null,
            reconnectAttempts: 0,
            totalDisconnects: 0
        };
        this.checkInterval = null;
        this.LOG_CHANNEL_ID = '1411386632589807719';
    }

    /**
     * Start monitoring connection health
     */
    start(intervalMs = 30000) {
        console.log('🔍 Starting connection health monitor...');
        
        this.setupDiscordListeners();
        this.checkInterval = setInterval(() => this.performHealthCheck(), intervalMs);
        
        // Initial check
        this.performHealthCheck();
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Setup Discord event listeners for connection issues
     */
    setupDiscordListeners() {
        this.client.on('disconnect', (event) => {
            this.healthStatus.discord.status = 'disconnected';
            this.healthStatus.lastDisconnect = Date.now();
            this.healthStatus.totalDisconnects++;
            console.warn(`⚠️ Discord disconnected: ${event?.reason || 'Unknown reason'}`);
            this.logConnectionEvent('disconnect', event?.reason);
        });

        this.client.on('reconnecting', () => {
            this.healthStatus.discord.status = 'reconnecting';
            this.healthStatus.reconnectAttempts++;
            console.log('🔄 Attempting to reconnect to Discord...');
        });

        this.client.on('ready', () => {
            this.healthStatus.discord.status = 'connected';
            this.healthStatus.reconnectAttempts = 0;
            console.log('✅ Discord connection restored');
        });

        this.client.on('error', (error) => {
            console.error('❌ Discord client error:', error.message);
            this.logConnectionEvent('error', error.message);
        });

        this.client.on('warn', (warning) => {
            console.warn('⚠️ Discord warning:', warning);
        });

        // Rate limit handling
        this.client.rest.on('rateLimited', (info) => {
            console.warn(`⏳ Rate limited: ${info.route} - Retry after ${info.retryAfter}ms`);
            this.logConnectionEvent('rateLimit', `Route: ${info.route}, Retry: ${info.retryAfter}ms`);
        });
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const now = Date.now();

        // Check Discord connection
        this.healthStatus.discord = {
            status: this.client.ws.status === 0 ? 'connected' : 'degraded',
            lastCheck: now,
            latency: this.client.ws.ping
        };

        // Check database connection
        try {
            const dbStart = Date.now();
            const { get } = require('../../../Core/database');
            await get('SELECT 1');
            this.healthStatus.database = {
                status: 'connected',
                lastCheck: now,
                responseTime: Date.now() - dbStart
            };
        } catch (error) {
            this.healthStatus.database = {
                status: 'error',
                lastCheck: now,
                error: error.message
            };
            console.error('❌ Database health check failed:', error.message);
        }

        // Log warning if latency is high
        if (this.healthStatus.discord.latency > 500) {
            console.warn(`⚠️ High Discord latency: ${this.healthStatus.discord.latency}ms`);
        }

        if (this.healthStatus.database.responseTime > 1000) {
            console.warn(`⚠️ Slow database response: ${this.healthStatus.database.responseTime}ms`);
        }
    }

    /**
     * Log connection events to Discord
     */
    async logConnectionEvent(type, details) {
        try {
            const channel = await this.client.channels.fetch(this.LOG_CHANNEL_ID);
            if (!channel) return;

            const colors = {
                disconnect: '#FF0000',
                reconnect: '#00FF00',
                error: '#FF6600',
                rateLimit: '#FFFF00'
            };

            const embed = new EmbedBuilder()
                .setTitle(`🔌 Connection Event: ${type.toUpperCase()}`)
                .setColor(colors[type] || '#808080')
                .setDescription(details || 'No details available')
                .addFields(
                    { name: 'Latency', value: `${this.client.ws.ping}ms`, inline: true },
                    { name: 'Total Disconnects', value: `${this.healthStatus.totalDisconnects}`, inline: true },
                    { name: 'Reconnect Attempts', value: `${this.healthStatus.reconnectAttempts}`, inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Failed to log connection event:', err.message);
        }
    }

    /**
     * Get current health status
     */
    getStatus() {
        return {
            ...this.healthStatus,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Check if bot is healthy enough to process commands
     */
    isHealthy() {
        return this.healthStatus.discord.status === 'connected' &&
               this.healthStatus.database.status === 'connected' &&
               this.healthStatus.discord.latency < 1000;
    }
}

module.exports = ConnectionMonitor;