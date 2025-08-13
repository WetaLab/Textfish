import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  Partials,
  Collection,
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  fetchAllMembers: true,
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel],
});
client.commands = new Collection();

["Events", "Commands"].forEach((handler) => {
  import(`./src/Handlers/${handler}.js`).then((module) => {
    module.default(client);
  });
});

client.login(process.env.DISCORD_TOKEN);
