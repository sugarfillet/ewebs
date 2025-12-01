// Lisp Interpreter for React Emacs

// --- Types ---

export type LispType = 'SYMBOL' | 'NUMBER' | 'STRING' | 'LIST' | 'FUNC' | 'PRIMITIVE' | 'BOOL' | 'NULL';

export interface LispVal {
  type: LispType;
  value?: any;
  name?: string; // for symbols
  elements?: LispVal[]; // for lists
  fn?: (args: LispVal[], env: LispEnv) => LispVal; // for primitives
  params?: string[]; // for lambdas
  body?: LispVal; // for lambdas
}

export interface EmacsAPI {
  message: (msg: string) => void;
  insert: (text: string) => void;
  getBufferContent: () => string;
  getCursor: () => number;
  setCursor: (pos: number) => void;
  switchBuffer: (name: string) => void;
  currentBufferName: () => string;
  killBuffer: (name: string) => void;
}

// --- Environment ---

export class LispEnv {
  vars: Map<string, LispVal>;
  outer?: LispEnv;
  api: EmacsAPI;

  constructor(api: EmacsAPI, outer?: LispEnv) {
    this.vars = new Map();
    this.outer = outer;
    this.api = api;
  }

  get(name: string): LispVal {
    if (this.vars.has(name)) return this.vars.get(name)!;
    if (this.outer) return this.outer.get(name);
    throw new Error(`Void variable: ${name}`);
  }

  set(name: string, val: LispVal) {
    this.vars.set(name, val);
  }

  define(name: string, val: LispVal) {
    this.vars.set(name, val);
  }
}

// --- Helpers ---

export const mkNum = (n: number): LispVal => ({ type: 'NUMBER', value: n });
export const mkStr = (s: string): LispVal => ({ type: 'STRING', value: s });
export const mkSym = (s: string): LispVal => ({ type: 'SYMBOL', name: s });
export const mkBool = (b: boolean): LispVal => ({ type: 'BOOL', value: b });
export const mkList = (elm: LispVal[]): LispVal => ({ type: 'LIST', elements: elm });
export const mkNull = (): LispVal => ({ type: 'NULL' });

const isTrue = (v: LispVal) => !(v.type === 'NULL' || (v.type === 'BOOL' && v.value === false));

// --- Parser ---

export const tokenize = (input: string): string[] => {
  return input
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .replace(/'/g, " ' ")
    .split(/\s+/)
    .filter(t => t.length > 0);
};

// A simple recursive descent parser
// This simple version doesn't handle strings with spaces perfectly if splitting by space first.
// Let's implement a character-based parser for better string support.

export const parse = (input: string): LispVal => {
  let pos = 0;

  const skipWhitespace = () => {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
  };

  const parseString = (): LispVal => {
    pos++; // skip "
    let start = pos;
    while (pos < input.length && input[pos] !== '"') {
      if (input[pos] === '\\') pos++;
      pos++;
    }
    const s = input.slice(start, pos);
    pos++; // skip closing "
    return mkStr(s.replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  };

  const parseList = (): LispVal => {
    pos++; // skip (
    const elements: LispVal[] = [];
    while (pos < input.length) {
      skipWhitespace();
      if (input[pos] === ')') {
        pos++;
        return mkList(elements);
      }
      elements.push(parseExpr());
    }
    throw new Error("Unclosed list");
  };

  const parseAtom = (): LispVal => {
    let start = pos;
    while (pos < input.length && !/\s|\)|\(/.test(input[pos])) pos++;
    const token = input.slice(start, pos);
    
    if (token === 't') return mkBool(true);
    if (token === 'nil') return mkNull();
    if (/^-?\d+(\.\d+)?$/.test(token)) return mkNum(parseFloat(token));
    return mkSym(token);
  };

  const parseQuote = (): LispVal => {
    pos++; // skip '
    const expr = parseExpr();
    return mkList([mkSym('quote'), expr]);
  };

  const parseExpr = (): LispVal => {
    skipWhitespace();
    if (pos >= input.length) return mkNull(); // Should not happen in valid expr
    if (input[pos] === '"') return parseString();
    if (input[pos] === '(') return parseList();
    if (input[pos] === '\'') return parseQuote();
    return parseAtom();
  };

  return parseExpr();
};

// --- Evaluator ---

export const evalLisp = (expr: LispVal, env: LispEnv): LispVal => {
  switch (expr.type) {
    case 'NUMBER':
    case 'STRING':
    case 'BOOL':
    case 'NULL':
      return expr;
    case 'SYMBOL':
      return env.get(expr.name!);
    case 'LIST':
      const elements = expr.elements!;
      if (elements.length === 0) return mkNull();
      
      const head = elements[0];
      // Special forms
      if (head.type === 'SYMBOL') {
        switch (head.name) {
          case 'quote':
            return elements[1];
          case 'setq': {
             // (setq name val name2 val2...)
             let result: LispVal = mkNull();
             for(let i=1; i < elements.length; i+=2) {
                const sym = elements[i];
                if (sym.type !== 'SYMBOL') throw new Error("setq expects symbols");
                const val = evalLisp(elements[i+1], env);
                env.set(sym.name!, val);
                result = val;
             }
             return result;
          }
          case 'if': {
             const cond = evalLisp(elements[1], env);
             if (isTrue(cond)) {
               return evalLisp(elements[2], env);
             } else if (elements.length > 3) {
               return evalLisp(elements[3], env);
             }
             return mkNull();
          }
          case 'defun': {
             // (defun name (params) body...)
             const name = elements[1].name!;
             const params = elements[2].elements!.map(e => e.name!);
             // Body is implicit progn
             const body = mkList([mkSym('progn'), ...elements.slice(3)]);
             const fn: LispVal = {
               type: 'FUNC',
               params,
               body
             };
             env.define(name, fn);
             return mkSym(name);
          }
          case 'progn': {
             let result: LispVal = mkNull();
             for (let i=1; i < elements.length; i++) {
               result = evalLisp(elements[i], env);
             }
             return result;
          }
          case 'let': {
             // (let ((var val) ...) body...)
             const bindings = elements[1].elements!;
             const newEnv = new LispEnv(env.api, env);
             bindings.forEach(b => {
               if (b.type === 'LIST') {
                 const name = b.elements![0].name!;
                 const val = evalLisp(b.elements![1], env); // eval in outer env
                 newEnv.define(name, val);
               } else if (b.type === 'SYMBOL') {
                 newEnv.define(b.name!, mkNull());
               }
             });
             let result: LispVal = mkNull();
             for(let i=2; i<elements.length; i++) {
               result = evalLisp(elements[i], newEnv);
             }
             return result;
          }
          case 'interactive': return mkNull(); // ignore
        }
      }

      // Function application
      const fn = evalLisp(head, env);
      const args = elements.slice(1).map(e => evalLisp(e, env));

      if (fn.type === 'PRIMITIVE') {
        return fn.fn!(args, env);
      } else if (fn.type === 'FUNC') {
        const activationRecord = new LispEnv(env.api, env); // lexical scoping would require closing over definition env, but simplified to dynamic-ish for now or use global as base
        // Actually, for proper lexical scope, we need the env where it was defined.
        // For this simple lisp, we'll just chain to current global for simplicity (Dynamic Scope-ish)
        
        fn.params!.forEach((p, i) => {
          activationRecord.define(p, args[i] || mkNull());
        });
        return evalLisp(fn.body!, activationRecord);
      }
      throw new Error(`Invalid function call: ${JSON.stringify(head)}`);
    
    default:
      return expr;
  }
};

// --- Standard Library ---

export const createGlobalEnv = (api: EmacsAPI): LispEnv => {
  const env = new LispEnv(api);

  const register = (name: string, fn: (args: LispVal[], env: LispEnv) => LispVal) => {
    env.define(name, { type: 'PRIMITIVE', fn });
  };

  // Math
  register('+', args => mkNum(args.reduce((a, b) => a + (b.value as number), 0)));
  register('-', args => mkNum((args[0].value as number) - (args.slice(1).reduce((a, b) => a + (b.value as number), 0))));
  register('*', args => mkNum(args.reduce((a, b) => a * (b.value as number), 1)));
  register('/', args => mkNum((args[0].value as number) / (args[1].value as number)));
  register('=', args => mkBool(args[0].value === args[1].value));
  register('<', args => mkBool((args[0].value as number) < (args[1].value as number)));
  register('>', args => mkBool((args[0].value as number) > (args[1].value as number)));

  // List ops
  register('list', args => mkList(args));
  register('cons', args => mkList([args[0], ...(args[1].elements || [])])); // simplified
  register('car', args => args[0].elements ? args[0].elements[0] : mkNull());
  register('cdr', args => args[0].elements ? mkList(args[0].elements.slice(1)) : mkNull());

  // Emacs Primitives
  register('message', args => {
    const msg = args.map(a => a.type === 'STRING' ? a.value : JSON.stringify(a)).join(' ');
    api.message(msg);
    return mkStr(msg);
  });

  register('insert', args => {
    const text = args.map(a => a.value).join('');
    api.insert(text);
    return mkNull();
  });

  register('buffer-name', () => mkStr(api.currentBufferName()));
  register('current-buffer', () => mkStr(api.currentBufferName())); // Simplified: return name as ID
  
  register('switch-to-buffer', args => {
    const name = args[0].value;
    api.switchBuffer(name);
    return mkStr(name);
  });
  
  register('kill-buffer', args => {
    const name = args[0].value;
    api.killBuffer(name);
    return mkNull();
  });

  register('point', () => mkNum(api.getCursor()));
  register('point-min', () => mkNum(0));
  register('point-max', () => mkNum(api.getBufferContent().length));
  register('goto-char', args => {
    api.setCursor(args[0].value as number);
    return args[0];
  });

  return env;
};

// --- S-Exp Finder ---

export const findLastSexp = (text: string, cursor: number): string | null => {
  // Scan backwards from cursor
  // This is a heuristic implementation
  let pos = cursor - 1;
  // Skip trailing whitespace
  while (pos >= 0 && /\s/.test(text[pos])) pos--;
  
  if (pos < 0) return null;

  if (text[pos] === ')') {
    // Scan back for matching (
    let depth = 1;
    let end = pos + 1;
    pos--;
    while (pos >= 0 && depth > 0) {
      if (text[pos] === ')') depth++;
      if (text[pos] === '(') depth--;
      if (depth > 0) pos--;
    }
    if (depth === 0) {
      return text.slice(pos, end);
    }
  } else if (text[pos] === '"') {
    // Scan back for opening "
    let end = pos + 1;
    pos--;
    while(pos >= 0) {
        if(text[pos] === '"' && text[pos-1] !== '\\') break;
        pos--;
    }
    return text.slice(pos, end);
  } else {
    // Atom
    let end = pos + 1;
    while (pos >= 0 && !/\s|\(|\)/.test(text[pos])) pos--;
    return text.slice(pos + 1, end);
  }
  return null;
};

export const printLisp = (val: LispVal): string => {
  if (val.type === 'NULL') return 'nil';
  if (val.type === 'BOOL') return val.value ? 't' : 'nil';
  if (val.type === 'NUMBER') return val.value.toString();
  if (val.type === 'STRING') return `"${val.value}"`;
  if (val.type === 'SYMBOL') return val.name!;
  if (val.type === 'LIST') return `(${val.elements!.map(printLisp).join(' ')})`;
  if (val.type === 'FUNC') return `<function>`;
  if (val.type === 'PRIMITIVE') return `<subr>`;
  return '?';
};