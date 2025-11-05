

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLicenses, getProducts, fetchDiscordUser } = require('../../lib/data-access');
const { format } = require('date-fns');
const fs = require('fs');
const path = require('path');

function getAdminIds() {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return config.adminIds || [];
    } catch (error) {
        console.error("Could not read admin IDs from config:", error);
        return [];
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('check-licenses')
        .setDescription('Check details of a specific license key.')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The license key to check.')
                .setRequired(true)),
    async execute(interaction) {
        const key = interaction.options.getString('key');
        const userId = interaction.user.id;
        
        await interaction.deferReply({ ephemeral: true });

        try {
            const licenses = await getLicenses();
            const products = await getProducts();
            const license = licenses.find(l => l.key === key);

            if (!license) {
                return interaction.editReply({ content: 'License key not found.' });
            }
            
            const adminIds = getAdminIds();
            const isOwner = license.discordId === userId;
            const isSubUser = (license.subUserDiscordIds || []).includes(userId);
            const isAdmin = adminIds.includes(userId);

            if (!isOwner && !isSubUser && !isAdmin) {
                return interaction.editReply({ content: 'You do not have permission to view this license.' });
            }


            const product = products.find(p => p.id === license.productId);
            const owner = await fetchDiscordUser(license.discordId);

            let subUsersDisplay = 'None';
            if (license.subUserDiscordIds && license.subUserDiscordIds.length > 0) {
                const subUserPromises = license.subUserDiscordIds.map(async id => {
                    const user = await fetchDiscordUser(id);
                    return user ? `${user.username} (${id})` : id;
                });
                const resolvedSubUsers = await Promise.all(subUserPromises);
                subUsersDisplay = resolvedSubUsers.join('\n');
            }
            
            const ipUsage = license.maxIps === -2 ? 'Disabled' : `${license.allowedIps.length} / ${license.maxIps === -1 ? '∞' : license.maxIps}`;
            
            const hwidUsage = product.hwidProtection 
                ? `${license.allowedHwids.length} / ${license.maxHwids === -1 ? '∞' : license.maxHwids}`
                : 'Disabled';


            const embed = new EmbedBuilder()
                .setTitle(`License Details: \`${license.key.substring(0, 15)}...\``)
                .setColor(license.status === 'active' ? '#22C55E' : '#EF4444')
                .addFields(
                    { name: 'Status', value: license.status, inline: true },
                    { name: 'Product', value: product?.name || 'N/A', inline: true },
                    { name: 'Owner', value: owner ? `${owner.username} (${owner.id})` : license.discordId, inline: true },
                    { name: 'Expires At', value: license.expiresAt ? format(new Date(license.expiresAt), 'PPP') : 'Never', inline: true },
                    { name: 'IPs Used', value: ipUsage, inline: true },
                    { name: 'HWIDs Used', value: hwidUsage, inline: true },
                    { name: 'Sub-users', value: subUsersDisplay }
                )
                .setTimestamp(new Date(license.createdAt));

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in check-licenses command:', error);
            await interaction.editReply({ content: 'An error occurred while fetching license details.' });
        }
    },
};
