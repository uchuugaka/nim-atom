/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {Point} = require('atom');
const {CommandTypes, AutoCompleteOptions} = require('./constants');
const fuzzaldrin = require('fuzzaldrin-plus');
const pragmas = require('./pragmas');

const DOTTED = 1;
const IDENT = 2;
const PRAGMA = 3;

const hasCachedResults = function(editor, bufferPosition, prefixInfo) {
  if (!editor.nimSuggestCache) { return false; }
  const oldPrefixInfo = editor.nimSuggestCache.prefixInfo;
  return (oldPrefixInfo.start === prefixInfo.start) &&
    (oldPrefixInfo.row === prefixInfo.row) &&
    (bufferPosition.column >= oldPrefixInfo.cursorStart);
};

const isIdentifierChar = c => ((c >= 'a') && (c <= 'z')) || 
  ((c >= 'A') && (c <= 'Z')) || 
  ((c >= '0') && (c <= '9')) || 
  (c === '_') || 
  (c > 127);

class PrefixInfo {
  constructor(type, start, cursorStart, searchStart, replacementStart, line, bufferPosition) {
    // The full text, including dot
    this.type = type;
    this.start = start;
    this.cursorStart = cursorStart;
    this.text = line.substring(this.start, bufferPosition.column);
    // Does the prefix contain any relevant search data?  If it's just a dot or {. it doesn't
    this.isRelevant = searchStart < bufferPosition.column;
    // This will be the search and replacement prefix used
    this.replacementPrefix = line.substring(replacementStart, bufferPosition.column);
    this.row = bufferPosition.row;
  }
}

const inPragma = function(line, col) {
  while (col > 0) {
    if ((line[col] === '}') && (line[col-1] === '.')) {
      return false;
    }
    if ((line[col] === '.') && (line[col-1] === '{')) {
      return true;
    }
    col -= 1;
  }
  return false;
};

const getPrefixInfo = function(editor, bufferPosition) {
    const line = editor.lineTextForBufferRow(bufferPosition.row);
    let col = bufferPosition.column - 1;
    while (col >= 0) {
      const c = line[col];
      if (c === '.') {
        if ((col > 0) && (line[col-1] === '{')) {
          return new PrefixInfo(PRAGMA, col-1, col, col+1, col-1, line, bufferPosition);
        } else if (inPragma(line, col-1)) {
          return null;
        } else {
          return new PrefixInfo(DOTTED, col, col, col+1, col+1, line, bufferPosition);
        }
      }
      if (!isIdentifierChar(c)) {
        return new PrefixInfo(IDENT, col+1, col+1, col+1, col+1, line, bufferPosition);
      } else {
        col -= 1;
      }
    }

    return new PrefixInfo(IDENT, 0, 0, 0, 0, line, bufferPosition);
  };

const empty = [];

module.exports = function(executor, options) {
  return {
    selector: '.source.nim',
    disableForSelector: '.source.nim .comment',
    inclusionPriority: 10,
    excludeLowerPriority: true,

    buildResults(symbols, prefixInfo) {
      for (let symbol of Array.from(symbols)) {
        symbol.replacementPrefix = prefixInfo.replacementPrefix;
      }
      // If the relevant search text is empty, just return the unsorted symbols
      // fuzzaldrin mixes things up
      if (!prefixInfo.isRelevant) {
        return symbols;
      } else {
        return fuzzaldrin.filter(symbols, prefixInfo.replacementPrefix, {key: 'text'});
      }
    },

    getSuggestions({editor, bufferPosition, scopeDescriptor}) {
      if ((options.autocomplete === AutoCompleteOptions.NEVER) || (options.autocomplete == null)) {
        return empty;
      }

      const prefixInfo = getPrefixInfo(editor, bufferPosition);

      if (prefixInfo === null) {
        return empty;
      } else if (prefixInfo.type === PRAGMA) {
        return this.buildResults(pragmas, prefixInfo);
      }

      if (options.autocomplete === AutoCompleteOptions.AFTERDOT) {
        if (prefixInfo.type !== DOTTED) { return empty; }
      }

      return new Promise(resolve => {
        if (hasCachedResults(editor, bufferPosition, prefixInfo)) {
          return resolve(this.buildResults(editor.nimSuggestCache.symbols, prefixInfo));
        } else if (prefixInfo.text.length > 0) {
          return executor.execute(editor, CommandTypes.SUGGEST, (err, symbols) => {
            if (err) {
              return resolve(empty);
            } else {
              editor.nimSuggestCache = {
                prefixInfo,
                symbols: symbols ? symbols : []
              };
              return resolve(this.buildResults(editor.nimSuggestCache.symbols, prefixInfo));
            }
          });
        } else {
          return resolve(empty);
        }
      });
    }
  };
};