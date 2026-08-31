export function withTimeout(operation, timeoutMs, message) {
  let timeoutId;
  const work = typeof operation === "function"
    ? Promise.resolve().then(operation)
    : Promise.resolve(operation);

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timeoutId));
}
