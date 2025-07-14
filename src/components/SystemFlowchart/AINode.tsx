
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Brain, Cpu, Sparkles } from 'lucide-react';

interface AINodeData {
  label: string;
  description: string;
  model: string;
}

const AINode = ({ data }: { data: AINodeData }) => {
  const getIcon = () => {
    if (data.model.includes('gpt')) return <Brain className="w-5 h-5" />;
    if (data.model === 'text-processing') return <Cpu className="w-5 h-5" />;
    return <Sparkles className="w-5 h-5" />;
  };

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-pink-100 to-purple-100 border-pink-300 text-pink-800 min-w-48">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center gap-2 mb-2">
        {getIcon()}
        <div>
          <div className="text-sm font-bold">{data.label}</div>
          <div className="text-xs opacity-75">{data.description}</div>
        </div>
      </div>
      <div className="text-xs mt-2">
        <div className="font-semibold">Modelo: {data.model}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default AINode;
