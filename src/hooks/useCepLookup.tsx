import { useState } from 'react';
import { toast } from 'sonner';

interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface AddressResult {
  address: string;
  city: string;
  state: string;
}

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);

  const lookupCep = async (cep: string): Promise<AddressResult | null> => {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return null;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro na requisição');
      }

      const data: CepResult = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return null;
      }

      // Build full address
      const addressParts = [
        data.logradouro,
        data.bairro,
        data.localidade,
        data.uf
      ].filter(Boolean);

      return {
        address: addressParts.join(', '),
        city: data.localidade,
        state: data.uf,
      };
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar CEP');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupCep, isLoading };
}
