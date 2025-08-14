import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  Type,
} from "@google/genai";
import axios from "axios";
import { Classification } from "./analysis.js";
import fs from "fs";

const ai = new GoogleGenAI({
  vertexai: false,
  apiKey: process.env.GEMINI_API_KEY,
});

const describeAi = new GoogleGenAI({
  vertexai: false,
  apiKey: process.env.GEMINI_API_KEY,
});

const dayOfWeek = new Date().toLocaleString("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
});
const validClassifications = Object.values(Classification).filter((c) => {
  if (c === Classification.MEGABLUNDER) return dayOfWeek === "Monday";
  if (c === Classification.SUPERBRILLIANT) return dayOfWeek === "Saturday";
  return true;
});

const SYSTEM_PROMPT = fs.readFileSync("./prompts/text_prompt.txt", "utf-8");
const SYSTEM_PROMPT_FOR_SCREENSHOTS = fs.readFileSync(
  "./prompts/screenshot_prompt.txt",
  "utf-8"
);

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.OFF,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.OFF,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.OFF,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.OFF,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.OFF,
  },
];

const thinkingConfig = { thinkingBudget: 512 };

const createConfig = (systemInstruction) => ({
  temperature: 0,
  responseMimeType: "application/json",
  thinkingConfig,
  safetySettings,
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      messages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            side: { type: Type.STRING, enum: ["left", "right"] },
            content: { type: Type.STRING },
            classification: { type: Type.STRING, enum: validClassifications },
          },
          required: ["side", "content", "classification"],
        },
      },
      validScreenshot: {
        type: Type.BOOLEAN,
        description:
          "Is the image actually an valid screenshot of a text interaction. (Ignore this by setting it to true if you are not analyzing a screenshot)",
      },
      elo: {
        type: Type.OBJECT,
        description: "Estimated Elo ratings for the players.",
        properties: {
          left: {
            type: Type.INTEGER,
            minimum: 100,
            maximum: 3000,
            nullable: true,
            description: `Estimated Elo (integer) for the "left" player.`,
          },
          right: {
            type: Type.INTEGER,
            minimum: 100,
            maximum: 3000,
            nullable: true,
            description: `Estimated Elo (integer) for the "right" player.`,
          },
        },
      },
      opponents: {
        type: Type.OBJECT,
        description: "Opponents found within the messages",
        properties: {
          left: {
            type: Type.STRING,
            description: "The username of the left messenger",
          },
          right: {
            type: Type.STRING,
            description: "The username of the right messenger",
          },
        },
      },
      color: {
        type: Type.OBJECT,
        description: "Color theme for the chat display.",
        properties: {
          left: {
            type: Type.OBJECT,
            description: `Color info for the "left" player. Omit if no messages from "left".`,
            properties: {
              label: {
                type: Type.STRING,
                description: `Simple, one-word color name (e.g., "Gray")`,
              },
              bubble_hex: {
                type: Type.STRING,
                description: "Hex code for the message bubble.",
              },
              text_hex: {
                type: Type.STRING,
                description: "Hex code for the text color.",
              },
            },
            required: ["label", "bubble_hex", "text_hex"],
          },
          right: {
            description: `Color info for the "right" player. Omit if no messages from "right".`,
            type: Type.OBJECT,
            properties: {
              label: {
                type: Type.STRING,
                description: `Simple, one-word color name (e.g., "Purple")`,
              },
              bubble_hex: {
                type: Type.STRING,
                description: "Hex code for the message bubble.",
              },
              text_hex: {
                type: Type.STRING,
                description: "Hex code for the text color.",
              },
            },
            required: ["label", "bubble_hex", "text_hex"],
          },
          background_hex: {
            type: Type.STRING,
            description: "Hex code for the overall chat background.",
          },
        },
        required: ["background_hex"],
      },
      opening_name: {
        type: Type.STRING,
        description: "A creative and funny opening name for the game.",
      },
      comment: {
        type: Type.STRING,
        description: "A one-sentence comment on the game.",
      },
    },
    required: [
      "messages",
      "elo",
      "color",
      "opening_name",
      "comment",
      "opponents",
      "validScreenshot",
    ],
  },
  systemInstruction,
});

export async function describeImage(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const imageBytes = Buffer.from(response.data);
    const contents = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBytes.toString("base64"),
        },
      },
      {
        text: "Describe this image in one short sentence, only the description, nothing else. Use the format Image of ...",
      },
    ];

    const result = await describeAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    var text = result.candidates[0]?.content.parts[0].text || "";
    if (text.endsWith(".")) {
      text = text.slice(0, -1);
    }

    return `[${text}]`;
  } catch (e) {
    console.error("Error generating image description:", e);
    return "";
  }
}

export async function analyzeConversationFromText(conversationText) {
  console.log("Analyzing conversation...");
  const config = createConfig(SYSTEM_PROMPT);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: conversationText.join("\n"),
      config,
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.warn("Failed to parse response, retrying with flash model...", e);
      const retryResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: conversationText.join("\n"),
        config,
      });
      return JSON.parse(retryResponse.text);
    }
  } catch (e) {
    console.error("Error analyzing conversation:", e);
  }
}

export async function analyzeConversationFromImage(url) {
  console.log("Fetching buffer from screenshot...");
  const responseData = await axios.get(url, { responseType: "arraybuffer" });
  const imageBytes = Buffer.from(responseData.data);

  const contents = [
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBytes.toString("base64"),
      },
    },
  ];
  console.log("Analyzing screenshot...");
  const config = createConfig(SYSTEM_PROMPT_FOR_SCREENSHOTS);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
      config,
    });

    return JSON.parse(response.text);
  } catch (e) {
    console.warn("Failed to parse response, retrying with flash model...", e);
    const retryResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config,
    });
    return JSON.parse(retryResponse.text);
  }
}
