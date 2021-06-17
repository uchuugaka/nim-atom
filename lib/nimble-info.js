/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');
const path = require('path');
const {separateLines, removeExt} = require('./util');

const readNimbleData = function(nimbleFilePath) {

  const fdata = fs.readFileSync(nimbleFilePath);
  const lines = separateLines(fdata.toString());
  const data = {};
  for (let line of Array.from(lines)) {
    const match = line.match(/^(\w+)\s*=\s*\"([^\"]*)\"/) || line.match(/^(\w+)\s*=\s*@\[\"([^\"]*)\"\]/);
    if (match) {
      const [_, key, value] = Array.from(match);
      data[key] = value;
    }
  }
    
  return data;
};

const getNimbleDict = function(folderPath) {
  const files = fs.readdirSync(folderPath);
  const nimbleFiles = files.filter(x => (path.extname(x) === '.nimble') && (path.basename(x) !== '.nimble'));
  if (nimbleFiles.length) { // Just do the first, there shouldn't be more than one
    const nimbleFilePath = path.join(folderPath, nimbleFiles[0]);
    return [readNimbleData(nimbleFilePath), nimbleFilePath];
  } else {
    return [];
  }
};

// A simple class to parse .nimble files and calculate where the source root
// and bin root should be.  Only uses the first bin value, multiple bins within
// a .nimble file are not supported.

class NimbleInfo {
  constructor(folderPath) {
    this.folderPath = folderPath;
    [this.data, this.nimbleFilePath] = Array.from(getNimbleDict(this.folderPath));
    this.hasNimbleFile = (this.data != null);
    this.srcDir = path.join(this.folderPath, this.getFirst('srcDir') || '');
    this.binDir = path.join(this.folderPath, this.getFirst('binDir') || '');
    this.bin = this.getFirst('bin');
    if (this.bin != null) {
      this.rootFilePath = path.join(this.srcDir, this.bin) + '.nim';
      this.binFilePath = path.join(this.binDir, this.bin);
    }
  }

  get(key) { return this.data[key]; }

  getFirst(key) {
    if ((this.data != null) && (this.data[key] != null)) {
      return this.data[key].split(',')[0];
    } else {
      return null;
    }
  }
}

module.exports = NimbleInfo;