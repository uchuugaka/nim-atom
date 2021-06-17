/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {BufferedProcess} = require('atom');
const KnownFiles = require('./known-files');
const path = require('path');
const {separateLines} = require('./util');
const {CommandTypes} = require('./constants');

module.exports = (executor, options) => ({
  name: 'Nim',
  grammarScopes: ['source.nim'],
  scope: 'project',
  lintsOnChange: options.lintOnFly,

  lint(editor) {
    return new Promise(function(resolve, reject) {
      if (!options.nimExists) {
        resolve([]);
      }
      return executor.execute(editor, CommandTypes.LINT, function(err, results) {
        if (err != null) {
          return resolve([]);
        } else {
          return resolve(results);
        }
      });
    });
  }
});