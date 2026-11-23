// Keep the installer location used by existing update scripts and shortcuts.
const path = require('node:path');

process.env.QCT_INSTALLER_OUTPUT = path.join(__dirname, 'dist_electron');
require('./desktop-app/build-with-version.cjs');
