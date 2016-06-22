// System Objects
var path = require('path');
// Third Party Dependencies

// Internal
var languages = {
  js: require('./javascript'),
  rs: require('./rust'),
  py: require('./python'),
};

var exportables = {};

// Initialize the directory given the various options
exportables.initProject = (opts) => {

  // Set a default directory if one was not provided
  opts.directory = opts.directory || path.resolve('.');

  // Detect the requested language
  var lang = exportables.detectLanguage(opts);

  // If a language could not be detected
  if (lang === null) {
    // Return an error
    return Promise.reject(new Error('Unrecognized language selection.'));
  } else {
    // Otherwise generate a project in that language
    return lang.generateProject(opts);
  }
};

// Determine the langauge to initialize the project with
exportables.detectLanguage = (opts) => {

  // If somehow a language option wasn't provided
  if (!opts.lang) {
    // Return JS as default
    return languages['js'];
  }

  // Iterate through each of the langauges
  for (var key in languages) {
    // Pull out the language info
    var lang = languages[key];

    // Check if the language option is within the available language keywords
    if (lang.meta.keywords &&
      lang.meta.keywords.indexOf(opts.lang.toLowerCase()) > -1) {
      // If it is, return that language
      return lang;
    }
  }

  // If not, someone has requested a language that is not supported
  return null;
};

module.exports = Object.assign(exportables, languages);
