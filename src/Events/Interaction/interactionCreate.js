import { PermissionsBitField } from "discord.js";

export default {
  name: "interactionCreate",

  /**
   * @param {import("discord.js").Client} client
   * @param {import("discord.js").CommandInteraction} interaction
   **/
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (interaction.channel?.isDMBased()) {
      if (!command.allowDms)
        return interaction.reply({
          ephemeral: true,
          content: "This command cannot be ran in a DM.",
        });
    }

    if (command.permission) {
      const member = interaction.member;
      if (!member.permissions || !member.permissions.has(command.permission)) {
        return interaction.reply({
          ephemeral: true,
          files: [`./external/assets/ACCESS DENIED.mp3`],
        });
      }
    }

    const deferOptions = { ephemeral: !!command.ephemeral };
    //await interaction.deferReply(deferOptions).catch(() => {});

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      if (command.rollback) {
        command.rollback(interaction, client, error);
      } else {
        try {
          await interaction.reply({
            content: "A critical error has occurred while running this action.",
            ephemeral: true,
          });
        } catch (err) {
          console.error("Failed to send error message", err);
        }
      }
    }
  },
};
