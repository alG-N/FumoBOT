const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../FumoBOT/MainBOT/config.json');
// const afk = require('./MainBOT/OtherFunCommand/afk');
// const anime = require('./MainBOT/OtherFunCommand/anime');

// const commands = [afk.data.toJSON()]; 
// commands.push(anime.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

// chay node deploy-commands.js de update

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // await rest.put(
        //     Routes.applicationGuildCommands(clientId, guildId), // test guild
        //     { body: commands }
        // );

        // await rest.put(
        //     Routes.applicationCommands(clientId), // global
        //     { body: commands }
        // );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// (async () => {
//     try {
//         console.log('Started clearing guild and global commands.');

//         // Clear guild commands
//         await rest.put(
//             Routes.applicationGuildCommands(clientId, guildId),
//             { body: [] }
//         );
//         console.log('✅ Cleared all guild commands.');

//         // Clear global commands
//         await rest.put(
//             Routes.applicationCommands(clientId),
//             { body: [] }
//         );
//         console.log('✅ Cleared all global commands.');

//         console.log('Finished clearing all commands.');
//     } catch (error) {
//         console.error(error);
//     }
// })();
