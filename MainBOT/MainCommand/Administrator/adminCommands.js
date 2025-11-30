const { EmbedBuilder } = require('discord.js');
const db = require('../Core/Database/dbSetting');

const ALLOWED_ADMINS = ['1128296349566251068', '1362450043939979378'];

/**
 * Admin command: .reset
 * Resets all user data for the command issuer
 */
async function handleReset(message) {
    const userId = message.author.id;

    if (!ALLOWED_ADMINS.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Access Denied')
                    .setDescription('❌ You do not have permission to use this command.')
            ]
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ Confirm Data Reset')
        .setDescription(
            '**Are you sure you want to reset ALL your data?**\nThis includes:\n- Coins\n- Inventory\n- Upgrades\n- Quests\n- Exchange History\n\nType `yes` to confirm within `15 seconds`.'
        );

    await message.channel.send({ embeds: [confirmEmbed] });

    const filter = (response) =>
        response.author.id === userId && response.content.toLowerCase() === 'yes';

    try {
        await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 15000,
            errors: ['time'],
        });

        db.serialize(() => {
            const tables = [
                'userCoins', 'redeemedCodes', 'farmingFumos', 'userUsage',
                'userInventory', 'userUpgrades', 'userBalance', 'dailyQuests',
                'userExchangeLimits', 'exchangeHistory', 'activeBoosts', 'sakuyaUsage',
                'dailyQuestProgress', 'weeklyQuestProgress', 'achievementProgress',
                'petInventory', 'hatchingEggs', 'equippedPets', 'userSales'
            ];

            tables.forEach(table => {
                db.run(`DELETE FROM ${table} WHERE userId = ?`, [userId]);
            });

            db.run(`DELETE FROM userSales WHERE userId = ?`, [userId], function (err) {
                if (err) {
                    console.error('Reset error:', err.message);
                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('⚠ Error')
                                .setDescription('Something went wrong while resetting your data. Please try again later.')
                        ]
                    });
                }

                const successEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('✅ Data Reset Complete')
                    .setDescription('All your user data has been successfully wiped from the system.');

                message.reply({ embeds: [successEmbed] });
            });
        });
    } catch (error) {
        const timeoutEmbed = new EmbedBuilder()
            .setColor('Grey')
            .setTitle('⏰ Timed Out')
            .setDescription('You did not confirm in time. Your data has **not** been reset.');

        message.reply({ embeds: [timeoutEmbed] });
    }
}

/**
 * Admin command: .resetbalance
 * Resets coins and gems to 0
 */
async function handleResetBalance(message) {
    const userId = message.author.id;

    if (!ALLOWED_ADMINS.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ Confirm Coin & Gem Reset')
        .setDescription('Are you sure you want to reset your **coins and gems to 0**?\n\nType `yes` within 15 seconds to confirm.');

    await message.channel.send({ embeds: [confirmEmbed] });

    const filter = (response) =>
        response.author.id === userId && response.content.toLowerCase() === 'yes';

    try {
        await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 15000,
            errors: ['time'],
        });

        db.run(`UPDATE userCoins SET coins = 0, gems = 0 WHERE userId = ?`, [userId], function (err) {
            if (err) {
                console.error('Coin reset error:', err.message);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('⚠ Error')
                            .setDescription('Something went wrong while resetting your coins and gems.')
                    ]
                });
            }

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Balance Reset')
                .setDescription('Your **coins and gems** have been successfully reset to 0.');

            message.reply({ embeds: [successEmbed] });
        });
    } catch {
        const timeoutEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('⏰ Timed Out')
            .setDescription("You didn't confirm in time. Coins and gems were **not** reset.");

        message.reply({ embeds: [timeoutEmbed] });
    }
}

/**
 * Admin command: .addbalance
 * Sets coins and gems to 1 billion
 */
async function handleAddBalance(message) {
    const userId = message.author.id;

    if (!ALLOWED_ADMINS.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ Confirm Add Balance')
        .setDescription('Are you sure you want to set your **coins and gems to 1,000,000,000**?\n\nType `yes` within 15 seconds to confirm.');

    await message.channel.send({ embeds: [confirmEmbed] });

    const filter = (response) =>
        response.author.id === userId && response.content.toLowerCase() === 'yes';

    try {
        await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 15000,
            errors: ['time'],
        });

        db.run(`UPDATE userCoins SET coins = 1000000000, gems = 1000000000 WHERE userId = ?`, [userId], (err) => {
            if (err) {
                console.error('Add balance error:', err.message);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('⚠ Error')
                            .setDescription('Something went wrong while updating your balance.')
                    ]
                });
            }

            const formattedCoins = (1000000000).toLocaleString();
            const formattedGems = (1000000000).toLocaleString();

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Balance Updated')
                .setDescription(`Your **coins** and **gems** have been set to \`${formattedCoins}\` and \`${formattedGems}\` successfully.`);

            message.reply({ embeds: [successEmbed] });
        });
    } catch {
        const timeoutEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('⏰ Timed Out')
            .setDescription("You didn't confirm in time. Your balance has **not** been changed.");

        await message.reply({ embeds: [timeoutEmbed] });
    }
}

/**
 * Admin command: .additem
 * Adds items to a user's inventory
 */
async function handleAddItem(message) {
    const allowedUsers = ['1128296349566251068'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.additem <userId> <itemName> [quantity]`')
            ]
        });
    }

    const [userId, ...rest] = args;
    let quantity = 1;
    let itemName = rest.join(' ');

    if (!isNaN(rest[rest.length - 1])) {
        quantity = parseInt(rest.pop(), 10);
        itemName = rest.join(' ');
    }

    if (!itemName) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.additem <userId> <itemName> [quantity]`')
            ]
        });
    }

    db.get(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName],
        (err, row) => {
            if (err) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('⚠ Error')
                            .setDescription('Failed to add the item to the user\'s inventory.')
                    ]
                });
            }
            if (row) {
                db.run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                    [quantity, userId, itemName],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('⚠ Error')
                                        .setDescription('Failed to update the item quantity.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Added')
                                    .setDescription(`Added **${quantity}x ${itemName}** to user \`${userId}\`.`)
                            ]
                        });
                    }
                );
            } else {
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
                    [userId, itemName, quantity],
                    function (err) {
                        if (err) {
                            return message.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle('⚠ Error')
                                        .setDescription('Failed to add the item to the user\'s inventory.')
                                ]
                            });
                        }
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Added')
                                    .setDescription(`Added **${quantity}x ${itemName}** to user \`${userId}\`.`)
                            ]
                        });
                    }
                );
            }
        }
    );
}

/**
 * Admin command: .removeitem
 * Removes items from a user's inventory
 */
async function handleRemoveItem(message) {
    const allowedUsers = ['1128296349566251068'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);
    if (args.length < 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.removeitem <userId> <itemName> [quantity]`')
            ]
        });
    }

    const [userId, ...rest] = args;
    let quantity = 1;
    let itemName = rest.join(' ');

    if (!isNaN(rest[rest.length - 1])) {
        quantity = parseInt(rest.pop(), 10);
        itemName = rest.join(' ');
    }

    if (!itemName) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.removeitem <userId> <itemName> [quantity]`')
            ]
        });
    }

    db.get(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName],
        (err, row) => {
            if (err) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('⚠ Error')
                            .setDescription('Failed to remove the item from the user\'s inventory.')
                    ]
                });
            }
            if (!row || row.quantity < quantity) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Orange')
                            .setTitle('❌ Item Not Found')
                            .setDescription(`User \`${userId}\` does not have enough **${itemName}**.`)
                    ]
                });
            }

            db.run(
                `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                [quantity, userId, itemName],
                function (err) {
                    if (err) {
                        return message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('⚠ Error')
                                    .setDescription('Failed to update the item quantity.')
                            ]
                        });
                    }
                    if (row.quantity - quantity <= 0) {
                        db.run(
                            `DELETE FROM userInventory WHERE userId = ? AND itemName = ?`,
                            [userId, itemName],
                            function (err) {
                                if (err) {
                                    return message.reply({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor('Red')
                                                .setTitle('⚠ Error')
                                                .setDescription('Failed to delete the item from the user\'s inventory.')
                                        ]
                                    });
                                }
                                message.reply({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor('Green')
                                            .setTitle('✅ Item Removed')
                                            .setDescription(`Removed **${quantity}x ${itemName}** from user \`${userId}\`.`)
                                    ]
                                });
                            }
                        );
                    } else {
                        message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Green')
                                    .setTitle('✅ Item Quantity Updated')
                                    .setDescription(`Updated **${itemName}** quantity for user \`${userId}\` to **${row.quantity - quantity}**.`)
                            ]
                        });
                    }
                }
            );
        }
    );
}

/**
 * Admin command: .changeid <oldId> <newId>
 * Changes a user's ID across all database tables
 */
async function handleChangeId(message) {
    const userId = message.author.id;

    if (!ALLOWED_ADMINS.includes(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);

    if (args.length !== 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.changeid <oldUserId> <newUserId>`')
            ]
        });
    }

    const oldId = args[0];
    const newId = args[1];

    if (oldId === newId) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('⚠ Invalid Input')
                    .setDescription('Old ID and new ID cannot be the same.')
            ]
        });
    }

    // tables to update
    const tables = [
        'userCoins', 'redeemedCodes', 'farmingFumos', 'userUsage',
        'userInventory', 'userUpgrades', 'userBalance', 'dailyQuests',
        'userExchangeLimits', 'exchangeHistory', 'activeBoosts', 'sakuyaUsage',
        'dailyQuestProgress', 'weeklyQuestProgress', 'achievementProgress',
        'userCraftHistory', 'potionCraftHistory', 'petInventory',
        'hatchingEggs', 'equippedPets', 'userSales'
    ];

    let totalChanged = 0;

    for (const table of tables) {
        await new Promise(resolve => {
            db.run(
                `UPDATE ${table} SET userId = ? WHERE userId = ?`,
                [newId, oldId],
                function (err) {
                    if (err) {
                        console.error(`❌ Error updating ${table}:`, err.message);
                    } else {
                        totalChanged += this.changes;
                    }
                    resolve();
                }
            );
        });
    }

    return message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ User ID Updated')
                .setDescription(
                    `**Old ID:** \`${oldId}\`\n**New ID:** \`${newId}\`\n\n` +
                    `Updated **${totalChanged} rows** across all tables.`
                )
        ]
    });
}

/** 
 * Admin command: .changepetname <userId>
 * Changes all unnamed pets for a user to use their userId as petName
 */
async function handleChangePetName(message) {
    const allowedUsers = ['1128296349566251068', '1362450043939979378'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply("❌ You do not have permission to use this command.");
    }

    const args = message.content.trim().split(' ').slice(1);
    if (args.length !== 1) {
        return message.reply("Usage: `.changepetname <petNameToReplace>`");
    }

    const targetPetName = args[0];

    const PET_NAMES = [
        'Jack', 'Bob', 'Timmy', 'Max', 'Charlie', 'Buddy', 'Rocky', 'Duke',
        'Bailey', 'Cooper', 'Tucker', 'Bear', 'Oliver', 'Toby', 'Leo', 'Milo',
        'Zeus', 'Bentley', 'Lucky', 'Oscar', 'Sam', 'Shadow', 'Jake', 'Buster',
        'Cody', 'Winston', 'Thor', 'Murphy', 'Jasper', 'Henry', 'Finn', 'Gus',
        'Luna', 'Bella', 'Daisy', 'Lucy', 'Molly', 'Sadie', 'Sophie', 'Chloe',
        'Lily', 'Zoe', 'Penny', 'Nala', 'Stella', 'Ruby', 'Rosie', 'Maggie',
        'Coco', 'Lola', 'Pepper', 'Piper', 'Princess', 'Angel', 'Willow', 'Roxy',
        'Cookie', 'Mia', 'Emma', 'Honey', 'Gracie', 'Ellie', 'Maya', 'Athena'
    ];

    // Fetch pets with the given petName
    db.all(
        `SELECT petId FROM petInventory WHERE petName = ?`,
        [targetPetName],
        (err, pets) => {
            if (err) return message.reply("⚠ Database error while reading pets: " + err.message);
            if (!pets || pets.length === 0) {
                return message.reply(`❌ No pets found with the name **${targetPetName}**.`);
            }

            pets.forEach(pet => {
                const newName = PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
                db.run(
                    `UPDATE petInventory SET petName = ? WHERE petId = ?`,
                    [newName, pet.petId],
                    (err2) => {
                        if (err2) console.error("⚠ Failed to update petName:", err2.message);
                    }
                );
            });

            return message.reply(
                `✅ Renamed **${pets.length}** pet(s) with the name **${targetPetName}** to random names.`
            );
        }
    );
}

/**
 * Admin command: .remove
 * Removes all pets of a specific rarity from a user's inventory
 */
async function handleRemove(message) {
    const allowedUsers = ['1128296349566251068', '1362450043939979378'];
    if (!allowedUsers.includes(message.author.id)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use this command.')
            ]
        });
    }

    const args = message.content.trim().split(' ').slice(1);

    // Check if args exist and have minimum required arguments
    if (args.length < 2) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('Usage')
                    .setDescription('`.remove <rarity> <userId>`\n\nExample: `.remove legendary 123456789012345678`')
            ]
        });
    }

    const rarity = args[0].toLowerCase();
    const userId = args[1];

    // Validate rarity
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    if (!validRarities.includes(rarity)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('⚠️ Invalid Rarity')
                    .setDescription(`Please provide a valid rarity: ${validRarities.map(r => `\`${r}\``).join(', ')}`)
            ]
        });
    }

    // Validate user ID
    if (!/^\d{17,19}$/.test(userId)) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('⚠️ Invalid User ID')
                    .setDescription('Please provide a valid Discord user ID (17-19 digits).')
            ]
        });
    }

    // Check how many pets will be removed
    db.get(
        `SELECT COUNT(*) as count FROM petInventory WHERE userId = ? AND LOWER(rarity) = ?`,
        [userId, rarity],
        (err, row) => {
            if (err) {
                console.error('Remove command error:', err.message);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('❌ Database Error')
                            .setDescription('Failed to query pet inventory.')
                    ]
                });
            }

            const petCount = row.count;

            if (petCount === 0) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Orange')
                            .setTitle('⚠️ No Pets Found')
                            .setDescription(`<@${userId}> has no **${rarity}** pets to remove.`)
                    ]
                });
            }

            // Remove the pets
            db.run(
                `DELETE FROM petInventory WHERE userId = ? AND LOWER(rarity) = ?`,
                [userId, rarity],
                function(err) {
                    if (err) {
                        console.error('Remove pets error:', err.message);
                        return message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('❌ Removal Failed')
                                    .setDescription('Failed to remove pets from inventory.')
                            ]
                        });
                    }

                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('Green')
                                .setTitle('✅ Pets Removed')
                                .addFields(
                                    { name: 'User', value: `<@${userId}>`, inline: true },
                                    { name: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
                                    { name: 'Pets Removed', value: `${petCount}`, inline: true }
                                )
                                .setTimestamp()
                        ]
                    });
                }
            );
        }
    );
}

/**
 * Register all admin commands
 */
function registerAdminCommands(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.trim();

        if (content === '.reset') {
            await handleReset(message);
        } else if (content.startsWith('.resetbalance')) {
            await handleResetBalance(message);
        } else if (content.toLowerCase() === '.addbalance') {
            await handleAddBalance(message);
        } else if (content.startsWith('.additem')) {
            await handleAddItem(message);
        } else if (content.startsWith('.removeitem')) {
            await handleRemoveItem(message);
        } else if (content.startsWith('.changeid')) {
            await handleChangeId(message);
        } else if (content.startsWith('.changepetname')) {
            await handleChangePetName(message);
        } else if (content.startsWith('.remove')){
            await handleRemove(message);
        }
    });
}

module.exports = { registerAdminCommands, ALLOWED_ADMINS };