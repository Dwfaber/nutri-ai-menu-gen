
import { useState } from 'react';
import { MenuItem, Menu } from '../types/client';

export const useMenuAI = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMenu = async (
    clientId: string,
    budget: number,
    restrictions: string[],
    preferences?: string
  ): Promise<Menu | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      // Simulate AI menu generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockItems: MenuItem[] = [
        {
          id: '1',
          name: 'Frango Grelhado com Quinoa',
          category: 'protein',
          nutritionalInfo: { calories: 450, protein: 35, carbs: 25, fat: 12 },
          cost: 8.50,
          restrictions: []
        },
        {
          id: '2',
          name: 'Salmão com Batata Doce',
          category: 'protein',
          nutritionalInfo: { calories: 520, protein: 38, carbs: 30, fat: 18 },
          cost: 12.00,
          restrictions: []
        },
        {
          id: '3',
          name: 'Salada Vegana Completa',
          category: 'vegetable',
          nutritionalInfo: { calories: 320, protein: 15, carbs: 28, fat: 16 },
          cost: 6.50,
          restrictions: ['vegan', 'gluten-free']
        }
      ];

      const filteredItems = restrictions.includes('vegan') 
        ? mockItems.filter(item => item.restrictions.includes('vegan'))
        : mockItems;

      const menu: Menu = {
        id: Date.now().toString(),
        clientId,
        name: `Cardápio ${new Date().toLocaleDateString()}`,
        week: new Date().toISOString().split('T')[0],
        items: filteredItems,
        totalCost: filteredItems.reduce((sum, item) => sum + item.cost, 0),
        createdAt: new Date().toISOString(),
        versions: {
          nutritionist: filteredItems,
          kitchen: filteredItems.map(item => ({ ...item, name: `${item.name} (Preparo: 20min)` })),
          client: filteredItems.map(item => ({ ...item, name: item.name.split(' ')[0] + ' Especial' }))
        }
      };

      return menu;
    } catch (err) {
      setError('Erro ao gerar cardápio. Tente novamente.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const editMenuWithNLP = async (menuId: string, command: string): Promise<boolean> => {
    setIsGenerating(true);
    
    try {
      // Simulate NLP processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Processing command: ${command} for menu ${menuId}`);
      return true;
    } catch (err) {
      setError('Erro ao processar comando. Tente novamente.');
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateMenu,
    editMenuWithNLP,
    isGenerating,
    error
  };
};
