var fs = require('fs'),
  path = require('path');

module.exports = {
  "name": basename.replace(/^node-|[.-]js$/g, ''),
  "version": '0.0.0',
  "description": (function() {
    var value;
    try {
      var src = fs.readFileSync('README.md', 'utf8');
      value = src.split('\n').filter(function(line) {
          return /\s+/.test(line) && line.trim() !== basename.replace(/^node-/, '') && !line.trim().match(/^#/);
        })[0]
        .trim()
        .replace(/^./, function(c) {
          return c.toLowerCase()
        })
        .replace(/\.$/, '');
    } catch (e) {}
    return value || 'Tessel project';
  })(),
  "main": (function() {
    var f;
    try {
      f = fs.readdirSync(dirname).filter(function(f) {
        return f.match(/\.js$/)
      })
      if (f.indexOf('index.js') !== -1)
        f = 'index.js';
      else if (f.indexOf('main.js') !== -1)
        f = 'main.js';
      else if (f.indexOf(basename + '.js') !== -1)
        f = basename + '.js';
      else
        f = f[0];
    } catch (e) {};

    return f || 'index.js';
  })(),
  "bin": function(callback) {
    fs.readdir(dirname + '/bin', function(er, d) {
      // no bins
      if (er) return callback();
      // just take the first js file we find there, or nada
      return callback(null, d.filter(function(f) {
        return f.match(/\.js$/)
      })[0])
    })
  },
  "directories": function(callback) {
    fs.readdir('.', function(er, dirs) {
      if (er) return callback(er)
      var res = {}
      dirs.forEach(function(d) {
        switch (d) {
          case 'example':
          case 'examples':
            return res.example = d
          case 'test':
          case 'tests':
            return res.test = d
          case 'doc':
          case 'docs':
            return res.doc = d
          case 'man':
            return res.man = d
        }
      })
      if (Object.keys(res).length === 0) res = undefined
      return callback(null, res)
    })
  },
  "dependencies": typeof dependencies !== 'undefined' ? dependencies : function(callback) {
    fs.readdir('node_modules', function(er, dir) {
      if (er) return callback();
      var deps = {};
      var n = dir.length;
      dir.forEach(function(d) {
        if (d.match(/^\./)) return next();
        if (d.match(/^(expresso|mocha|tap|coffee-script|coco|streamline)$/))
          return next();
        fs.readFile('node_modules/' + d + '/package.json', function(er, p) {
          if (er) return next();
          try {
            p = JSON.parse(p);
          } catch (e) {
            return next()
          }
          if (!p.version) return next();
          deps[d] = '~' + p.version;
          return next();
        })
      })

      function next() {
        if (--n === 0) return callback(null, deps)
      }
    })
  },
  "devDependencies": typeof devDependencies !== 'undefined' ? devDependencies : function(callback) {
    // same as dependencies but for dev deps
    fs.readdir('node_modules', function(er, dir) {
      if (er) return callback();
      var deps = {};
      var n = dir.length;
      dir.forEach(function(d) {
        if (d.match(/^\./)) return next()
        if (!d.match(/^(expresso|mocha|tap|coffee-script|coco|streamline)$/))
          return next();
        fs.readFile('node_modules/' + d + '/package.json', function(er, p) {
          if (er) return next();

          try {
            p = JSON.parse(p);
          } catch (e) {
            return next();
          }

          if (!p.version) return next();
          deps[d] = '~' + p.version;
          return next();
        })
      })

      function next() {
        if (--n === 0) return callback(null, deps);
      }
    })
  },
  "scripts": (function() {
    return {'test': 'echo \"Error: no test specified\" && exit 1'};
  })(),

  "repository": (function() {
    try {
      var gitConfig = fs.readFileSync('.git/config', 'utf8');
    } catch (e) {
      gitConfig = null;
    }

    if (gitConfig) {
      gitConfig = gitConfig.split(/\r?\n/);
      var i = gitConfig.indexOf('[remote "origin"]');
      if (i !== -1) {
        var u = gitConfig[i + 1];
        if (!u.match(/^\s*url =/)) u = gitConfig[i + 2];
        if (!u.match(/^\s*url =/)) u = null;
        else u = u.replace(/^\s*url = /, '');
      }
      if (u && u.match(/^git@github.com:/))
        u = u.replace(/^git@github.com:/, 'git://github.com/');
    }
    return u || "";
  })(),

  "keywords": ['Tessel'],
  "author": config['init.author.name'] ? {
    "name": config['init.author.name'],
    "email": config['init.author.email'],
    "url": config['init.author.url']
  } : undefined,
  "license": 'MIT'
}
