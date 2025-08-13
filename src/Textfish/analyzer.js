import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  Type,
} from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: false, // Set to true if using Vertex AI
  apiKey: process.env.GEMINI_API_KEY,
});

const describeAi = new GoogleGenAI({
  vertexai: false,
  apiKey: process.env.GEMINI_API_KEY,
});

import axios from "axios";

import { Classification } from "./analysis.js";
import fs from "fs";

const SYSTEM_PROMPT = `
You are TextingTheoryBot, an AI that analyzes casual text conversations between two participants.

Input: A text chat log of a conversation in the format:
Username1: message1
Username2: message2

The chat log may include messages from people who are not the "opponents", (you have to decide who the opponents are) ignore all messages from non opponents, but you have to analyze ALL messages from the opponents

Classifications:
Message classifications
Brilliant: An extremely clever message, often involves moving from an even or losing position to completely winning.
Great: A message that is extremely difficult to find. Note that this along with Brilliant is not always possible in certain positions.
Best: An Excellent that is not quite as unorthodox and usually a bit stronger.
Excellent: An above-average message.
Good: An average/passing message.
Inaccuracy: A weak message or misstep.
Mistake: Just as the name implies.
Miss: Not just bad, but also a missed opportunity.
Blunder: A devastating mistake that's hard to come back from.
Megablunder: The absolute worst of the worst.
Special classifications
Book: A standard opening message.
Forced: Realistically the only message that makes sense here.
Interesting: Could realistically go either way, it just depends on how the opponent reacts.
Result classifications
Abandon: A player leaves abruptly.
Checkmated: A player gives in to the play of the opponent.
Draw: One or both player(s) settle.
Resign: A player gives up.
Timeout: A player took too long.
Winner: A post-victory message.

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

`;

export async function describeImage(url) {
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
      text: "Describe this image in one short sentence, only the description, nothing else. Use the format image of ...",
    },
  ];

  try {
    const result = await describeAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    console.log("result", result.candidates[0]?.content);
    return "["+result.candidates[0]?.content.parts[0].text + "]" || "";
  } catch (e) {
    console.error("Error generating image description:", e);
    return "";
  }
}

export async function analyzeConversationFromText(conversationText) {
  console.log("Analyzing");
  const dayOfWeek = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  });
  const validClassifications = Object.values(Classification).filter((c) => {
    if (c === Classification.MEGABLUNDER) return dayOfWeek === "Monday";
    if (c === Classification.SUPERBRILLIANT) return dayOfWeek === "Saturday";
    return true;
  });
  const response = await ai.models.generateContent({
    //model: "gemini-2.5-pro",
    model: "gemini-2.5-flash",
    contents: conversationText.join("\n"),
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      thinkingConfig: {
        thinkingBudget: 512,
      },
      safetySettings: [
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
      ],
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
                classification: {
                  type: Type.STRING,
                  enum: validClassifications,
                },
              },
              required: ["side", "content", "classification"],
            },
          },
          elo: {
            type: Type.OBJECT,
            description: "Estimated Elo ratings for the players.",
            properties: {
              left: {
                type: Type.INTEGER,
                minimum: 100,
                maximum: 3000,
                description: `Estimated Elo (integer) for the "left" player.`,
                nullable: true,
              },
              right: {
                type: Type.INTEGER,
                minimum: 100,
                maximum: 3000,
                description: `Estimated Elo (integer) for the "right" player.`,
                nullable: true,
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
                nullable: true,
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
                type: Type.OBJECT,
                description: `Color info for the "right" player. Omit if no messages from "right".`,
                nullable: true,
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
            description: "A creative opening name for the game.",
          },
          comment: {
            type: Type.STRING,
            description: "A one-sentence comment on the game.",
          },
          vote_target: {
            type: Type.STRING,
            enum: ["left", "right"],
            description:
              "If the Reddit post title brackets indicates a vote is being requested for one player (e.g., '[Me]', '[Left]', '[Blue]' etc.), which side ('left' or 'right') you think the vote is for. Omit if no vote is requested in the title.",
            nullable: true,
          },
        },
        required: ["messages", "elo", "color", "opening_name", "comment"],
      },
      systemInstruction: SYSTEM_PROMPT,
    },
  });

  const geminiResponseText = response.text;
  let analysis;
  try {
    analysis = JSON.parse(geminiResponseText);
  } catch (e) {
    console.error(
      `Failed to parse Gemini JSON response: ${e}`,
      geminiResponseText
    );
    return;
  }

  console.log(`Parsed Gemini response: ${JSON.stringify(analysis)}`);

  return analysis;
}
