// Third Party Dependencies
var inquirer = require('inquirer');

/*
controller.menu({
  // Custom prefix
  prefix: colors.grey('INFO '),
  prompt: [inquirer.prompt options],
  // Custom answer -> data translation
  translate: function(answer) {
    // answer =>
    // { [prompt.name]: ... }
    return answer[prompt.name];
  }
}) => Promise
*/

var Menu = {};

Menu.prompt = (setup) => {
  var options = setup.prompt;

  if (options.type === 'list') {
    options.choices.push('\tExit');
  }

  // Enforce a customized prompt prefix
  inquirer.prompt.prompts[options.type].prototype.prefix = (str) => {
    // String() used to coerce an `undefined` to ''. Do not change.
    return String(setup.prefix) + str;
  };

  return new Promise(function(resolve) {
    inquirer.prompt([options], function(answer) {
      if (setup.translate) {
        resolve(setup.translate(answer));
      } else {
        resolve(answer);
      }
    });
  });
};

module.exports = Menu;
