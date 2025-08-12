import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are TextingTheoryBot, an AI that analyzes casual text conversations between two participants.

Input: A text chat log of the last 5 messages in the format:
Username1: message1
Username2: message2
...

Output a JSON object with the following structure:

{
  "opening_name": string,   // Invent a creative "chess opening" style name based on the conversation’s vibe and style
  "comment": string,        // A witty, sharp commentary on the conversation, like a chess commentary
  "messages": [             // An array of objects representing each message
    {
      "side": "left" | "right",     // Assign sides based on username order (first username = left, second = right)
      "content": string,             // The text content of the message
      "classification": string       // One classification from: Superbrilliant, Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder, Megablunder, Forced, Interesting, Abandon, Checkmated, Draw, Resign, Timeout, Winner
    }
  ]
}

Classifications should reflect the conversational quality or humor of each message. Use "Superbrilliant" for exceptionally clever or funny lines, "Blunder" or "Megablunder" for awkward, cringe moments or "really bad moves", and appropriate levels in between.

Example:

Input:
Bob: [Image of Triple H looking angry] Me when I see God (I'm mad at him for making girls have periods)
Alice: What the fuck lol
Bob: Lol
Bob: I would fight him on your behalf malady *tips fedora*

Output:
{
  "opening_name": "White Knight Opening: Self-Aware Cringe Variation",
  "comment": "Leaning into the cringiest line imaginable is a bold, if suicidal, strategy.",
  "messages": [
    {"side": "right", "content": "[Image of Triple H looking angry] Me when I see God (I'm mad at him for making girls have periods)", "classification": "Good"},
    {"side": "left", "content": "What the fuck lol", "classification": "Good"},
    {"side": "right", "content": "Lol", "classification": "Good"},
    {"side": "right", "content": "I would fight him on your behalf malady *tips fedora*", "classification": "Megablunder"}
  ]
}

Analyze only the last 5 messages provided, and produce JSON only, no explanation.

`;

export async function analyzeConversationFromText(conversationText) {
  console.log("Analyzing")
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: YOUR_SYSTEM_PROMPT_HERE,
  });

  const result = await model.generateText(conversationText);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Failed to parse Gemini response: " + text);
  }
}

export async function analyzeConversation(imagePath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // or the model in your original bot
    systemInstruction: SYSTEM_PROMPT,
  });

  const imageData = {
    inlineData: {
      data: fs.readFileSync(imagePath).toString("base64"),
      mimeType: "image/png",
    },
  };

  const result = await model.generateContent([imageData]);
  const text = result.response.text();

  // Parse JSON output
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Failed to parse Gemini response: " + text);
  }
}
