import { analyzeConversationFromText } from "../../Textfish/analyzer.js";
import { renderConversation } from "../../Textfish/renderer.js";
import { Classification } from "../../Textfish/analysis.js";
import {
  AttachmentBuilder,
  SlashCommandBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";

function convertMessages(data) {
  return data.messages.map((msg) => {
    const username = data.opponents[msg.side] || "Unknown";
    return {
      username,
      content: msg.content,
      side: msg.side,
      classification: msg.classification.toUpperCase(),
    };
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName("analyze")
    .setDescription("Analyse x amount of sent messages.")
    .setIntegrationTypes(0, 1) // Can be both 0, 1 for both guild & user install
    .setContexts(0, 1, 2)
    .addIntegerOption((option) =>
      option
        .setName("messages")
        .setDescription("The number of messages to fetch (max 10)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction, client) {
    const amount = interaction.options.getInteger("messages");

    const fMessagesComponent = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Fetching messages...")
    );

    const sentMessage = await interaction.followUp({
      flags: MessageFlags.IsComponentsV2,
      components: [fMessagesComponent],
    });

    const fetched = await interaction.channel.messages.fetch({ limit: amount });

    const messagesArray = fetched
      .filter(
        (msg) =>
          msg.content && 
          msg.content.trim() !== "" &&
          msg.author.id !== client.user.id
      )
      .map((msg) => `${msg.author.username}: ${msg.content}`);

    console.log(fetched, messagesArray);

    const fAnalyzing = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Analyzing...")
    );

    await sentMessage.edit({ components: [fAnalyzing] });
    const analysis = await analyzeConversationFromText(messagesArray.reverse());

    const fTallying = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Tallying results & rendering...")
    );

    await sentMessage.edit({ components: [fTallying] });
    const result = convertMessages(analysis);
    const canvas = await renderConversation(
      result,
      analysis.color.left.bubble_hex,
      analysis.color.right.bubble_hex
    );
    //analysis.color.left.text_hex,
    //analysis.color.right.text_hex
    //);

    const buffer = canvas.toBuffer("image/png");
    const attachment = new AttachmentBuilder(buffer, { name: "analysis.png" });

    const introTitle = new TextDisplayBuilder().setContent("**✪ Game Review**");

    const comment = new TextDisplayBuilder().setContent(
      analysis.comment || "No Comment"
    );

    const chatLog = new MediaGalleryBuilder().addItems((mediaGalleryItem) =>
      mediaGalleryItem
        .setDescription("Overview of the chatlog")
        .setURL("attachment://analysis.png")
    );

    const opener = new TextDisplayBuilder().setContent(
      "*" + analysis.opening_name + "*" || "*No opener name*"
    );

    const includedClassifications = [
      "Superbrilliant",
      "Brilliant",
      "Great",
      "Best",
      "Excellent",
      "Good",
      "Book",
      "Inaccuracy",
      "Mistake",
      "Miss",
      "Blunder",
      "Megablunder",
    ];

    const tally = {};
    includedClassifications.forEach((c) => {
      tally[c] = { left: 0, right: 0 };
    });

    for (const msg of analysis.messages) {
      const { classification, side } = msg;
      if (
        includedClassifications.includes(classification) &&
        (side === "left" || side === "right")
      ) {
        tally[classification][side]++;
      }
    }

    const leftHeader = analysis.opponents.left;
    const rightHeader = analysis.opponents.right;

    const rows = [
      ["Classification", leftHeader, rightHeader],
      ...Object.entries(tally).map(([classification, counts]) => [
        classification,
        counts.left.toString(),
        counts.right.toString(),
      ]),
      [
        "Game Rating",
        analysis.elo.left.toString(),
        analysis.elo.right.toString(),
      ],
    ];

    const colWidths = rows[0].map((_, colIndex) =>
      Math.max(...rows.map((row) => row[colIndex].length))
    );

    const pad = (str, width, alignRight = false) =>
      alignRight ? str.padStart(width) : str.padEnd(width);

    let table = "";
    rows.forEach((row, rowIndex) => {
      table +=
        "| " +
        row
          .map(
            (cell, i) => pad(cell, colWidths[i], i > 0 && rowIndex > 0) 
          )
          .join(" | ") +
        " |\n";

      if (rowIndex === 0) {
        table +=
          "|-" + colWidths.map((w) => "-".repeat(w)).join("-|-") + "-|\n";
      }
    });

    const tableText = new TextDisplayBuilder().setContent(
      "```\n" + table + "\n```"
    );

    const container = new ContainerBuilder()
      .addTextDisplayComponents(introTitle, comment)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
      )
      .addMediaGalleryComponents(chatLog)
      .addTextDisplayComponents(opener)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
      )
      .addTextDisplayComponents(tableText);

    await sentMessage.edit({
      files: [attachment],
      components: [container],
    });
  },
};
