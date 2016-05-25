module.exports = {
  includes: [
    'node_modules/**/aws-sdk/apis/*.json',
    'node_modules/**/mime/types/*.types',
    'node_modules/**/negotiator/**/*.js',
    'node_modules/**/socket.io-client/socket.io.js',
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
  blacklist: [
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
    'extend': {
      special: {
        /*
          The "extend" module uses the following unadvisable pattern:

          module.exports = function NAME() {
            ... later calls NAME()
          };

          UglifyJS's compression algorithm wants to remove that unnecessary
          function expression _name_. That's ok, because we can just as
          easily use `keep_fnames: true` to avoid that removal. Unfortunately,
          that's not enough in this case, as mangling produces sometimes
          requires another pass with `figure_out_scope` to avoid
          unhygienic mangling.
        */
        rescope_after_mangle: true
      },
      compress: {
        keep_fnames: true
      },
      mangle: {}
    },
  },
};
