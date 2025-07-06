'use client';

import { NodeProps } from 'reactflow';
import { NodeData } from '@/store/useCanvasStore';
import { HiOutlineDatabase } from 'react-icons/hi';
import BaseNode from './BaseNode';

export default function IndexerNode({ id, data, selected, type = 'indexer', zIndex = 0, isConnectable = true, xPos = 0, yPos = 0, dragHandle, dragging = false }: NodeProps<NodeData>) {
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
      <div className="flex items-center justify-center mt-3">
        <HiOutlineDatabase className="text-white w-8 h-8" />
      </div>
      <div className="text-xs text-white mt-2 opacity-80">
        {data.settings?.vectorStore || 'Configure indexer'}
      </div>
    </BaseNode>
  );
}
