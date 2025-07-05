'use client';

import { NodeProps } from 'reactflow';
import { NodeData } from '@/store/useCanvasStore';
import { BiNetworkChart } from 'react-icons/bi';
import BaseNode from './BaseNode';

export default function EmbedderNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="flex items-center justify-center mt-3">
        <BiNetworkChart className="text-white w-8 h-8" />
      </div>
      <div className="text-xs text-white mt-2 opacity-80">
        {data.settings?.model || 'Configure embedder'}
      </div>
    </BaseNode>
  );
}
