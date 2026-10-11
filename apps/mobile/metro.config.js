const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo SDK 52+ detecta el monorepo (workspaces) automáticamente: watchFolders y resolución de node_modules.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
