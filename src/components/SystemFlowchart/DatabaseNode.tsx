
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, Server } from 'lucide-react';

interface DatabaseNodeData {
  label: string;
  description: string;
  tables: string[];
}

const DatabaseNode = ({ data }: { data: DatabaseNodeData }) => {
  const isLegacy = data.label.includes('Legado');

  return (
    <div className={`px-4 py-3 shadow-lg rounded-lg border-2 min-w-48 ${
      isLegacy 
        ? 'bg-orange-100 border-orange-300 text-orange-800' 
        : 'bg-indigo-100 border-indigo-300 text-indigo-800'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center gap-2 mb-2">
        {isLegacy ? <Server className="w-5 h-5" /> : <Database className="w-5 h-5" />}
        <div>
          <div className="text-sm font-bold">{data.label}</div>
          <div className="text-xs opacity-75">{data.description}</div>
        </div>
      </div>
      <div className="text-xs mt-2">
        <div className="font-semibold mb-1">Tabelas:</div>
        {data.tables.map((table, index) => (
          <div key={index} className="opacity-75">• {table}</div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default DatabaseNode;
