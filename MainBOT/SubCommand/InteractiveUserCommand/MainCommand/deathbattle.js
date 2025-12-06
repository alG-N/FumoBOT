const { SlashCommandBuilder } = require('discord.js');
const { checkRestrictions } = require('../../../MainCommand/Middleware/restrictions');
const skillsetService = require('../Service/SkillsetService');
const battleService = require('../Service/DeathBattleService/BattleService');
const embedBuilder = require('../Utility/DeathbattleUtility/embedBuilder');
const logger = require('../Utility/DeathbattleUtility/logger');
const { MAX_HP, DEFAULT_HP, COUNTDOWN_SECONDS, ROUND_INTERVAL, BATTLE_LOG_RESET_INTERVAL } = require('../Configuration/Deathbattle/deathBattleConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deathbattle')
        .setDescription('Start a death battle with another user!')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user you want to battle')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('skillset')
                .setDescription('Skill set to use (jjk, naruto)')
                .setRequired(true)
                .addChoices(
                    { name: 'Jujutsu Kaisen', value: 'jjk' },
                    { name: 'Naruto', value: 'naruto' }
                ))
        .addIntegerOption(option =>
            option.setName('your_hp')
                .setDescription(`Your HP (max ${MAX_HP.toLocaleString()})`)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('opponent_hp')
                .setDescription(`Opponent HP (max ${MAX_HP.toLocaleString()})`)
                .setRequired(false)),

    async execute(interaction) {
        try {
            const restriction = checkRestrictions(interaction.user.id);
            if (restriction.blocked) {
                return interaction.reply({ embeds: [restriction.embed], ephemeral: true });
            }

            const opponent = interaction.options.getUser('opponent');
            const player1 = interaction.user;
            const skillsetName = interaction.options.getString('skillset');
            let player1Hp = interaction.options.getInteger('your_hp') || DEFAULT_HP;
            let player2Hp = interaction.options.getInteger('opponent_hp') || player1Hp;

            if (!opponent) {
                return interaction.reply({ 
                    embeds: [embedBuilder.buildErrorEmbed('You need to select someone to battle!')], 
                    ephemeral: true 
                });
            }

            if (!skillsetService.isValidSkillset(skillsetName)) {
                return interaction.reply({ 
                    embeds: [embedBuilder.buildErrorEmbed(`Invalid skillset! Available: ${skillsetService.getAllSkillsets().join(', ')}`)], 
                    ephemeral: true 
                });
            }

            if (opponent.id === player1.id) {
                return interaction.reply({ 
                    embeds: [embedBuilder.buildErrorEmbed('You cannot fight yourself!')], 
                    ephemeral: true 
                });
            }

            if (player1Hp > MAX_HP || player2Hp > MAX_HP) {
                return interaction.reply({ 
                    embeds: [embedBuilder.buildErrorEmbed(`HP too high! Max is ${MAX_HP.toLocaleString()}.`)], 
                    ephemeral: true 
                });
            }

            const battle = battleService.createBattle(
                interaction.guild.id,
                player1,
                opponent,
                skillsetName,
                player1Hp,
                player2Hp
            );

            logger.log(`Battle started: ${player1.tag} vs ${opponent.tag} (${skillsetName})`, interaction);

            let countdown = COUNTDOWN_SECONDS;
            let battleEmbed = embedBuilder.buildCountdownEmbed(battle, countdown);

            await interaction.reply({ embeds: [battleEmbed] });
            const message = await interaction.fetchReply();

            const countdownInterval = setInterval(async () => {
                countdown--;
                battleEmbed = embedBuilder.buildCountdownEmbed(battle, countdown);
                await interaction.editReply({ embeds: [battleEmbed] });
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    battle.battleLog = `⚔️ **Round 1**: The battle between **${battle.player1.username}** and **${battle.player2.username}** begins!\n`;
                    startBattle(battle, interaction);
                }
            }, 1000);

            async function startBattle(battle, interaction) {
                battleEmbed = embedBuilder.buildBattleEmbed(battle);
                await interaction.editReply({ embeds: [battleEmbed] });

                battle.interval = setInterval(async () => {
                    if (battle.player1Health <= 0 || battle.player2Health <= 0) {
                        clearInterval(battle.interval);
                        
                        let winnerMsg = '';
                        if (battle.player1Health <= 0 && battle.player2Health <= 0) {
                            winnerMsg = `\n**It's a draw!**`;
                            logger.log(`Battle ended in draw`, interaction);
                        } else if (battle.player1Health <= 0) {
                            winnerMsg = `\n**${battle.player2.username} wins the battle!**`;
                            logger.log(`Battle won by ${battle.player2.tag}`, interaction);
                        } else {
                            winnerMsg = `\n**${battle.player1.username} wins the battle!**`;
                            logger.log(`Battle won by ${battle.player1.tag}`, interaction);
                        }
                        
                        battle.battleLog += winnerMsg;
                        battleEmbed = embedBuilder.buildBattleEmbed(battle);
                        battleEmbed.setFooter({ text: 'Battle finished!' });
                        await interaction.editReply({ embeds: [battleEmbed] });
                        
                        battleService.removeBattle(interaction.guild.id);
                        return;
                    }

                    if (battle.roundCount % BATTLE_LOG_RESET_INTERVAL === 0) {
                        battle.battleLog = `⚔️ **Battle Continues - Round ${battle.roundCount}** ⚔️\n\n`;
                    }

                    if (battle.roundCount % 2 !== 0) {
                        if (!battle.player1Stunned) {
                            let log = battleService.dealDamage(battle, true);
                            battle.battleLog += `**Round ${battle.roundCount}**: ${log}\n`;
                        } else {
                            battle.battleLog += `**Round ${battle.roundCount}**: **${battle.player1.username}** was stunned and couldn't attack!\n`;
                            battle.player1Stunned = false;
                        }
                    } else {
                        if (battle.player2Stunned) {
                            battle.battleLog += `**Round ${battle.roundCount}**: **${battle.player2.username}** was stunned and couldn't attack!\n`;
                            battle.player2Stunned = false;
                        } else if (!battle.player1Immune) {
                            let log = battleService.dealDamage(battle, false);
                            battle.battleLog += `**Round ${battle.roundCount}**: ${log}\n`;
                        } else {
                            battle.battleLog += `**Round ${battle.roundCount}**: **${battle.player1.username}** was immune to all attacks this round!\n`;
                            battle.player1Immune = false;
                        }
                    }

                    const effectLogs = battleService.handleEffects(battle);
                    effectLogs.forEach(log => battle.battleLog += `${log}\n`);

                    battleEmbed = embedBuilder.buildBattleEmbed(battle);
                    await interaction.editReply({ embeds: [battleEmbed] });

                    battle.roundCount++;
                }, ROUND_INTERVAL);
            }

        } catch (err) {
            logger.error(`DeathBattle command error: ${err.message}`, interaction);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    embeds: [embedBuilder.buildErrorEmbed('An error occurred while starting the battle. Please try again later.')], 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    embeds: [embedBuilder.buildErrorEmbed('An error occurred while starting the battle. Please try again later.')], 
                    ephemeral: true 
                });
            }
        }
    }
};