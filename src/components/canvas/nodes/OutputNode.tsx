'use client';

import { NodeProps } from 'reactflow';
import { NodeData } from '@/store/useCanvasStore';
import { HiOutlineDocumentText } from 'react-icons/hi';
import BaseNode from './BaseNode';

export default function OutputNode({ id, data, selected, type = 'output', zIndex = 0, isConnectable = true, xPos = 0, yPos = 0, dragHandle, dragging = false }: NodeProps<NodeData>) {
  return (
    <BaseNode 
      id={id} 
      data={data} 
      selected={selected}
      type={type}
      zIndex={zIndex}
      isConnectable={isConnectable}
      xPos={xPos}
      yPos={yPos}
      dragHandle={dragHandle}
      dragging={dragging}
    >
      {/* Use a badge to show output format when configured */}
      {data.settings?.outputFormat && (
        <div className="inline-flex items-center px-2 py-1 rounded-full bg-white/20 text-xs text-white mt-1">
          <span className="mr-1">→</span>
          {data.settings.outputFormat}
        </div>
      )}
      
      {/* Show config prompt when not configured */}
      {!data.settings?.outputFormat && (
        <div className="text-xs text-white/70 italic mt-1 border border-dashed border-white/30 rounded p-1 text-center">
          Click to configure output format
        </div>
      )}
    </BaseNode>
  );
}
