
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLicenses, getProducts } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("View your license profile."),
    async execute(interaction) {
        const user = interaction.user;
        await interaction.deferReply({ ephemeral: true });

        try {
            const allLicenses = await getLicenses();
            const allProducts = await getProducts();
            
            const ownedLicenses = allLicenses.filter(l => l.discordId === user.id);
            const subUserOn = allLicenses.filter(l => (l.subUserDiscordIds || []).includes(user.id));
            
            const firstOwned = ownedLicenses[0];

            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Profile`)
                .setThumbnail(user.displayAvatarURL())
                .setColor('#5865F2')
                .addFields(
                    { name: '📝 Owned Licenses', value: `${ownedLicenses.length}`, inline: true },
                    { name: '🤝 Member On', value: `${subUserOn.length}`, inline: true },
                    { name: '✉️ Email', value: `||${firstOwned?.email || 'Not Set'}||`, inline: true },
                    { name: '🆔 Discord ID', value: `\`${user.id}\``, inline: false },
                )
                .setTimestamp();
            
            if (ownedLicenses.length > 0) {
                const ownedValue = ownedLicenses.slice(0, 5).map(l => {
                    const product = allProducts.find(p => p.id === l.productId);
                    return `**${product?.name || 'Unknown'}**: \`${l.key.substring(0,12)}...\``
                }).join('\n');
                embed.addFields({ name: 'Your Licenses (first 5)', value: ownedValue });
            }


            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching profile:', error);
            await interaction.editReply({ content: 'An error occurred while fetching your profile.' });
        }
    },
};
