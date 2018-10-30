module.exports = {
  includes: [
    'node_modules/**/aws-sdk/apis/*.json',
    'node_modules/**/mime/types/*.types',
    'node_modules/**/negotiator/**/*.js',
    'node_modules/**/socket.io-client/socket.io.js',
    'node_modules/**/socket.io-client/dist/socket.io.min.js',
    'node_modules/**/socket.io-client/dist/socket.io.js',
  ],

  ignores: [
    'node_modules/**/tessel/**/*',
  ],

  // These are used to override all other rules.
  //
  // A concrete example of why this is necessary:
  //
  //    Sometimes `ignores` might conflict with includes,
  //    such as the case with "tessel" and "mime". Since
  //    `includes` always trump `ignores`, 'mime/types/*.types'
  //    gets removed from the `ignores` list and results in
  //    `./node_modules/tessel/node_modules/mime/types/*.*`
  //    being included in the bundle. Since we ABSOLUTELY
  //    know that we do not want users trying to send the
  //    `tessel` module that would exist as a result of
  //    `npm install tessel`, we _must_ have a backup
  //    strategy. In this particular case, it means
  //    `rm -rf` anything in this list.
  //
  //    This could also be caused by `.tesselinclude`
  //    rules, so those must be overridden as well.
  //
  disallowed: [
    'node_modules/tessel',
  ],

  binaryPathTranslations: {
    '*': [{
      find: `${process.platform}-${process.arch}`,
      replace: 'linux-mipsel'
    }],
    /*
      Other module-specific translations could be added in the future.
     */
  },
  compressionOptions: {
    // "extend" is the name of the module
    extend: {
      compress: {
        keep_fnames: true
      },
      mangle: {}
    },
  },
  compressionDisallowed: {
    bindings: true,
  },

  compressionVersion: {
    // Values are either 'es' or 'js' and map
    // to a version of uglify
    'component-inherit': 'js',
    express: 'js',
    glob: 'js',
    'supports-color': 'js',
  },
};
