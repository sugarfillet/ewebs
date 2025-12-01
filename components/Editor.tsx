import React, { useRef, useEffect } from 'react';
import { Buffer, EditorMode } from '../types';
import { THEME } from '../constants';

interface EditorProps {
  buffer: Buffer;
  isActive: boolean;
  onUpdateContent: (content: string) => void;
  onUpdateCursor: (position: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const Editor: React.FC<EditorProps> = ({ buffer, isActive, onUpdateContent, onUpdateCursor, onKeyDown }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync cursor position from state to DOM when buffer changes or cursor moves via logic
  useEffect(() => {
    if (textareaRef.current && isActive) {
        // Only set selection if it deviates to avoid fighting native behavior during typing
        if (textareaRef.current.selectionStart !== buffer.cursorPosition) {
             textareaRef.current.setSelectionRange(buffer.cursorPosition, buffer.cursorPosition);
        }
    }
  }, [buffer.cursorPosition, buffer.id, isActive]);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isActive, buffer.id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateContent(e.target.value);
    onUpdateCursor(e.target.selectionStart);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    onUpdateCursor(e.currentTarget.selectionStart);
  };

  return (
    <div className={`flex-1 relative w-full h-full overflow-hidden ${THEME.bg}`}>
      <textarea
        ref={textareaRef}
        value={buffer.content}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onSelect={handleSelect}
        readOnly={buffer.readOnly}
        spellCheck={false}
        className={`w-full h-full p-2 resize-none outline-none font-mono text-base leading-relaxed ${THEME.bg} ${THEME.fg} ${THEME.selection} border-none`}
        style={{ fontFamily: '"Fira Code", monospace' }}
      />
    </div>
  );
};

export default Editor;