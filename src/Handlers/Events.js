import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

export default async (client, Discord) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const event_folders = readdirSync(path.join(__dirname, "../Events"));

  for (const folder of event_folders) {
    const event_files = readdirSync(path.join(__dirname, `../Events/${folder}`))
      .filter(file => file.endsWith(".js"));

    for (const file of event_files) {
      const filePath = path.join(__dirname, `../Events/${folder}/${file}`);

      // Convert to file:// URL so Windows doesn't break
      const eventModule = await import(pathToFileURL(filePath).href);

      const handler = eventModule.default || eventModule;

      if (handler.once) {
        client.once(handler.name, (...args) =>
          handler.execute(...args, client, Discord)
        );
      } else {
        client.on(handler.name, (...args) =>
          handler.execute(...args, client, Discord)
        );
      }
    }
  }
};
