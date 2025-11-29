const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType,
    Collection
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();  // done 

// DATABASE MODULES
const { initializeDatabase } = require('./MainCommand/Core/Database/schema');
const { startIncomeSystem } = require('./MainCommand/Core/Database/PassiveIncome/income'); 
const { scheduleBackups } = require('./MainCommand/Core/Database/backup'); 

// UTILITY MODULES
const { initializeErrorHandlers } = require('./MainCommand/Ultility/errorHandler');

// PET MODULES
const { initializePetSystems } = require('./MainCommand/CommandFolder/PetCommand/Passive/petAging');

// ADMIN MODULES
const { registerAdminCommands } = require('./MainCommand/Administrator/adminCommands');
const { registerBanSystem } = require('./MainCommand/Administrator/banSystem');
const { registerTicketSystem } = require('./MainCommand/Administrator/ticketSystem');

// USER DATA MODULES
const { registerCodeRedemption } = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/codeRedemption');

// MAINTENANCE CONFIG
const { maintenance, developerID } = require("./MainCommand/Configuration/Maintenance/maintenanceConfig");
console.log(`Maintenance mode is currently: ${maintenance}`);

// CLIENT INITIALIZATION
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.setMaxListeners(150);
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
const fumos = require('./MainCommand/Storage/NormalCrateFumoStorage');
const help = require('./MainCommand/CommandFolder/TutorialCommand/help');
const inventory = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Storage');
const balance = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Balance');
const item = require('./MainCommand/CommandFolder/UserDataCommand/UserBalance/Item');
const Efumos = require('./MainCommand/Storage/EventFumoStorage');
const Egacha = require('./MainCommand/CommandFolder/GachaCommand/eventgacha');
const library = require('./MainCommand/CommandFolder/FumoDataCommand/library');
const libraryFumos = require('./MainCommand/Storage/LibraryFumoStorage');
const inform = require('./MainCommand/CommandFolder/FumoDataCommand/inform');
const leaderboard = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/leaderboard');
const gamble = require('./MainCommand/CommandFolder/GachaCommand/gamble');
const slot = require('./MainCommand/CommandFolder/GachaCommand/slot');
const flip = require('./MainCommand/CommandFolder/GachaCommand/flip');
const mysteryCrate = require('./MainCommand/CommandFolder/GachaCommand/mysterycrate');
const sell = require('./MainCommand/CommandFolder/UserDataCommand/UsuableCommand/sell');
const pray = require('./MainCommand/CommandFolder/PrayCommand/pray');
const Pfumos = require('./MainCommand/Storage/PrayFumoStorage');
const market = require('./MainCommand/CommandFolder/MarketCommand/market');
const marketFumos = require('./MainCommand/Storage/MarketFumoStorage');
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
const farm = require('./MainCommand/CommandFolder/FarmingCommand/FarmManagement');

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
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Initialize database
    initializeDatabase();

    // Start income system
    startIncomeSystem();

    // Schedule backups
    scheduleBackups(client);

    // Initialize error handlers
    initializeErrorHandlers(client);

    // Set bot status
    setStaticStatus();

    // Set pet exp gaining and aging systems
    initializePetSystems();

    console.log('🚀 Bot is fully operational!');
});

// REGISTER ALL GAME COMMANDS
gacha(client, fumos);
Egacha(client, Efumos);
starter(client);
daily(client);
help(client);
inventory(client);
balance(client);
item(client);
library(client, libraryFumos);
inform(client);
leaderboard(client);
gamble(client);
slot(client);
flip(client);
mysteryCrate(client);
sell(client);
pray(client, Pfumos);
market(client, marketFumos);
exchange(client);
shop(client);
useItem(client);
itemInfo(client);
boost(client);
useFragment(client);
farm(client);
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

// REGISTER ADMIN & USER SYSTEMS
registerAdminCommands(client);
registerBanSystem(client, developerID);
registerTicketSystem(client);
registerCodeRedemption(client);

// INTERACTION HANDLER
client.on('interactionCreate', async interaction => {
    // Handle BUTTONS
    if (interaction.isButton()) {
        console.log('🔘 Button interaction received:', interaction.customId);

        // Reddit button handler
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

        // Pixiv button handler
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

    // Handle SLASH COMMANDS
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

    // Handle AUTOCOMPLETE
    if (interaction.isAutocomplete()) {
        // console.log('🔍 Autocomplete triggered for:', interaction.commandName);
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

// BOT STATUS
function setStaticStatus() {
    try {
        if (client.user) {
            client.user.setPresence({
                activities: [{
                    name: '.help and .starter',
                    type: ActivityType.Playing,
                }],
                status: 'online',
            });
            console.log('✅ Status set to: Playing .help and .starter');
        } else {
            console.warn('Client user is not ready yet.');
        }
    } catch (error) {
        console.error('Failed to set bot presence:', error);
    }
}

// BOT LOGIN
client.login(process.env.BOT_TOKEN);
// created by alterGolden || golden_exist