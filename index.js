"use strict";

// Dependencies
const {
    Client,
    Intents,
    MessageEmbed,
    MessageButton,
    MessageActionRow
} = require("discord.js");
const fs = require("fs");

// Load config
const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

const token = process.env.DISCORD_TOKEN || config.token;

const bot = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
});

// =========================
// GAMEMODES
// =========================

const GAMEMODES = [
    "Sword",
    "Axe",
    "Mace",
    "DiaSMP",
    "DiaPOT",
    "Crystal",
    "SMP",
    "SpearMace",
    "Cart",
    "UHC"
];

// Separate queue for every gamemode
const queues = {};

for (const gamemode of GAMEMODES) {
    queues[gamemode] = {
        users: [],
        message: null,
        testerID: null
    };
}

// =========================
// HELPERS
// =========================

function gamemodeOption(required = true) {
    return {
        type: "STRING",
        name: "gamemode",
        description: "Choose the gamemode.",
        required: required,
        choices: GAMEMODES.map(gamemode => ({
            name: gamemode,
            value: gamemode
        }))
    };
}

function getQueueEmbed(gamemode) {
    const data = queues[gamemode];

    return new MessageEmbed()
        .setTitle(`${gamemode} Tester(s) Available!`)
        .setDescription(
`The ${gamemode} queue updates every 10 seconds.

**${gamemode} Queue**:
${
    data.users.length
        ? data.users.map((user, index) =>
            `${index + 1}. <@${user}>`
        ).join("\n")
        : "No users in queue."
}

**Active Testers**:
${
    data.testerID
        ? `<@${data.testerID}>`
        : "None"
}`
        );
}

function getQueueButton(gamemode) {
    return new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(`joinQueue:${gamemode}`)
                .setLabel(`Join ${gamemode} Queue`)
                .setStyle("PRIMARY")
        );
}

function hasTesterRole(interaction, gamemode) {
    if (!config.roles || !config.roles[gamemode]) {
        return false;
    }

    return interaction.member.roles.cache.some(
        role => role.id === config.roles[gamemode]
    );
}

// =========================
// BOT READY
// =========================

bot.on("ready", async () => {

    console.log("Pixel Tiers is running.");

    const guild = bot.guilds.cache.first();

    if (!guild) {
        console.error("No guilds found for the bot.");
        return;
    }

    // =========================
    // SLASH COMMANDS
    // =========================

    await guild.commands.set([

        // /queue
        {
            name: "queue",
            description: "Create a tier-test queue.",
            options: [
                gamemodeOption()
            ]
        },

        // /stopqueue
        {
            name: "stopqueue",
            description: "Delete a gamemode queue.",
            options: [
                gamemodeOption()
            ]
        },

        // /remove
        {
            name: "remove",
            description: "Remove a user from a gamemode queue.",
            options: [
                gamemodeOption(),
                {
                    type: "STRING",
                    name: "user",
                    description: "User to remove from the queue.",
                    required: true
                }
            ]
        },

        // /rank
        {
            name: "rank",
            description: "Set a rank to the specified user.",
            options: [
                {
                    type: "STRING",
                    name: "user",
                    description: "User to give a rank.",
                    required: true
                },
                {
                    type: "STRING",
                    name: "rank",
                    description: "The rank to give to the user.",
                    required: true
                }
            ]
        },

        // /result
        {
            name: "result",
            description: "Send test result.",
            options: [
                {
                    type: "USER",
                    name: "user",
                    description: "The user who took the test.",
                    required: true
                },
                {
                    type: "STRING",
                    name: "region",
                    description: "The region of the user.",
                    required: true
                },
                {
                    type: "STRING",
                    name: "username",
                    description: "The username of the user.",
                    required: true
                },
                {
                    type: "STRING",
                    name: "previous_rank",
                    description: "The previous rank of the user.",
                    required: true
                },
                {
                    type: "STRING",
                    name: "rank_earned",
                    description: "The rank earned by the user.",
                    required: true
                }
            ]
        }

    ]);

    console.log("Commands registered.");

    // =========================
    // UPDATE QUEUES
    // =========================

    setInterval(async () => {

        for (const gamemode of GAMEMODES) {

            const data = queues[gamemode];

            if (!data.message) continue;

            try {

                await data.message.edit({
                    embeds: [
                        getQueueEmbed(gamemode)
                    ],
                    components: [
                        getQueueButton(gamemode)
                    ]
                });

            } catch (error) {

                console.error(
                    `Could not update ${gamemode} queue:`,
                    error.message
                );

            }
        }

    }, 10 * 1000);

});

// =========================
// COMMAND HANDLER
// =========================

bot.on("interactionCreate", async interaction => {

    if (!interaction.isCommand()) return;

    const commandName = interaction.commandName;

    // =========================
    // /queue
    // =========================

    if (commandName === "queue") {

        const gamemode =
            interaction.options.getString("gamemode");

        const data = queues[gamemode];

        // Check gamemode tester role
        if (!hasTesterRole(interaction, gamemode)) {

            return interaction.reply({
                content:
                    `You do not have the required **${gamemode} Tester** role.`,
                ephemeral: true
            });

        }

        // Check existing queue
        if (data.message) {

            return interaction.reply({
                content:
                    `There is already an active **${gamemode}** queue.`,
                ephemeral: true
            });

        }

        // Find channel
        const channel =
            interaction.guild.channels.cache.get(
                config.channelID
            );

        if (!channel) {

            return interaction.reply({
                content: "Channel not found.",
                ephemeral: true
            });

        }

        // Reset queue
        data.users = [];

        data.testerID =
            interaction.user.id;

        // Create queue message
        data.message =
            await channel.send({

                embeds: [
                    getQueueEmbed(gamemode)
                ],

                components: [
                    getQueueButton(gamemode)
                ]

            });

        await interaction.reply({

            content:
                `**${gamemode}** queue created successfully.`,

            ephemeral: true

        });

    }

    // =========================
    // /stopqueue
    // =========================

    else if (commandName === "stopqueue") {

        if (
            !interaction.member.permissions.has(
                "ADMINISTRATOR"
            )
        ) {

            return interaction.reply({
                content:
                    "You do not have the required permissions.",
                ephemeral: true
            });

        }

        const gamemode =
            interaction.options.getString("gamemode");

        const data = queues[gamemode];

        if (!data.message) {

            return interaction.reply({
                content:
                    `No active **${gamemode}** queue to be deleted.`,
                ephemeral: true
            });

        }

        try {

            await data.message.delete();

        } catch (error) {

            console.error(
                `Could not delete ${gamemode} queue:`,
                error.message
            );

        }

        data.users = [];
        data.message = null;
        data.testerID = null;

        await interaction.reply({

            content:
                `**${gamemode}** queue successfully deleted.`,

            ephemeral: true

        });

    }

    // =========================
    // /remove
    // =========================

    else if (commandName === "remove") {

        if (
            !interaction.member.permissions.has(
                "ADMINISTRATOR"
            )
        ) {

            return interaction.reply({
                content:
                    "You do not have the required permissions.",
                ephemeral: true
            });

        }

        const gamemode =
            interaction.options.getString("gamemode");

        const userInput =
            interaction.options.getString(
                "user",
                true
            );

        const data = queues[gamemode];

        const userIdMatch =
            userInput.match(/\d+/);

        if (!userIdMatch) {

            return interaction.reply({
                content:
                    "Invalid user ID or mention.",
                ephemeral: true
            });

        }

        const userId =
            userIdMatch[0];

        if (data.users.includes(userId)) {

            data.users =
                data.users.filter(
                    user => user !== userId
                );

            await interaction.reply({

                content:
                    `User successfully removed from the **${gamemode}** queue.`,

                ephemeral: true

            });

        } else {

            await interaction.reply({

                content:
                    `User is not in the **${gamemode}** queue.`,

                ephemeral: true

            });

        }

    }

    // =========================
    // /rank
    // =========================

    else if (commandName === "rank") {

        if (
            !interaction.member.permissions.has(
                "ADMINISTRATOR"
            )
        ) {

            return interaction.reply({
                content:
                    "You do not have the required permissions.",
                ephemeral: true
            });

        }

        let user =
            interaction.options.getString(
                "user",
                true
            );

        let rank =
            interaction.options.getString(
                "rank",
                true
            );

        const userIdMatch =
            user.match(/\d+/);

        const rankIdMatch =
            rank.match(/\d+/);

        if (
            userIdMatch &&
            rankIdMatch
        ) {

            user =
                interaction.guild.members.cache.get(
                    userIdMatch[0]
                );

            rank =
                interaction.guild.roles.cache.find(
                    role =>
                        role.id === rankIdMatch[0]
                );

            if (!user || !rank) {

                return interaction.reply({
                    content:
                        "Please mention a valid user and role.",
                    ephemeral: true
                });

            }

            await user.roles.add(rank);

            await interaction.reply({

                content:
                    "Rank assigned successfully.",

                ephemeral: true

            });

        } else {

            await interaction.reply({

                content:
                    "Invalid user or role ID.",

                ephemeral: true

            });

        }

    }

    // =========================
    // /result
    // =========================

    else if (commandName === "result") {

        const user =
            interaction.options.getUser("user");

        const region =
            interaction.options.getString("region");

        const username =
            interaction.options.getString("username");

        const previousRank =
            interaction.options.getString(
                "previous_rank"
            );

        const rankEarned =
            interaction.options.getString(
                "rank_earned"
            );

        const avatarUrl =
            `https://minotar.net/avatar/${username}`;

        const embed =
            new MessageEmbed()

                .setTitle(
                    `${user.username}'s Test Results 🏆`
                )

                .setThumbnail(
                    avatarUrl
                )

                .addField(
                    "Testers",
                    `<@${interaction.user.id}>`,
                    true
                )

                .addField(
                    "Region",
                    region,
                    true
                )

                .addField(
                    "Username",
                    username,
                    true
                )

                .addField(
                    "Previous Rank",
                    previousRank,
                    true
                )

                .addField(
                    "Rank Earned",
                    rankEarned,
                    true
                );

        await interaction.reply({
            embeds: [embed]
        });

    }

});

// =========================
// BUTTON HANDLER
// =========================

bot.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) return;

    if (
        !interaction.customId.startsWith(
            "joinQueue:"
        )
    ) return;

    const gamemode =
        interaction.customId.split(":")[1];

    if (
        !GAMEMODES.includes(gamemode)
    ) {

        return interaction.reply({
            content:
                "Invalid gamemode.",
            ephemeral: true
        });

    }

    const data =
        queues[gamemode];

    if (!data.message) {

        return interaction.reply({
            content:
                `The **${gamemode}** queue is no longer active.`,
            ephemeral: true
        });

    }

    if (
        data.users.includes(
            interaction.user.id
        )
    ) {

        return interaction.reply({
            content:
                `You are already in the **${gamemode}** queue.`,
            ephemeral: true
        });

    }

    data.users.push(
        interaction.user.id
    );

    await interaction.reply({

        content:
            `You have successfully joined the **${gamemode}** queue.`,

        ephemeral: true

    });

});

// =========================
// LOGIN
// =========================

if (!token) {

    console.error(
        "No Discord bot token found."
    );

    process.exit(1);

}

bot.login(token);
