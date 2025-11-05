
const { SlashCommandBuilder } = require('discord.js');
const { updateLicenseStatus } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deactivate')
        .setDescription('Deactivate a license key.')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The license key to deactivate.')
                .setRequired(true)),
    async execute(interaction) {
        const key = interaction.options.getString('key');
        
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await updateLicenseStatus(key, 'inactive');

            if (result.success) {
                await interaction.editReply(`License key \`${key}\` has been successfully deactivated.`);
            } else {
                await interaction.editReply(`Error: ${result.message || 'Failed to deactivate license.'}`);
            }
        } catch (error) {
            console.error('Error deactivating license:', error);
            await interaction.editReply({ content: 'An unexpected error occurred while deactivating the license.' });
        }
    },
};
