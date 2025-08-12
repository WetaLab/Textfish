import { createCanvas } from "canvas";
import { getEloColor } from "./color.js";

export function renderAnalysis(analysis) {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = analysis.color.background_hex || "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.font = "20px Arial";
  ctx.fillStyle = "#000";
  ctx.fillText(`Opening: ${analysis.opening_name}`, 20, 40);
  ctx.fillText(`Comment: ${analysis.comment}`, 20, 70);

  let y = 120;
  for (const msg of analysis.messages) {
    ctx.fillStyle = msg.side === "left" ? getEloColor(analysis.elo.left) : getEloColor(analysis.elo.right);
    ctx.fillRect(msg.side === "left" ? 20 : 400, y - 20, 360, 40);
    ctx.fillStyle = "#fff";
    ctx.fillText(msg.content, msg.side === "left" ? 30 : 410, y + 5);
    y += 60;
  }

  return canvas.toBuffer();
}
