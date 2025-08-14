import {
  analyzeConversationFromImage,
  describeImage,
} from "../../Textfish/analyzer.js";
import {
  renderConversation,
  convertMessages,
} from "../../Textfish/renderer.js";
import {
  Classification,
  unicodes,
  CLASSIFICATION_ACCURACY_INFO,
  getClassificationAccuracy,
  getAccuracyString,
} from "../../Textfish/analysis.js";
import {
  AttachmentBuilder,
  SlashCommandBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";

////////////////////////
// Config / constants //
////////////////////////

const INCLUDED_CLASSIFICATIONS = [
  "Superbrilliant",
  "Brilliant",
  "Great",
  "Best",
  "Excellent",
  "Good",
  "Book",
  "Interesting",
  "Inaccuracy",
  "Mistake",
  "Miss",
  "Blunder",
  "Megablunder",
  "Forced",
];

/////////////
// Helpers //
/////////////
function buildTally(messages) {
  const tally = Object.fromEntries(
    INCLUDED_CLASSIFICATIONS.map((c) => [c, { left: 0, right: 0 }])
  );

  for (const { classification, side } of messages) {
    if (
      INCLUDED_CLASSIFICATIONS.includes(classification) &&
      (side === "left" || side === "right")
    ) {
      tally[classification][side]++;
    }
  }
  return tally;
}

function formatTally(tally) {
  const formatted = {};
  for (const [classification, counts] of Object.entries(tally)) {
    const unicode = unicodes[classification.toUpperCase()];
    if (unicode) {
      formatted[`${classification}${unicode}`] = counts;
    } else if (counts.left !== 0 || counts.right !== 0) {
      formatted[classification] = counts;
    }
  }
  return formatted;
}

function buildTable(analysis, tallyFormatted) {
  const leftElo = analysis.elo?.left?.toString?.() ?? "0";
  const rightElo = analysis.elo?.right?.toString?.() ?? "0";
  const leftOpponent = analysis.opponents?.left?.slice?.(0, 15) ?? "";
  const rightOpponent = analysis.opponents?.right?.slice?.(0, 15) ?? "";
  const rows = [
    [" ", leftOpponent, rightOpponent],
    [
      "Accuracy",
      getAccuracyString(analysis.messages, "left"),
      getAccuracyString(analysis.messages, "right"),
    ],
    [" ", " ", " "], // padding row
    ...Object.entries(tallyFormatted).map(([classification, counts]) => [
      classification,
      counts.left.toString(),
      counts.right.toString(),
    ]),
    [" ", " ", " "], // padding row
    ["Game Rating", leftElo, rightElo],
  ];

  const colWidths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => row[i].length))
  );

  const pad = (str, width, alignRight = false) =>
    alignRight ? str.padStart(width) : str.padEnd(width);

  let table = "";
  rows.forEach((row, rowIndex) => {
    table +=
      "| " +
      row
        .map((cell, i) => pad(cell, colWidths[i], i > 0 && rowIndex > 0))
        .join(" | ") +
      " |\n";

    if (rowIndex === 0) {
      table += "|-" + colWidths.map((w) => "-".repeat(w)).join("-|-") + "-|\n";
    }
  });

  return "```\n" + table + "\n```";
}

function loadingContainer(text) {
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text)
  );
}

////////////////////////
// Command definition //
////////////////////////
export default {
  allowDms: true,
  data: new SlashCommandBuilder()
    .setName("analyzescreenshot")
    .setDescription("Analyse screenshot of a conversation")
    .setIntegrationTypes(0, 1)
    .setContexts(0, 1, 2)
    .addAttachmentOption((option) =>
      option
        .setRequired(true)
        .setName("screenshot")
        .setDescription("The image to analyze")
    ),

  async execute(interaction, client) {
    const screenshot = interaction.options.getAttachment("screenshot");
    const url = screenshot.url;

    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [loadingContainer("Analyzing...")],
      fetchReply: true,
    });

    const analysis = await analyzeConversationFromImage(url);
    if (!analysis.validScreenshot) {
      return interaction.editReply({
        components: [loadingContainer("Provided screenshot was not valid.")],
      });
    }

    console.log("Analysis: ", analysis);

    await interaction.editReply({
      components: [loadingContainer("Tallying results & rendering...")],
    });

    const result = convertMessages(analysis);
    const leftBubble = analysis.color?.left?.bubble_hex ?? "#808080"; // gray
    const rightBubble = analysis.color?.right?.bubble_hex ?? "#808080";
    const leftText = analysis.color?.left?.text_hex ?? "#FFFFFF"; // white
    const rightText = analysis.color?.right?.text_hex ?? "#FFFFFF";

    const canvas = await renderConversation(
      result,
      leftBubble,
      rightBubble,
      leftText,
      rightText
    );
    const buffer = canvas.toBuffer("image/png");
    const attachment = new AttachmentBuilder(buffer, { name: "analysis.png" });

    const tally = buildTally(analysis.messages);
    const tallyFormatted = formatTally(tally);
    const tableText = buildTable(analysis, tallyFormatted);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**✪ Game Review**"),
        new TextDisplayBuilder().setContent(analysis.comment || "No Comment")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems((item) =>
          item
            .setDescription("Overview of the chatlog")
            .setURL("attachment://analysis.png")
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `*${analysis.opening_name || "No opener name"}*`
        ),
        new TextDisplayBuilder().setContent(tableText)
      );

    await interaction.editReply({
      files: [attachment],
      components: [container],
    });
  },
};
