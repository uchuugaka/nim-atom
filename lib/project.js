/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');
const path = require('path');
const PersistentCaas = require('./persistent-caas');
const OnDemandCaas = require('./on-demand-caas');
const Compiler = require('./compiler');
const NimbleInfo = require('./nimble-info');
const {existsSync, separateLines, removeExt} = require('./util');
const {CommandTypes} = require('./constants');

const guessRootFilePath = function(folderPath, rootFilenameGuesses) {
  for (let rootFilename of Array.from(rootFilenameGuesses)) {
    var rootFilePath;
    if (rootFilename.indexOf('<parent>') !== -1) {
      rootFilePath = path.join(folderPath, rootFilename.replace('<parent>', path.basename(folderPath)));
    } else if (rootFilename.indexOf('<nimble>') !== -1) {
      const files = fs.readdirSync(folderPath);
      const nimbleFiles = files.filter(x => (path.extname(x) === '.nimble') && (path.basename(x) !== '.nimble'));
      if (nimbleFiles.length) { // Just do the first, there shouldn't be more than one
        rootFilePath = path.join(folderPath, rootFilename.replace('<nimble>', path.basename(nimbleFiles[0], '.nimble')));
      } else {
        continue;
      }
    } else {
      rootFilePath = path.join(folderPath, rootFilename);
    }
      
    if (existsSync(rootFilePath)) { return rootFilePath; }
  }

  return null;
};

const findSameNamedNim = function(folderPath, extensions) {
  const files = fs.readdirSync(folderPath);
  for (var extension of Array.from(extensions)) {
    const extFiles = files.filter(x => x.endsWith(extension) && (x !== extension));
    for (let extFile of Array.from(extFiles)) {
      const extFileBase = path.basename(extFile, extension);
      const rootFilePath = path.join(folderPath, (extFileBase + '.nim'));
      if (existsSync(rootFilePath)) {
        return rootFilePath;
      }
    }
  }
  return null;
};

const findFirstNimFile = function(folderPath) {
  const files = fs.readdirSync(folderPath);
  const nimFiles = files.filter(x => x.endsWith('.nim') && (x !== '.nim'));
  return nimFiles[0];
};

class Project {
  constructor(folderPath, options) {
    this.folderPath = folderPath;
    this.options = options;
    this.compiler = new Compiler(this.options);
    this.detectInfo();
  }

  detectInfo() {  
    if ((this.folderPath == null)) {
      return this.caas = new OnDemandCaas(this.options);
    } else {
      // First look to see if there's a .nimble file
      this.nimbleInfo = new NimbleInfo(this.folderPath);
      if (this.nimbleInfo.hasNimbleFile) {
        this.rootFilePath = this.nimbleInfo.rootFilePath;
        this.binFilePath = this.nimbleInfo.binFilePath;
      }
      
      // No root found in .nimble? Or no .nimble?  Ok, let's try to find .nim matching
      // the standard extensions
      if ((this.rootFilePath == null)) {
        this.rootFilePath = findSameNamedNim(this.folderPath, ['.nimcfg', '.nim.cfg', '.nims']);
        if (this.rootFilePath != null) {
          this.binFilePath = removeExt(this.rootFilePath);
        }
      }

      if (this.binFilePath != null) {
        this.binFolderPath = path.dirname(this.binFilePath);
      }
      if (this.rootFilePath != null) {
        this.rootFolderPath = path.dirname(this.rootFilePath);
      }

      let foundProject = false;

      if (this.options.nimSuggestEnabled && this.options.nimSuggestExists) {
        if (this.rootFilePath != null) {
          this.caas = new PersistentCaas(this.folderPath, this.rootFilePath, this.options);
          foundProject = true;
        } else {
          // We'd like to use nimsuggest even though there isn't a project, so try guessing..
          const guessedProjectFile = guessRootFilePath(this.folderPath, ['<nimble>.nim', 'proj.nim', '<parent>.nim']);
          if (guessedProjectFile != null) {
            this.caas = new PersistentCaas(this.folderPath, guessedProjectFile, this.options);
            foundProject = true;
          } else {
            this.caas = new OnDemandCaas(this.options);
          }
        }
      } else if (this.options.nimExists) {
        this.caas = new OnDemandCaas(this.options);
      }

      if (foundProject) {
        return atom.notifications.addInfo("Found nim project at " + this.caas.folderPath);
      }
    }
  }

  getBinFilePathFor(filePath) {
    if (this.binFilePath != null) { return this.binFilePath; } else { return removeExt(filePath); }
  }

  getBinFolderPathFor(filePath) {
    if (this.binFolderPath != null) { return this.binFolderPath; } else { return path.dirname(filePath); }
  }

  getRootFilePathFor(filePath) {
    if (this.rootFilePath != null) { return this.rootFilePath; } else { return filePath; }
  }

  getRootFolderPathFor(filePath) {
    if (this.rootFolderPath != null) { return this.rootFolderPath; } else { return path.dirname(filePath); }
  }


  sendCommand(cmd, cb) {
    if (cmd.type === CommandTypes.LINT) {
      // Compile at the project root, if there is one
      cmd.compiledPath = (this.rootFilePath != null) ? this.rootFilePath : cmd.filePath;
      if (cmd.dirtyFileData != null) {
        return this.compiler.checkDirty(cmd.compiledPath, cmd.filePath, cmd.dirtyFileData, cb);
      } else {
        return this.compiler.check(cmd.compiledPath, cb);
      }
    } else if (cmd.type === CommandTypes.BUILD) {
      // Build the root, if it's available
      if (this.rootFilePath != null) {
        cmd.compiledPath = this.rootFilePath;
      } else {
        cmd.compiledPath = cmd.filePath;
      }
      return this.compiler.build(cmd.compiledPath, this.binFilePath, cb);
    } else if (this.caas != null) {
      return this.caas.sendCommand(cmd, cb);
    } else {
      return cb("Could not find nim executable, please check nim package settings");
    }
  }

  destroy() {
    if (this.caas != null) { this.caas.destroy(); }
    return this.compiler.destroy();
  }
}

module.exports = Project;