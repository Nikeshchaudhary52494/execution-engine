import python from "./python.js";
import javascript from "./javascript.js";
import cpp from "./cpp.js";
import java from "./java.js";

const registry = new Map();

[python, javascript, cpp, java].forEach((lang) => {
  if (lang) {
    registry.set(lang.name, lang);
  }
});

export const getLanguage = (name) => {
  return registry.get(name);
}
