import React from 'react';
import { Buffer, EditorMode } from '../types';
import { THEME } from '../constants';

interface StatusLineProps {
  buffer: Buffer;
  mode: EditorMode;
  chordStack: string;
}

const StatusLine: React.FC<StatusLineProps> = ({ buffer, mode, chordStack }) => {
  // Emacs style: -U:--- Name  Line  (Mode)
  
  const modifiedIndicator = buffer.isModified ? '**' : '--';
  const readOnlyIndicator = buffer.readOnly ? '%' : '-';
  const statusStr = `-${readOnlyIndicator}${modifiedIndicator}-`;
  
  const displayMode = mode === EditorMode.WAITING_FOR_CHORD ? `Waiting for key (${chordStack})` : buffer.mode;

  return (
    <div className={`h-6 w-full flex items-center px-2 text-sm font-mono select-none ${THEME.modelineBg} ${THEME.modelineFg} border-t border-b border-gray-600`}>
      <span className="mr-2 text-gray-300">CS:1</span>
      <span className="mr-2">{statusStr}</span>
      <span className="font-bold mr-4">{buffer.name}</span>
      <span className="mr-auto">All</span>
      <span className="mr-2">({displayMode})</span>
    </div>
  );
};

export default StatusLine;