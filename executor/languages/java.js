module.exports = {
  name: "java",
  image: "bellsoft/liberica-openjdk-alpine:17",
  extension: "java",

  command(file) {
    const cls = file.replace(".java", "");
    return [
      "sh",
      "-c",
      `javac ${file} -d /tmp && java -cp /tmp ${cls}`,
    ];
  },
};
