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
            const [licenses, products] = await Promise.all([getLicenses(), getProducts()]);
            const productMap = new Map(products.map(p => [p.id, p]));
            const userLicenses = licenses.filter(l => l.discordId === discordId);

            if (userLicenses.length === 0) {
                return interaction.editReply({ content: 'No licenses found for this user.' });
            }

            const user = await fetchDiscordUser(discordId);

            const embed = new EmbedBuilder()
                .setTitle(`Licenses for ${user?.username || discordId}`)
                .setColor('#5865F2')
                .setTimestamp();

            if (user?.avatar) embed.setThumbnail(user.avatar);

            const capped = userLicenses.slice(0, 20);
            const fields = capped.map(l => {
                const product = productMap.get(l.productId);
                const maskedKey = `${l.key.substring(0, 6)}...${l.key.slice(-4)}`;
                return {
                    name: product?.name || 'Unknown Product',
                    value: `Key: \`${maskedKey}\`\nStatus: ${l.status}`,
                    inline: true,
                };
            });
            embed.addFields(...fields);

            if (userLicenses.length > 20) {
                embed.setFooter({ text: `Showing 20 of ${userLicenses.length} licenses` });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error searching licenses:", error);
            await interaction.editReply({ content: 'An error occurred while searching for licenses.' });
        }
    },
};
