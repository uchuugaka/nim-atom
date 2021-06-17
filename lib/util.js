/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');

module.exports = {
  existsSync(filePath) {
    try {
      fs.statSync(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') { return false; } else { throw err; }
    }
    return true;
  },
  separateLines(data) { return data.split("\n"); },
  separateSpaces(data) { return data.trim().split(' '); },
  prettyPrint(obj) {
    return JSON.stringify(obj, null, '  ');
  },
  hasExt(pathstr, ext) {
    if ((pathstr == null)) { return false; }
    return pathstr.endsWith(ext);
  },
  removeExt(pathstr) {
    return pathstr.replace(/\.[^\\\/.]+$/, "");
  },
  isFile(pathstr) {
    try {
      return fs.lstatSync(pathstr).isFile();
    } catch (err) {
      if (err.code === 'ENOENT') { return false; } else { throw err; }
    }
  },
  isDirectory(pathstr) {
    try {
      return fs.lstatSync(pathstr).isDirectory();
    } catch (err) {
      if (err.code === 'ENOENT') { return false; } else { throw err; }
    }
  },
  debounce(wait, func, immediate) {
    let timeout = null;
    return function() {
      const context = this;
      const args = arguments;
      const later = function() {
        timeout = null;
        if (!immediate) { return func.apply(context, args); } 
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) { return func.apply(context, args); }
    };
  },
  arrayEqual(a, b) {
    if (a != null) {
      if (b != null) {
        return (a.length === b.length) && a.every((elem, i) => elem === b[i]);
      } else {
        return false;
      }
    } else {
      if (b != null) {
        return false;
      } else {
        return true;
      }
    }
  }
};