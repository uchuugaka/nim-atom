/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');
const temp = require('temp');
const {prettyPrint} = require('./util');

class Caas {
  constructor() {
    this.trackedTemp = temp.track();
    const tempFile = this.trackedTemp.openSync({ 
      prefix: 'nimsuggest',
      suffix: '.nim'
    });
    this.tempFilePath = tempFile.path;
    fs.close(tempFile.fd);
    this.currentCb = null;
    this.lines = [];
    this.output = [];
  }

  sendCommand(cmd, cb) {
    this.retries = 0;
    this.currentCmd = cmd;
    this.currentCb = cb;
    return this.doCommandInternal(cmd);
  }

  doCommandInternal(cmd) {
    if (this.destroyed) { return; }
    this.lines = [];
    this.output.length = 0;
    this.ensureCaas();
    return this.doCommand(cmd);
  }

  resetVarsAndCallback(err, value) {
    if (this.currentCb != null) {
      const {
        currentCb
      } = this;
      this.currentCb = null;
      this.currentCmd = null;
      return currentCb(err, value);
    }
  }

  onCommandFailed(error) {
    this.retries = this.retries + 1;
    if (this.retries > 3) {
      const message = (() => {
        if (error != null) { 
          return error.toString();
        } else {
          const printedCmd = `${this.currentCmd.type}: ${this.currentCmd.filePath},${this.currentCmd.row},${this.currentCmd.col}`;
          return `ERROR: Command failed multiple times.\nCommand:\n${printedCmd}\nOutput:\n${this.output.join('\n')}`;
        }
      })();
      return this.resetVarsAndCallback(message);
    } else {
      const cb = () => this.doCommandInternal(this.currentCmd);
      return setTimeout(cb, 100);
    }
  }

  onCommandDone() {
    return this.resetVarsAndCallback(null, this.lines);
  }

  logOutput(text) {
    return this.output.push(text);
  }

  onCaasLine(line) {
    // Ignore it if we don't have a current callback waiting, maybe just the initial instructions
    if (this.currentCb != null) { return this.lines.push(line); }
  }

  destroy() {
    this.destroyed = true;
    return this.trackedTemp.cleanupSync();
  }
}

module.exports = Caas;