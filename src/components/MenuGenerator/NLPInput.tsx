
import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NLPInputProps {
  onCommand: (command: string) => Promise<void>;
  isProcessing: boolean;
  placeholder?: string;
}

const NLPInput = ({ onCommand, isProcessing, placeholder = "Digite um comando em linguagem natural..." }: NLPInputProps) => {
  const [command, setCommand] = useState('');
  const [suggestions] = useState([
    "Substituir frango por peixe",
    "Adicionar opção vegana",
    "Reduzir custo em 10%",
    "Remover ingredientes com glúten"
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isProcessing) {
      await onCommand(command);
      setCommand('');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={placeholder}
          disabled={isProcessing}
          className="flex-1"
        />
        <Button 
          type="submit" 
          disabled={!command.trim() || isProcessing}
          className="bg-green-600 hover:bg-green-700"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
      
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => setCommand(suggestion)}
            disabled={isProcessing}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NLPInput;
