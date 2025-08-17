const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.setMaxListeners(150);
function formatNumber(num) {
    if (num < 1e3) return num.toString(); // Less than 1000
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let index = -1;

    do {
        num /= 1e3;
        index++;
    } while (num >= 1e3 && index < units.length - 1);

    return num.toFixed(1) + ' ' + units[index];
}
const { maintenance, developerID } = require("../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../Command/Banned/BanUtils.js');
module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (!message.content.startsWith('.deathbattle')) return;

            // Check for maintenance mode or ban
            const banData = isBanned(message.author.id);
            if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
                let description = '';
                let footerText = '';

                if (maintenance === "yes" && message.author.id !== developerID) {
                    description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                    footerText = "Thank you for your patience";
                } else if (banData) {
                    description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                    if (banData.expiresAt) {
                        const remaining = banData.expiresAt - Date.now();
                        const seconds = Math.floor((remaining / 1000) % 60);
                        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                        const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

                        const timeString = [
                            days ? `${days}d` : '',
                            hours ? `${hours}h` : '',
                            minutes ? `${minutes}m` : '',
                            seconds ? `${seconds}s` : ''
                        ].filter(Boolean).join(' ');

                        description += `\n**Time Remaining:** ${timeString}`;
                    } else {
                        description += `\n**Ban Type:** Permanent`;
                    }

                    footerText = "Ban enforced by developer";
                }

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                    .setDescription(description)
                    .setFooter({ text: footerText })
                    .setTimestamp();

                console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

                return message.reply({ embeds: [embed] });
            }

            const args = message.content.trim().split(/\s+/).slice(1);
            const opponent = message.mentions.users.first();
            const player1 = message.author;

            if (!opponent) return message.reply('You need to ping someone to battle!');
            if (!args.includes('jjk')) return message.reply('You must include the skill set "jjk" to start the battle! Example: .deathbattle @username [your-hp] [opponent-hp] jjk');
            if (opponent.id === player1.id) return message.reply('You cannot fight yourself!');

            // HP setup (user can set their own and opponent's HP, max 1,000,000)
            let player1Hp = 150, player2Hp = 150;
            let skill = 'free skill';
            // args: [@user] [your-hp] [opponent-hp] jjk
            if (args.length >= 3 && !isNaN(parseInt(args[1])) && !isNaN(parseInt(args[2]))) {
                player1Hp = Math.min(parseInt(args[1]), 1000000);
                player2Hp = Math.min(parseInt(args[2]), 1000000);
                if (parseInt(args[1]) > 1000000 || parseInt(args[2]) > 1000000) return message.reply('HP too high! Max is 1,000,000.');
                skill = args[3] && args[3].toLowerCase() === 'jjk' ? 'jjk' : 'free skill';
            } else if (args.length >= 2 && !isNaN(parseInt(args[1]))) {
                player1Hp = Math.min(parseInt(args[1]), 1000000);
                player2Hp = player1Hp;
                if (parseInt(args[1]) > 1000000) return message.reply('HP too high! Max is 1,000,000.');
                skill = args[2] && args[2].toLowerCase() === 'jjk' ? 'jjk' : 'free skill';
            } else if (args[1] && args[1].toLowerCase() === 'jjk') {
                skill = 'jjk';
            }

            let player1Health = player1Hp;
            let player2Health = player2Hp;
            let roundCount = 1;
            let player1Stunned = false, player2Stunned = false;
            let player1Immune = false, player2Immune = false;
            let usedJJKPowers = [];
            let effects = {
                user1: { shrine: 0, speech: 1, speechTurns: 0, binding: false, beam: 0, burn: 0, slow: 0, lightning: 0 },
                user2: { shrine: 0, speech: 1, speechTurns: 0, binding: false, beam: 0, burn: 0, slow: 0, lightning: 0 }
            };

            // Balanced & lore-accurate JJK skills, with new skills from other characters
            const jjkPowers = [
                // Gojo Satoru
                { name: 'hollow purple', char: 'Gojo', type: 'damage', scale: 0.22, desc: 'Hollow Purple' },
                { name: 'infinity', char: 'Gojo', type: 'stun', scale: 0.10, desc: 'Infinity' },
                // Itadori Yuji
                { name: 'black flash', char: 'Itadori', type: 'damage', scale: 0.13, desc: 'Black Flash' },
                // Fushiguro Megumi
                { name: 'summon mahoraga', char: 'Fushiguro', type: 'damage', scale: 0.14, desc: 'Summon Mahoraga' },
                { name: 'seven shadows', char: 'Fushiguro', type: 'random', scale: 0.09, desc: 'Shikigami: Seven Shadows' },
                // Sukuna
                { name: 'malevolent shrine', char: 'Sukuna', type: 'dot', scale: 0.05, turns: 4, desc: 'Malevolent Shrine' },
                { name: 'world cutting slash', char: 'Sukuna', type: 'damage', scale: 0.16, desc: 'World Cutting Slash' },
                // Yuta Okkotsu
                { name: 'cursed speech', char: 'Inumaki', type: 'debuff', scale: 0.09, debuff: 0.7, turns: 2, desc: 'Cursed Speech' },
                { name: 'reverse cursed energy', char: 'Yuta', type: 'heal', scale: 0.10, desc: 'Reverse Cursed Energy' },
                // Todo Aoi
                { name: 'boogie woogie', char: 'Todo', type: 'swap', scale: 0.11, desc: 'Boogie Woogie' },
                // Nanami Kento
                { name: 'ratio technique', char: 'Nanami', type: 'damage', scale: 0.12, desc: 'Ratio Technique' },
                // Hakari Kinji
                { name: 'idle death gamble', char: 'Hakari', type: 'gamble', scale: 0.13, desc: 'Idle Death Gamble' },
                // Kashimo Hajime
                { name: 'lightning', char: 'Kashimo', type: 'charge', scale: 0.30, charges: 2, desc: 'Lightning' },
                // Jogo
                { name: 'burn', char: 'Jogo', type: 'dot', scale: 0.07, turns: 2, desc: 'Burn' },
                // Uraume
                { name: 'ice formation', char: 'Uraume', type: 'slow', scale: 0.09, turns: 2, desc: 'Ice Formation' },
                // Choso
                { name: 'blood manipulation', char: 'Choso', type: 'damage', scale: 0.11, desc: 'Blood Manipulation' },
                // Maki Zenin
                { name: 'heavenly restriction', char: 'Maki', type: 'buff', heal: true, boost: 1.3, desc: 'Heavenly Restriction' },
                // Yuki Tsukumo
                { name: 'star rage', char: 'Yuki', type: 'sacrifice', scale: 0.4, self: 0.25, desc: 'Star Rage' },
                // Mahito
                { name: 'soul transformation', char: 'Mahito', type: 'damage', scale: 0.10, desc: 'Soul Transformation' },
                // Geto Suguru
                { name: 'cursed spirit manipulation', char: 'Geto', type: 'random', scale: 0.10, desc: 'Cursed Spirit Manipulation' },
                // Shoko Ieiri
                { name: 'medical technique', char: 'Shoko', type: 'heal', scale: 0.08, desc: 'Medical Technique' }
            ];

            function getRandomPower() {
                if (usedJJKPowers.length >= jjkPowers.length) usedJJKPowers = [];
                let available = jjkPowers.filter(p => !usedJJKPowers.includes(p.name));
                let selected = available[Math.floor(Math.random() * available.length)];
                usedJJKPowers.push(selected.name);
                return selected;
            }

            function calculateDamage(base, hp, debuff = 1, boost = 1) {
                // Balanced scaling for all HP ranges
                let scale = 1;
                if (hp > 1000000) scale = 3.5;
                else if (hp > 100000) scale = 2.5;
                else if (hp > 10000) scale = 1.7;
                else if (hp > 1000) scale = 1.2;
                else if (hp > 100) scale = 1;
                else scale = 0.7;
                return Math.floor(base * scale * debuff * boost);
            }

            function dealDamage(attacker, defender, attackerHp, defenderHp, isUser1) {
                let log = '', damage = 0;
                let atkEff = isUser1 ? effects.user1 : effects.user2;
                let defEff = isUser1 ? effects.user2 : effects.user1;
                let bindingBoost = atkEff.binding ? 1.3 : 1;
                let debuff = defEff.speech;

                let power = getRandomPower();

                switch (power.type) {
                    case 'damage':
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 15, defenderHp, debuff, bindingBoost);
                        log = `${attacker.username} used ${power.desc} and dealt **${damage}** damage to ${defender.username}!`;
                        break;
                    case 'debuff':
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                        defEff.speech = power.debuff;
                        defEff.speechTurns = power.turns;
                        log = `${attacker.username} used ${power.desc}, dealt **${damage}** damage and applied a defense debuff for ${power.turns} turns!`;
                        break;
                    case 'stun':
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                        if (isUser1) player2Stunned = true; else player1Stunned = true;
                        log = `${attacker.username} used ${power.desc}, stunned the opponent and dealt **${damage}** damage!`;
                        break;
                    case 'gamble':
                        if (Math.random() < 0.5) {
                            atkEff.immune = true;
                            log = `${attacker.username} won Idle Death Gamble and is immune this round!`;
                        } else {
                            damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                            log = `${attacker.username} lost Idle Death Gamble and dealt **${damage}** damage to ${defender.username}!`;
                        }
                        break;
                    case 'heal':
                        let heal = Math.floor(attackerHp * power.scale);
                        if (isUser1) player1Health = Math.min(player1Health + heal, player1Hp);
                        else player2Health = Math.min(player2Health + heal, player2Hp);
                        log = `${attacker.username} used ${power.desc} and healed for **${heal}** HP!`;
                        break;
                    case 'dot':
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                        if (isUser1) defEff[power.desc.includes('Burn') ? 'burn' : 'shrine'] = power.turns;
                        else atkEff[power.desc.includes('Burn') ? 'burn' : 'shrine'] = power.turns;
                        log = `${attacker.username} used ${power.desc}, dealt **${damage}** damage and applied a DoT for ${power.turns} turns!`;
                        break;
                    case 'buff':
                        if (!atkEff.binding) {
                            atkEff.binding = true;
                            if (isUser1) player1Health = player1Hp;
                            else player2Health = player2Hp;
                            log = `${attacker.username} used ${power.desc}! Fully healed and damage increased for the rest of the battle!`;
                        } else {
                            log = `${attacker.username} tried to use ${power.desc} again, but it can only be used once!`;
                        }
                        break;
                    case 'random':
                        let summonNames = [];
                        if (power.name === 'seven shadows') {
                            summonNames = ['Divine Dog', 'Nue', 'Great Serpent', 'Toad', 'Max Elephant', 'Rabbit Escape', 'Black Divine Dog'];
                        } else if (power.name === 'cursed spirit manipulation') {
                            summonNames = ['Rika', 'Tamamo-no-Mae', 'Rainbow Dragon', 'Smallpox Deity', 'Fly Heads'];
                        } else {
                            summonNames = ['Unknown Spirit'];
                        }
                        let summon = summonNames[Math.floor(Math.random() * summonNames.length)];
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                        log = `${attacker.username} summoned ${summon} with ${power.desc}, dealing **${damage}** damage to ${defender.username}!`;
                        break;
                    case 'charge':
                        if (atkEff.lightning < power.charges - 1) {
                            atkEff.lightning++;
                            log = `${attacker.username} is charging Lightning (${atkEff.lightning}/${power.charges})!`;
                        } else {
                            atkEff.lightning = 0;
                            damage = calculateDamage(Math.floor(defenderHp * power.scale) + 25, defenderHp, debuff, bindingBoost);
                            if (isUser1) player2Stunned = true; else player1Stunned = true;
                            log = `${attacker.username} unleashed Lightning and dealt **${damage}** damage, stunning ${defender.username}!`;
                        }
                        break;
                    case 'slow':
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                        defEff.slow = power.turns;
                        log = `${attacker.username} used ${power.desc}, dealt **${damage}** damage and slowed ${defender.username} for ${power.turns} rounds!`;
                        break;
                    case 'sacrifice':
                        damage = Math.floor(defenderHp * power.scale);
                        let selfDmg = Math.floor(attackerHp * power.self);
                        if (isUser1) player1Health = Math.max(0, player1Health - selfDmg);
                        else player2Health = Math.max(0, player2Health - selfDmg);
                        log = `${attacker.username} used ${power.desc}, dealt **${damage}** to ${defender.username} and took **${selfDmg}** self-damage!`;
                        break;
                    case 'swap':
                        damage = calculateDamage(Math.floor(defenderHp * power.scale) + 10, defenderHp, debuff, bindingBoost);
                        // Swap HP for fun
                        let temp = player1Health;
                        player1Health = player2Health;
                        player2Health = temp;
                        log = `${attacker.username} used ${power.desc}, swapped HP with ${defender.username} and dealt **${damage}** damage!`;
                        break;
                    default:
                        damage = calculateDamage(Math.floor(defenderHp * 0.10) + 10, defenderHp, debuff, bindingBoost);
                        log = `${attacker.username} used a combo attack and dealt **${damage}** damage to ${defender.username}!`;
                }
                return { damage, log };
            }

            // Battle log and embed
            let battleLog = `⚔️ The battle between **${player1.username}** and **${opponent.username}** begins! ⚔️\n\n`;
            let countdown = 5;
            let battleEmbed = new EmbedBuilder()
                .setTitle('⚔️ Death-Battle ⚔️')
                .setDescription(`⏳ Battle begins in **${countdown}** seconds!`)
                .setColor('#ff0000')
                .addFields(
                    { name: `${player1.username}'s HP`, value: `${player1Health} HP`, inline: true },
                    { name: `${opponent.username}'s HP`, value: `${player2Health} HP`, inline: true }
                )
                .setThumbnail('https://steamuserimages-a.akamaihd.net/ugc/5107676531909210294/7A14253B35558071FBE17AD6F27C6158D078960C/?imw=5000&imh=5000&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false')
                .setFooter({ text: 'Get ready for an epic showdown!' });

            let battleMessage = await message.channel.send({ embeds: [battleEmbed] });

            const countdownInterval = setInterval(async () => {
                try {
                    countdown--;
                    battleEmbed.setDescription(`⏳ Battle begins in **${countdown}** seconds!`);
                    await battleMessage.edit({ embeds: [battleEmbed] });
                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        battleLog += `⚔️ **Round 1**: The battle between **${player1.username}** and **${opponent.username}** begins!\n`;
                        startBattle();
                    }
                } catch (err) {
                    console.error('Countdown interval error:', err);
                    clearInterval(countdownInterval);
                }
            }, 1000);

            async function startBattle() {
                battleEmbed.setDescription(battleLog)
                    .setFooter({ text: 'Who will win? Place your bet.', iconURL: client.user.displayAvatarURL() });
                await battleMessage.edit({ embeds: [battleEmbed] });

                const interval = setInterval(async () => {
                    try {
                        if (player1Health <= 0 || player2Health <= 0) {
                            clearInterval(interval);
                            let winnerMsg = '';
                            if (player1Health <= 0 && player2Health <= 0) winnerMsg = `\n**It's a draw!**`;
                            else if (player1Health <= 0) winnerMsg = `\n**${opponent.username} wins the battle!**`;
                            else winnerMsg = `\n**${player1.username} wins the battle!**`;
                            battleLog += winnerMsg;
                            battleEmbed.setDescription(battleLog)
                                .setFooter({ text: 'Battle finished!', iconURL: client.user.displayAvatarURL() });
                            await battleMessage.edit({ embeds: [battleEmbed] });
                            return;
                        }

                        // Reset log every 8 rounds for readability
                        if (roundCount % 8 === 0) battleLog = `⚔️ **Battle Continues - Round ${roundCount}** ⚔️\n\n`;

                        // Turn logic
                        if (roundCount % 2 !== 0) {
                            // Player 1's turn
                            if (!player1Stunned) {
                                let result = dealDamage(player1, opponent, player1Health, player2Health, true);
                                player2Health = Math.max(0, player2Health - result.damage);
                                battleLog += `**Round ${roundCount}**: ${result.log}\n`;
                            } else {
                                battleLog += `**Round ${roundCount}**: **${player1.username}** was stunned and couldn't attack!\n`;
                                player1Stunned = false;
                            }
                        } else {
                            // Player 2's turn
                            if (player2Stunned) {
                                battleLog += `**Round ${roundCount}**: **${opponent.username}** was stunned and couldn't attack!\n`;
                                player2Stunned = false;
                            } else if (!player1Immune) {
                                let result = dealDamage(opponent, player1, player2Health, player1Health, false);
                                player1Health = Math.max(0, player1Health - result.damage);
                                battleLog += `**Round ${roundCount}**: ${result.log}\n`;
                            } else {
                                battleLog += `**Round ${roundCount}**: **${player1.username}** was immune to all attacks this round!\n`;
                                player1Immune = false;
                            }
                        }

                        // Handle effects
                        function handleEffects() {
                            // Malevolent Shrine
                            if (effects.user1.shrine > 0) {
                                let dmg = Math.max(Math.floor(player2Hp * 0.05), 1);
                                player2Health = Math.max(0, player2Health - dmg);
                                battleLog += `**Malevolent Shrine**: Dealt **${dmg}** damage to **${opponent.username}**!\n`;
                                effects.user1.shrine--;
                            }
                            if (effects.user2.shrine > 0) {
                                let dmg = Math.max(Math.floor(player1Hp * 0.05), 1);
                                player1Health = Math.max(0, player1Health - dmg);
                                battleLog += `**Malevolent Shrine**: Dealt **${dmg}** damage to **${player1.username}**!\n`;
                                effects.user2.shrine--;
                            }
                            // Burn
                            if (effects.user1.burn > 0) {
                                let burnDmg = Math.floor(player1Hp * 0.035);
                                player1Health = Math.max(0, player1Health - burnDmg);
                                battleLog += `**Burn**: **${opponent.username}** dealt **${burnDmg}** burn damage to **${player1.username}**!\n`;
                                effects.user1.burn--;
                            }
                            if (effects.user2.burn > 0) {
                                let burnDmg = Math.floor(player2Hp * 0.035);
                                player2Health = Math.max(0, player2Health - burnDmg);
                                battleLog += `**Burn**: **${player1.username}** dealt **${burnDmg}** burn damage to **${opponent.username}**!\n`;
                                effects.user2.burn--;
                            }
                            // Cursed Speech debuff
                            if (effects.user1.speechTurns > 0) {
                                effects.user1.speechTurns--;
                                if (effects.user1.speechTurns === 0) effects.user1.speech = 1;
                            }
                            if (effects.user2.speechTurns > 0) {
                                effects.user2.speechTurns--;
                                if (effects.user2.speechTurns === 0) effects.user2.speech = 1;
                            }
                        }
                        handleEffects();

                        // Update embed
                        battleEmbed.setDescription(battleLog)
                            .spliceFields(0, 2,
                                { name: `${player1.username}'s HP`, value: `${player1Health > 0 ? player1Health : 0} HP`, inline: true },
                                { name: `${opponent.username}'s HP`, value: `${player2Health > 0 ? player2Health : 0} HP`, inline: true }
                            );
                        await battleMessage.edit({ embeds: [battleEmbed] });

                        roundCount++;
                    } catch (err) {
                        console.error('Battle interval error:', err);
                        clearInterval(interval);
                        battleEmbed.setDescription('⚠️ An error occurred during the battle. Please try again later.');
                        await battleMessage.edit({ embeds: [battleEmbed] });
                    }
                }, 3500);
            }
        } catch (err) {
            console.error('Deathbattle command error:', err);
            message.reply('⚠️ An error occurred while starting the battle. Please try again later.');
        }
    });
};
