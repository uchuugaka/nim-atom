/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');
const {BufferedProcess} = require('atom');
const Caas = require('./caas');
const {CommandTypes} = require('./constants');
const {separateLines} = require('./util');

class OnDemandCaas extends Caas {
  constructor(options) {
    this.options = options;
    super();
  }

  processData(data) {
    this.logOutput(data);
    const lines = separateLines(data);
    for (let line of Array.from(lines)) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        this.onCaasLine(line);
      }
    }
    return true; // Discard the lines
  }

  execProcess(args) {
    this.process = new BufferedProcess({
      command: this.options.nimExe,
      args,
      stderr: data => this.processData(data),
      stdout: data => this.processData(data),
      exit: code => {
        return this.onCommandDone();
      }
    });
    
    return this.process.onWillThrowError(({error,handle}) => {
      handle();
      console.log("Nim crashed...");
      return this.onCommandFailed(error);
    });
  }

  ensureCaas() {} // Nothing to do, it's on demand..

  doCommand(cmd) {
    let args, trackArg, type;
    if (cmd.type === CommandTypes.LINT) {
      // Lint it!
      return;
    }

    if (cmd.type === CommandTypes.SUGGEST) {
      type = 'suggest';
    } else if (cmd.type === CommandTypes.DEFINITION) {
      type = 'def';
    } else if (cmd.type === CommandTypes.CONTEXT) {
      type = 'context';
    } else if (cmd.type === CommandTypes.USAGE) {
      type = 'usages';
    }

    if (cmd.dirtyFileData != null) {
      trackArg = `--trackDirty:${this.tempFilePath},${cmd.filePath},${cmd.row},${cmd.col}`;
      args = ["idetools", `--${type}`, "--listFullPaths", "--colors:off", "--verbosity:0", trackArg, cmd.filePath];
      return fs.writeFile(this.tempFilePath, cmd.dirtyFileData, err => {
        if (err != null) {
          return this.onCommandFailed();
        } else {
          return this.execProcess(args);
        }
      });
    } else {
      trackArg = `--track:${cmd.filePath},${cmd.row},${cmd.col}`;
      args = ["idetools", `--${type}`, "--listFullPaths", "--colors:off", "--verbosity:0", trackArg, cmd.filePath];
      return this.execProcess(args);
    }
  }
}

module.exports = OnDemandCaas;