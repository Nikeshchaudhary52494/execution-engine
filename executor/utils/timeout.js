export const timeoutPromise = (ms, onTimeout) => {
  return new Promise((_, reject) =>
    setTimeout(async () => {
      await onTimeout();
      reject(new Error("TIMEOUT"));
    }, ms)
  );
}
