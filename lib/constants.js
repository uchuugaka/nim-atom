module.exports = {
  NimSymbolsTypes: {
    skParam: 'variable',
    skVar: 'variable',
    skLet: 'variable',
    skTemp: 'variable',
    skForVar: 'variable',
    skResult: 'variable',
    skConst: 'constant',
    skGenericParam: 'type',
    skType: 'type',
    skField: 'property',
    skProc: 'function',
    skMethod: 'method',
    skIterator: 'function',
    skConverter: 'function',
    skMacro: 'function',
    skTemplate: 'function',
    skEnumField: 'constant'
  },
  CommandTypes: {
    DEFINITION: 'DEFINITION',
    SUGGEST: 'SUGGESTIONS',
    CONTEXT: 'INVOCATION_CONTEXT',
    USAGE: 'SYMBOL_USAGES',
    LINT: 'LINT',
    BUILD: 'BUILD'
  },
  AutoCompleteOptions: {
    ALWAYS: 'ALWAYS',
    AFTERDOT: 'AFTERDOT',
    NEVER: 'NEVER'
  }
};