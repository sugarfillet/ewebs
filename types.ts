export interface Buffer {
  id: string;
  name: string;
  content: string;
  cursorPosition: number; // Index in content string
  mode: string;
  isModified: boolean;
  readOnly?: boolean;
}

export enum EditorMode {
  NORMAL = 'NORMAL',
  MINIBUFFER = 'MINIBUFFER',
  WAITING_FOR_CHORD = 'WAITING_FOR_CHORD', // e.g. after C-x
}

export enum MinibufferType {
  NONE = 'NONE',
  COMMAND = 'COMMAND', // M-x
  FIND_FILE = 'FIND_FILE', // C-x C-f
  SWITCH_BUFFER = 'SWITCH_BUFFER', // C-x b
  GEMINI_PROMPT = 'GEMINI_PROMPT', // Custom AI command
  YES_NO = 'YES_NO', // Confirmation
  EVAL = 'EVAL', // M-:
}

export interface EmacsState {
  buffers: Buffer[];
  activeBufferId: string;
  editorMode: EditorMode;
  chordStack: string; // "C-x"
  minibuffer: {
    type: MinibufferType;
    prompt: string;
    input: string;
    callback?: (input: string) => void;
  };
  message: string; // Echo area message
}

export interface Command {
  name: string;
  description: string;
  execute: () => void;
}