const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  testTimeout: 120000,
  bail: true,
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
};
