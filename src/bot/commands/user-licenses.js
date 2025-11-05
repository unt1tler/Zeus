

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLicenses, getProducts } = require('../../lib/data-access');
const { format } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user-licenses')
        .setDescription('View all licenses you own or are a sub-user on.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        await interaction.deferReply({ ephemeral: true });

        try {
            const allLicenses = await getLicenses();
            const allProducts = await getProducts();

            const ownedLicenses = allLicenses.filter(l => l.discordId === userId);
            const subUserLicenses = allLicenses.filter(l => (l.subUserDiscordIds || []).includes(userId));

            if (ownedLicenses.length === 0 && subUserLicenses.length === 0) {
                return interaction.editReply({ content: "You don't have any licenses." });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Licenses`)
                .setColor('#5865F2')
                .setThumbnail(interaction.user.displayAvatarURL());

            if (ownedLicenses.length > 0) {
                const fields = ownedLicenses.map(l => {
                    const product = allProducts.find(p => p.id === l.productId);
                    const isActive = l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt) > new Date());
                    const status = isActive ? '🟢 Active' : '🔴 Inactive/Expired';
                    return {
                        name: `🔑 ${product?.name || 'Unknown Product'}`,
                        value: `Key: \`${l.key}\`\nStatus: ${status}\nExpires: ${l.expiresAt ? format(new Date(l.expiresAt), 'PPP') : 'Never'}`,
                    };
                });
                 embed.addFields({ name: 'OWNED LICENSES', value: '\u200B' }, ...fields);
            }

            if (subUserLicenses.length > 0) {
                 const fields = subUserLicenses.map(l => {
                    const product = allProducts.find(p => p.id === l.productId);
                    return {
                        name: `🤝 ${product?.name || 'Unknown Product'}`,
                        value: `Key: \`${l.key}\` (Sub-user)`,
                    };
                });
                embed.addFields({ name: 'MEMBER ON', value: '\u200B' }, ...fields);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Error fetching user's licenses:", error);
            await interaction.editReply({ content: 'An error occurred while fetching your licenses.' });
        }
    },
};
