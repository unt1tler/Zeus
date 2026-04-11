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
            const [allLicenses, allProducts] = await Promise.all([getLicenses(), getProducts()]);
            const productMap = new Map(allProducts.map(p => [p.id, p]));

            const ownedLicenses = allLicenses.filter(l => l.discordId === userId);
            const subUserLicenses = allLicenses.filter(l => (l.subUserDiscordIds || []).includes(userId));

            if (ownedLicenses.length === 0 && subUserLicenses.length === 0) {
                return interaction.editReply({ content: "You don't have any licenses." });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Licenses`)
                .setColor('#5865F2')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            let fieldCount = 0;
            const MAX_FIELDS = 23; // leave room for section headers

            if (ownedLicenses.length > 0) {
                embed.addFields({ name: 'OWNED LICENSES', value: '\u200B' });
                fieldCount++;
                const capped = ownedLicenses.slice(0, Math.min(ownedLicenses.length, MAX_FIELDS - fieldCount));
                for (const l of capped) {
                    const product = productMap.get(l.productId);
                    const isActive = l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt) > new Date());
                    const status = isActive ? '🟢 Active' : '🔴 Inactive/Expired';
                    embed.addFields({
                        name: `🔑 ${product?.name || 'Unknown Product'}`,
                        value: `Key: \`${l.key}\`\nStatus: ${status}\nExpires: ${l.expiresAt ? format(new Date(l.expiresAt), 'PPP') : 'Never'}`,
                    });
                    fieldCount++;
                }
                if (ownedLicenses.length > capped.length) {
                    embed.addFields({ name: '\u200B', value: `*...and ${ownedLicenses.length - capped.length} more*` });
                    fieldCount++;
                }
            }

            if (subUserLicenses.length > 0 && fieldCount < MAX_FIELDS) {
                embed.addFields({ name: 'MEMBER ON', value: '\u200B' });
                fieldCount++;
                const capped = subUserLicenses.slice(0, Math.min(subUserLicenses.length, MAX_FIELDS - fieldCount));
                for (const l of capped) {
                    const product = productMap.get(l.productId);
                    embed.addFields({
                        name: `🤝 ${product?.name || 'Unknown Product'}`,
                        value: `Key: \`${l.key}\` (Sub-user)`,
                    });
                    fieldCount++;
                }
                if (subUserLicenses.length > capped.length) {
                    embed.addFields({ name: '\u200B', value: `*...and ${subUserLicenses.length - capped.length} more*` });
                }
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error fetching user's licenses:", error);
            await interaction.editReply({ content: 'An error occurred while fetching your licenses.' });
        }
    },
};
