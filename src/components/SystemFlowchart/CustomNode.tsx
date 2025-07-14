
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Component, Zap, Database } from 'lucide-react';

interface CustomNodeData {
  label: string;
  description: string;
  category: 'interface' | 'business' | 'external';
}

const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const getIcon = () => {
    switch (data.category) {
      case 'interface':
        return <Component className="w-4 h-4" />;
      case 'business':
        return <Zap className="w-4 h-4" />;
      case 'external':
        return <Database className="w-4 h-4" />;
      default:
        return <Component className="w-4 h-4" />;
    }
  };

  const getColor = () => {
    switch (data.category) {
      case 'interface':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'business':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'external':
        return 'bg-purple-100 border-purple-300 text-purple-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 ${getColor()} min-w-32`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex items-center gap-2">
        {getIcon()}
        <div>
          <div className="text-sm font-bold">{data.label}</div>
          <div className="text-xs opacity-75">{data.description}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
};

export default CustomNode;
