/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require('path');
const {BufferedProcess, Point} = require('atom');
const SubAtom = require('sub-atom');
const Config = require('./config');
const Linter = require('./linter');
const AutoCompleter = require('./auto-completer');
const ProjectManager = require('./project-manager');
const Executor = require('./executor');
const Runner = require('./runner');
const NimStatusBarView = require('./nim-status-bar-view');
const {CommandTypes, AutoCompleteOptions} = require('./constants');
const {hasExt, arrayEqual, separateSpaces, debounce, isFile} = require('./util');



const checkForExecutable = function(executablePath, cb) {
  if (executablePath !== '') {
    try {
      const process = new BufferedProcess({
        command: executablePath,
        args: ['--version'],
        exit: code => {
          return cb(code === 0);
        }
      });
          
      return process.onWillThrowError(({error,handle}) => {
        handle();
        return cb(false);
      });
    } catch (e) {
      return cb(false);
    }
  } else {
    return cb(false);
  }
};

const fixSystemPath = function(executablePath) {
  if ((executablePath != null) && (executablePath.indexOf('~') !== -1)) {
    return executablePath.replace('~', process.env.HOME);
  } else {
    return executablePath;
  }
};

const joinOptPath = function(base, file) {
  if (base != null) {
    return path.join(base, file);
  } else {
    return file;
  }
};

const navigateToFile = function(file, line, col, sourceEditor) {
  // This function uses Nim coordinates
  const atomLine = line - 1;
  return atom.workspace.open(file)
    .done(function(ed) {
      // This belongs to the current project, even if it may be in a different place
      if ((ed.nimProject == null)) {
        ed.nimProject = sourceEditor.nimProject;
      }
      const pos = new Point(atomLine, col);
      ed.scrollToBufferPosition(pos, {center: true});
      return ed.setCursorBufferPosition(pos);
  });
};
  
module.exports = {
  config: Config,

  updateProjectsOnEditors() {
    // Try to match up old and new projects
    for (let editor of Array.from(atom.workspace.getTextEditors())) {
      if (editor.nimProject != null) {
        editor.nimProject = 
          (editor.nimProject.folderPath != null) ?
            this.projectManager.getProjectForPath(editor.nimProject.folderPath)
          :
            this.projectManager.getProjectForPath(editor.getPath());
      }
    }
    return null;
  },

  updateProjectManager() {
    this.projectManager.update(atom.project.rootDirectories.map(x => x.path), this.options);
    return this.updateProjectsOnEditors();
  },

  checkForExes(cb) {
    if (this.options.nimLibPath.length) {
      if (!isFile(path.join(this.options.nimLibPath, 'system.nim'))) {
        this.options.nimLibPathExists = false;
        atom.notifications.addError("Could not find nim libs, please check nim package settings");
      } else {
        if (this.options.nimLibPathExists === false) {
          atom.notifications.addSuccess("Found nim libs");
        }
      }
    }

    const oldNimExists = this.options.nimExists;
    const oldNimSuggestExists = this.options.nimSuggestExists;
    let checkedNim = false;
    let checkedNimSuggest = false;

    const done = () => {
      if (!this.options.nimExists) {
        atom.notifications.addError("Could not find nim executable, please check nim package settings");
      } else if (oldNimExists === false) {
        atom.notifications.addSuccess("Found nim executable");
      }

      if (!this.options.nimSuggestExists && this.options.nimSuggestEnabled) {
        atom.notifications.addError("Could not find nimsuggest executable, please check nim package settings");
      }

      if (this.options.nimSuggestExists && (oldNimSuggestExists === false)) {
        atom.notifications.addSuccess("Found nimsuggest executable");
      }

      return cb();
    };

    checkForExecutable(this.options.nimExe, found => {
      this.options.nimExists = found;
      checkedNim = true;
      if (checkedNimSuggest) {
          return done();
        }
    });

    return checkForExecutable(this.options.nimSuggestExe, found => {
      this.options.nimSuggestExists = found;
      checkedNimSuggest = true;
      if (checkedNim) {
          return done();
        }
    });
  },

  activate(state) {
    this.options = {
      nimSuggestExe: fixSystemPath(joinOptPath(atom.config.get('nim.nimBinPath'), 'nimsuggest')),
      nimExe: fixSystemPath(joinOptPath(atom.config.get('nim.nimBinPath'), 'nim')),
      nimSuggestEnabled: atom.config.get('nim.nimsuggestEnabled'),
      lintOnFly: atom.config.get('nim.onTheFlyChecking'),
      nimLibPath: fixSystemPath(atom.config.get('nim.nimLibPath'))
    };

    this.runner = new Runner(() => this.statusBarView);
    this.projectManager = new ProjectManager();
    this.executor = new Executor(this.projectManager, this.options);
    return this.checkForExes(() => { 
      return require('atom-package-deps').install('nim', true)
        .then(() => this.activateAfterChecks(state));
    });
  },
        
  save(editor, cb) {
    if (editor.isModified()) {
      var disposable = editor.buffer.onDidSave(function() {
        disposable.dispose();
        return cb();
      });
      return editor.save();
    } else {
      return cb();
    }
  },

  saveAllModified(cb) {
    let editor;
    let savedCount = 0;
    let count = 0;
    for (editor of Array.from(atom.workspace.getTextEditors())) {
      if (editor.isModified()) {
        count += 1;
      }
    }

    if (count === 0) {
      return cb();
    }

    for (editor of Array.from(atom.workspace.getTextEditors())) {
      if (editor.isModified()) {
        this.save(editor, function() {
          savedCount += 1;
          if (savedCount === count) {
            return cb();
          }
        });
      }
    }

    return null;
  },

  gotoDefinition(editor) {
    return this.executor.execute(editor, CommandTypes.DEFINITION, function(err, data) {
      if ((err == null) && (data != null)) {
        return navigateToFile(data.path, data.line, data.col, editor);
      }
    });
  },

  run(editor, cb) {
    const runCmd = atom.config.get('nim.runCommand');
    if (runCmd === '') {
      return atom.notifications.addError("Run Command not specified, please check nim package settings");
    }

    return this.build(editor, success => {
      if (!success) {
        if (cb != null) { cb("Build failed."); }
        return;
      }
        
      const project = editor.nimProject;
      const filePath = editor.getPath();

      const newRunCmd = runCmd
        .replace('<bin>', project.getBinFilePathFor(filePath))
        .replace('<binpath>', project.getBinFolderPathFor(filePath));

      if (this.statusBarView != null) {
        this.statusBarView.showInfo("Nim run started");
      }
      return this.runner.run(newRunCmd);
    });
  },

  build(editor, cb) {
    if (this.statusBarView != null) {
      this.statusBarView.showInfo("Nim build started", 0);
    }
    //atom.notifications.addInfo "Build started.."

    return this.runner.waitUntilFinished(() => {
      const afterSaves = () => {
        return this.executor.execute(editor, CommandTypes.BUILD, (err, result, extra) => {
          if (err != null) {
            if (this.statusBarView != null) {
              this.statusBarView.showError("Nim build failed");
            }
            if (cb != null) { return cb("Build failed"); }
          } else if (extra.code !== 0) {
            if (this.linterApi != null) {
              this.linterApi.setMessages(this.linter, result);
            }
            if (this.statusBarView != null) {
              this.statusBarView.showError("Nim build failed");
            }
            // atom.notifications.addError "Build failed.",
            //   detail: "Project root: #{extra.filePath}"
            if (cb != null) { return cb(false); }
          } else {
            if (this.linterApi != null) {
              this.linterApi.setMessages(this.linter, result);
            }
            if (this.statusBarView != null) {
              this.statusBarView.showSuccess("Nim build succeeded");
            }
            // atom.notifications.addSuccess "Build succeeded.",
            //   detail: "Project root: #{extra.filePath}"
            //   dismissable: true
            if (cb != null) { return cb(true); }
          }
        });
      };

      const abb = atom.config.get('nim.autosaveBeforeBuild');

      if (abb === 'Save all files') {
        return this.saveAllModified(afterSaves);
      } else if (abb === 'Save current file') {
        return this.save(editor, afterSaves);
      }
    });
  },

  activateAfterChecks(state) {
    this.updateProjectManager();
    
    const self = this;

    atom.commands.add('atom-text-editor', {
      'nim:goto-definition'(ev) {
        const editor = this.getModel();
        if (!editor) { return; }
        return self.gotoDefinition(editor);
      }
    }
    );

    atom.commands.add('atom-text-editor', {
      'nim:run'(ev) {
        const editor = this.getModel();
        if (!editor) { return; }
        return self.run(editor);
      }
    }
    );

    atom.commands.add('atom-text-editor', {
      'nim:build'(ev) {
        const editor = this.getModel();
        if (!editor) { return; }
        return self.build(editor);
      }
    }
    );

    const updateProjectManagerDebounced = debounce(2000, () => {
      return this.checkForExes(() => this.updateProjectManager());
    });

    this.subscriptions = new SubAtom();
    this.subscriptions.add(atom.config.onDidChange('nim.nimExecutablePath', path => {
      this.options.nimExe = fixSystemPath(path.newValue || 'nim');
      return updateProjectManagerDebounced();
    })
    );

    this.subscriptions.add(atom.config.onDidChange('nim.nimsuggestExecutablePath', path => {
      this.options.nimSuggestExe = fixSystemPath(path.newValue || 'nimsuggest');
      const nsen = atom.config.get('nim.nimsuggestEnabled');
      if (path.newValue === '') {
        if (nsen) { atom.config.set('nim.nimsuggestEnabled', false); }
      } else {
        if (!nsen) { atom.config.set('nim.nimsuggestEnabled', true); }
      }
      return updateProjectManagerDebounced();
    })
    );

    this.subscriptions.add(atom.config.onDidChange('nim.nimsuggestEnabled', enabled => {
      this.options.nimSuggestEnabled = enabled.newValue;
      return updateProjectManagerDebounced();
    })
    );

    this.subscriptions.add(atom.config.onDidChange('nim.nimLibPath', path => {
      this.options.nimLibPath = fixSystemPath(path.newValue);
      return updateProjectManagerDebounced();
    })
    );

    this.subscriptions.add(atom.config.observe('nim.useCtrlShiftClickToJumpToDefinition', enabled => {
      return this.options.ctrlShiftClickEnabled = enabled;
    })
    );

    this.subscriptions.add(atom.config.observe('nim.autocomplete', value => {
      return this.options.autocomplete = (() => {
        if (value === 'Always') {
        return AutoCompleteOptions.ALWAYS;
      } else if (value === 'Only after dot') {
        return AutoCompleteOptions.AFTERDOT;
      } else if (value === 'Never') {
        return AutoCompleteOptions.NEVER;
      }
      })();
    })
    );

    this.subscriptions.add(atom.project.onDidChangePaths(paths => {
      if (!arrayEqual(paths, this.projectManager.projectPaths)) {
        return this.updateProjectManager();
      }
    })
    );

    return this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      const editorPath = editor.getPath();
      if (!hasExt(editorPath, '.nim') && !hasExt(editorPath, '.nims')) { return; }

      // For binding ctrl-shift-click
      const editorSubscriptions = new SubAtom();
      const editorElement = atom.views.getView(editor);
      const editorLines = editorElement.querySelector('.lines');

      editorSubscriptions.add(editorLines, 'mousedown', e => {
        if (!this.options.ctrlShiftClickEnabled) { return; } 
        if ((e.which !== 1) || !e.shiftKey || (!e.ctrlKey && ((process.platform !== 'darwin') || !e.metaKey))) { return; }
        const screenPos = editorElement.component.screenPositionForMouseEvent(e);
        editor.setCursorScreenPosition(screenPos);
        this.gotoDefinition(editor);
        return false;
      });
      editorSubscriptions.add(editor.onDidDestroy(() => {
        editorSubscriptions.dispose();
        return this.subscriptions.remove(editorSubscriptions);
      })
      );
      return this.subscriptions.add(editorSubscriptions);
    })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    this.projectManager.destroy();
    if (this.statusBarView != null) {
      this.statusBarView.destroy();
    }
    return (this.statusBarTile != null ? this.statusBarTile.destroy() : undefined);
  },

  nimLinter() {
    this.linter = Linter(this.executor, this.options);
    return this.linter;
  },

  consumeLinter(linterApi) {
    return this.linterApi = linterApi;
  },

  consumeStatusBar(statusBar) {
    this.statusBarView = new NimStatusBarView();
    this.statusBarView.init(5000);
    return this.statusBarTile = statusBar.addRightTile({item: this.statusBarView, priority: 50});
  },

  nimAutoComplete() { return AutoCompleter(this.executor, this.options); }
};