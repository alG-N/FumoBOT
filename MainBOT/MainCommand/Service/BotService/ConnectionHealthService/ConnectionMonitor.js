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
        this.isReady = false;
        
        // Warning cooldown tracking (prevent spam)
        this.lastWarnings = {
            highLatency: 0,
            slowDatabase: 0
        };
        this.WARNING_COOLDOWN = 5 * 60 * 1000; // 5 minutes between same warnings

        // Health metrics for advanced monitoring
        this.healthMetrics = {
            responseTimes: [], // Track response times for latency analysis
            errors: [],        // Track errors for error rate calculation
            uptime: 0,         // Total uptime
            lastUptime: null,  // Last recorded uptime timestamp
            averageResponseTime: 0, // Average response time
            errorRate: 0       // Error rate percentage
        };
    }

    /**
     * Start monitoring connection health
     */
    start(intervalMs = 30000) {
        console.log('🔍 Starting connection health monitor...');
        
        this.setupDiscordListeners();
        this.checkInterval = setInterval(() => this.performHealthCheck(), intervalMs);
        
        // Initial check after client is ready
        if (this.client.isReady()) {
            this.isReady = true;
            this.performHealthCheck();
        }
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
            this.isReady = true;
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
        if (!this.isReady || !this.client.isReady()) {
            console.log('⏳ Skipping health check - client not ready');
            return;
        }

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

        // Log warning if latency is high (with cooldown to prevent spam)
        if (this.healthStatus.discord.latency > 500) {
            if (now - this.lastWarnings.highLatency > this.WARNING_COOLDOWN) {
                console.warn(`⚠️ High Discord latency: ${this.healthStatus.discord.latency}ms`);
                this.lastWarnings.highLatency = now;
            }
        } else {
            // Reset cooldown when latency returns to normal
            this.lastWarnings.highLatency = 0;
        }

        if (this.healthStatus.database.responseTime > 1000) {
            if (now - this.lastWarnings.slowDatabase > this.WARNING_COOLDOWN) {
                console.warn(`⚠️ Slow database response: ${this.healthStatus.database.responseTime}ms`);
                this.lastWarnings.slowDatabase = now;
            }
        } else {
            // Reset cooldown when response time returns to normal
            this.lastWarnings.slowDatabase = 0;
        }

        this._updateHealthMetrics({
            healthy: this.healthStatus.discord.status === 'connected' && this.healthStatus.database.status === 'connected',
            responseTime: this.healthStatus.database.responseTime,
            status: this.healthStatus.database.status
        });
    }

    /**
     * Update health metrics for advanced monitoring
     */
    _updateHealthMetrics(result) {
        const now = Date.now();
        
        // อัปเดต response times
        this.healthMetrics.responseTimes.push({
            timestamp: now,
            duration: result.responseTime
        });
        
        // เก็บแค่ 100 รายการล่าสุด
        if (this.healthMetrics.responseTimes.length > 100) {
            this.healthMetrics.responseTimes.shift();
        }
        
        // อัปเดต error rate
        if (!result.healthy) {
            this.healthMetrics.errors.push({
                timestamp: now,
                type: result.status
            });
        }
        
        // ลบ errors ที่เก่ากว่า 1 ชั่วโมง
        const oneHourAgo = now - 3600000;
        this.healthMetrics.errors = this.healthMetrics.errors.filter(
            e => e.timestamp > oneHourAgo
        );
        
        // คำนวณ error rate
        const recentChecks = this.healthMetrics.responseTimes.filter(
            r => r.timestamp > oneHourAgo
        );
        
        if (recentChecks.length > 0) {
            const recentErrors = this.healthMetrics.errors.length;
            this.healthMetrics.errorRate = (recentErrors / recentChecks.length) * 100;
        }
        
        // อัปเดต uptime
        if (result.healthy) {
            if (!this.healthMetrics.lastUptime) {
                this.healthMetrics.lastUptime = now;
            }
            this.healthMetrics.uptime = now - this.healthMetrics.lastUptime;
        }
        
        // คำนวณ average response time
        if (this.healthMetrics.responseTimes.length > 0) {
            const sum = this.healthMetrics.responseTimes.reduce(
                (acc, r) => acc + r.duration, 0
            );
            this.healthMetrics.averageResponseTime = 
                sum / this.healthMetrics.responseTimes.length;
        }
    }

    /**
     * Log connection events to Discord
     */
    async logConnectionEvent(type, details) {
        // Make sure client is ready before trying to send
        if (!this.isReady || !this.client.isReady()) {
            console.log(`📝 [ConnectionMonitor] Queued log event (client not ready): ${type} - ${details}`);
            return;
        }

        try {
            const channel = await this.client.channels.fetch(this.LOG_CHANNEL_ID).catch(err => {
                console.error(`❌ Failed to fetch log channel ${this.LOG_CHANNEL_ID}:`, err.message);
                return null;
            });

            if (!channel) {
                console.error(`❌ Log channel ${this.LOG_CHANNEL_ID} not found or inaccessible`);
                return;
            }

            // Check if bot has permission to send messages
            if (channel.guild) {
                const permissions = channel.permissionsFor(this.client.user);
                if (!permissions || !permissions.has('SendMessages')) {
                    console.error(`❌ Bot lacks SendMessages permission in channel ${this.LOG_CHANNEL_ID}`);
                    return;
                }
            }

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
                    { name: 'Latency', value: `${this.client.ws.ping || 'N/A'}ms`, inline: true },
                    { name: 'Total Disconnects', value: `${this.healthStatus.totalDisconnects}`, inline: true },
                    { name: 'Reconnect Attempts', value: `${this.healthStatus.reconnectAttempts}`, inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`✅ Logged connection event to Discord: ${type}`);
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
            memoryUsage: process.memoryUsage(),
            healthMetrics: this.healthMetrics // Include health metrics in status
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

    /**
     * Manually send a test log to verify channel access
     */
    async testLog() {
        await this.logConnectionEvent('test', 'This is a test log message from ConnectionMonitor');
    }
}

module.exports = ConnectionMonitor;