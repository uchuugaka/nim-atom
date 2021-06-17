/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {CommandTypes, NimSymbolsTypes} = require('./constants');
const KnownFiles = require('./known-files');
const CompilerErrorsParser = require('./compiler-errors-parser');

const prettifyDocStr = function(str) {
  const replaced = str.replace(/\\x([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\`\`?([^\`]+)\`?\`/g, (match, ident) => ident)
    .replace(/\\([^\\])/g, (match, escaped) => escaped);
  if ((replaced === '"') || (replaced === '')) { return ' '; } else { return replaced; }
};

class Executor {
  constructor(projectManager, options) {
    this.projectManager = projectManager;
    this.options = options;
    this.commandQueue = [];
    this.compilerErrorsParser = new CompilerErrorsParser(this.options);
  }

  parseSuggest(lines) {
    const result = (() => {
      const result1 = [];
      for (let ln of Array.from(lines)) {
        const datums = ln.split("\t");
        if (!(datums.length >= 8)) { continue; }
        let [type, symbolType, name, sig, path, line, col, docs] = Array.from(datums);
      
        // Skip the name of the owning module (e.g. system.len)
        const shortName = name.substr(name.indexOf(".") + 1);
      
        // Remove the enclosing string quotes ("...")
        if (docs[0] === '"') { docs = docs.slice(1, -1); }
      
        const item = {
          text: shortName,
          sig,
          type: NimSymbolsTypes[symbolType] || "tag",
          description: prettifyDocStr(docs),
          path: KnownFiles.getCanonical(path),
          row: line,
          col,
          rightLabelHTML: sig
        };

        result1.push(item);
      }
      return result1;
    })();

    return {
      result
    };
  }

  parseDefinition(lines) {
    if (lines.length < 1) { return {}; }
    const firstMatch = lines[0];
    const datums = firstMatch.split("\t");
    if (!(datums.length >= 8)) { return {}; }
    const [type, symbolType, name, sig, path, line, col, docs] = Array.from(datums);
    const item = {
      type,
      symbolType,
      name,
      sig,
      path: KnownFiles.getCanonical(path),
      line: parseInt(line),
      col: parseInt(col),
      docs
    };
    return {
      result: item
    };
  }

  doError(cmd, err) {
    if (cmd.type !== CommandTypes.SUGGEST) { // This happens too much, don't broadcast it
      atom.notifications.addError(`Nim: Error executing command: ${cmd.type}`,
        {detail: "Details dumped to developer console.  Go to View -> Developer -> Toggle Developer Tools and open the Console to view."});
    }
    console.log(err);
    this.currentCommand = null;
    cmd.cb(err);
  }

  handleParseResult(cmd, parsedData) {
    let data;
    return data = parseFn(lines);
  }
    

  doNextCommand() {
    if (this.commandQueue.length > 0) {
      const next = this.commandQueue.shift();
      const cb = () => { 
        return this.doCommand(next);
      };
      return setTimeout(cb, 0);
    } else {
      return this.currentCommand = null;
    }
  }

  doCommand(cmd) {
    this.currentCommand = cmd;
    return cmd.project.sendCommand(cmd, (err, result) => {
      if (err != null) {
        this.doError(cmd, err);
        this.doNextCommand();
        return;
      }

      const parsedResult = (() => {
        if (cmd.type === CommandTypes.BUILD) {
          const res = this.compilerErrorsParser.parse(cmd.filePath, result.lines);
          res.extra = { 
            code: result.code,
            filePath: cmd.filePath
          };
          return res;
        } else if (cmd.type === CommandTypes.LINT) {
          return this.compilerErrorsParser.parse(cmd.filePath, result.lines);
        } else if (cmd.type === CommandTypes.SUGGEST) {
          return this.parseSuggest(result);
        } else if (cmd.type === CommandTypes.DEFINITION) {
          return this.parseDefinition(result);
        } else if (cmd.type === CommandTypes.CONTEXT) {
          return this.parseContext(result);
        } else if (cmd.type === CommandTypes.USAGE) {
          return this.parseUsage(result);
        }
      })();

      if (parsedResult.err != null) {
        this.doError(cmd, parsedResult.err);
      } else {
        cmd.cb(null, parsedResult.result, parsedResult.extra);
      }

      return this.doNextCommand();
    });
  }

  execute(editor, commandType, cb) {
    const cmd =
      {type: commandType};
    if (editor.isModified()) {
      cmd.dirtyFileData = editor.getText();
    }
    const cursor = editor.getCursorBufferPosition();
    cmd.col = cursor.column;
    cmd.row = cursor.row+1;
    cmd.filePath = editor.getPath();
    cmd.cb = cb;
    if (editor.nimProject != null) {
      cmd.project = editor.nimProject;
    } else {
      cmd.project = this.projectManager.getProjectForPath(cmd.filePath);
      editor.nimProject = cmd.project;
    }

    // If we can't find the project, it means the project manager is still not initialized,
    // try again in a moment
    if ((cmd.project == null)) {
      setTimeout((() => this.execute(editor, commandType, cb)), 1);
      return;
    }

    // Make sure only one command executes at a time
    if (this.currentCommand != null) {
      return this.commandQueue.push(cmd);
    } else {
      return this.doCommand(cmd);
    }
  }
}

module.exports = Executor;