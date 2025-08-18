const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../FumoBOT/MainBOT/config.json');
const afk = require('./MainBOT/OtherFunCommand/afk');

const commands = [afk.data.toJSON()]; 

const rest = new REST({ version: '10' }).setToken(token);

// chay node deploy-commands.js de update

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), // test guild
            { body: commands }
        );

        // await rest.put(
        //     Routes.applicationCommands(clientId), // global
        //     { body: commands }
        // );

        // await rest.put(
        //     Routes.applicationGuildCommands(clientId, guildId),
        //     { body: [] }
        // );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
