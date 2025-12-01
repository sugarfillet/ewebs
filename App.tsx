import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Buffer, EditorMode, MinibufferType, EmacsState } from './types';
import { INITIAL_BUFFERS, INITIAL_BUFFER_ID, THEME } from './constants';
import StatusLine from './components/StatusLine';
import MiniBuffer from './components/MiniBuffer';
import Editor from './components/Editor';
import { generateText, explainCode } from './services/geminiService';
import { createGlobalEnv, evalLisp, parse, printLisp, findLastSexp, LispEnv, EmacsAPI } from './services/lisp';

const App: React.FC = () => {
  // We use a Ref for the authoritative state to allow synchronous Lisp operations
  // that need to chain (progn (insert "a") (insert "b"))
  const stateRef = useRef<EmacsState>({
    buffers: INITIAL_BUFFERS,
    activeBufferId: INITIAL_BUFFER_ID,
    editorMode: EditorMode.NORMAL,
    chordStack: '',
    minibuffer: {
      type: MinibufferType.NONE,
      prompt: '',
      input: '',
    },
    message: 'For information about GNU Emacs and the GNU system, type C-h C-a.',
  });

  // A counter to force React re-renders when Ref changes
  const [tick, setTick] = useState(0);

  // Sync function to update React view
  const refresh = () => setTick(t => t + 1);

  // State Accessor for render
  const state = stateRef.current;
  const activeBuffer = state.buffers.find(b => b.id === state.activeBufferId) || state.buffers[0];

  // --- Lisp Environment Setup ---

  const api: EmacsAPI = {
    message: (msg: string) => {
      stateRef.current.message = msg;
      refresh();
    },
    insert: (text: string) => {
      const s = stateRef.current;
      const bufIdx = s.buffers.findIndex(b => b.id === s.activeBufferId);
      if (bufIdx === -1) return;
      
      const buf = s.buffers[bufIdx];
      const before = buf.content.slice(0, buf.cursorPosition);
      const after = buf.content.slice(buf.cursorPosition);
      
      s.buffers[bufIdx] = {
        ...buf,
        content: before + text + after,
        cursorPosition: buf.cursorPosition + text.length,
        isModified: true
      };
      refresh();
    },
    getBufferContent: () => {
        const s = stateRef.current;
        const buf = s.buffers.find(b => b.id === s.activeBufferId);
        return buf ? buf.content : "";
    },
    getCursor: () => {
        const s = stateRef.current;
        const buf = s.buffers.find(b => b.id === s.activeBufferId);
        return buf ? buf.cursorPosition : 0;
    },
    setCursor: (pos: number) => {
        const s = stateRef.current;
        const idx = s.buffers.findIndex(b => b.id === s.activeBufferId);
        if (idx !== -1) {
            s.buffers[idx].cursorPosition = Math.max(0, Math.min(pos, s.buffers[idx].content.length));
            refresh();
        }
    },
    switchBuffer: (name: string) => {
        // Logic duplicated from main switchBuffer but operating on Ref
        const s = stateRef.current;
        const existing = s.buffers.find(b => b.name === name);
        if (existing) {
            s.activeBufferId = existing.id;
        } else {
             // Create if not exists (loose behavior for switch-to-buffer)
             const newBuf: Buffer = {
                 id: name,
                 name: name,
                 content: '',
                 cursorPosition: 0,
                 mode: 'Fundamental',
                 isModified: false
             };
             s.buffers.push(newBuf);
             s.activeBufferId = newBuf.id;
        }
        refresh();
    },
    currentBufferName: () => {
        const s = stateRef.current;
        const buf = s.buffers.find(b => b.id === s.activeBufferId);
        return buf ? buf.name : "";
    },
    killBuffer: (name: string) => {
        const s = stateRef.current;
        if (s.buffers.length <= 1) return;
        const killId = s.buffers.find(b => b.name === name)?.id;
        if (!killId) return;

        s.buffers = s.buffers.filter(b => b.id !== killId);
        if (s.activeBufferId === killId) {
            s.activeBufferId = s.buffers[0].id;
        }
        refresh();
    }
  };

  const lispEnvRef = useRef<LispEnv | null>(null);
  if (!lispEnvRef.current) {
    lispEnvRef.current = createGlobalEnv(api);
  }

  // --- Core Actions (Operating on Ref) ---

  const echo = (msg: string) => {
    stateRef.current.message = msg;
    refresh();
  };

  const updateActiveBuffer = (updates: Partial<Buffer>) => {
    const s = stateRef.current;
    const idx = s.buffers.findIndex(b => b.id === s.activeBufferId);
    if (idx !== -1) {
      s.buffers[idx] = { ...s.buffers[idx], ...updates };
      refresh();
    }
  };

  const switchBuffer = (bufferId: string) => {
    const s = stateRef.current;
    s.activeBufferId = bufferId;
    s.message = `Switched to buffer ${bufferId}`;
    s.editorMode = EditorMode.NORMAL;
    s.minibuffer = { type: MinibufferType.NONE, prompt: '', input: '' };
    refresh();
  };

  const createBuffer = (name: string) => {
    const s = stateRef.current;
    const existing = s.buffers.find(b => b.name === name);
    if (existing) {
      switchBuffer(existing.id);
      return;
    }
    const newBuffer: Buffer = {
      id: name,
      name: name,
      content: '',
      cursorPosition: 0,
      mode: 'Fundamental',
      isModified: false,
    };
    s.buffers.push(newBuffer);
    s.activeBufferId = newBuffer.id;
    s.editorMode = EditorMode.NORMAL;
    s.message = '(New file)';
    s.minibuffer = { type: MinibufferType.NONE, prompt: '', input: '' };
    refresh();
  };

  const killBuffer = () => {
    const s = stateRef.current;
    if (s.buffers.length <= 1) {
      echo("Cannot kill the last buffer");
      return;
    }
    const idx = s.buffers.findIndex(b => b.id === s.activeBufferId);
    const nextBuffer = s.buffers[idx === 0 ? 1 : idx - 1];
    
    s.buffers = s.buffers.filter(b => b.id !== s.activeBufferId);
    s.activeBufferId = nextBuffer.id;
    s.message = `Killed buffer`;
    s.editorMode = EditorMode.NORMAL;
    s.chordStack = '';
    refresh();
  };

  // --- Logic ---

  const evalSexp = (code: string) => {
    try {
        const ast = parse(code);
        const result = evalLisp(ast, lispEnvRef.current!);
        echo(printLisp(result));
    } catch (e) {
        echo(`Lisp Error: ${(e as Error).message}`);
    }
  };

  const executeCommand = async (cmdName: string) => {
    switch (cmdName) {
      case 'ask-gemini':
        startMinibuffer(MinibufferType.GEMINI_PROMPT, 'Ask Gemini: ');
        break;
      case 'gemini-explain':
        echo("Gemini is thinking...");
        try {
          const s = stateRef.current;
          const currBuf = s.buffers.find(b => b.id === s.activeBufferId)!;
          const explanation = await explainCode(currBuf.content);
          
          const explainBufferId = `*Gemini-Explain*`;
          const existing = s.buffers.find(b => b.id === explainBufferId);
          if (existing) {
              existing.content = explanation;
              switchBuffer(explainBufferId);
          } else {
             const newBuf: Buffer = {
                  id: explainBufferId,
                  name: explainBufferId,
                  content: explanation,
                  cursorPosition: 0,
                  mode: 'Markdown',
                  isModified: false,
                  readOnly: true
              };
              stateRef.current.buffers.push(newBuf);
              switchBuffer(explainBufferId);
          }
        } catch (e) {
          echo("Gemini Error.");
        }
        break;
      case 'kill-buffer':
        killBuffer();
        break;
      default:
        echo(`Command not found: ${cmdName}`);
    }
  };

  const startMinibuffer = (type: MinibufferType, prompt: string) => {
    const s = stateRef.current;
    s.editorMode = EditorMode.MINIBUFFER;
    s.minibuffer = { type, prompt, input: '' };
    s.chordStack = '';
    refresh();
  };

  const handleMinibufferCommit = async (value: string) => {
    const s = stateRef.current;
    const type = s.minibuffer.type;
    
    // Reset mode
    s.minibuffer.type = MinibufferType.NONE;
    s.editorMode = EditorMode.NORMAL;
    refresh();

    if (type === MinibufferType.COMMAND) {
      executeCommand(value);
    } else if (type === MinibufferType.FIND_FILE) {
      createBuffer(value);
    } else if (type === MinibufferType.SWITCH_BUFFER) {
        const target = s.buffers.find(b => b.name === value);
        if(target) switchBuffer(target.id);
        else createBuffer(value);
    } else if (type === MinibufferType.GEMINI_PROMPT) {
      echo("Gemini is thinking...");
      try {
        const text = await generateText(value);
        api.insert(text); // Use Lisp API logic for insertion
        echo("Gemini response inserted.");
      } catch (e) {
        echo("Gemini API Error.");
      }
    } else if (type === MinibufferType.EVAL) {
        evalSexp(value);
    }
  };

  // --- Key Handling ---

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    const { key, ctrlKey, altKey, metaKey, shiftKey } = e;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isMeta = isMac ? metaKey : altKey; 
    const isCtrl = ctrlKey;

    // Prevent default browser actions for common Emacs keys
    if ((isCtrl && ['n','p','f','b','a','e','k','y','v'].includes(key)) || (isMeta)) {
      // NOTE: We do not preventDefault everything (like C-c, C-v for copy paste)
      // but specific nav keys need it.
      // C-n = New Window, C-p = Print in some browsers.
      // e.preventDefault(); 
      // Handled in individual cases below to be safe.
    }

    if (isMeta && key === ':') { // M-: (Eval)
        e.preventDefault();
        startMinibuffer(MinibufferType.EVAL, 'Eval: ');
        return;
    }

    if (isMeta && key === 'x') { // M-x
      e.preventDefault();
      startMinibuffer(MinibufferType.COMMAND, 'M-x ');
      return;
    }

    // CHORD handling
    if (state.editorMode === EditorMode.WAITING_FOR_CHORD) {
      e.preventDefault();
      stateRef.current.editorMode = EditorMode.NORMAL;
      stateRef.current.chordStack = '';
      refresh();

      if (isCtrl && key === 'f') { // C-x C-f
        startMinibuffer(MinibufferType.FIND_FILE, 'Find file: ');
      } else if (isCtrl && key === 's') { // C-x C-s
        echo(`Wrote ${activeBuffer.name}`);
        updateActiveBuffer({ isModified: false });
      } else if (key === 'b') { // C-x b
        startMinibuffer(MinibufferType.SWITCH_BUFFER, 'Switch to buffer: ');
      } else if (key === 'k') { // C-x k
        killBuffer();
      } else if (isCtrl && key === 'g') { // C-x C-g
        echo("Quit");
      } else if (isCtrl && key === 'e') { // C-x C-e (Eval Last Sexp)
        const content = activeBuffer.content;
        const cursor = activeBuffer.cursorPosition;
        const sexp = findLastSexp(content, cursor);
        if (sexp) {
            evalSexp(sexp);
        } else {
            echo("End of file or no sexp found");
        }
      } else {
        echo(`C-x ${key} is undefined`);
      }
      return;
    }

    // NORMAL bindings
    if (isCtrl) {
      switch (key) {
        case 'x':
          e.preventDefault();
          stateRef.current.editorMode = EditorMode.WAITING_FOR_CHORD;
          stateRef.current.chordStack = 'C-x';
          refresh();
          break;
        case 'g':
          e.preventDefault();
          echo("Quit");
          break;
        case 'n':
            e.preventDefault();
            moveCursorLine(1);
            break;
        case 'p':
            e.preventDefault();
            moveCursorLine(-1);
            break;
        // Basic cursor movement override checks
        case 'f':
        case 'b':
        case 'a': // Start of line
        case 'e': // End of line
            // Browser textarea usually handles these natively on macOS but not Windows.
            // For MVP let native behavior rule unless we build a full engine.
            break;
      }
    }
  };

  const moveCursorLine = (dir: number) => {
    // Logic reused but on Ref
    const s = stateRef.current;
    const buf = s.buffers.find(b => b.id === s.activeBufferId);
    if (!buf) return;
    
    const content = buf.content;
    const currentPos = buf.cursorPosition;
    
    // Find start of current line
    const lineStart = content.lastIndexOf('\n', currentPos - 1) + 1;
    const offset = currentPos - lineStart;
    
    let newPos = currentPos;
    
    if (dir === -1) { // Up
      if (lineStart === 0) return;
      const prevLineEnd = lineStart - 1;
      const prevLineStart = content.lastIndexOf('\n', prevLineEnd - 1) + 1;
      const prevLineLength = prevLineEnd - prevLineStart;
      newPos = prevLineStart + Math.min(offset, prevLineLength);
    } else { // Down
       const lineEnd = content.indexOf('\n', currentPos);
       if (lineEnd === -1) return;
       const nextLineStart = lineEnd + 1;
       const nextLineEnd = content.indexOf('\n', nextLineStart);
       const actualNextEnd = nextLineEnd === -1 ? content.length : nextLineEnd;
       const nextLineLength = actualNextEnd - nextLineStart;
       newPos = nextLineStart + Math.min(offset, nextLineLength);
    }
    
    buf.cursorPosition = newPos;
    refresh();
  };

  const handleMinibufferKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMinibufferCommit(stateRef.current.minibuffer.input);
    } else if (e.ctrlKey && e.key === 'g') {
      e.preventDefault();
      echo("Quit");
      stateRef.current.editorMode = EditorMode.NORMAL;
      stateRef.current.minibuffer.type = MinibufferType.NONE;
      refresh();
    }
  };

  return (
    <div className={`flex flex-col h-screen w-screen ${THEME.bg} text-white overflow-hidden`}>
      <Editor 
        buffer={activeBuffer}
        isActive={state.editorMode !== EditorMode.MINIBUFFER}
        onUpdateContent={(c) => updateActiveBuffer({ content: c, isModified: true })}
        onUpdateCursor={(p) => updateActiveBuffer({ cursorPosition: p })}
        onKeyDown={handleEditorKeyDown}
      />
      
      <StatusLine 
        buffer={activeBuffer} 
        mode={state.editorMode} 
        chordStack={state.chordStack}
      />
      
      <MiniBuffer 
        type={state.minibuffer.type}
        prompt={state.minibuffer.prompt}
        input={state.minibuffer.input}
        message={state.message}
        onChange={(val) => { stateRef.current.minibuffer.input = val; refresh(); }}
        onKeyDown={handleMinibufferKeyDown}
      />
    </div>
  );
};

export default App;