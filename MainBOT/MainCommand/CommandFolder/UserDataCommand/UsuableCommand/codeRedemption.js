const { EmbedBuilder, Events } = require('discord.js');
const db = require('../../../Core/Database/dbSetting');

const validCodes = {
    "Welcome": {
        coins: 10000,
        gems: 500,
        expires: null,
        maxUses: null,
        description: "A warm welcome gift for new users!"
    },
    "BugFix": {
        items: [
            { item: "alGShard(P)", quantity: 1 },
            { item: "ShinyShard(?)", quantity: 10 }
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Updated server lets gooo!"
    },
    "BetaTest3322": {
        items: [
            { item: "Lumina(M)", quantity: 150 },
            { item: "ForgottenBook(C)", quantity: 500 },
            { item: "RedShard(L)", quantity: 150 },
            { item: "WhiteShard(L)", quantity: 150 },
            { item: "YellowShard(L)", quantity: 150 },
            { item: "BlueShard(L)", quantity: 150 },
            { item: "DarkShard(L)", quantity: 150 },
            { item: "AncientRelic(E)", quantity: 150 },
            { item: "FragmentOf1800s(R)", quantity: 150 },
            { item: "Nullified(?)", quantity: 150 },
            { item: "HakureiTicket(L)", quantity: 150 },
            { item: "TimeClock(L)", quantity: 150 },
            { item: "MysteriousDice(M)", quantity: 150 },
            { item: "PrayTicket(R)", quantity: 150 },
        ],
        expires: "2025-12-31T23:59:59Z",
        maxUses: null,
        description: "Beta tester exclusive!"
    },
    "golden_exist": {
        coins: 99999,
        gems: 9999,
        expires: null,
        maxUses: 1,
        description: "Only the first to find this gets the gold!"
    },
    "JACKPOT": {
        coins: 7777,
        gems: 777,
        expires: null,
        maxUses: null,
        description: "Lucky jackpot code!"
    },
};

const ADMIN_IDS = ['1128296349566251068', '1362450043939979378'];

function formatReward(reward) {
    let parts = [];
    if (reward.coins) parts.push(`🪙 **${reward.coins.toLocaleString()} coins**`);
    if (reward.gems) parts.push(`💎 **${reward.gems.toLocaleString()} gems**`);
    if (reward.items) {
        reward.items.forEach(({ item, quantity }) => {
            parts.push(`🎁 **${item}** x${quantity}`);
        });
    }
    return parts.length ? parts.join('\n') : "*No reward data*";
}

function logCodeError(context, error) {
    console.error(`[CodeRedemption] ${context}:`, error);
}

async function handleCodeInfo(message) {
    const isAdmin = ADMIN_IDS.includes(message.author.id);
    let codeList = '';
    
    if (isAdmin) {
        codeList = '\n\n**Active Codes:**\n' +
            Object.entries(validCodes)
                .filter(([k, v]) => !v.expires || new Date(v.expires) > new Date())
                .map(([k, v]) => `\`${k}\` - ${v.description || 'No description'}`)
                .join('\n');
    }

    const embed = new EmbedBuilder()
        .setTitle('🎁 Code Redemption System')
        .setDescription(
            '🎉 **Welcome to the Code Redemption System!** 🎉\n\n' +
            'Find secret codes around the bot and enter them to claim amazing rewards! 🏆💎\n\n' +
            '**How it works:**\n' +
            '1️⃣ **Find a code** hidden in various parts of the bot.\n' +
            '2️⃣ **Enter** the code using `.code <code>`.\n' +
            '3️⃣ **Enjoy** your rewards!\n\n' +
            (isAdmin ? `${codeList}\n\n` : '') +
            'Good luck and have fun! 🤩'
        )
        .setColor(0xFFD700)
        .setThumbnail('https://static.wikia.nocookie.net/nicos-nextbots-fanmade/images/f/f4/Bottled_cirno.png/revision/latest?cb=20240125031826')
        .setImage('https://media.istockphoto.com/id/520327210/photo/young-boy-finding-treasure.jpg?s=612x612&w=0&k=20&c=Q3PcIngIESMXeXofRLnWwq1wwMO3VmznA9T2Mg1gt2I=')
        .setFooter({ text: 'Remember: Each code can only be used once!', iconURL: 'https://gcdn.thunderstore.io/live/repository/icons/FraDirahra-Fumo_Cirno-1.0.0.png.256x256_q95.png' })
        .setTimestamp();

    return message.channel.send({ embeds: [embed] });
}

async function handleCodeRedemption(message, code) {
    const reward = validCodes[code];
    const userId = message.author.id;
    const currentDate = new Date().toISOString();

    if (!reward) {
        const embed = new EmbedBuilder()
            .setTitle('Invalid Code')
            .setDescription('The code you entered is invalid. Please try again.')
            .setColor(0xFF0000)
            .setFooter({ text: 'Check your spelling and try again!' });
        return message.channel.send({ embeds: [embed] });
    }

    if (reward.expires && new Date() > new Date(reward.expires)) {
        return message.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('⏰ Code Expired')
                .setDescription(`Sorry, the code **${code}** has expired.`)
                .setColor(0xFFA500)
            ]
        });
    }

    if (reward.maxUses) {
        try {
            const redeemedCount = await new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as count FROM redeemedCodes WHERE code = ?`, [code], (err, row) => {
                    if (err) return reject(err);
                    resolve(row.count);
                });
            });
            if (redeemedCount >= reward.maxUses) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🚫 Code Limit Reached')
                        .setDescription(`Sorry, the code **${code}** has already been fully redeemed.`)
                        .setColor(0xFF0000)
                    ]
                });
            }
        } catch (err) {
            logCodeError('Checking code usage limit', err);
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('Error')
                    .setDescription('Could not verify code usage. Please try again later.')
                    .setColor(0xFF0000)
                ]
            });
        }
    }

    try {
        const redeemedRow = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM redeemedCodes WHERE userId = ? AND code = ?`, [userId, code], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        if (redeemedRow) {
            const embed = new EmbedBuilder()
                .setTitle('Code Already Redeemed')
                .setDescription(`You have already redeemed the code **${code}**. Each code can only be used once.`)
                .setColor(0xFF4500);
            return message.channel.send({ embeds: [embed] });
        }

        await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', err => err ? reject(err) : resolve()));
        try {
            if (reward.coins || reward.gems) {
                const coinsRow = await new Promise((resolve, reject) => {
                    db.get(`SELECT * FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    });
                });
                if (coinsRow) {
                    await new Promise((resolve, reject) => {
                        db.run(`UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
                            [reward.coins || 0, reward.gems || 0, userId], err => {
                                if (err) return reject(err);
                                resolve();
                            });
                    });
                } else {
                    await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO userCoins (userId, coins, gems, joinDate) VALUES (?, ?, ?, ?)`,
                            [userId, reward.coins || 0, reward.gems || 0, currentDate], err => {
                                if (err) return reject(err);
                                resolve();
                            });
                    });
                }
            }

            if (reward.items && Array.isArray(reward.items)) {
                for (const { item, quantity } of reward.items) {
                    const itemRow = await new Promise((resolve, reject) => {
                        db.get(`SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, item], (err, row) => {
                            if (err) return reject(err);
                            resolve(row);
                        });
                    });
                    if (itemRow) {
                        await new Promise((resolve, reject) => {
                            db.run(`UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                                [quantity, userId, item], err => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                        });
                    } else {
                        await new Promise((resolve, reject) => {
                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
                                [userId, item, quantity], err => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                        });
                    }
                }
            }

            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO redeemedCodes (userId, code) VALUES (?, ?)`, [userId, code], err => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            await new Promise((resolve, reject) => db.run('COMMIT', err => err ? reject(err) : resolve()));
        } catch (err) {
            await new Promise((resolve, reject) => db.run('ROLLBACK', () => resolve()));
            throw err;
        }

        const rewardMsg = formatReward(reward);
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Code Redeemed!')
            .setDescription(`You've received:\n${rewardMsg}`)
            .setColor(0x00FF00)
            .setFooter({ text: 'Enjoy your rewards!' });
        message.channel.send({ embeds: [successEmbed] });

        try {
            await message.author.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🎁 Code Redemption Receipt')
                        .setDescription(`You redeemed code: **${code}**\n\n${rewardMsg}`)
                        .setColor(0x00FF00)
                        .setTimestamp()
                ]
            });
        } catch (dmErr) {
        }

    } catch (error) {
        logCodeError('Redeeming code', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('Something went wrong. Please try again later.')
            .setColor(0xFF0000);
        message.channel.send({ embeds: [errorEmbed] });
    }
}

function registerCodeRedemption(client) {
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        if (message.content === '.code') {
            return handleCodeInfo(message);
        }

        if (message.content.startsWith('.code ')) {
            const code = message.content.split(' ')[1]?.trim();
            if (code) {
                return handleCodeRedemption(message, code);
            }
        }
    });
}

module.exports = {
    registerCodeRedemption,
    validCodes,
    formatReward
};