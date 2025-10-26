// build-version.js
const fs = require("fs");
const path = require("path");

// On crée un identifiant de version basé sur la date/heure du déploiement
const buildId = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);

// Liste des fichiers où remplacer __BUILD_ID__
const filesToPatch = ["index.html", "script.js", "service-worker.js"];

filesToPatch.forEach((filename) => {
  const filePath = path.join(__dirname, filename);
  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(/__BUILD_ID__/g, buildId);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Version ${buildId} injectée dans ${filename}`);
});

console.log("✨ Build version patch terminé.");
