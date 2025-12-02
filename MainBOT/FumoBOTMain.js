const { Collection, Client } = require('discord.js');
const { createClient, setPresence, ActivityType } = require('./MainCommand/Configuration/discord');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// DATABASE MODULES
const { initializeDatabase } = require('./MainCommand/Core/Database/schema');
const { startIncomeSystem } = require('./MainCommand/Core/Database/PassiveIncome/income');
const { scheduleBackups } = require('./MainCommand/Core/Database/backup');

// UTILITY MODULES
const { initializeErrorHandlers } = require('./MainCommand/Ultility/errorHandler');

// PET MODULES
const { initializePetSystems } = require('./MainCommand/CommandFolder/PetCommand/Passive/petAging');
const { initializeShop } = require('./MainCommand/Service/MarketService/EggShopService/EggShopCacheService');

// SEASON MODULES
const { initializeSeasonSystem } = require('./MainCommand/Service/FarmingService/SeasonService/SeasonManagerService')

// AUTO-ROLL PERSISTENCE MODULE - NEW
const { restoreAutoRolls, shutdownAutoRolls } = require('./MainCommand/Service/GachaService/NormalGachaService/CrateAutoRollService');
const FumoPool = require('./MainCommand/Data/FumoPool');
const { LOG_CHANNEL_ID } = require('./MainCommand/Core/logger');

// ADMIN MODULES
const { registerAdminCommands } = require('./MainCommand/Administrator/adminCommands');
const { registerBanSystem } = require('./MainCommand/Administrator/banSystem');
const { registerTicketSystem } = require('./MainCommand/Administrator/ticketSystem');

// USER DATA MODULES
const { registerCodeRedemption } = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/codeRedemption');

// INITIALIZE SHARD
const initializeShardHandler = require('./MainCommand/Service/UserDataService/UseService/ShardInteractionHandler');

// MAINTENANCE CONFIG
const { maintenance, developerID } = require("./MainCommand/Configuration/maintenanceConfig");
console.log(`Maintenance mode is currently: ${maintenance}`);

// CLIENT INITIALIZATION - Now using the discord.js config
const client = createClient();
client.commands = new Collection();

// LOAD SLASH COMMANDS
const commandFolders = fs.readdirSync(path.join(__dirname, 'SubCommand'));
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, 'SubCommand', folder))
        .filter(file => file.endsWith('.js') && file !== 'MainMusic.js');

    for (const file of commandFiles) {
        const command = require(path.join(__dirname, 'SubCommand', folder, file));
        if (command && command.data && command.data.name) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`Command in file ${file} is missing 'data' or 'data.name' property.`);
        }
    }
}

// LOAD GAME COMMAND MODULES
const gacha = require('./MainCommand/CommandFolder/GachaCommand/crategacha');
const help = require('./MainCommand/CommandFolder/TutorialCommand/help');
const inventory = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Storage');
const balance = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Balance');
const item = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Item');
const Egacha = require('./MainCommand/CommandFolder/GachaCommand/eventgacha');
const library = require('./MainCommand/CommandFolder/FumoDataCommand/library');
const inform = require('./MainCommand/CommandFolder/FumoDataCommand/inform');
const leaderboard = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/leaderboard');
const gamble = require('./MainCommand/CommandFolder/GachaCommand/gamble');
const slot = require('./MainCommand/CommandFolder/GachaCommand/slot');
const flip = require('./MainCommand/CommandFolder/GachaCommand/flip');
const mysteryCrate = require('./MainCommand/CommandFolder/GachaCommand/mysterycrate');
const sell = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/sell');
const pray = require('./MainCommand/CommandFolder/PrayCommand/pray');
const market = require('./MainCommand/CommandFolder/MarketCommand/market');
const exchange = require('./MainCommand/CommandFolder/MarketCommand/exchange');
const shop = require('./MainCommand/CommandFolder/MarketCommand/shop');
const useItem = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/use');
const itemInfo = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/itemInfo');
const boost = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/boost');
const credit = require('./MainCommand/CommandFolder/TutorialCommand/aboutBot');
const Pcraft = require('./MainCommand/CommandFolder/CraftCommand/potionCraft');
const Icraft = require('./MainCommand/CommandFolder/CraftCommand/itemCraft');
const craft = require('./MainCommand/CommandFolder/CraftCommand/craft');
const quest = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/quest');
const daily = require('./MainCommand/CommandFolder/UserDataCommand/DailyStuff/daily');
const starter = require('./MainCommand/CommandFolder/UserDataCommand/DailyStuff/starter');
const eggshop = require('./MainCommand/CommandFolder/MarketCommand/eggshop');
const eggInventory = require('./MainCommand/CommandFolder/PetCommand/Functionality/eggInventory');
const eggOpen = require('./MainCommand/CommandFolder/PetCommand/Functionality/eggOpen');
const eggcheck = require('./MainCommand/CommandFolder/PetCommand/Functionality/eggcheck');
const equipPet = require('./MainCommand/CommandFolder/PetCommand/Functionality/equipPet');
const useFragment = require('./MainCommand/CommandFolder/FarmingCommand/useFragment');
const addFarm = require('./MainCommand/CommandFolder/FarmingCommand/AddFarm');
const addBest = require('./MainCommand/CommandFolder/FarmingCommand/AddBest');
const endFarm = require('./MainCommand/CommandFolder/FarmingCommand/EndFarm');
const farmCheck = require('./MainCommand/CommandFolder/FarmingCommand/FarmCheck');
const farmInfo = require('./MainCommand/CommandFolder/FarmingCommand/FarmInfo');
const InitializeFarming = require('./MainCommand/CommandFolder/FarmingCommand/InitializeFarming');
const trade = require('./MainCommand/CommandFolder/TradeCommand/trade')

// OTHER FUN COMMANDS
const anime = require('./SubCommand/API-Website/Anime/anime');
const afk = require('./SubCommand/BasicCommand/afk');
const musicCommands = require('./SubCommand/MusicFunction/MainMusic');
const reddit = require('./SubCommand/API-Website/Reddit/reddit');
const pixiv = require('./SubCommand/API-Website/Pixiv/pixiv');
const steam = require('./SubCommand/API-Website/Steam/steam');

if (reddit && reddit.data && reddit.data.name) {
    client.commands.set(reddit.data.name, reddit);
    console.log('✅ Manually loaded reddit command');
}

if (pixiv && pixiv.data && pixiv.data.name) {
    client.commands.set(pixiv.data.name, pixiv);
    console.log('✅ Manually loaded pixiv command');
}

if (steam && steam.data && steam.data.name) {
    client.commands.set(steam.data.name, steam);
    console.log('✅ Manually loaded steam command');
}

// BOT READY EVENT
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}, status set to: Playing .help and .starter`);
    initializeDatabase();
    startIncomeSystem();
    scheduleBackups(client);
    initializeErrorHandlers(client);
    setPresence(client, 'online', '.help and .starter', ActivityType.PLAYING);
    initializePetSystems();
    initializeSeasonSystem(client);
    initializeShop();
    initializeShardHandler(client);
    
    try {
        console.log('🔄 Checking for auto-rolls to restore...');
        const crateFumos = FumoPool.getForCrate();
        const eventFumos = FumoPool.getForEvent();

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
        } else {
            console.log(`🔄 Found ${allUserIds.length} user(s) with active auto-rolls to restore`);
        }

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

        const detailsButtonHandler = async (interaction) => {
            if (!interaction.isButton()) return;

            if (interaction.customId.startsWith('viewNormalAutoRoll_') ||
                interaction.customId.startsWith('viewEventAutoRoll_')) {
                await handleDetailsButtonInteraction(interaction, normalStates, eventStates);
            }
        };

        client.on('interactionCreate', detailsButtonHandler);

        const totalRestored = results.normal.restored + results.event.restored;
        const totalFailed = results.normal.failed + results.event.failed;

        console.log(`📊 Restoration complete: ${totalRestored} restored, ${totalFailed} failed`);
        console.log(`   ├─ Normal: ${results.normal.restored} restored, ${results.normal.failed} failed`);
        console.log(`   └─ Event: ${results.event.restored} restored, ${results.event.failed} failed`);

        if (normalResult.reasons && Object.keys(normalResult.reasons).length > 0) {
            console.log(`📋 Normal failure reasons:`, normalResult.reasons);
        }
        if (eventResult.reasons && Object.keys(eventResult.reasons).length > 0) {
            console.log(`📋 Event failure reasons:`, eventResult.reasons);
        }

    } catch (error) {
        console.error('❌ Error during auto-roll restoration:', error);
    }

    console.log('🚀 Bot is fully operational!');
});

// REGISTER ALL GAME COMMANDS
gacha(client);
Egacha(client);
starter(client);
daily(client);
help(client);
inventory(client);
balance(client);
item(client);
library(client);
inform(client);
leaderboard(client);
gamble(client);
slot(client);
flip(client);
mysteryCrate(client);
sell(client);
pray(client);
market(client);
exchange(client);
shop(client);
useItem(client);
itemInfo(client);
boost(client);
useFragment(client);
addFarm(client);
addBest(client);
endFarm(client);
farmCheck(client);
farmInfo(client);
InitializeFarming(client);
credit(client);
Pcraft(client);
Icraft(client);
craft(client);
quest(client);
eggshop(client);
eggInventory(client);
eggOpen(client);
eggcheck(client);
equipPet(client);
trade(client);

// REGISTER ADMIN & USER SYSTEMS
registerAdminCommands(client);
registerBanSystem(client, developerID);
registerTicketSystem(client);
registerCodeRedemption(client);

// INTERACTION HANDLER
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        // console.log('🔘 Button interaction received:', interaction.customId);
        if (interaction.customId.startsWith('show_post_') ||
            interaction.customId.startsWith('gallery_') ||
            interaction.customId.startsWith('back_to_list_') ||
            interaction.customId.startsWith('page_next_') ||
            interaction.customId.startsWith('page_prev_')) {
            const redditCommand = client.commands.get('reddit');
            if (redditCommand && redditCommand.handleButton) {
                try {
                    await redditCommand.handleButton(interaction);
                } catch (error) {
                    console.error('Reddit button handler error:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: 'There was an error processing this button!', ephemeral: true });
                        }
                    } catch (e) {
                        console.error('Failed to send error message:', e);
                    }
                }
            } else {
                console.error('Reddit command or handleButton not found');
            }
            return;
        }

        if (interaction.customId.startsWith('pixiv_')) {
            const pixivCommand = client.commands.get('pixiv');
            if (pixivCommand && pixivCommand.handleButton) {
                try {
                    await pixivCommand.handleButton(interaction);
                } catch (error) {
                    console.error('Pixiv button handler error:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: 'There was an error processing this button!', ephemeral: true });
                        }
                    } catch (e) {
                        console.error('Failed to send error message:', e);
                    }
                }
            } else {
                console.error('Pixiv command or handleButton not found');
            }
            return;
        }

        return;
    }

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Command execution error:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
                }
            } catch (e) {
                console.error('Failed to send error message:', e);
            }
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error('Autocomplete error:', error);
        }
        return;
    }
});

// MESSAGE EVENT HANDLERS
client.on('messageCreate', message => {
    afk.onMessage(message, client);
});

client.on('messageCreate', message => {
    anime.onMessage(message, client);
});

// MUSIC COMMANDS
musicCommands(client);

// GRACEFUL SHUTDOWN HANDLERS
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', handleCrash);

async function handleShutdown(signal) {
    console.log(`\n🛑 Received ${signal || 'shutdown'} signal, saving state...`);
    try {
        shutdownAutoRolls();
        console.log('✅ Auto-roll state saved successfully');
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

// BOT LOGIN
client.login(process.env.BOT_TOKEN);
// created by alterGolden || golden_exist