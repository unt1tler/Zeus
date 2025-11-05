

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getLicenses, getProducts, addSubUserToLicense, removeSubUserFromLicense, resetLicenseIdentities, addLicenseIdentity } = require('../../lib/data-access');
const { format } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-license')
        .setDescription('Manage a license you own or are a member of.')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The license key you want to manage.')
                .setRequired(true)),
    async execute(interaction) {
        const key = interaction.options.getString('key');
        const userId = interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        const licenses = await getLicenses();
        const products = await getProducts();
        let license = licenses.find(l => l.key === key);

        if (!license) {
            return interaction.editReply({ content: "This license key does not exist." });
        }
        
        const product = products.find(p => p.id === license.productId);
        
        const isOwner = license.discordId === userId;
        const isSubUser = (license.subUserDiscordIds || []).includes(userId);

        if (!isOwner && !isSubUser) {
            return interaction.editReply({ content: "You do not have permission to manage this license." });
        }
        
        const now = new Date();
        const isActive = license.status === 'active' && (!license.expiresAt || new Date(license.expiresAt) > now);

        if (!isActive) {
            return interaction.editReply({ content: "This license is expired or inactive and cannot be managed." });
        }

        const createEmbed = (lic, prod) => {
            const embed = new EmbedBuilder()
                .setTitle(`Managing License`)
                .setDescription(`\`${lic.key}\``)
                .setColor(isActive ? '#22C55E' : '#EF4444')
                .addFields(
                    { name: 'Status', value: `${isActive ? '🟢 Active' : '🔴 Inactive/Expired'}`, inline: true },
                    { name: 'Expires', value: lic.expiresAt ? format(new Date(lic.expiresAt), 'PPP') : 'Never', inline: true },
                    { name: 'Role', value: isOwner ? '🔑 Owner' : '👥 Sub-user', inline: true }
                )
                .setFooter({ text: 'Manage your license identities and sub-users.'})
                .setTimestamp();
            
            if (lic.maxIps === -2) {
                embed.addFields({ name: '🌐 IPs Used', value: 'Disabled', inline: true });
            } else {
                 const ipUsage = `${lic.allowedIps.length} / ${lic.maxIps === -1 ? '∞' : lic.maxIps}`;
                 embed.addFields({ name: '🌐 IPs Used', value: ipUsage, inline: true });
            }

            if (prod?.hwidProtection) {
                const hwidUsage = `${lic.allowedHwids.length} / ${lic.maxHwids === -1 ? '∞' : lic.maxHwids}`;
                embed.addFields({ name: '💻 HWIDs Used', value: hwidUsage, inline: true });
            }

            return embed;
        }

        const createComponents = (lic, prod) => {
            const isHwidProt = prod?.hwidProtection || false;
            const isIpProtEnabled = lic.maxIps !== -2;
            const rows = [];
            const row1 = new ActionRowBuilder();
            const row2 = new ActionRowBuilder();

            if (isOwner) {
                row1.addComponents(new ButtonBuilder().setCustomId('manage_sub_users').setLabel('Sub-users').setStyle(ButtonStyle.Primary).setEmoji('👤'));
            }

            if (isIpProtEnabled) {
                row2.addComponents(
                    new ButtonBuilder().setCustomId('add_ip').setLabel('Add IP').setStyle(ButtonStyle.Secondary).setEmoji('🌐'),
                    new ButtonBuilder().setCustomId('reset_ips').setLabel('Reset IPs').setStyle(ButtonStyle.Danger).setEmoji('🌐'),
                );
            }

            if (isHwidProt) {
                 row2.addComponents(
                    new ButtonBuilder().setCustomId('add_hwid').setLabel('Add HWID').setStyle(ButtonStyle.Secondary).setEmoji('💻'),
                    new ButtonBuilder().setCustomId('reset_hwids').setLabel('Reset HWIDs').setStyle(ButtonStyle.Danger).setEmoji('💻')
                 );
            }
            
            if (isOwner && row1.components.length > 0) {
                rows.push(row1);
            }
            if (row2.components.length > 0) {
                rows.push(row2);
            }

            return rows;
        }

        const reply = await interaction.editReply({ embeds: [createEmbed(license, product)], components: createComponents(license, product) });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 180000
        });

        collector.on('collect', async i => {
            const currentLicenses = await getLicenses();
            const currentProducts = await getProducts();
            license = currentLicenses.find(l => l.key === key);
            const currentProduct = currentProducts.find(p => p.id === license.productId);


            if (!license) {
                 return i.reply({ content: 'This license no longer exists.', ephemeral: true });
            }
            
            const isInteractionUserOwner = license.discordId === i.user.id;
            const isInteractionUserSubUser = (license.subUserDiscordIds || []).includes(i.user.id);
            
            if (!isInteractionUserOwner && !isInteractionUserSubUser) {
                return i.reply({ content: 'You no longer have permission to manage this license.', ephemeral: true });
            }
            
            try {
                if (i.customId === 'manage_sub_users') {
                     if (!isInteractionUserOwner) {
                         return i.reply({ content: 'Only the license owner can manage sub-users.', ephemeral: true });
                     }
                     const subUserId = await promptForInput(i, 'sub_user_modal', 'Manage Sub-user', 'Enter Discord ID', 'discord_id_input', 'The ID of the user to add or remove.');
                     if (!subUserId) return;

                     const isAlreadySubUser = (license.subUserDiscordIds || []).includes(subUserId);
                     const result = isAlreadySubUser 
                        ? await removeSubUserFromLicense(key, subUserId)
                        : await addSubUserToLicense(key, subUserId);

                    if (result.success) {
                        license = result.license;
                        await interaction.editReply({ embeds: [createEmbed(license, currentProduct)], components: createComponents(license, currentProduct) });
                        await i.followUp({ content: `✅ Successfully ${isAlreadySubUser ? 'removed' : 'added'} user \`${subUserId}\`.`, ephemeral: true });
                    } else {
                        await i.followUp({ content: `❌ Error: ${result.message}`, ephemeral: true });
                    }

                } else if (i.customId.startsWith('add_')) {
                    const type = i.customId.split('_')[1];
                    const value = await promptForInput(i, `add_${type}_modal`, `Add ${type.toUpperCase()}`, `Enter ${type.toUpperCase()}`, `${type}_input`, `The ${type.toUpperCase()} to add to the license.`);
                    if (!value) return;

                    const result = await addLicenseIdentity(key, type, value);
                     if (result.success) {
                        license = result.license;
                        await interaction.editReply({ embeds: [createEmbed(license, currentProduct)], components: createComponents(license, currentProduct) });
                        await i.followUp({ content: `✅ Successfully added ${type.toUpperCase()}: \`${value}\`.`, ephemeral: true });
                    } else {
                        await i.followUp({ content: `❌ Error: ${result.message}`, ephemeral: true });
                    }

                } else if (i.customId.startsWith('reset_')) {
                    const type = i.customId.split('_')[1];
                    const result = await resetLicenseIdentities(key, type);
                    if (result.success) {
                         license = result.license;
                         await interaction.editReply({ embeds: [createEmbed(license, currentProduct)], components: createComponents(license, currentProduct) });
                         await i.followUp({ content: `✅ Successfully reset all ${type} for this license.`, ephemeral: true });
                    } else {
                        await i.followUp({ content: `❌ Error: ${result.message}`, ephemeral: true });
                    }
                }
            } catch (err) {
                console.error(`Error in /manage-license collector for customId ${i.customId}:`, err);
                if (!i.replied && !i.deferred) {
                   await i.reply({ content: 'An unexpected error occurred.', ephemeral: true }).catch(()=>{});
                } else {
                   await i.followUp({ content: 'An unexpected error occurred.', ephemeral: true }).catch(()=>{});
                }
            }
        });
        
        collector.on('end', async () => {
             const finalLicenses = await getLicenses();
             const finalProducts = await getProducts();
             const finalLicense = finalLicenses.find(l => l.key === key);
             if (finalLicense) {
                const finalProduct = finalProducts.find(p => p.id === finalLicense.productId);
                const finalEmbed = createEmbed(finalLicense, finalProduct);
                finalEmbed.setFooter({ text: 'This interaction has expired.'});
                interaction.editReply({ embeds: [finalEmbed], components: [] });
             } else {
                interaction.editReply({ content: 'This license no longer exists.', components: [] });
             }
        });
    },
};

async function promptForInput(interaction, modalId, title, label, inputId, placeholder) {
    const modal = new ModalBuilder()
        .setCustomId(`${modalId}_${interaction.id}`)
        .setTitle(title);

    const textInput = new TextInputBuilder()
        .setCustomId(inputId)
        .setLabel(label)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(placeholder)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(textInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    try {
        const modalInteraction = await interaction.awaitModalSubmit({
            time: 60000,
            filter: i => i.customId === `${modalId}_${interaction.id}` && i.user.id === interaction.user.id,
        });
        await modalInteraction.deferUpdate();
        return modalInteraction.fields.getTextInputValue(inputId);
    } catch (err) {
        return null;
    }
}
