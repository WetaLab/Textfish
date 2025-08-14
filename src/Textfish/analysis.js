export const Classification = {
  SUPERBRILLIANT: "Superbrilliant",
  BRILLIANT: "Brilliant",
  GREAT: "Great",
  BEST: "Best",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  BOOK: "Book",
  INACCURACY: "Inaccuracy",
  MISTAKE: "Mistake",
  MISS: "Miss",
  BLUNDER: "Blunder",
  MEGABLUNDER: "Megablunder",
  FORCED: "Forced",
  INTERESTING: "Interesting",
  ABANDON: "Abandon",
  CHECKMATED: "Checkmated",
  DRAW: "Draw",
  RESIGN: "Resign",
  TIMEOUT: "Timeout",
  WINNER: "Winner"
};

export const unicodes = {
  SUPERBRILLIANT: " (!!!)",
  BRILLIANT: " (!!)",
  GREAT: " (!)",
  BEST: " (★)",
  MISTAKE: " (?)",
  MISS: " (X)",
  BLUNDER: " (??)",
  MEGABLUNDER: " (???)",
};

export const CLASSIFICATION_ACCURACY_INFO = {
  SUPERBRILLIANT: { accuracy: 100, radius: 0 },
  BRILLIANT: { accuracy: 100, radius: 0 },
  GREAT: { accuracy: 100, radius: 0 },
  BEST: { accuracy: 100, radius: 0 },
  EXCELLENT: { accuracy: 99, radius: 1 },
  GOOD: { accuracy: 96.5, radius: 1.5 },
  BOOK: { accuracy: 100, radius: 2 },
  INACCURACY: { accuracy: -7.5, radius: 2.5 },
  MISTAKE: { accuracy: -15, radius: 5 },
  MISS: { accuracy: -10, radius: 3 },
  BLUNDER: { accuracy: -60, radius: 40 },
  MEGABLUNDER: { accuracy: -100, radius: 0 },
};

export function getClassificationAccuracy(classification) {
  const { accuracy, radius } = CLASSIFICATION_ACCURACY_INFO[classification];
  const jitter = (Math.random() * 2 - 1) * radius;
  return Math.min(100, accuracy + jitter);
}

export function getAccuracyString(messages, side) {
  const playerMessages = messages.filter((msg) => msg.side == side);
  let totalScore = 0;
  let classifiedMovesCount = 0;

  for (const msg of playerMessages) {
    if (CLASSIFICATION_ACCURACY_INFO[msg.classification.toUpperCase()]) {
      totalScore += getClassificationAccuracy(msg.classification.toUpperCase());
      classifiedMovesCount++;
    }
  }

  if (classifiedMovesCount === 0) return "0.0";
  const averageAccuracy = totalScore / classifiedMovesCount;
  return Math.min(100, Math.max(0, averageAccuracy)).toFixed(1);
}

