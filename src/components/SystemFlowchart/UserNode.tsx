
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Building } from 'lucide-react';

interface UserNodeData {
  label: string;
  description: string;
  role: 'expert' | 'client';
}

const UserNode = ({ data }: { data: UserNodeData }) => {
  const isExpert = data.role === 'expert';

  return (
    <div className={`px-4 py-2 shadow-md rounded-full border-2 min-w-32 ${
      isExpert 
        ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
        : 'bg-amber-100 border-amber-300 text-amber-800'
    }`}>
      <Handle type="source" position={Position.Top} className="w-2 h-2" />
      <div className="flex items-center gap-2">
        {isExpert ? <User className="w-4 h-4" /> : <Building className="w-4 h-4" />}
        <div>
          <div className="text-sm font-bold">{data.label}</div>
          <div className="text-xs opacity-75">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

export default UserNode;
