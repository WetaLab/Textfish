import { readdirSync } from "fs";
import { REST, Routes } from "discord.js";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

export default async (client) => {
  client.rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const command_folder = readdirSync(path.join(__dirname, "../Commands"));
  client.commands_array = [];

  for (const folder of command_folder) {
    const command_files = readdirSync(
      path.join(__dirname, `../Commands/${folder}`)
    ).filter((file) => file.endsWith(".js"));

    for (const file of command_files) {
      const filePath = path.join(__dirname, `../Commands/${folder}/${file}`);
      const commandModule = await import(pathToFileURL(filePath).href);
      const command = commandModule.default || commandModule;

      client.commands.set(command.data.name, command);

      client.commands_array.push(command.data.toJSON());
    }
  }

  client.on("ready", () => {
    console.log(`Application commands sent ${process.env.APPID_TH}`);
    client.rest.put(Routes.applicationCommands(process.env.APPID_TH), {
      body: client.commands_array,
    });
  });
};
