
const { SlashCommandBuilder } = require('discord.js');
const { renewLicense } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('renew-license')
        .setDescription('Renew an expired license.')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The license key to renew.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription("Duration to extend the license by (e.g., '1m', '6m', '1y').")
                .setRequired(true)),
    async execute(interaction) {
        const key = interaction.options.getString('key');
        const duration = interaction.options.getString('duration');

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await renewLicense(key, duration);

            if (result.success) {
                await interaction.editReply(`License for **${result.productName}** has been successfully renewed. New expiration: ${new Date(result.license.expiresAt).toLocaleDateString()}.`);
            } else {
                await interaction.editReply(`Error: ${result.message || 'Failed to renew license.'}`);
            }
        } catch (error) {
            console.error('Error renewing license:', error);
            await interaction.editReply({ content: 'An unexpected error occurred.' });
        }
    },
};
