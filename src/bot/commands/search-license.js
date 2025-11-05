
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLicenses, getProducts, fetchDiscordUser } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search-license')
        .setDescription('Search for licenses by Discord ID.')
        .addStringOption(option =>
            option.setName('discord_id')
                .setDescription('The Discord ID of the user to search for.')
                .setRequired(true)),
    async execute(interaction) {
        const discordId = interaction.options.getString('discord_id');
        await interaction.deferReply({ ephemeral: true });

        try {
            const licenses = await getLicenses();
            const products = await getProducts();
            const userLicenses = licenses.filter(l => l.discordId === discordId);

            if (userLicenses.length === 0) {
                return interaction.editReply({ content: 'No licenses found for this user.' });
            }
            
            const user = await fetchDiscordUser(discordId);

            const embed = new EmbedBuilder()
                .setTitle(`Licenses for ${user?.username || discordId}`)
                .setColor('#5865F2');
            
            if(user?.avatar) embed.setThumbnail(user.avatar);

            const fields = userLicenses.map(l => {
                const product = products.find(p => p.id === l.productId);
                return {
                    name: product?.name || 'Unknown Product',
                    value: `Key: \`${l.key}\`\nStatus: ${l.status}`
                };
            });
            embed.addFields(...fields);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Error searching licenses:", error);
            await interaction.editReply({ content: 'An error occurred while searching for licenses.' });
        }
    },
};
