interface CalculateTypingDurationParams {
  messageLength: number;
  minDelay: number; // in milliseconds per character
  maxDelay: number; // in milliseconds per character
}

function calculateTypingDuration({ messageLength, minDelay, maxDelay }: CalculateTypingDurationParams): number {
  const seed = Math.random();
  const speedRange = maxDelay - minDelay;
  const randomSpeed = minDelay + seed * speedRange;
  const typingTime = messageLength * randomSpeed;

  return typingTime;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { calculateTypingDuration, sleep };
