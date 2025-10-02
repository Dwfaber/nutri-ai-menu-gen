import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIAS_DISPONIVEIS = [
  'Prato Principal 1',
  'Prato Principal 2',
  'Guarnição',
  'Salada 1',
  'Salada 2',
  'Sobremesa',
  'Suco 1',
  'Suco 2',
  'Desjejum',
  'Bebidas'
];

interface AuditConfigFormProps {
  onStartAudit: (config: {
    categorias: string[] | null;
    limite_receitas: number;
    incluir_calculos_detalhados: boolean;
    apenas_problematicas: boolean;
  }) => void;
  isAuditing: boolean;
}

export const AuditConfigForm = ({ onStartAudit, isAuditing }: AuditConfigFormProps) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [limiteReceitas, setLimiteReceitas] = useState(50);
  const [calcularDetalhes, setCalcularDetalhes] = useState(false);
  const [apenasProblematicas, setApenasProblematicas] = useState(false);

  const handleCategoryToggle = (categoria: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoria) 
        ? prev.filter(c => c !== categoria)
        : [...prev, categoria]
    );
  };

  const handleSelectAll = () => {
    if (selectedCategories.length === CATEGORIAS_DISPONIVEIS.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...CATEGORIAS_DISPONIVEIS]);
    }
  };

  const handleSubmit = () => {
    onStartAudit({
      categorias: selectedCategories.length === 0 ? null : selectedCategories,
      limite_receitas: limiteReceitas,
      incluir_calculos_detalhados: calcularDetalhes,
      apenas_problematicas: apenasProblematicas
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label>Categorias a Auditar</Label>
        <div className="flex items-center gap-2 mb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isAuditing}
          >
            {selectedCategories.length === CATEGORIAS_DISPONIVEIS.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedCategories.length === 0 
              ? 'Todas as categorias serão auditadas'
              : `${selectedCategories.length} categoria(s) selecionada(s)`
            }
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CATEGORIAS_DISPONIVEIS.map(cat => (
            <div key={cat} className="flex items-center space-x-2">
              <Checkbox
                id={`cat-${cat}`}
                checked={selectedCategories.includes(cat)}
                onCheckedChange={() => handleCategoryToggle(cat)}
                disabled={isAuditing}
              />
              <Label
                htmlFor={`cat-${cat}`}
                className="text-sm font-normal cursor-pointer"
              >
                {cat}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="limite">Limite de Receitas por Categoria</Label>
          <Input
            id="limite"
            type="number"
            min={10}
            max={500}
            value={limiteReceitas}
            onChange={(e) => setLimiteReceitas(parseInt(e.target.value) || 50)}
            disabled={isAuditing}
          />
          <p className="text-xs text-muted-foreground">
            Máximo de receitas a auditar por categoria (padrão: 50)
          </p>
        </div>

        <div className="space-y-3">
          <Label>Opções Avançadas</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="detalhes"
                checked={calcularDetalhes}
                onCheckedChange={(checked) => setCalcularDetalhes(checked as boolean)}
                disabled={isAuditing}
              />
              <Label htmlFor="detalhes" className="text-sm font-normal cursor-pointer">
                Incluir cálculos detalhados de ingredientes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="problematicas"
                checked={apenasProblematicas}
                onCheckedChange={(checked) => setApenasProblematicas(checked as boolean)}
                disabled={isAuditing}
              />
              <Label htmlFor="problematicas" className="text-sm font-normal cursor-pointer">
                Mostrar apenas receitas problemáticas
              </Label>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isAuditing}
        className="w-full"
        size="lg"
      >
        <Search className="mr-2 h-4 w-4" />
        {isAuditing ? 'Auditando...' : 'Iniciar Auditoria Completa'}
      </Button>
    </div>
  );
};
