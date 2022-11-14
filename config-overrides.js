// const path = require('path');
// const {
//   addBabelPlugins,
// } = require('customize-cra');

module.exports = function override(config) {
  // const wasmExtensionRegExp = /\.wasm$/;

  config.resolve.extensions.push('.wasm');
  // eslint-disable-next-line no-param-reassign
  config.resolve.fallback = {
    fs: false,
    path: false,
    buffer: false,
    stream: false,
  };
  // config.module.rules.forEach((rule) => {
  //   (rule.oneOf || []).forEach((oneOf) => {
  //     if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
  //       // Make file-loader ignore WASM files
  //       oneOf.exclude.push(wasmExtensionRegExp);
  //     }
  //   });
  // });

  // Add a dedicated loader for WASM
  // config.module.rules.push({
  //   test: wasmExtensionRegExp,
  //   include: path.resolve(__dirname, 'src'),
  //   use: [{ loader: require.resolve('wasm-loader'), options: {} }],
  // });

  return config;
};
