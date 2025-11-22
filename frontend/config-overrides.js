const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser.js'),
    vm: require.resolve('vm-browserify'),
    os: require.resolve('os-browserify/browser'),
    path: require.resolve('path-browserify'),
    zlib: require.resolve('browserify-zlib'),
    http: false,
    https: false,
    url: false,
    assert: false,
    fs: false,
    net: false,
    tls: false,
  };
  
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];
  
  config.ignoreWarnings = [/Failed to parse source map/];
  
  return config;
};
