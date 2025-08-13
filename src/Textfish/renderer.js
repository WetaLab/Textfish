import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

registerFont(path.join(__dirname, "fonts/Inter.ttf"), { family: "Inter" });

const CANVAS_WIDTH = 650;
const PADDING = 16;
const AVATAR_SIZE = 48;
const BUBBLE_RADIUS = 14;
const MAX_BUBBLE_WIDTH = 300;
const FONT_FAMILY = "Inter";
const FONT_SIZE = 18;

const COLORS = {
  background: "#18181b",
  text: "#e4e4e7",
  avatarBg: "#71717a",
};

function drawAvatar(ctx, x, y, username) {
  ctx.fillStyle = COLORS.avatarBg;
  ctx.beginPath();
  ctx.arc(
    x + AVATAR_SIZE / 2,
    y + AVATAR_SIZE / 2,
    AVATAR_SIZE / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `bold 20px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initials = username
    .split(" ")
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
  ctx.fillText(initials, x + AVATAR_SIZE / 2, y + AVATAR_SIZE / 2);
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  const words = text.split(" ");
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }

    while (ctx.measureText(currentLine).width > maxWidth) {
      let fitLength = 0;
      let sliceWidth = 0;

      for (let i = 0; i < currentLine.length; i++) {
        const charWidth = ctx.measureText(currentLine[i]).width;
        if (sliceWidth + charWidth > maxWidth) break;
        sliceWidth += charWidth;
        fitLength++;
      }

      lines.push(currentLine.slice(0, fitLength));
      currentLine = currentLine.slice(fitLength);
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

async function renderMessage(
  ctx,
  message,
  y,
  bubbleColorLeft,
  bubbleColorRight,
  textColorLeft,
  textColorRight
) {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  const maxBubbleWidth = MAX_BUBBLE_WIDTH;
  const lines = wrapText(ctx, message.content, maxBubbleWidth - PADDING * 2);

  const lineHeight = FONT_SIZE * 1.4;
  const bubbleHeight = lines.length * lineHeight + PADDING * 2;

  const maxLineWidth = Math.max(
    ...lines.map((line) => ctx.measureText(line).width)
  );

  const words = message.content.split(" ");
  const maxWordWidth = Math.max(
    ...words.map((word) => ctx.measureText(word).width)
  );

  const minBubbleWidth = maxWordWidth + PADDING * 2;

  const bubbleWidth =
    Math.min(
      maxBubbleWidth,
      Math.max(minBubbleWidth, maxLineWidth + PADDING * 2 + 10)
    ) + 60;

  const isRightSide = message.side === "right";

  const bubbleX = isRightSide
    ? CANVAS_WIDTH - bubbleWidth - AVATAR_SIZE - PADDING * 3
    : AVATAR_SIZE + PADDING * 2;
  const avatarX = isRightSide ? CANVAS_WIDTH - AVATAR_SIZE - PADDING : PADDING;

  drawAvatar(ctx, avatarX, y, message.username);

  ctx.fillStyle = isRightSide ? bubbleColorRight : bubbleColorLeft;
  roundRect(ctx, bubbleX, y, bubbleWidth, bubbleHeight, BUBBLE_RADIUS, true);

  ctx.fillStyle = isRightSide ? textColorRight : textColorLeft;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    const textX = bubbleX + PADDING;
    const textY = y + PADDING + i * lineHeight;
    ctx.fillText(line, textX, textY);
  });

  if (message.classification) {
    let badgePath;
    if (message.classification.toLowerCase() == "checkmated") {
      badgePath = path.join(
        __dirname,
        "badges",
        `${message.classification.toLowerCase()}_${
          isRightSide ? "white" : "black"
        }.png`
      );
    } else {
      badgePath = path.join(
        __dirname,
        "badges",
        `${message.classification.toLowerCase()}.png`
      );
    }
    try {
      const badgeImg = await loadImage(badgePath);

      const badgeHeight = 55;
      const badgeWidth = (badgeImg.width / badgeImg.height) * badgeHeight;

      const bubbleCenterX = bubbleX + bubbleWidth / 2;
      const canvasCenterX = CANVAS_WIDTH / 2;

      let badgeX;
      if (bubbleCenterX < canvasCenterX) {
        badgeX = bubbleX + bubbleWidth + PADDING;
      } else {
        badgeX = bubbleX - badgeWidth - PADDING;
      }

      const badgeY = y + (bubbleHeight - badgeHeight) / 2;

      ctx.drawImage(badgeImg, badgeX, badgeY, badgeWidth, badgeHeight);
    } catch (e) {
      console.warn(`Badge image not found or failed to load: ${badgePath}`);
    }
  }

  return Math.max(bubbleHeight, AVATAR_SIZE) + PADDING;
}

export async function renderConversation(
  messages,
  bubbleColorLeft,
  bubbleColorRight,
  textColorLeft,
  textColorRight
) {
  let totalHeight = PADDING;
  const ctxTmp = createCanvas(100, 100).getContext("2d");
  ctxTmp.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  for (const msg of messages) {
    const lines = wrapText(ctxTmp, msg.content, MAX_BUBBLE_WIDTH - PADDING * 2);
    const lineHeight = FONT_SIZE * 1.4;
    const bubbleHeight = lines.length * lineHeight + PADDING * 2;
    totalHeight += Math.max(bubbleHeight, AVATAR_SIZE) + PADDING;
  }

  const canvas = createCanvas(CANVAS_WIDTH, totalHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = PADDING;
  for (const msg of messages) {
    y += await renderMessage(
      ctx,
      msg,
      y,
      bubbleColorLeft,
      bubbleColorRight,
      textColorLeft,
      textColorRight
    );
  }

  return canvas;
}
