
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { updateLicensesByPlatformId } = require('../../lib/data-access');
const cheerio = require('cheerio');

const linkTokens = new Map();

async function scrapeBuiltByBitProfile(builtByBitId) {
    try {
        const response = await fetch(`https://builtbybit.com/members/${builtByBitId}/`);
        if (!response.ok) {
            return { success: false, message: 'Could not fetch BuiltByBit profile. Is the ID correct?' };
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const aboutMeText = $('.memberAboutMe').text();
        return { success: true, aboutMe: aboutMeText };
    } catch (error) {
        console.error(`Error scraping BBB profile ${builtByBitId}:`, error);
        return { success: false, message: 'An unexpected error occurred while checking the profile.' };
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('link-builtbybit')
        .setDescription('Link your BuiltByBit account to your Discord account.')
        .addStringOption(option =>
            option.setName('builtbybit_id')
                .setDescription('Your numerical BuiltByBit user ID.')
                .setRequired(true)),
    async execute(interaction) {
        const builtByBitId = interaction.options.getString('builtbybit_id');
        const discordUserId = interaction.user.id;
        
        if (isNaN(parseInt(builtByBitId))) {
            return interaction.reply({ content: 'Please provide a valid numerical BuiltByBit user ID.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        
        const token = `LF-LINK-${require('crypto').randomUUID().substring(0, 8)}`;
        linkTokens.set(discordUserId, { token, builtByBitId });

        const embed = new EmbedBuilder()
            .setTitle('Link your BuiltByBit Account')
            .setColor('#5865F2')
            .setDescription('To verify you own this BuiltByBit account, please complete the following steps.')
            .addFields(
                { name: 'Step 1: Copy your Token', value: `\`${token}\`` },
                { name: 'Step 2: Update your Profile', value: `Go to your [BuiltByBit profile](https://builtbybit.com/account/about-you) and paste the token anywhere in your "About Me" section.` },
                { name: 'Step 3: Verify', value: 'Once you have updated your profile, click the "Verify" button below. The token will expire in 5 minutes.' }
            )
            .setFooter({ text: `Attempting to link BuiltByBit ID: ${builtByBitId}`});

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_bbb_link')
                    .setLabel('Verify')
                    .setStyle(ButtonStyle.Primary)
            );

        const reply = await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
        
        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId === 'verify_bbb_link') {
                await i.deferUpdate();
                const storedData = linkTokens.get(i.user.id);
                if (!storedData) {
                    return i.followUp({ content: 'Your verification token has expired. Please run the command again.', ephemeral: true });
                }

                const { token: storedToken, builtByBitId: storedId } = storedData;
                
                const scrapeResult = await scrapeBuiltByBitProfile(storedId);

                if (!scrapeResult.success) {
                    return i.followUp({ content: `Error: ${scrapeResult.message}`, ephemeral: true });
                }

                if (scrapeResult.aboutMe && scrapeResult.aboutMe.includes(storedToken)) {
                    const result = await updateLicensesByPlatformId('builtbybit', storedId, i.user.id);

                    if (result.success) {
                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Account Linked Successfully!')
                            .setColor('#22C55E')
                            .setDescription(`Your BuiltByBit account (\`${storedId}\`) has been successfully linked to your Discord account. Any existing and future licenses purchased with this BuiltByBit account will be associated with you.`)
                            .setFooter({text: "You can now remove the token from your profile."});
                        await i.editReply({ embeds: [successEmbed], components: [] });

                    } else {
                         await i.followUp({ content: `Error linking account: ${result.message}`, ephemeral: true });
                    }
                    
                    linkTokens.delete(i.user.id);
                    collector.stop();

                } else {
                    await i.followUp({ content: 'Verification failed. We could not find the token in your BuiltByBit profile. Please ensure it was saved correctly and try again.', ephemeral: true });
                }
            }
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) {
                 const expiredEmbed = new EmbedBuilder(embed.toJSON())
                    .setTitle('Link Expired')
                    .setDescription('This verification request has expired. Please run the command again.')
                    .setColor('#ED4245');
                interaction.editReply({ embeds: [expiredEmbed], components: [] });
            }
            linkTokens.delete(discordUserId);
        });
    },
};
