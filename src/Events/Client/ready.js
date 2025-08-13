import { ActivityType } from "discord.js";

export default {
  name: "ready",
  // once: true,
  async execute(client) {
    console.log("Client is ready.");
    client.user.setPresence({
      status: "idle", 
      activities: [
        {
          name: "& Analyzing Text Games",
          type: ActivityType.Watching, 
        },
      ],
    });
  },
};
