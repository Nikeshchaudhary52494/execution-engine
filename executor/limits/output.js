export const createOutputLimiter = (container, maxSize) => {
  let output = "";
  let killed = false;

  const onData = async (chunk) => {
    if (output.length < maxSize) {
      output += chunk.toString();
    } else if (!killed) {
      killed = true;
      await container.kill().catch(() => {});
    }
  };

  return {
    onData,
    getOutput: () => output,
    wasKilled: () => killed,
    markKilled: () => (killed = true),
  };
}
