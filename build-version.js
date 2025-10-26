// build-version.js
const fs = require("fs");
const path = require("path");

// ----- 1️⃣ GÉNÉRATION D'UNE VERSION LISIBLE -----
const baseVersion = "1.4"; // tu peux modifier ici ton numéro de version majeure/mineure
const date = new Date();
const buildDate = date.toISOString().slice(0, 10).replace(/-/g, ""); // ex: 20251026
const buildId = `${baseVersion}.${buildDate}`; // => "1.4.20251026"

// ----- 2️⃣ FICHIERS À PATCHER -----
const filesToPatch = ["index.html", "script.js", "service-worker.js"];

filesToPatch.forEach((filename) => {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(/__BUILD_ID__/g, buildId);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Version ${buildId} injectée dans ${filename}`);
});

console.log("✨ Build version patch terminé.");
