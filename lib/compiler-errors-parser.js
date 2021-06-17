/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const KnownFiles = require('./known-files');

const matchTemplate = line => line.match(new RegExp(`\
^(.+)\
\\((\\d+),\\s(\\d+)\\)\\stemplate/generic\\sinstantiation\\sfrom\\shere`)
);

const matchWarningErrorHint = line => line.match(/^(.+?\.nims?)\((\d+),\s(\d+)\)\s(Warning|Error|Hint):\s(.*)/);

const matchInternalError = line => line.match(new RegExp(`Error:\\sinternal\\serror:`));

const matchSigsegvError = line => line.match(/^(SIGSEGV\:.+)/);

const processLine = function(filePath, line, state) {
  let _, col, msg, sourcePath;
  const templateMatch = matchTemplate(line);

  if (templateMatch) {
    [_, sourcePath, line, col] = Array.from(templateMatch);
    sourcePath = sourcePath.endsWith('stdinfile.nim') ? filePath : KnownFiles.getCanonical(sourcePath);
    msg = "template/generic instantiation from here";
    line = parseInt(line) - 1;
    col  = parseInt(col) - 1;

    return{
      location: {
        file: sourcePath,
        position: [[line, col],[line, col+1]]
      },
      severity: "info",
      excerpt: msg
    };
  }

  const wehMatch = matchWarningErrorHint(line);
  
  if (wehMatch) {
    let type;
    [_, sourcePath, line, col, type, msg] = Array.from(wehMatch);
    sourcePath = sourcePath.endsWith('stdinfile.nim') ? filePath : KnownFiles.getCanonical(sourcePath);
    if (type === 'Hint') { type = 'info'; }
    type = type.toLowerCase();
    line = parseInt(line) - 1;
    col  = parseInt(col) - 1;

    return{
      location: {
        file: sourcePath,
        position: [[line, col],[line, col+1]]
      },
      severity: type,
      excerpt: msg
    };
  }
    

  const internalErrorMatch = matchInternalError(line);

  if (internalErrorMatch) {
    state.foundInternalError = true;
    return;
  }

  const sigsegvErrorMatch = matchSigsegvError(line);

  if (sigsegvErrorMatch) {
    state.foundInternalError = true;
    return;
  }
};

class CompilerErrorsParser {
  constructor(options) {
    this.options = options;
  }

  parse(filePath, errorLines) {
    const results = [];
    const err = null;
    const state =
      {foundInternalError: false};

    for (let errorLine of Array.from(errorLines)) {
      const processed = processLine(filePath, errorLine, state);
      if (processed instanceof Array) {
        processed.forEach(x => results.push(x));
      } else if (processed != null) {
        results.push(processed);
      }
    }
    
    if (state.foundInternalError) {
      results.push({
        location: {
          file: filePath,
          position: [[0, 0],[0, 0]]
        },
        severity: 'Error',
        excerpt: 'Compiler internal error.  Details dumped to developer console.  Go to View -> Developer -> Toggle Developer Tools and open the Console to view.'
      });
        
      console.log(`ERROR: Compiler execution failed.\nOutput:\n${errorLines.join('\n')}`);
    }

    console.log(results);

    return {
      err,
      result: results
    };
  }
}

module.exports = CompilerErrorsParser;