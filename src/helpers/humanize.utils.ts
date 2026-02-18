interface CalculateTypingDurationParams {
  messageLength: number;
  minSpeed: number; // in milliseconds per character
  maxSpeed: number; // in milliseconds per character
}

function calculateTypingDuration({ messageLength, minSpeed, maxSpeed }: CalculateTypingDurationParams): number {
  const seed = Math.random();
  const speedRange = maxSpeed - minSpeed;
  const randomSpeed = minSpeed + seed * speedRange;
  const typingTime = messageLength * randomSpeed;

  return typingTime;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { calculateTypingDuration, sleep };
