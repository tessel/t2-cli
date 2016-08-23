var fs = require("fs-extra");
var path = require("path");

var p = "test/unit/";

function replacer(contents, find, replace) {

  do {
    contents = contents.replace(find, replace);
  } while (contents.includes(find));

  return contents;
}

function remover(contents, find) {
  contents = contents.split("\n");

  return contents.reduce((accum, line) => {
    if (!line.includes(find)) {
      accum.push(line);
    }
    return accum;
  }, []).join("\n");
  do {
    contents = contents.replace(find, replace);
  } while (contents.includes(find));

  return contents;
}


fs.readdir(p, (error, files) => {
  files.forEach(file => {
    if (file.endsWith(".js")) {
      var contents = fs.readFileSync(path.join(p, file), "utf8");

      // contents = replacer(contents, `Fritzing`, "wiring");
      contents = replacer(contents, 'require("../common/bootstrap");', "require('../common/bootstrap');");
      // console.log(contents);
      fs.writeFileSync(path.join(p, file), contents);
    }
  });
});
