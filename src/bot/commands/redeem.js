

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { getVouchers, saveVouchers, getLicenses, createLicense, renewLicense, getProducts } = require('../../lib/data-access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem a voucher code for a license.')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The voucher code to redeem.')
                .setRequired(true)),
    async execute(interaction) {
        const code = interaction.options.getString('code');
        const userId = interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const vouchers = await getVouchers();
            const voucherIndex = vouchers.findIndex(v => v.code === code);

            if (voucherIndex === -1) {
                return interaction.editReply({ content: 'This voucher code is invalid.' });
            }

            const voucher = vouchers[voucherIndex];

            if (voucher.isRedeemed) {
                return interaction.editReply({ content: 'This voucher has already been redeemed.' });
            }
            
            const licenses = await getLicenses();
            const existingLicenses = licenses.filter(l => l.discordId === userId && l.productId === voucher.productId);

            if (existingLicenses.length > 0) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('renew').setLabel('Renew Existing License').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('new_license').setLabel('Get a New License').setStyle(ButtonStyle.Secondary)
                    );
                
                const reply = await interaction.editReply({
                    content: 'You already have a license for this product. Would you like to renew an existing one or receive a completely new license?',
                    components: [row],
                    ephemeral: true,
                });

                const filter = i => i.user.id === userId;
                const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter });
                
                collector.on('collect', async i => {
                    await i.deferUpdate();
                    if (i.customId === 'new_license') {
                        await redeemNewLicense(interaction, voucher, voucherIndex, vouchers, userId);
                    } else if (i.customId === 'renew') {
                        if (existingLicenses.length === 1) {
                            const result = await renewLicense(existingLicenses[0].key, voucher.duration);
                            await handleRenewalResult(i, result, voucher, voucherIndex, vouchers, userId, existingLicenses[0].id);
                        } else {
                            const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId('select_license_to_renew')
                                .setPlaceholder('Select the license you want to renew')
                                .addOptions(existingLicenses.map(l => ({
                                    label: `Key: ...${l.key.slice(-12)}`,
                                    description: `Expires: ${l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : 'Never'}`,
                                    value: l.key,
                                })));

                            const row = new ActionRowBuilder().addComponents(selectMenu);
                            const selectReply = await i.followUp({ content: 'You have multiple licenses for this product. Which one would you like to renew?', components: [row], ephemeral: true, fetchReply: true });
                            
                            const selectCollector = selectReply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter });
                            selectCollector.on('collect', async selectInteraction => {
                                await selectInteraction.deferUpdate();
                                const licenseKeyToRenew = selectInteraction.values[0];
                                const licenseToRenew = existingLicenses.find(l => l.key === licenseKeyToRenew);
                                const result = await renewLicense(licenseKeyToRenew, voucher.duration);
                                await handleRenewalResult(selectInteraction, result, voucher, voucherIndex, vouchers, userId, licenseToRenew.id);
                                await i.editReply({ content: 'Action completed.', components: [] });
                            });
                        }
                    }
                    await interaction.editReply({ content: 'Action completed.', components: [] });
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({ content: 'Redemption timed out.', components: [] });
                    }
                });

            } else {
                await redeemNewLicense(interaction, voucher, voucherIndex, vouchers, userId);
            }

        } catch (error) {
            console.error('Error redeeming voucher:', error);
            await interaction.editReply({ content: 'An unexpected error occurred.' });
        }
    },
};

async function handleRenewalResult(interaction, result, voucher, voucherIndex, vouchers, userId, licenseId) {
     if (result.success) {
        voucher.isRedeemed = true;
        voucher.redeemedBy = userId;
        voucher.redeemedAt = new Date().toISOString();
        voucher.redeemedForLicenseId = licenseId;
        voucher.redeemAction = 'renew';
        vouchers[voucherIndex] = voucher;
        await saveVouchers(vouchers);
        
        const products = await getProducts();
        const product = products.find(p => p.id === voucher.productId);

        const embed = new EmbedBuilder()
            .setTitle('License Renewed!')
            .setColor('#22C55E')
            .setDescription(`You have successfully renewed your license for **${product?.name || 'a product'}**.`)
            .addFields(
                { name: 'License Key', value: `\`${result.license.key}\`` },
                { name: 'New Expiration', value: result.license.expiresAt ? new Date(result.license.expiresAt).toLocaleDateString() : 'Never' }
            )
            .setTimestamp();
        
        await interaction.followUp({ embeds: [embed], components: [], ephemeral: true });

    } else {
        await interaction.followUp({ content: `❌ Error: ${result.message}`, components: [], ephemeral: true });
    }
}


async function redeemNewLicense(interaction, voucher, voucherIndex, vouchers, userId) {
    let expiresAt = null;
    if (voucher.duration !== 'lifetime') {
        const amount = parseInt(voucher.duration.slice(0, -1));
        const unit = voucher.duration.slice(-1);
        const date = new Date();
        if (unit === 'm') date.setMonth(date.getMonth() + amount);
        else if (unit === 'y') date.setFullYear(date.getFullYear() + amount);
        expiresAt = date.toISOString();
    }
    
    const result = await createLicense({
        productId: voucher.productId,
        discordId: userId,
        expiresAt: expiresAt
    });

    if (result.success) {
        voucher.isRedeemed = true;
        voucher.redeemedBy = userId;
        voucher.redeemedAt = new Date().toISOString();
        voucher.redeemedForLicenseId = result.license.id;
        voucher.redeemAction = 'create';
        vouchers[voucherIndex] = voucher;
        await saveVouchers(vouchers);
        
        const products = await getProducts();
        const product = products.find(p => p.id === voucher.productId);

        const embed = new EmbedBuilder()
            .setTitle('Voucher Redeemed!')
            .setColor('#22C55E')
            .setDescription(`You have successfully received a new license for **${product?.name || 'a product'}**.`)
            .addFields({ name: 'Your new license key', value: `\`${result.license.key}\`` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed], components: [] });
    } else {
        await interaction.editReply({ content: `Error: ${result.message || 'Failed to create license.'}`, components: [] });
    }
}
