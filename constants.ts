import { Buffer } from './types';

export const INITIAL_BUFFER_ID = 'scratch';

export const WELCOME_MESSAGE = `;; This buffer is for text that is not saved, and for Lisp evaluation.
;; To create a file, visit it with C-x C-f and enter text in your file's buffer.

Welcome to React Emacs v1.0
===========================

Keybindings:
C-x C-f    Find File (Create/Open Buffer)
C-x C-s    Save Buffer (Mock)
C-x b      Switch Buffer
C-x k      Kill Buffer
M-x        Execute Command
M-:        Eval Expression
C-x C-e    Eval Last S-expression
C-g        Cancel / Quit

AI Commands:
M-x ask-gemini      Ask Gemini AI a question
M-x gemini-explain  Explain the code in current buffer

Lisp Scratchpad:
Try evaluating these expressions with C-x C-e (place cursor at end of line):
(+ 2 2)
(message "Hello from Emacs!")
(insert " This text was inserted by Lisp.")
(progn (insert "A") (insert "B") (insert "C"))
`;

export const INITIAL_BUFFERS: Buffer[] = [
  {
    id: INITIAL_BUFFER_ID,
    name: '*scratch*',
    content: WELCOME_MESSAGE,
    cursorPosition: 0,
    mode: 'Lisp Interaction',
    isModified: false,
  },
  {
    id: 'messages',
    name: '*Messages*',
    content: 'React Emacs initialization complete.\n',
    cursorPosition: 0,
    mode: 'Fundamental',
    isModified: false,
    readOnly: true,
  }
];

export const THEME = {
  bg: 'bg-[#3f3f3f]',
  fg: 'text-[#dcdccc]',
  modelineBg: 'bg-[#5f5f5f]',
  modelineFg: 'text-white',
  cursor: 'bg-[#dcdccc]',
  selection: 'selection:bg-[#5f5f5f]',
};