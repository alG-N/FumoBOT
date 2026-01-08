const { Collection, REST, Routes } = require('discord.js');
const { createClient, setPresence, ActivityType } = require('./MainCommand/Configuration/discord');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Core Systems
const { initializeDatabase } = require('./MainCommand/Core/Database/schema');
const { startIncomeSystem } = require('./MainCommand/Core/Database/PassiveIncome/income');
const { scheduleBackups } = require('./MainCommand/Core/Database/backup');
const { initializeErrorHandlers } = require('./MainCommand/Ultility/errorHandler');
const { LOG_CHANNEL_ID } = require('./MainCommand/Core/logger');

// Auto-Deploy Configuration
const { clientId } = require('./config.json');
const COMMANDS_HASH_FILE = path.join(__dirname, '.commands-hash.json');
const AUTO_DEPLOY_ENABLED = true; // Set to false to disable auto-deploy

// Services
const { initializeShop } = require('./MainCommand/Service/MarketService/EggShopService/EggShopCacheService');
const { initializeSeasonSystem } = require('./MainCommand/Service/FarmingService/SeasonService/SeasonManagerService');
const { shutdownAutoRolls } = require('./MainCommand/Service/GachaService/NormalGachaService/CrateAutoRollService');
const initializeShardHandler = require('./MainCommand/Service/UserDataService/UseService/ShardInteractionHandler');
const { registerSigilInteractionHandler } = require('./MainCommand/Service/UserDataService/UseService/SigilInteractionHandler');
const PetIntervalManager = require('./MainCommand/Service/PetService/PetIntervalManager');

// Bot Health & Image Validation
const ConnectionMonitor = require('./MainCommand/Service/BotService/ConnectionHealthService/ConnectionMonitor');
const { validateAllFumoImages } = require('./MainCommand/Service/BotService/ImageValidationService/ImageValidator');

// Administrator Module
const {
    registerAdminCommands,
    registerBanSystem,
    registerTicketSystem,
    initializeGuildTracking,
    migratePetsCommand
} = require('./MainCommand/Administrator');

// Data & Configuration
const FumoPool = require('./MainCommand/Data/FumoPool');
const { registerCodeRedemption } = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/codeRedemption');
const { maintenance, developerID } = require('./MainCommand/Configuration/maintenanceConfig');

// Client Initialization
const client = createClient();
client.commands = new Collection();

// Initialize connection monitor
const connectionMonitor = new ConnectionMonitor(client);

// Integrate with diagnostics
const { setConnectionMonitor } = require('./MainCommand/Ultility/diagnostics');
setConnectionMonitor(connectionMonitor);

// Pre-initialize Lavalink before login
const lavalinkService = require('./SubCommand/MusicFunction/Service/LavalinkService');
lavalinkService.preInitialize(client);

// Command Loader
const SKIP_FOLDERS = ['handlers', 'node_modules', 'Test', 'backup'];
function loadCommandsRecursively(directory, depth = 0) {
    const items = fs.readdirSync(directory, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) {
            // Skip certain folders that contain non-command modules
            if (SKIP_FOLDERS.includes(item.name)) continue;
            loadCommandsRecursively(fullPath, depth + 1);
        } else if (item.isFile() && item.name.endsWith('.js')) {
            try {
                const command = require(fullPath);
                if (command?.data?.name) {
                    client.commands.set(command.data.name, command);
                }
            } catch (error) {
                console.error(`❌ Error loading ${item.name}:`, error.message);
            }
        }
    }
}

// Command Modules (Lazy-loaded)
const commandModules = {
    // Gacha Commands
    gacha: () => require('./MainCommand/CommandFolder/GachaCommand/crategacha'),
    Egacha: () => require('./MainCommand/CommandFolder/GachaCommand/eventgacha'),
    gamble: () => require('./MainCommand/CommandFolder/GachaCommand/gamble'),
    slot: () => require('./MainCommand/CommandFolder/GachaCommand/slot'),
    flip: () => require('./MainCommand/CommandFolder/GachaCommand/flip'),
    mysteryCrate: () => require('./MainCommand/CommandFolder/GachaCommand/mysterycrate'),
    diceduel: () => require('./MainCommand/CommandFolder/GachaCommand/diceduel'),
    
    // Tutorial Commands
    help: () => require('./MainCommand/CommandFolder/TutorialCommand/help'),
    credit: () => require('./MainCommand/CommandFolder/TutorialCommand/aboutBot'),
    
    // User Data Commands
    inventory: () => require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Storage'),
    balance: () => require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Balance'),
    item: () => require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Item'),
    boost: () => require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/boost'),
    leaderboard: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/leaderboard'),
    sell: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/sell'),
    useItem: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/use'),
    itemInfo: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/itemInfo'),
    quest: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/quest'),
    level: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/level'),
    rebirth: () => require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/rebirth'),
    daily: () => require('./MainCommand/CommandFolder/UserDataCommand/DailyStuff/daily'),
    starter: () => require('./MainCommand/CommandFolder/UserDataCommand/DailyStuff/starter'),
    
    // Fumo Data Commands
    library: () => require('./MainCommand/CommandFolder/FumoDataCommand/library'),
    inform: () => require('./MainCommand/CommandFolder/FumoDataCommand/inform'),
    
    // Market Commands
    pray: () => require('./MainCommand/CommandFolder/PrayCommand/pray'),
    market: () => require('./MainCommand/CommandFolder/MarketCommand/market'),
    exchange: () => require('./MainCommand/CommandFolder/MarketCommand/exchange'),
    shop: () => require('./MainCommand/CommandFolder/MarketCommand/shop'),
    eggshop: () => require('./MainCommand/CommandFolder/MarketCommand/eggshop'),
    
    // Craft Commands
    craft: () => require('./MainCommand/CommandFolder/CraftCommand/craft'),
    
    // Pet Commands
    eggInventory: () => require('./MainCommand/CommandFolder/PetCommand/eggInventory'),
    eggOpen: () => require('./MainCommand/CommandFolder/PetCommand/eggOpen'),
    eggcheck: () => require('./MainCommand/CommandFolder/PetCommand/eggCheck'),
    equipPet: () => require('./MainCommand/CommandFolder/PetCommand/equipPet'),
    
    // Farming Commands
    addFarm: () => require('./MainCommand/CommandFolder/FarmingCommand/AddFarm'),
    addBest: () => require('./MainCommand/CommandFolder/FarmingCommand/AddBest'),
    endFarm: () => require('./MainCommand/CommandFolder/FarmingCommand/EndFarm'),
    farmCheck: () => require('./MainCommand/CommandFolder/FarmingCommand/FarmCheck'),
    farmInfo: () => require('./MainCommand/CommandFolder/FarmingCommand/FarmInfo'),
    InitializeFarming: () => require('./MainCommand/CommandFolder/FarmingCommand/InitializeFarming'),
    
    // Trade Commands
    trade: () => require('./MainCommand/CommandFolder/TradeCommand/trade')
};

// Subcommand Modules
const anime = require('./SubCommand/API-Website/Anime/anime');
const afk = require('./SubCommand/BasicCommand/afk');
const reddit = require('./SubCommand/API-Website/Reddit/reddit');
const pixiv = require('./SubCommand/API-Website/Pixiv/pixiv');
const steam = require('./SubCommand/API-Website/Steam/steam');
const rule34 = require('./SubCommand/API-Website/Rule34/rule34');

// Admin commands
const { botCheckCommand } = require('./MainCommand/Administrator');

// Register API commands
[reddit, pixiv, steam, rule34].forEach(cmd => {
    if (cmd?.data?.name) {
        client.commands.set(cmd.data.name, cmd);
    }
});

// Register admin slash commands
if (botCheckCommand?.data?.name) {
    client.commands.set(botCheckCommand.data.name, botCheckCommand);
}

// Load SubCommand folder
loadCommandsRecursively(path.join(__dirname, 'SubCommand'));

// Auto-Deploy Slash Commands
async function deployCommands(forceRefresh = false) {
    if (!AUTO_DEPLOY_ENABLED) {
        console.log('⏭️ Auto-deploy disabled, skipping...');
        return;
    }

    try {
        // Collect all commands with data property
        const commands = [];
        for (const [name, command] of client.commands) {
            if (command.data) {
                try {
                    commands.push(command.data.toJSON());
                } catch (err) {
                    console.error(`❌ Failed to serialize command ${name}:`, err.message);
                }
            }
        }

        if (commands.length === 0) {
            console.log('⚠️ No commands to deploy');
            return;
        }

        // Create hash of current commands
        const commandsString = JSON.stringify(commands.sort((a, b) => a.name.localeCompare(b.name)));
        const currentHash = crypto.createHash('md5').update(commandsString).digest('hex');

        // Check if commands have changed
        let previousHash = null;
        try {
            if (fs.existsSync(COMMANDS_HASH_FILE)) {
                const hashData = JSON.parse(fs.readFileSync(COMMANDS_HASH_FILE, 'utf8'));
                previousHash = hashData.hash;
            }
        } catch (err) {
            // File doesn't exist or is corrupted, will deploy
        }

        if (!forceRefresh && previousHash === currentHash) {
            console.log('✅ Commands unchanged, skipping deploy');
            return;
        }

        console.log(`🔄 Deploying ${commands.length} slash commands globally...`);
        
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
        
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );

        // Save new hash
        fs.writeFileSync(COMMANDS_HASH_FILE, JSON.stringify({ 
            hash: currentHash, 
            deployedAt: new Date().toISOString(),
            commandCount: commands.length
        }, null, 2));

    } catch (error) {
        console.error('❌ Failed to deploy commands:', error.message);
    }
}

client.login(process.env.BOT_TOKEN);

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    // Start connection monitoring
    connectionMonitor.start(30000); // Check every 30 seconds
    
    // Validate fumo images on startup (non-blocking)
    setTimeout(async () => {
        try {
            const fumos = FumoPool.getRaw();
            const results = await validateAllFumoImages(fumos, client);
            if (results.broken.length > 0 || results.missing.length > 0) {
                console.log(`⚠️ Image validation: ${results.broken.length} broken, ${results.missing.length} missing`);
            }
        } catch (error) {
            console.error('❌ Image validation failed:', error.message);
        }
    }, 10000); // Start 10 seconds after ready

    // Auto-deploy slash commands (only if changed)
    await deployCommands();

    lavalinkService.finalize();
    await new Promise(resolve => setTimeout(resolve, 5000));

    const status = lavalinkService.getNodeStatus();
    if (!status.ready) {
        console.log('[Lavalink] ⚠️ Music system not ready');
    }

    initializeDatabase();
    
    // Migrate quests without trackingType (one-time fix for existing users)
    try {
        const QuestPoolService = require('./MainCommand/Service/UserDataService/QuestService/QuestPoolService');
        const migrationResult = await QuestPoolService.migrateQuestsWithoutTrackingType();
        if (migrationResult.migrated > 0) {
            console.log(`✅ Quest migration: ${migrationResult.migrated} users migrated`);
        }
    } catch (err) {
        console.error('⚠️ Quest migration error:', err.message);
    }
    
    startIncomeSystem();
    scheduleBackups(client);
    initializeErrorHandlers(client);
    setPresence(client, 'online', '.help and .starter', ActivityType.PLAYING);
    initializeSeasonSystem(client);
    initializeShop();
    // Parallel initialization for faster startup
    await Promise.all([
        Promise.resolve(initializeShardHandler(client)),
        Promise.resolve(registerSigilInteractionHandler(client)),
        Promise.resolve(initializeGuildTracking(client)),
        Promise.resolve(PetIntervalManager.startAllPetIntervals())
    ]);
    
    await restoreAutoRollSystems(client);

    console.log('🚀 Bot is fully operational!');
});

async function restoreAutoRollSystems(client) {
    try {
        const crateFumos = FumoPool.getForCrate();


        const {
            notifyUserUnifiedAutoRoll,
            sendUnifiedRestorationSummary,
            handleDetailsButtonInteraction
        } = require('./MainCommand/Service/GachaService/UnifiedAutoRollNotification');

        const { restoreAutoRolls: restoreNormalAutoRolls } = require('./MainCommand/Service/GachaService/NormalGachaService/CrateAutoRollService');
        const { restoreEventAutoRolls } = require('./MainCommand/Service/GachaService/EventGachaService/EventAutoRollService');
        const { loadUnifiedAutoRollState } = require('./MainCommand/Service/GachaService/UnifiedAutoRollPersistence');

        const unifiedState = loadUnifiedAutoRollState();
        const allUserIds = Object.keys(unifiedState);

        if (allUserIds.length === 0) {
            console.log('ℹ️ No auto-rolls to restore');
            return;
        }

        console.log(`🔄 Found ${allUserIds.length} user(s) with active auto-rolls to restore`);

        const results = {
            normal: { restored: 0, failed: 0 },
            event: { restored: 0, failed: 0 }
        };

        const normalStates = new Map();
        const eventStates = new Map();

        const normalResult = await restoreNormalAutoRolls(
            client,
            crateFumos,
            { notifyUsers: false, logChannelId: null }
        );
        results.normal = normalResult;

        const eventResult = await restoreEventAutoRolls(
            client,
            { notifyUsers: false, logChannelId: null }
        );
        results.event = eventResult;

        const { getAutoRollMap } = require('./MainCommand/Service/GachaService/NormalGachaService/CrateAutoRollService');
        const { getEventAutoRollMap } = require('./MainCommand/Service/GachaService/EventGachaService/EventAutoRollService');

        const activeNormalMap = getAutoRollMap();
        const activeEventMap = getEventAutoRollMap();

        for (const userId of allUserIds) {
            const userState = unifiedState[userId];

            if (userState.normal && activeNormalMap.has(userId)) {
                normalStates.set(userId, userState.normal);
            }

            if (userState.event && activeEventMap.has(userId)) {
                eventStates.set(userId, userState.event);
            }
        }

        for (const userId of allUserIds) {
            const hasNormal = normalStates.has(userId);
            const hasEvent = eventStates.has(userId);

            if (hasNormal || hasEvent) {
                try {
                    await notifyUserUnifiedAutoRoll(
                        client,
                        userId,
                        normalStates.get(userId) || null,
                        eventStates.get(userId) || null
                    );
                } catch (error) {
                    console.warn(`⚠️ Failed to send notification to user ${userId}:`, error.message);
                }
            }
        }

        await sendUnifiedRestorationSummary(client, results, LOG_CHANNEL_ID);

        // Store handlers in client for access from main interactionCreate handler
        // This avoids adding duplicate event listeners on each restart
        client.autoRollDetailsHandler = {
            normalStates,
            eventStates,
            handleDetailsButtonInteraction
        };

        const totalRestored = results.normal.restored + results.event.restored;
        const totalFailed = results.normal.failed + results.event.failed;

        if (totalRestored > 0 || totalFailed > 0) {
            console.log(`📊 Auto-rolls restored: ${totalRestored} (${totalFailed} failed)`);
        }

    } catch (error) {
        console.error('❌ Error during auto-roll restoration:', error);
    }
}

// Register All Commands
Object.entries(commandModules).forEach(([name, loader]) => {
    try {
        loader()(client);
    } catch (error) {
        console.error(`❌ Failed to initialize ${name}:`, error.message);
    }
});

// Admin & System Registration
registerAdminCommands(client);
registerBanSystem(client, developerID);
registerTicketSystem(client);
migratePetsCommand(client);
registerCodeRedemption(client);

client.on('interactionCreate', async interaction => {
    // Handle Select Menus FIRST (before buttons)
    if (interaction.isStringSelectMenu()) {

        // Rule34 settings select menus
        if (interaction.customId.startsWith('r34_setting_')) {
            const rule34Command = client.commands.get('rule34');
            if (rule34Command && rule34Command.handleSelectMenu) {
                try {
                    await rule34Command.handleSelectMenu(interaction);
                } catch (error) {
                    console.error('Rule34 select menu handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while updating settings.',
                            ephemeral: true
                        }).catch(() => {});
                    }
                }
            }
            return;
        }

        // Music settings select menus
        if (interaction.customId.startsWith('music_setting_')) {
            const musicCommand = client.commands.get('music');
            if (musicCommand && musicCommand.handleSelectMenu) {
                try {
                    await musicCommand.handleSelectMenu(interaction);
                } catch (error) {
                    console.error('Music select menu handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while updating settings.',
                            ephemeral: true
                        }).catch(() => {});
                    }
                }
            }
            return;
        }
    }

    if (interaction.isButton()) {

        // Handle auto-roll details button (from restoreAutoRollSystems)
        if (interaction.customId.startsWith('viewNormalAutoRoll_') ||
            interaction.customId.startsWith('viewEventAutoRoll_')) {
            if (client.autoRollDetailsHandler) {
                const { normalStates, eventStates, handleDetailsButtonInteraction } = client.autoRollDetailsHandler;
                try {
                    await handleDetailsButtonInteraction(interaction, normalStates, eventStates);
                } catch (error) {
                    console.error('Auto-roll details handler error:', error);
                }
            }
            return;
        }

        const {
            handleDisableNotificationButton,
            handleConfirmDisableNotification,
            handleCancelDisableNotification,
            handleEnableNotification
        } = require('./MainCommand/Service/GachaService/NotificationButtonsService');

        if (interaction.customId.startsWith('disableNotification_')) {
            await handleDisableNotificationButton(interaction);
            return;
        }

        if (interaction.customId.startsWith('confirmDisableNotif_')) {
            await handleConfirmDisableNotification(interaction);
            return;
        }

        if (interaction.customId.startsWith('cancelDisableNotif_')) {
            await handleCancelDisableNotification(interaction);
            return;
        }

        if (interaction.customId.startsWith('enableNotification_')) {
            await handleEnableNotification(interaction);
            return;
        }

        // Reddit button handlers
        if (interaction.customId.startsWith('reddit_')) {
            const redditCommand = client.commands.get('reddit');
            if (redditCommand && redditCommand.handleButton) {
                try {
                    await redditCommand.handleButton(interaction);
                } catch (error) {
                    console.error('Reddit button handler error:', error);
                }
            }
            return;
        }

        // Pixiv button handlers
        if (interaction.customId.startsWith('pixiv_')) {
            const pixivCommand = client.commands.get('pixiv');
            if (pixivCommand && pixivCommand.handleButton) {
                try {
                    await pixivCommand.handleButton(interaction);
                } catch (error) {
                    console.error('Pixiv button handler error:', error);
                }
            }
            return;
        }

        // Steam button handlers
        if (interaction.customId.startsWith('steam_')) {
            return;
        }

        // Rule34 button handlers
        if (interaction.customId.startsWith('r34_') || interaction.customId.startsWith('rule34_')) {
            const rule34Command = client.commands.get('rule34');
            if (rule34Command && rule34Command.handleButton) {
                try {
                    await rule34Command.handleButton(interaction);
                } catch (error) {
                    console.error('Rule34 button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred. Please try again.',
                            ephemeral: true
                        }).catch(() => {});
                    }
                }
            }
            return;
        }

        // Music button handlers
        if (interaction.customId.startsWith('music_')) {
            const musicCommand = client.commands.get('music');
            if (musicCommand && musicCommand.handleButton) {
                try {
                    await musicCommand.handleButton(interaction);
                } catch (error) {
                    console.error('Music button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred. Please try again.',
                            ephemeral: true
                        }).catch(() => {});
                    }
                }
            }
            return;
        }

        return;
    }

    if (interaction.isChatInputCommand()) {

        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`❌ Command not found: ${interaction.commandName}`);
            await safeReply(interaction, '❌ This command is not available. The bot may need to restart.');
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error executing ${interaction.commandName}:`, error);
            await safeReply(interaction, 'There was an error executing this command!');
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.log(`[Autocomplete] Error for ${interaction.commandName}:`, error.message);
        }
        return;
    }
});

async function safeReply(interaction, content) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content, ephemeral: true });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    } catch (error) {
        console.error('Failed to send error message:', error);
    }
}

client.on('messageCreate', async message => {
    try {
        await afk.onMessage(message, client);
        await anime.onMessage(message, client);
    } catch (error) {
        // Silent fail for message handlers to prevent bot crashes
    }
});

// Voice state update handler - cleanup music when bot is kicked/moved
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Only handle bot's own voice state changes
    if (oldState.member?.id !== client.user.id) return;
    
    // Bot was in a channel and is now disconnected (kicked or moved out)
    if (oldState.channelId && !newState.channelId) {
        const guildId = oldState.guild.id;
        
        try {
            const musicService = require('./SubCommand/MusicFunction/Service/MusicService');
            await musicService.cleanup(guildId);
        } catch (error) {
            console.error(`[Music] Cleanup error for guild ${guildId}:`, error.message);
        }
    }
});

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', handleCrash);
process.on('unhandledRejection', handleUnhandledRejection);

async function handleShutdown(signal) {
    console.log(`\n🛑 Received ${signal || 'shutdown'} signal, saving state...`);
    try {
        shutdownAutoRolls();
        
        // Cleanup music cache intervals
        try {
            const musicCache = require('./SubCommand/MusicFunction/Repository/MusicCache');
            musicCache.stopCleanupInterval();
        } catch (e) {}
        
        console.log('👋 Shutting down gracefully...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

function handleCrash(error) {
    console.error('❌ CRITICAL: Uncaught Exception:', error);

    try {
        console.log('💾 Emergency saving auto-roll state...');
        shutdownAutoRolls();
        console.log('✅ Emergency save complete');
    } catch (saveError) {
        console.error('❌ Failed to save state during crash:', saveError);
    }

    process.exit(1);
}

function handleUnhandledRejection(reason, promise) {
    console.error('❌ CRITICAL: Unhandled Promise Rejection:');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    
    // Log stack trace if available
    if (reason instanceof Error) {
        console.error('Stack:', reason.stack);
    }
    
    // In production, you might want to exit or attempt recovery
    // For now, just log and continue (Node.js 15+ will exit by default)
}