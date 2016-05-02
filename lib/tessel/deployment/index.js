var languages = {
  js: require('./javascript'),
  py: require('./python'),
  rs: require('./rust'),
};

var exportables = {
  resolveLanguage: (input) => {
    input = String(input).toLowerCase();
    for (var key in languages) {
      if (languages[key] &&
        (input === languages[key].lang.name || input === languages[key].lang.extname)) {
        return languages[key];
      }
    }
    return null;
  },
};

module.exports = Object.assign(exportables, languages);
