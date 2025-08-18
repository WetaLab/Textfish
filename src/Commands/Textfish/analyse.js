import {
  analyzeConversationFromText,
  describeImage,
} from "../../Textfish/analyzer.js";
import {
  renderConversation,
  convertMessages,
} from "../../Textfish/renderer.js";
import { unicodes, getAccuracyString } from "../../Textfish/analysis.js";
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
function loadingContainer(text) {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text)
  );

  if (text === "Analyzing...") {
    if (Math.floor(Math.random() * 100) === 0) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems((item) =>
          item
            .setDescription("Jarvis...")
            .setURL(
              "https://cdn.discordapp.com/attachments/495994825833709619/1406787521232240690/caption.gif?ex=68a3bc79&is=68a26af9&hm=ef3e4b7217512651efe9596de4935eca1dc4642f0b09a3e43f15317f683d1ab6&"
            )
        )
      );
    }
  }

  return container;
}

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
    [" ", " ", " "], // Padding
    ...Object.entries(tallyFormatted).map(([classification, counts]) => [
      classification,
      counts.left.toString(),
      counts.right.toString(),
    ]),
    [" ", " ", " "], // Padding
    ["Game Rating", leftElo, rightElo],
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
        .map((cell, i) => pad(cell, colWidths[i], i > 0 && rowIndex > 0))
        .join(" | ") +
      " |\n";

    if (rowIndex === 0) {
      table += "|-" + colWidths.map((w) => "-".repeat(w)).join("-|-") + "-|\n";
    }
  });

  return "```\n" + table + "\n```";
}

async function fetchMessagesWithImageDescriptions(channel, amount) {
  const fetchedInit = await channel.messages.fetch({ limit: amount + 1 });
  const fetched = [];

  for (const message of fetchedInit.values()) {
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment?.contentType?.startsWith("image")) {
        const description = await describeImage(attachment.url);
        message.content += " " + description;
      }
    }
    if (message.content.trim()) {
      fetched.push(message);
    }
  }
  return fetched;
}

////////////////////////
// Command definition //
////////////////////////
export default {
  data: new SlashCommandBuilder()
    .setName("analyze")
    .setDescription("Analyse x amount of sent messages.")
    .setIntegrationTypes(0, 1)
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

    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [loadingContainer("Fetching messages...")],
      fetchReply: true,
    });

    if (!interaction.channel) {
      return await interaction.editReply({
        components: [
          loadingContainer(
            "Failed to fetch messages, do I have the proper permissions?"
          ),
        ],
      });
    }

    const fetched = await fetchMessagesWithImageDescriptions(
      interaction.channel,
      amount
    );

    const messagesArray = fetched
      .filter((msg) => msg.author.id !== client.user.id)
      .map((msg) => `${msg.author.username}: ${msg.content}`);

    await interaction.editReply({
      components: [loadingContainer("Analyzing...")],
    });
    const analysis = await analyzeConversationFromText(messagesArray.reverse());

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

    const tallyFormatted = formatTally(buildTally(analysis.messages));
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
