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
const { initializeDatabase } = require('../MainBOT/Command/database/schema');
const { startIncomeSystem } = require('../MainBOT/Command/database/income'); 
const { scheduleBackups } = require('../MainBOT/Command/database/backup'); 

// ========================================
// UTILITY MODULES
// ========================================
const { initializeErrorHandlers } = require('../MainBOT/Command/utils/errorHandler');

// ========================================
// ADMIN MODULES
// ========================================
const { registerAdminCommands } = require('../MainBOT/Command/Admin/adminCommands');
const { registerBanSystem } = require('../MainBOT/Command/Admin/banSystem');
const { registerTicketSystem } = require('../MainBOT/Command/Admin/ticketSystem');

// ========================================
// USER DATA MODULES
// ========================================
const { registerCodeRedemption } = require('../MainBOT/Command/UserData/codeRedemption');

// ========================================
// MAINTENANCE CONFIG
// ========================================
const { maintenance, developerID } = require("./Command/Maintenace/MaintenaceConfig");
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
const commandFolders = fs.readdirSync(path.join(__dirname, 'OtherFunCommand'));
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, 'OtherFunCommand', folder))
        .filter(file => file.endsWith('.js') && file !== 'MainMusic.js');
    
    for (const file of commandFiles) {
        const command = require(path.join(__dirname, 'OtherFunCommand', folder, file));
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
const gacha = require('./Command/Gacha/crategacha');
const fumos = require('./ThyFumoStorage');
const help = require('./Command/Tutorial/help');
const inventory = require('./Command/UserData/Storage');
const balance = require('./Command/UserData/Balance');
const item = require('./Command/UserData/Item');
const Efumos = require('./EventFumoStorage');
const Egacha = require('./Command/Gacha/eventgacha');
const library = require('./Command/FumoData/library');
const libraryFumos = require('./Command/FumoData/libraryFumo');
const inform = require('./Command/FumoData/inform');
const leaderboard = require('./Command/UserData/leaderboard');
const gamble = require('./Command/Gacha/gamble');
const slot = require('./Command/Gacha/slot');
const flip = require('./Command/Gacha/flip');
const mysteryCrate = require('./Command/Gacha/mysterycrate');
const sell = require('./Command/UserData/sell');
const pray = require('./Command/PrayCMD/pray');
const Pfumos = require('./Command/PrayCMD/fumoStorage');
const market = require('./Command/Market/market');
const marketFumos = require('./Command/Market/Storage/marketStorage');
const exchange = require('./Command/Market/exchange');
const shop = require('./Command/Market/shop');
const useItem = require('./Command/UserData/use');
const itemInfo = require('./Command/UserData/itemInfo');
const boost = require('./Command/UserData/boost');
const credit = require('./Command/UserData/aboutBot');
const Pcraft = require('./Command/Craft/potionCraft');
const Icraft = require('./Command/Craft/itemCraft');
const craft = require('./Command/Craft/craft');
const quest = require('./Command/UserData/quest');
const daily = require('./Command/UserData/daily');
const starter = require('./Command/UserData/starter');
const eggshop = require('./Command/Market/eggshop');
const eggInventory = require('./Command/PetData/eggInventory');
const eggOpen = require('./Command/PetData/eggOpen');
const eggcheck = require('./Command/PetData/eggcheck');
const equipPet = require('./Command/PetData/equipPet');
const useFragment = require('./Command/FarmingPhase/useFragment');
const farm = require('./Command/FarmingPhase/addFarm');

// ========================================
// OTHER FUN COMMANDS
// ========================================
const anime = require('./OtherFunCommand/API-Website/Anime/anime');
const afk = require('./OtherFunCommand/BasicCommand/afk');
const musicCommands = require('./OtherFunCommand/MusicFunction/MainMusic');
const reddit = require('./OtherFunCommand/API-Website/Reddit/reddit');
const video = require('./OtherFunCommand/Video/video');

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
