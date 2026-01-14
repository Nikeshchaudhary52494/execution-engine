const python = require("./python");
const javascript = require("./javascript");
const cpp = require("./cpp");
const java = require("./java");

const registry = new Map();

[python, javascript, cpp, java].forEach((lang) => {
  registry.set(lang.name, lang);
});

function getLanguage(name) {
  return registry.get(name);
}

module.exports = { getLanguage };
