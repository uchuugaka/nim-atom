/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const nimCaseInsensitiveOS = os.platform() === 'win32';

const knownFiles = {};

const findFile = function(fullPath) {
  let foundPath, segments;
  if (!nimCaseInsensitiveOS) { return fullPath; }

  const {
    sep
  } = path;

  if (fullPath[0] === '/') {
    foundPath = '/';
    segments = fullPath.split(sep);
  } else {
    foundPath = fullPath[0].toUpperCase() + ':\\';
    segments = fullPath.split(sep);
  }
  
  let first = true;

  for (let i = 1, end = segments.length, asc = 1 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
    const files = fs.readdirSync(foundPath);
    const lowerSegment = segments[i].toLowerCase();
    let found = false;
    for (let file of Array.from(files)) {
      if (file.toLowerCase() === lowerSegment) {
        if (first) {
          foundPath += file;
          first = false;
        } else {
          foundPath += sep + file;
        }
        found = true;
        break;
      }
    }

    if (found === false) {
      throw new Error(`Could not find file ${fullPath}, ${foundPath}`);
    }
  }

  return foundPath;
};

module.exports = {
  getCanonical(fullPath) {
    if (knownFiles[fullPath]) {
      return knownFiles[fullPath];
    } else {
      const file = findFile(fullPath);
      knownFiles[fullPath] = file;
      return file;
    }
  }
};
  