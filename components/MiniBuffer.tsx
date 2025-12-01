import React, { useEffect, useRef } from 'react';
import { MinibufferType } from '../types';

interface MiniBufferProps {
  type: MinibufferType;
  prompt: string;
  input: string;
  message: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const MiniBuffer: React.FC<MiniBufferProps> = ({ type, prompt, input, message, onChange, onKeyDown }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (type !== MinibufferType.NONE && inputRef.current) {
      inputRef.current.focus();
    }
  }, [type]);

  if (type === MinibufferType.NONE) {
    return (
      <div className="h-8 w-full bg-[#3f3f3f] text-[#dcdccc] px-2 flex items-center text-sm font-mono overflow-hidden whitespace-nowrap">
        {message}
      </div>
    );
  }

  return (
    <div className="h-8 w-full bg-[#3f3f3f] text-[#dcdccc] px-2 flex items-center text-sm font-mono border-t border-gray-700">
      <span className="text-[#8cd0d3] mr-2 whitespace-nowrap">{prompt}</span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="flex-1 bg-transparent border-none outline-none text-[#dcdccc] h-full"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
};

export default MiniBuffer;