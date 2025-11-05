

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProducts, createLicense } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-license')
        .setDescription('Create a new license key.')
        .addStringOption(option =>
            option.setName('product_id')
                .setDescription('The ID of the product for the license.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('discord_id')
                .setDescription('The Discord ID of the license owner.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription("Duration of the license (e.g., '1m', '1y', 'lifetime').")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('max_ips')
                .setDescription('Maximum allowed IPs (-1 for unlimited).'))
        .addStringOption(option =>
            option.setName('sub_users')
                .setDescription('Comma-separated list of sub-user Discord IDs.')),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const productId = interaction.options.getString('product_id');
        const discordId = interaction.options.getString('discord_id');
        const duration = interaction.options.getString('duration');
        const maxIps = interaction.options.getInteger('max_ips') ?? 1;
        const subUsers = interaction.options.getString('sub_users');

        try {
            const products = await getProducts();
            const product = products.find(p => p.id === productId);
            if (!product) {
                return interaction.editReply({ content: 'Error: Invalid Product ID.' });
            }

            let expiresAt = null;
            if (duration !== 'lifetime') {
                const amount = parseInt(duration.slice(0, -1));
                const unit = duration.slice(-1);
                const date = new Date();
                if (unit === 'm') date.setMonth(date.getMonth() + amount);
                else if (unit === 'y') date.setFullYear(date.getFullYear() + amount);
                else return interaction.editReply({ content: "Invalid duration format. Use '1m', '1y', 'lifetime'." });
                expiresAt = date.toISOString();
            }

            const licenseData = {
                productId,
                discordId,
                expiresAt,
                maxIps,
                maxHwids: product.hwidProtection ? 1 : -1,
                subUserDiscordIds: subUsers ? subUsers.split(',').map(s => s.trim()) : [],
            };

            const result = await createLicense(licenseData);

            if (result.success) {
                const embed = new EmbedBuilder()
                    .setTitle('License Created Successfully')
                    .setColor('#22C55E')
                    .setDescription(`A new license has been generated.`)
                    .addFields(
                        { name: 'License Key', value: `\`${result.license.key}\`` },
                        { name: 'Owner Discord ID', value: discordId, inline: true },
                        { name: 'Product ID', value: productId, inline: true }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({ content: `Error: ${result.message || 'Failed to create license.'}` });
            }
        } catch (error) {
            console.error('Error creating license:', error);
            await interaction.editReply({ content: 'An unexpected error occurred.' });
        }
    },
};
