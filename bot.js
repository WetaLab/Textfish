import "dotenv/config";
import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
import {
  analyzeConversation,
  analyzeConversationFromText,
} from "./analyzer.js";
import { renderAnalysis } from "./renderer.js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const analysis = await analyzeConversationFromText([
    "Gray: I swear",
    "Gray: We Didn't Have Sex I Just Gave Him Head",
    "Green: say god",
    "Gray: god",
    "Green: i believe you",
    "Gray: Thank you🙏",
    "Green: [image of Ronald McDonald sitting on a bench looking like a clown]",
    "Green: this must be how you see me",
  ]);

  console.log(analysis);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content !== "!analyse") return;

  const messages = await msg.channel.messages.fetch({ limit: 5 });
  const sorted = Array.from(messages.values()).sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );
  if (sorted.length < 2) {
    await msg.reply("Not enough messages to analyze!");
    return;
  }

  // Only support two participants exactly for now
  const participants = [...new Set(sorted.map((m) => m.author.username))];
  if (participants.length !== 2) {
    await msg.reply("Analysis supports exactly two participants.");
    return;
  }

  const conversationText = sorted
    .map((m) => `${m.author.username}: ${m.content}`)
    .join("\n");

  try {
    const analysis = await analyzeConversationFromText(conversationText);
    const imgBuffer = renderAnalysis(analysis);
    const file = new AttachmentBuilder(imgBuffer, { name: "analysis.png" });
    await msg.reply({ content: "Here's your chat analysis:", files: [file] });
  } catch (err) {
    console.error(err);
    await msg.reply("Sorry, I couldn't analyze the conversation.");
  }
});

client.login(process.env.DISCORD_TOKEN);
