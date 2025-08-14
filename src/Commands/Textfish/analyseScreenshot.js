import { analyzeConversationFromImage } from "../../Textfish/analyzer.js";
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

const unicodes = {
  SUPERBRILLIANT: " (!!!)",
  BRILLIANT: " (!!)",
  GREAT: " (!)",
  BEST: " (★)",
  MISTAKE: " (?)",
  MISS: " (X)",
  BLUNDER: " (??)",
  MEGABLUNDER: " (???)",
};

const CLASSIFICATION_ACCURACY_INFO = {
  SUPERBRILLIANT: { accuracy: 100, radius: 0 },
  BRILLIANT: { accuracy: 100, radius: 0 },
  GREAT: { accuracy: 100, radius: 0 },
  BEST: { accuracy: 100, radius: 0 },
  EXCELLENT: { accuracy: 99, radius: 1 },
  GOOD: { accuracy: 96.5, radius: 1.5 },
  BOOK: { accuracy: 100, radius: 2 },
  INACCURACY: { accuracy: -7.5, radius: 2.5 },
  MISTAKE: { accuracy: -15, radius: 5 },
  MISS: { accuracy: -10, radius: 3 },
  BLUNDER: { accuracy: -60, radius: 40 },
  MEGABLUNDER: { accuracy: -100, radius: 0 },
};

function getClassificationAccuracy(classification) {
  const { accuracy, radius } = CLASSIFICATION_ACCURACY_INFO[classification];
  const jitter = (Math.random() * 2 - 1) * radius;
  return Math.min(100, accuracy + jitter);
}

function getAccuracyString(messages, side) {
  const playerMessages = messages.filter((msg) => msg.side == side);
  let totalScore = 0;
  let classifiedMovesCount = 0;

  for (const msg of playerMessages) {
    if (CLASSIFICATION_ACCURACY_INFO[msg.classification.toUpperCase()]) {
      totalScore += getClassificationAccuracy(msg.classification.toUpperCase());
      classifiedMovesCount++;
    }
  }

  if (classifiedMovesCount === 0) return "0.0";
  const averageAccuracy = totalScore / classifiedMovesCount;
  return Math.min(100, Math.max(0, averageAccuracy)).toFixed(1);
}

function convertMessages(data) {
  return data.messages.map((msg) => {
    const username = data.opponents[msg.side] || "Unknown";
    return {
      username,
      content: msg.content.replace("\n", " "),
      side: msg.side,
      classification: msg.classification.toUpperCase(),
    };
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName("analyzescreenshot")
    .setDescription("Analyse screenshot of a conversation")
    .setIntegrationTypes(0, 1) // Can be both 0, 1 for both guild & user install
    .setContexts(0, 1, 2)
    .addAttachmentOption((option) =>
      option
        .setRequired(true)
        .setName("screenshot")
        .setDescription("The image to screenshot")
    ),

  async execute(interaction, client) {
    const attachmentArgument = interaction.options.getAttachment("screenshot");
    const url = attachmentArgument.url;

    const fAnalyzing = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Analyzing...")
    );

    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [fAnalyzing],
      fetchReply: true,
    });
    const analysis = await analyzeConversationFromImage(url);

    if (analysis.validScreenshot == false) {
      const fFailed = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "Provided screenshot was not valid."
        )
      );
      return interaction.editReply({ components: [fFailed] });
    }

    const fTallying = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Tallying results & rendering...")
    );

    await interaction.editReply({ components: [fTallying] });
    const result = convertMessages(analysis);
    const canvas = await renderConversation(
      result,
      analysis.color.left.bubble_hex,
      analysis.color.right.bubble_hex,
      analysis.color.left.text_hex,
      analysis.color.right.text_hex
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
      "Interesting",
      "Inaccuracy",
      "Mistake",
      "Miss",
      "Blunder",
      "Megablunder",
      "Forced",
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

    var tallyFormatted = {};

    console.log(tally);

    for (const classification in tally) {
      if (unicodes[classification.toUpperCase()]) {
        tallyFormatted[
          `${classification}${unicodes[classification.toUpperCase()]}`
        ] = tally[classification];
      } else {
        let left = tally[classification].left;
        let right = tally[classification].right;
        if (left == 0 && right == 0) {
          console.log("Empty tally:", tally[classification], classification);
        } else {
          tallyFormatted[classification] = tally[classification];
        }
      }
    }

    console.log(tallyFormatted);

    const rows = [
      [" ", leftHeader, rightHeader],
      [
        "Accuracy",
        getAccuracyString(analysis.messages, "left"),
        getAccuracyString(analysis.messages, "right"),
      ],
      [" ", " ", " "], // Padding
      ...Object.entries(tallyFormatted).map(([classification, counts]) => [
        `${classification}`,
        counts.left.toString(),
        counts.right.toString(),
      ]),
      [" ", " ", " "], // Padding

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
          .map((cell, i) => {
            // Adjust width if cell contains "★"
            let width = colWidths[i];
            if (cell.includes("★")) {
              width -= 0;
            }
            return pad(cell, width, i > 0 && rowIndex > 0);
          })
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

    await interaction.editReply({
      files: [attachment],
      components: [container],
    });
  },
};
