module.exports = {
  name: "cpp",
  image: "gcc:latest",
  extension: "cpp",

  command(file) {
    return [
      "sh",
      "-c",
      `g++ ${file} -o /tmp/out && chmod +x /tmp/out && /tmp/out`,
    ];
  },

  detectForkBomb(output) {
    return output.trim() === "Killed";
  },
};
