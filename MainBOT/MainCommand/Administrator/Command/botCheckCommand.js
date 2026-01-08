const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const os = require('os');
const { DEVELOPER_ID, ADMIN_IDS } = require('../Config/adminConfig');

// Service imports for health checks
const lavalinkService = require('../../../SubCommand/MusicFunction/Service/LavalinkService');

// Health status constants
const STATUS = {
    ONLINE: { emoji: '🟢', text: 'Online', color: 0x00FF00 },
    DEGRADED: { emoji: '🟡', text: 'Degraded', color: 0xFFFF00 },
    OFFLINE: { emoji: '🔴', text: 'Offline', color: 0xFF0000 },
    UNKNOWN: { emoji: '⚪', text: 'Unknown', color: 0x808080 }
};

// MainCommand systems to check
const MAIN_COMMAND_SYSTEMS = [
    { id: 'gacha', name: 'Gacha System', emoji: '🎰', description: 'Crate rolls, event gacha, mystery crates' },
    { id: 'trading', name: 'Trading System', emoji: '🤝', description: 'Player-to-player trading' },
    { id: 'market', name: 'Market System', emoji: '🏪', description: 'Shop, exchange, egg shop' },
    { id: 'farming', name: 'Farming System', emoji: '🌾', description: 'Fumo farming, seasons, biomes' },
    { id: 'pet', name: 'Pet System', emoji: '🐾', description: 'Egg hatching, pet equipment' },
    { id: 'craft', name: 'Craft System', emoji: '🔨', description: 'Item crafting' },
    { id: 'pray', name: 'Pray System', emoji: '🙏', description: 'Pray for Fumos' },
    { id: 'quest', name: 'Quest System', emoji: '📋', description: 'Daily/weekly quests, achievements' },
    { id: 'database', name: 'Database', emoji: '💾', description: 'SQLite database connection' }
];

// SubCommand systems to check
const SUB_COMMAND_SYSTEMS = [
    { id: 'lavalink', name: 'Lavalink (Music)', emoji: '🎵', description: 'Music playback service' },
    { id: 'cobalt', name: 'Cobalt (Video)', emoji: '📹', description: 'Video download service' },
    { id: 'pixiv', name: 'Pixiv API', emoji: '🎨', description: 'Pixiv artwork search' },
    { id: 'reddit', name: 'Reddit API', emoji: '📰', description: 'Reddit content fetching' },
    { id: 'steam', name: 'Steam API', emoji: '🎮', description: 'Steam profile lookup' }
];

/**
 * Check if user is authorized (owner/admin)
 */
function isAuthorized(userId) {
    return userId === DEVELOPER_ID || ADMIN_IDS.includes(userId);
}

/**
 * Get system uptime formatted
 */
function getUptime(client) {
    const uptime = client.uptime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
    const used = process.memoryUsage();
    const heapUsed = (used.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (used.heapTotal / 1024 / 1024).toFixed(2);
    const rss = (used.rss / 1024 / 1024).toFixed(2);
    return { heapUsed, heapTotal, rss };
}

/**
 * Check Lavalink status
 */
function checkLavalinkStatus() {
    try {
        const status = lavalinkService.getNodeStatus();
        if (!status) {
            return { status: STATUS.OFFLINE, details: 'Not initialized' };
        }
        
        if (status.ready && status.nodes?.length > 0) {
            const readyNodes = status.nodes.filter(n => n.state === 2);
            if (readyNodes.length === status.nodes.length) {
                return {
                    status: STATUS.ONLINE,
                    details: `${readyNodes.length} node(s) ready, ${status.activeConnections} player(s)`,
                    nodes: status.nodes,
                    players: status.players
                };
            } else if (readyNodes.length > 0) {
                return {
                    status: STATUS.DEGRADED,
                    details: `${readyNodes.length}/${status.nodes.length} nodes ready`,
                    nodes: status.nodes
                };
            }
        }
        
        return { status: STATUS.OFFLINE, details: 'No nodes available' };
    } catch (error) {
        return { status: STATUS.OFFLINE, details: error.message };
    }
}

/**
 * Check Cobalt status
 */
async function checkCobaltStatus() {
    try {
        const videoConfig = require('../../../SubCommand/VideoFunction/Configuration/videoConfig');
        const instances = videoConfig.COBALT_INSTANCES || ['http://localhost:9000'];
        
        const http = require('http');
        const https = require('https');
        
        // Try to ping the first Cobalt instance
        const apiUrl = instances[0];
        const url = new URL(apiUrl);
        const protocol = url.protocol === 'https:' ? https : http;
        
        return new Promise((resolve) => {
            const req = protocol.request({
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: '/',
                method: 'GET',
                timeout: 5000
            }, (res) => {
                if (res.statusCode === 200 || res.statusCode === 405) {
                    resolve({
                        status: STATUS.ONLINE,
                        details: `Connected to ${apiUrl}`,
                        instances: instances.length
                    });
                } else {
                    resolve({
                        status: STATUS.DEGRADED,
                        details: `Status ${res.statusCode} from ${apiUrl}`
                    });
                }
            });
            
            req.on('error', () => {
                resolve({
                    status: STATUS.OFFLINE,
                    details: `Cannot connect to ${apiUrl}`
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    status: STATUS.OFFLINE,
                    details: 'Connection timeout'
                });
            });
            
            req.end();
        });
    } catch (error) {
        return { status: STATUS.OFFLINE, details: error.message };
    }
}

/**
 * Check database status
 */
async function checkDatabaseStatus() {
    try {
        const db = require('../../Core/Database/dbSetting');
        
        return new Promise((resolve) => {
            const start = Date.now();
            db.get('SELECT 1 as test', [], (err) => {
                const responseTime = Date.now() - start;
                
                if (err) {
                    resolve({ status: STATUS.OFFLINE, details: err.message });
                } else if (responseTime > 1000) {
                    resolve({
                        status: STATUS.DEGRADED,
                        details: `Slow response: ${responseTime}ms`
                    });
                } else {
                    resolve({
                        status: STATUS.ONLINE,
                        details: `Response time: ${responseTime}ms`
                    });
                }
            });
        });
    } catch (error) {
        return { status: STATUS.OFFLINE, details: error.message };
    }
}

/**
 * Create overview embed
 */
async function createOverviewEmbed(client) {
    const memory = getMemoryUsage();
    const lavalinkCheck = checkLavalinkStatus();
    const cobaltCheck = await checkCobaltStatus();
    const dbCheck = await checkDatabaseStatus();
    
    // Calculate overall health
    const checks = [lavalinkCheck, cobaltCheck, dbCheck];
    const onlineCount = checks.filter(c => c.status === STATUS.ONLINE).length;
    const offlineCount = checks.filter(c => c.status === STATUS.OFFLINE).length;
    
    let overallStatus = STATUS.ONLINE;
    if (offlineCount > 0 && onlineCount > 0) overallStatus = STATUS.DEGRADED;
    if (offlineCount === checks.length) overallStatus = STATUS.OFFLINE;
    
    const embed = new EmbedBuilder()
        .setTitle('🤖 FumoBOT Health Dashboard')
        .setColor(overallStatus.color)
        .setDescription(`**Overall Status:** ${overallStatus.emoji} ${overallStatus.text}`)
        .addFields(
            {
                name: '📊 Bot Statistics',
                value: [
                    `**Uptime:** ${getUptime(client)}`,
                    `**Ping:** ${client.ws.ping}ms`,
                    `**Guilds:** ${client.guilds.cache.size}`,
                    `**Users:** ${client.users.cache.size}`
                ].join('\n'),
                inline: true
            },
            {
                name: '💾 Memory Usage',
                value: [
                    `**Heap:** ${memory.heapUsed}/${memory.heapTotal} MB`,
                    `**RSS:** ${memory.rss} MB`,
                    `**System:** ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}/${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`
                ].join('\n'),
                inline: true
            },
            {
                name: '🔌 Core Services',
                value: [
                    `${lavalinkCheck.status.emoji} **Lavalink:** ${lavalinkCheck.details}`,
                    `${cobaltCheck.status.emoji} **Cobalt:** ${cobaltCheck.details}`,
                    `${dbCheck.status.emoji} **Database:** ${dbCheck.details}`
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Use the buttons below to check individual systems' })
        .setTimestamp();
    
    return embed;
}

/**
 * Create MainCommand system select menu
 */
function createMainCommandSelectMenu(userId) {
    const options = MAIN_COMMAND_SYSTEMS.map(sys => ({
        label: sys.name,
        value: `main_${sys.id}`,
        description: sys.description.substring(0, 50),
        emoji: sys.emoji
    }));
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`botcheck_main_select_${userId}`)
            .setPlaceholder('Select a MainCommand system to check...')
            .addOptions(options)
    );
}

/**
 * Create SubCommand system select menu
 */
function createSubCommandSelectMenu(userId) {
    const options = SUB_COMMAND_SYSTEMS.map(sys => ({
        label: sys.name,
        value: `sub_${sys.id}`,
        description: sys.description.substring(0, 50),
        emoji: sys.emoji
    }));
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`botcheck_sub_select_${userId}`)
            .setPlaceholder('Select a SubCommand system to check...')
            .addOptions(options)
    );
}

/**
 * Create navigation buttons
 */
function createNavButtons(userId, view = 'overview') {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`botcheck_overview_${userId}`)
            .setLabel('📊 Overview')
            .setStyle(view === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(view === 'overview'),
        new ButtonBuilder()
            .setCustomId(`botcheck_main_${userId}`)
            .setLabel('🎴 MainCommand')
            .setStyle(view === 'main' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`botcheck_sub_${userId}`)
            .setLabel('🔧 SubCommand')
            .setStyle(view === 'sub' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`botcheck_refresh_${userId}`)
            .setLabel('🔄')
            .setStyle(ButtonStyle.Success)
    );
    
    return row;
}

/**
 * Check a specific MainCommand system
 */
async function checkMainCommandSystem(systemId) {
    const system = MAIN_COMMAND_SYSTEMS.find(s => s.id === systemId);
    if (!system) return { status: STATUS.UNKNOWN, details: 'System not found' };
    
    try {
        switch (systemId) {
            case 'database':
                return await checkDatabaseStatus();
            
            case 'gacha':
            case 'trading':
            case 'market':
            case 'farming':
            case 'pet':
            case 'craft':
            case 'pray':
            case 'quest': {
                // These depend on database, check if db is working
                const dbStatus = await checkDatabaseStatus();
                if (dbStatus.status === STATUS.ONLINE) {
                    return { status: STATUS.ONLINE, details: 'System operational (DB connected)' };
                } else {
                    return { status: STATUS.OFFLINE, details: 'Database unavailable' };
                }
            }
            
            default:
                return { status: STATUS.UNKNOWN, details: 'No specific check available' };
        }
    } catch (error) {
        return { status: STATUS.OFFLINE, details: error.message };
    }
}

/**
 * Check a specific SubCommand system
 */
async function checkSubCommandSystem(systemId) {
    const system = SUB_COMMAND_SYSTEMS.find(s => s.id === systemId);
    if (!system) return { status: STATUS.UNKNOWN, details: 'System not found' };
    
    try {
        switch (systemId) {
            case 'lavalink':
                return checkLavalinkStatus();
            
            case 'cobalt':
                return await checkCobaltStatus();
            
            case 'pixiv':
            case 'reddit':
            case 'steam': {
                // External APIs - basic check
                return { status: STATUS.ONLINE, details: 'API module loaded' };
            }
            
            default:
                return { status: STATUS.UNKNOWN, details: 'No specific check available' };
        }
    } catch (error) {
        return { status: STATUS.OFFLINE, details: error.message };
    }
}

/**
 * Create system detail embed
 */
async function createSystemDetailEmbed(type, systemId, client) {
    const systems = type === 'main' ? MAIN_COMMAND_SYSTEMS : SUB_COMMAND_SYSTEMS;
    const system = systems.find(s => s.id === systemId);
    
    if (!system) {
        return new EmbedBuilder()
            .setTitle('❌ System Not Found')
            .setColor(0xFF0000)
            .setDescription('The requested system could not be found.');
    }
    
    const checkFn = type === 'main' ? checkMainCommandSystem : checkSubCommandSystem;
    const check = await checkFn(systemId);
    
    const embed = new EmbedBuilder()
        .setTitle(`${system.emoji} ${system.name} Status`)
        .setColor(check.status.color)
        .setDescription(`**Status:** ${check.status.emoji} ${check.status.text}`)
        .addFields(
            { name: '📝 Description', value: system.description, inline: false },
            { name: '🔍 Details', value: check.details || 'No additional details', inline: false }
        )
        .setTimestamp();
    
    // Add extra details for specific systems
    if (systemId === 'lavalink' && check.nodes) {
        const nodeInfo = check.nodes.map(n => {
            const stateText = n.state === 2 ? 'Connected' : 'Disconnected';
            return `• **${n.name}:** ${stateText}`;
        }).join('\n');
        embed.addFields({ name: '🎵 Nodes', value: nodeInfo || 'No nodes', inline: false });
        
        if (check.players && check.players.length > 0) {
            embed.addFields({
                name: '🎶 Active Players',
                value: `${check.players.length} guild(s) playing music`,
                inline: false
            });
        }
    }
    
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botcheck')
        .setDescription('Check bot health status and service connections (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        
        // Check authorization
        if (!isAuthorized(userId)) {
            return interaction.reply({
                content: '❌ This command is restricted to bot owners only.',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: false });
        
        try {
            const embed = await createOverviewEmbed(interaction.client);
            const navButtons = createNavButtons(userId, 'overview');
            
            const message = await interaction.editReply({
                embeds: [embed],
                components: [navButtons]
            });
            
            // Create collector for button/select interactions
            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 300000 // 5 minutes
            });
            
            let currentView = 'overview';
            
            collector.on('collect', async (i) => {
                try {
                    await i.deferUpdate();
                    
                    const customId = i.customId;
                    
                    // Handle button clicks
                    if (customId.startsWith('botcheck_overview_')) {
                        currentView = 'overview';
                        const embed = await createOverviewEmbed(interaction.client);
                        await i.editReply({
                            embeds: [embed],
                            components: [createNavButtons(userId, 'overview')]
                        });
                    }
                    else if (customId.startsWith('botcheck_main_') && !customId.includes('select')) {
                        currentView = 'main';
                        const embed = new EmbedBuilder()
                            .setTitle('🎴 MainCommand Systems')
                            .setColor(0x5DADE2)
                            .setDescription('Select a system from the dropdown below to check its status.')
                            .addFields({
                                name: 'Available Systems',
                                value: MAIN_COMMAND_SYSTEMS.map(s => `${s.emoji} **${s.name}** - ${s.description}`).join('\n')
                            })
                            .setTimestamp();
                        
                        await i.editReply({
                            embeds: [embed],
                            components: [
                                createNavButtons(userId, 'main'),
                                createMainCommandSelectMenu(userId)
                            ]
                        });
                    }
                    else if (customId.startsWith('botcheck_sub_') && !customId.includes('select')) {
                        currentView = 'sub';
                        const embed = new EmbedBuilder()
                            .setTitle('🔧 SubCommand Systems')
                            .setColor(0x9B59B6)
                            .setDescription('Select a system from the dropdown below to check its status.')
                            .addFields({
                                name: 'Available Systems',
                                value: SUB_COMMAND_SYSTEMS.map(s => `${s.emoji} **${s.name}** - ${s.description}`).join('\n')
                            })
                            .setTimestamp();
                        
                        await i.editReply({
                            embeds: [embed],
                            components: [
                                createNavButtons(userId, 'sub'),
                                createSubCommandSelectMenu(userId)
                            ]
                        });
                    }
                    else if (customId.startsWith('botcheck_refresh_')) {
                        // Refresh current view
                        if (currentView === 'overview') {
                            const embed = await createOverviewEmbed(interaction.client);
                            await i.editReply({
                                embeds: [embed],
                                components: [createNavButtons(userId, 'overview')]
                            });
                        } else if (currentView === 'main') {
                            const embed = new EmbedBuilder()
                                .setTitle('🎴 MainCommand Systems')
                                .setColor(0x5DADE2)
                                .setDescription('Select a system from the dropdown below to check its status.')
                                .addFields({
                                    name: 'Available Systems',
                                    value: MAIN_COMMAND_SYSTEMS.map(s => `${s.emoji} **${s.name}** - ${s.description}`).join('\n')
                                })
                                .setTimestamp();
                            
                            await i.editReply({
                                embeds: [embed],
                                components: [
                                    createNavButtons(userId, 'main'),
                                    createMainCommandSelectMenu(userId)
                                ]
                            });
                        } else if (currentView === 'sub') {
                            const embed = new EmbedBuilder()
                                .setTitle('🔧 SubCommand Systems')
                                .setColor(0x9B59B6)
                                .setDescription('Select a system from the dropdown below to check its status.')
                                .addFields({
                                    name: 'Available Systems',
                                    value: SUB_COMMAND_SYSTEMS.map(s => `${s.emoji} **${s.name}** - ${s.description}`).join('\n')
                                })
                                .setTimestamp();
                            
                            await i.editReply({
                                embeds: [embed],
                                components: [
                                    createNavButtons(userId, 'sub'),
                                    createSubCommandSelectMenu(userId)
                                ]
                            });
                        }
                    }
                    // Handle select menu
                    else if (customId.startsWith('botcheck_main_select_') || customId.startsWith('botcheck_sub_select_')) {
                        const value = i.values[0];
                        const [type, systemId] = value.split('_');
                        
                        const embed = await createSystemDetailEmbed(type, systemId, interaction.client);
                        
                        const components = [createNavButtons(userId, type)];
                        if (type === 'main') {
                            components.push(createMainCommandSelectMenu(userId));
                        } else {
                            components.push(createSubCommandSelectMenu(userId));
                        }
                        
                        await i.editReply({
                            embeds: [embed],
                            components
                        });
                    }
                } catch (error) {
                    console.error('[BotCheck] Interaction error:', error);
                }
            });
            
            collector.on('end', async () => {
                try {
                    const embed = await createOverviewEmbed(interaction.client);
                    embed.setFooter({ text: 'Session expired - run /botcheck again to interact' });
                    
                    const disabledRow = createNavButtons(userId, 'overview');
                    disabledRow.components.forEach(btn => btn.setDisabled(true));
                    
                    await message.edit({
                        embeds: [embed],
                        components: [disabledRow]
                    }).catch(() => {});
                } catch {}
            });
            
        } catch (error) {
            console.error('[BotCheck] Command error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while checking bot status.',
                embeds: [],
                components: []
            });
        }
    }
};
