/**
 * System Diagnostics Utility
 * Provides real-time monitoring of bot health, errors, and performance
 * Integrates with ConnectionMonitor for comprehensive health tracking
 */

const { getCircuitStatus } = require('./circuitBreaker');
const { getSessionStats } = require('./sessionManager');
const { getErrorStats } = require('./errorHandler');
const { getCacheStats } = require('../Core/database');
const os = require('os');

// Connection monitor reference (set via setConnectionMonitor)
let connectionMonitor = null;

/**
 * Set the connection monitor instance for integration
 * @param {ConnectionMonitor} monitor - The connection monitor instance
 */
function setConnectionMonitor(monitor) {
    connectionMonitor = monitor;
}

/**
 * Get connection status from ConnectionMonitor if available
 * @returns {object} Connection status
 */
function getConnectionStatus() {
    if (!connectionMonitor) {
        return {
            discord: { status: 'unknown', latency: null },
            database: { status: 'unknown', responseTime: null },
            totalDisconnects: 0,
            reconnectAttempts: 0,
            integrated: false
        };
    }
    
    const status = connectionMonitor.getStatus();
    return {
        discord: status.discord,
        database: status.database,
        totalDisconnects: status.totalDisconnects,
        reconnectAttempts: status.reconnectAttempts,
        lastDisconnect: status.lastDisconnect,
        integrated: true,
        isHealthy: connectionMonitor.isHealthy()
    };
}

/**
 * Get comprehensive system diagnostics
 * @returns {object} System health information
 */
function getSystemDiagnostics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
        },
        memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            percentUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        system: {
            platform: process.platform,
            nodeVersion: process.version,
            cpuUsage: process.cpuUsage(),
            freeMem: Math.round(os.freemem() / 1024 / 1024),
            totalMem: Math.round(os.totalmem() / 1024 / 1024)
        },
        connection: getConnectionStatus(),
        circuits: getCircuitStatus(),
        sessions: getSessionStats(),
        errors: getErrorStats(),
        cache: getCacheStats()
    };
}

/**
 * Format uptime to human readable string
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    
    return parts.join(' ');
}

/**
 * Check if system is healthy
 * @returns {object} Health check result
 */
function healthCheck() {
    const diagnostics = getSystemDiagnostics();
    const issues = [];
    
    // Check connection status (from ConnectionMonitor integration)
    if (diagnostics.connection.integrated) {
        if (diagnostics.connection.discord.status !== 'connected') {
            issues.push({ severity: 'critical', message: `Discord disconnected: ${diagnostics.connection.discord.status}` });
        } else if (diagnostics.connection.discord.latency > 500) {
            issues.push({ severity: 'warning', message: `High Discord latency: ${diagnostics.connection.discord.latency}ms` });
        }
        
        if (diagnostics.connection.database.status !== 'connected') {
            issues.push({ severity: 'critical', message: `Database disconnected: ${diagnostics.connection.database.status}` });
        } else if (diagnostics.connection.database.responseTime > 100) {
            issues.push({ severity: 'warning', message: `Slow database: ${diagnostics.connection.database.responseTime}ms` });
        }
        
        if (diagnostics.connection.totalDisconnects > 5) {
            issues.push({ severity: 'warning', message: `Frequent disconnects: ${diagnostics.connection.totalDisconnects} total` });
        }
    }
    
    // Check memory
    if (diagnostics.memory.percentUsed > 90) {
        issues.push({ severity: 'critical', message: `High memory usage: ${diagnostics.memory.percentUsed}%` });
    } else if (diagnostics.memory.percentUsed > 75) {
        issues.push({ severity: 'warning', message: `Elevated memory usage: ${diagnostics.memory.percentUsed}%` });
    }
    
    // Check circuits
    const openCircuits = Object.entries(diagnostics.circuits)
        .filter(([_, status]) => status.state === 'OPEN');
    if (openCircuits.length > 0) {
        issues.push({ 
            severity: 'warning', 
            message: `${openCircuits.length} circuit(s) open: ${openCircuits.map(([name]) => name).join(', ')}` 
        });
    }
    
    // Check error rates
    if (diagnostics.errors.total > 50) {
        issues.push({ severity: 'critical', message: `High error rate: ${diagnostics.errors.total} errors/min` });
    } else if (diagnostics.errors.total > 20) {
        issues.push({ severity: 'warning', message: `Elevated error rate: ${diagnostics.errors.total} errors/min` });
    }
    
    // Check sessions
    if (diagnostics.sessions.total > 1000) {
        issues.push({ severity: 'warning', message: `Many active sessions: ${diagnostics.sessions.total}` });
    }
    
    const status = issues.length === 0 ? 'healthy' :
                   issues.some(i => i.severity === 'critical') ? 'critical' : 'degraded';
    
    return {
        status,
        issues,
        diagnostics
    };
}

/**
 * Format diagnostics for Discord embed
 * @returns {object} Discord embed-compatible object
 */
function formatDiagnosticsEmbed() {
    const health = healthCheck();
    const d = health.diagnostics;
    
    const statusColors = {
        healthy: 0x00FF00,
        degraded: 0xFFFF00,
        critical: 0xFF0000
    };
    
    const fields = [
        {
            name: '⏱️ Uptime',
            value: d.uptime.formatted,
            inline: true
        },
        {
            name: '💾 Memory',
            value: `${d.memory.heapUsed}/${d.memory.heapTotal}MB (${d.memory.percentUsed}%)`,
            inline: true
        },
        {
            name: '🔌 Node',
            value: d.system.nodeVersion,
            inline: true
        }
    ];
    
    // Add connection status if integrated
    if (d.connection.integrated) {
        const discordIcon = d.connection.discord.status === 'connected' ? '✅' : '❌';
        const dbIcon = d.connection.database.status === 'connected' ? '✅' : '❌';
        fields.push({
            name: '🌐 Discord',
            value: `${discordIcon} ${d.connection.discord.status}\n${d.connection.discord.latency ? `📡 ${d.connection.discord.latency}ms` : ''}`,
            inline: true
        });
        fields.push({
            name: '🗄️ Database',
            value: `${dbIcon} ${d.connection.database.status}\n${d.connection.database.responseTime ? `⚡ ${d.connection.database.responseTime}ms` : ''}`,
            inline: true
        });
        if (d.connection.totalDisconnects > 0) {
            fields.push({
                name: '🔄 Reconnects',
                value: `${d.connection.totalDisconnects} disconnects\n${d.connection.reconnectAttempts} attempts`,
                inline: true
            });
        }
    }
    
    fields.push(
        {
            name: '📊 Sessions',
            value: `${d.sessions.total} active`,
            inline: true
        },
        {
            name: '❌ Errors (1min)',
            value: `${d.errors.total}`,
            inline: true
        },
        {
            name: '🔄 Cache Entries',
            value: `${d.cache.total} (${d.cache.valid} valid)`,
            inline: true
        }
    );
    
    // Add circuit status if any issues
    const circuitEntries = Object.entries(d.circuits);
    if (circuitEntries.length > 0) {
        const circuitStatus = circuitEntries
            .map(([name, status]) => `${status.state === 'CLOSED' ? '✅' : '⚠️'} ${name}: ${status.state}`)
            .join('\n');
        fields.push({
            name: '⚡ Circuit Breakers',
            value: circuitStatus || 'None active',
            inline: false
        });
    }
    
    // Add issues if any
    if (health.issues.length > 0) {
        const issueText = health.issues
            .map(i => `${i.severity === 'critical' ? '🔴' : '🟡'} ${i.message}`)
            .join('\n');
        fields.push({
            name: '⚠️ Issues',
            value: issueText,
            inline: false
        });
    }
    
    return {
        title: `${health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '🔴'} System Health: ${health.status.toUpperCase()}`,
        color: statusColors[health.status],
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'FumoBOT Diagnostics' }
    };
}

module.exports = {
    getSystemDiagnostics,
    healthCheck,
    formatDiagnosticsEmbed,
    formatUptime,
    setConnectionMonitor,
    getConnectionStatus
};
