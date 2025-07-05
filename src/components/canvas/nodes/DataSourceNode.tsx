'use client';

import { NodeProps } from 'reactflow';
import { NodeData } from '@/store/useCanvasStore';
import { FiDatabase } from 'react-icons/fi';
import BaseNode from './BaseNode';

export default function DataSourceNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="flex items-center justify-center mt-3">
        <FiDatabase className="text-white w-8 h-8" />
      </div>
      <div className="text-xs text-white mt-2 opacity-80">
        {data.settings?.sourceType || 'Configure data source'}
      </div>
    </BaseNode>
  );
}
