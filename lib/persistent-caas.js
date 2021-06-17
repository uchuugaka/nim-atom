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

class PersistentCaas extends Caas {
  constructor(folderPath, rootFilePath, options) {
    this.folderPath = folderPath;
    this.rootFilePath = rootFilePath;
    this.options = options;
    super();
    // Start Nimsuggest when project is opened, since sometimes it takes a few secs
    this.ensureCaas();
  }

  doCommand(cmd) {
    let args, type;
    if (cmd.type === CommandTypes.LINT) {
      // Lint it!
      return;
    }

    if (cmd.type === CommandTypes.SUGGEST) {
      type = 'sug';
    } else if (cmd.type === CommandTypes.DEFINITION) {
      type = 'def';
    } else if (cmd.type === CommandTypes.CONTEXT) {
      type = 'con';
    } else if (cmd.type === CommandTypes.USAGE) {
      type = 'use';
    }

    if (cmd.dirtyFileData != null) {
      args = `${type} \"${cmd.filePath}\";\"${this.tempFilePath}\":${cmd.row}:${cmd.col}\n`;
      return fs.writeFile(this.tempFilePath, cmd.dirtyFileData, err => {
        // If we are not in the original cmd, an error happened during the callback
        if (this.currentCmd !== cmd) { return; }
        if (err != null) {
          return this.onCommandFailed(err);
        } else {
          return this.process.process.stdin.write(args);
        }
      });
    } else {
      args = `${type} \"${cmd.filePath}\":${cmd.row}:${cmd.col}\n`;
      return this.process.process.stdin.write(args);
    }
  }

  processData(data) {
    this.logOutput(data);
    const lines = separateLines(data);
    let newlineCount = 0; 
    for (let line of Array.from(lines)) {
      const trimmed = line.trim();
      if (this.initialLineCount < 4) {
        // Ignore help text
        this.initialLineCount += 1;
      } else if (trimmed.length === 0) {
        newlineCount = newlineCount + 1;
        if (newlineCount === 2) {
          this.onCommandDone();
        }
      } else if (trimmed === '>') {
        // For Windows, '>' is an empty result, not followed by newline
        this.onCommandDone();
      } else if (trimmed.startsWith('> ')) {
        // The first result in Windows will start with '> '
        this.onCaasLine(trimmed.substr(2));
      } else {
        this.onCaasLine(trimmed);
      }
    }
    return true; // Discard the lines
  }

  startCaas() {
    let args;
    this.initialLineCount = 0;
    if (this.options.nimLibPath.length) {
      args = [`--lib:\"${this.options.nimLibPath}\"`, '--stdin', this.rootFilePath];
    } else {
      args = ['--stdin', this.rootFilePath];
    }

    this.process = new BufferedProcess({
      command: this.options.nimSuggestExe,
      args,
      options: {
        cwd: this.folderPath
      },
      stdout: data => this.processData(data),

      exit: code => {
        if (code === 0) { return; }
        console.log("Nimsuggest crashed...");
        this.process = null;
        if (this.currentCb != null) {
          return this.onCommandFailed();
        }
      }
    });

    return this.process.onWillThrowError(({error,handle}) => {
      handle();
      console.log("Nimsuggest crashed...");
      this.process = null;
      if (this.currentCb != null) {
        return this.onCommandFailed(error);
      }
    });
  }

  ensureCaas() {
    if ((this.process == null)) {
      return this.startCaas();
    }
  }

  stopCaas() {
    if ((this.process == null)) { return; }
    this.process.process.stdin.end();
    return this.process = null;
  }

  destroy() {
    this.stopCaas();
    return super.destroy();
  }
}

module.exports = PersistentCaas;