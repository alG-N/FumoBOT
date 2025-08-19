const path = require('path');
const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../FumoBOT/MainBOT/config.json');

// Collect commands here
const commands = [];

// Require each command file
const sayCommand = require('../FumoBOT/MainBOT/BotTrollinCommand(Owner)/say.js');
const afkCommand = require('../FumoBOT/MainBOT/OtherFunCommand/afk');
const animeCommand = require('../FumoBOT/MainBOT/OtherFunCommand/anime');

// Push commands if valid
if ('data' in sayCommand && 'execute' in sayCommand) {
    commands.push(sayCommand.data.toJSON());
} else {
    console.warn('⚠️ say.js is missing "data" or "execute".');
}

if ('data' in afkCommand && 'execute' in afkCommand) {
    commands.push(afkCommand.data.toJSON());
} else {
    console.warn('⚠️ afk.js is missing "data" or "execute".');
}

if ('data' in animeCommand && 'execute' in animeCommand) {
    commands.push(animeCommand.data.toJSON());
} else {
    console.warn('⚠️ anime.js is missing "data" or "execute".');
}

// REST client
const rest = new REST({ version: '10' }).setToken(token);

// Deploy commands
(async () => {
    try {
        console.log('🔄 Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), // use guild deploy for testing
            { body: commands }
        );

        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
