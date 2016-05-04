// System Objects
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');


var languages = {
  js: require('./javascript'),
  py: require('./python'),
  rs: require('./rust'),
};

var exportables = {
  resolveLanguage: (input) => {
    input = String(input).toLowerCase();

    var extname = path.extname(input).slice(1);

    for (var key in languages) {
      var lang = languages[key];
      var meta = lang.meta;

      if (input === meta.name || input === meta.extname ||
        extname === meta.name || extname === meta.extname) {
        return lang;
      } else {
        if (fs.existsSync(meta.configuration)) {
          return lang;
        }
      }
    }
    return null;
  },
};

module.exports = Object.assign(exportables, languages);
