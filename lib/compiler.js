/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require('path');
const fs = require('fs');
const temp = require('temp');
const {BufferedProcess} = require('atom');
const mkdirp = require('mkdirp');
const {separateLines} = require('./util');
const KnownFiles = require('./known-files');


class Compiler {
  constructor(options) {
    this.options = options;
    this.trackedTemp = temp.track();
    const tempFile = this.trackedTemp.openSync({ 
      prefix: 'nimcheck',
      suffix: '.nim'
    });
    this.tempFilePath = tempFile.path;
    fs.close(tempFile.fd);
  }

  check(filePath, cb) {
    const args = ["check", "--listFullPaths", "--colors:off", "--verbosity:0"];
    if (this.options.nimLibPath.length) {
      args.push(`--lib:\"${this.options.nimLibPath}\"`);
    }
    args.push(filePath);
    return this.execute(path.dirname(filePath), args, cb);
  }

  checkDirty(rootFilePath, filePath, fileText, cb) {
    const trackArg = `--trackDirty:${this.tempFilePath},${filePath},1,1`;
    const args = ["check", "--listFullPaths", "--colors:off", "--verbosity:0", trackArg];
    if (this.options.nimLibPath.length) {
      args.push(`--lib:\"${this.options.nimLibPath}\"`);
    }
    args.push(rootFilePath);
    return fs.writeFile(this.tempFilePath, fileText, err => {
      if (err != null) {
        return cb("Error writing temp file for compiler");
      } else {
        return this.execute(path.dirname(rootFilePath), args, cb);
      }
    });
  }

  build(filePath, binPath, cb) {
    if (binPath != null) {
      return mkdirp(path.dirname(binPath), err => {
        if (err != null) { cb(err); }
        let args = ["c", "--listFullPaths", "--colors:off", "--verbosity:0", `--out:${binPath}`];
        if (this.options.nimLibPath.length) {
          args.push(`--lib:\"${this.options.nimLibPath}\"`);
        }
        args.push(filePath);
        if (this.options.compileArgs != null) {
          args = args.concat(this.options.compileArgs);
        }
        return this.execute(path.dirname(filePath), args, cb);
      });
    } else {
      let args = ["c", "--listFullPaths", "--colors:off", "--verbosity:0"];
      if (this.options.nimLibPath.length) {
        args.push(`--lib:\"${this.options.nimLibPath}\"`);
      }
      args.push(filePath);
      if (this.options.compileArgs != null) {
          args = args.concat(this.options.compileArgs);
        }
      return this.execute(path.dirname(filePath), args, cb);
    }
  }

  execute(cwd, args, cb) {
    if (!this.options.nimExists) {
      return cb("Could not find nim executable, please check nim package settings");
    }

    const results = [];

    const processData = function(data) {
      const lines = separateLines(data);
      for (let line of Array.from(lines)) {
        results.push(line);
      }
      return null;
    };

    const process = new BufferedProcess({
      command: this.options.nimExe,
      args,
      options: {
        cwd
      },
      stderr: processData,
      stdout: processData,
      exit(code) {
        return cb(null, {
          code,
          lines: results
        }
        );
      }
    });

    return process.onWillThrowError(function({error,handle}) {
      handle();
      return cb(`ERROR: Compiler execution failed.\nCommand: ${options.nimExe} ${args.join(' ')}\nOutput:\n${output}`);
    });
  }

  destroy() {
    this.destroyed = true;
    return this.trackedTemp.cleanupSync();
  }
}

module.exports = Compiler;