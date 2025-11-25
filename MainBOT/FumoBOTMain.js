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

// ========================================
// DATABASE MODULES
// ========================================
const { initializeDatabase } = require('./MainCommand/Database/schema');
const { startIncomeSystem } = require('./MainCommand/Database/PassiveIncome/income'); 
const { scheduleBackups } = require('./MainCommand/Database/backup'); 

// ========================================
// UTILITY MODULES
// ========================================
const { initializeErrorHandlers } = require('./MainCommand/utils/errorHandler');

// ========================================
// ADMIN MODULES
// ========================================
const { registerAdminCommands } = require('./MainCommand/Admin/adminCommands');
const { registerBanSystem } = require('./MainCommand/Admin/banSystem');
const { registerTicketSystem } = require('./MainCommand/Admin/ticketSystem');

// ========================================
// USER DATA MODULES
// ========================================
const { registerCodeRedemption } = require('./MainCommand/UserData/codeRedemption');

// ========================================
// MAINTENANCE CONFIG
// ========================================
const { maintenance, developerID } = require("./MainCommand/Maintenace/MaintenaceConfig");
console.log(`Maintenance mode is currently: ${maintenance}`);

// ========================================
// CLIENT INITIALIZATION
// ========================================
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

// ========================================
// LOAD SLASH COMMANDS
// ========================================
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

// ========================================
// LOAD GAME COMMAND MODULES
// ========================================
const gacha = require('./MainCommand/Gacha/crategacha');
const fumos = require('./MainCommand/Storage/ThyFumoStorage');
const help = require('./MainCommand/Tutorial/help');
const inventory = require('./MainCommand/UserData/Storage');
const balance = require('./MainCommand/UserData/Balance');
const item = require('./MainCommand/UserData/Item');
const Efumos = require('./MainCommand/Storage/EventFumoStorage');
const Egacha = require('./MainCommand/Gacha/eventgacha');
const library = require('./MainCommand/FumoData/library');
const libraryFumos = require('./MainCommand/FumoData/libraryFumo');
const inform = require('./MainCommand/FumoData/inform');
const leaderboard = require('./MainCommand/UserData/leaderboard');
const gamble = require('./MainCommand/Gacha/gamble');
const slot = require('./MainCommand/Gacha/slot');
const flip = require('./MainCommand/Gacha/flip');
const mysteryCrate = require('./MainCommand/Gacha/mysterycrate');
const sell = require('./MainCommand/UserData/sell');
const pray = require('./MainCommand/PrayCMD/pray');
const Pfumos = require('./MainCommand/PrayCMD/fumoStorage');
const market = require('./MainCommand/Market/market');
const marketFumos = require('./MainCommand/Market/Storage/marketStorage');
const exchange = require('./MainCommand/Market/exchange');
const shop = require('./MainCommand/Market/shop');
const useItem = require('./MainCommand/UserData/use');
const itemInfo = require('./MainCommand/UserData/itemInfo');
const boost = require('./MainCommand/UserData/boost');
const credit = require('./MainCommand/UserData/aboutBot');
const Pcraft = require('./MainCommand/Craft/potionCraft');
const Icraft = require('./MainCommand/Craft/itemCraft');
const craft = require('./MainCommand/Craft/craft');
const quest = require('./MainCommand/UserData/quest');
const daily = require('./MainCommand/UserData/daily');
const starter = require('./MainCommand/UserData/starter');
const eggshop = require('./MainCommand/Market/eggshop');
const eggInventory = require('./MainCommand/PetData/eggInventory');
const eggOpen = require('./MainCommand/PetData/eggOpen');
const eggcheck = require('./MainCommand/PetData/eggcheck');
const equipPet = require('./MainCommand/PetData/equipPet');
const useFragment = require('./MainCommand/Farming/useFragment');
const farm = require('./MainCommand/Farming/FarmManagement');

// ========================================
// OTHER FUN COMMANDS
// ========================================
const anime = require('./SubCommand/API-Website/Anime/anime');
const afk = require('./SubCommand/BasicCommand/afk');
const musicCommands = require('./SubCommand/MusicFunction/MainMusic');
const reddit = require('./SubCommand/API-Website/Reddit/reddit');

if (reddit && reddit.data && reddit.data.name) {
    client.commands.set(reddit.data.name, reddit);
    console.log('✅ Manually loaded reddit command');
}

// ========================================
// BOT READY EVENT
// ========================================
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

    console.log('🚀 Bot is fully operational!');
});

// ========================================
// REGISTER ALL GAME COMMANDS
// ========================================
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

// ========================================
// REGISTER ADMIN & USER SYSTEMS
// ========================================
registerAdminCommands(client);
registerBanSystem(client, developerID);
registerTicketSystem(client);
registerCodeRedemption(client);

// ========================================
// INTERACTION HANDLER
// ========================================
client.on('interactionCreate', async interaction => {
    // Handle BUTTONS
    if (interaction.isButton()) {
        console.log('🔘 Button interaction received:', interaction.customId);

        if (interaction.customId.startsWith('show_post_') || interaction.customId.startsWith('gallery_') || interaction.customId.startsWith('back_to_list_') || interaction.customId.startsWith('page_next_') || interaction.customId.startsWith('page_prev_')) {
            const redditCommand = client.commands.get('reddit');
            if (redditCommand && redditCommand.handleButton) {
                try {
                    await redditCommand.handleButton(interaction);
                } catch (error) {
                    console.error('Button handler error:', error);
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
        console.log('🔍 Autocomplete triggered for:', interaction.commandName);
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

// ========================================
// MESSAGE EVENT HANDLERS
// ========================================
client.on('messageCreate', message => {
    afk.onMessage(message, client);
});

client.on('messageCreate', message => {
    anime.onMessage(message, client);
});

// ========================================
// MUSIC COMMANDS
// ========================================
musicCommands(client);

// ========================================
// BOT STATUS
// ========================================
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

// ========================================
// BOT LOGIN
// ========================================
client.login(process.env.BOT_TOKEN);
