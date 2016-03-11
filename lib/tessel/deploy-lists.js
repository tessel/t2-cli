module.exports = {
  includes: [
    'negotiator/**/*.js',
    'socket.io-client/socket.io.js',
    'mime/types/*.types'
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
