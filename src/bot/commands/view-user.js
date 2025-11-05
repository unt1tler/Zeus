
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLicenses, fetchDiscordUser } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-user')
        .setDescription("View a user's license profile.")
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to view.')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        await interaction.deferReply({ ephemeral: true });

        try {
            const allLicenses = await getLicenses();
            const ownedLicenses = allLicenses.filter(l => l.discordId === user.id);
            const subUserOn = allLicenses.filter(l => (l.subUserDiscordIds || []).includes(user.id));
            
            const firstOwned = ownedLicenses[0];
            const discordUser = await fetchDiscordUser(user.id);


            const embed = new EmbedBuilder()
                .setTitle(`${discordUser?.username || user.username}'s Profile`)
                .setThumbnail(discordUser?.avatar || user.displayAvatarURL())
                .setColor('#5865F2')
                .addFields(
                    { name: 'Discord ID', value: user.id, inline: true },
                    { name: 'Email', value: firstOwned?.email || 'Not set', inline: true },
                    { name: 'Owned Licenses', value: `${ownedLicenses.length}`, inline: false },
                    { name: 'Is Sub-user On', value: `${subUserOn.length} licenses`, inline: false }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching user profile:', error);
            await interaction.editReply({ content: 'An error occurred while fetching the profile.' });
        }
    },
};
