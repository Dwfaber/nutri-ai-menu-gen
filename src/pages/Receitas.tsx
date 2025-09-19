import { useState } from 'react';
import { Search, Book, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecipeAnalysis } from '@/hooks/useRecipeAnalysis';

const Receitas = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { recipes, categories, loading, error } = useRecipeAnalysis();

  const filteredRecipes = recipes.filter(recipe => {
    const matchesCategory = selectedCategory === 'all' || recipe.categoria_descricao === selectedCategory;
    const matchesSearch = recipe.nome_receita.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Carregando receitas...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-destructive">Erro ao carregar receitas: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Book className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Receitas</h1>
          <p className="text-muted-foreground">
            Gerencie e visualize todas as receitas do sistema ({recipes.length} receitas)
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar receitas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtrar por categoria:</span>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          Todas ({recipes.length})
        </Button>
        {categories.map((category) => (
          <Button
            key={category.name}
            variant={selectedCategory === category.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.name)}
          >
            {category.name} ({category.count})
          </Button>
        ))}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredRecipes.length} receitas encontradas
        </p>
        {selectedCategory !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base line-clamp-2">
                  {recipe.nome_receita}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {recipe.categoria_descricao}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Porções:</span>
                  <span className="font-medium">{recipe.porcoes || 1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo Total:</span>
                  <span className="font-medium text-primary">
                    R$ {recipe.custo_total?.toFixed(2) || '0,00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tempo Preparo:</span>
                  <span className="font-medium">{recipe.tempo_preparo || 0} min</span>
                </div>
                {recipe.inativa && (
                  <Badge variant="destructive" className="text-xs">
                    Inativa
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredRecipes.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Book className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma receita encontrada</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou termo de busca.
          </p>
        </div>
      )}
    </div>
  );
};

export default Receitas;