const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Course uploads use the same document rules as the web and server.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, "../shared")];
// Files in ../shared must resolve packages (e.g. zod) from the app's node_modules,
// because the repo-root node_modules is outside Metro's watched folders.
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(__dirname, "node_modules"),
];
module.exports = config;
