import { useState } from 'react';
import { toast } from 'sonner';

interface GeocodingResult {
  city: string;
  state: string;
}

export function useGeocoding() {
  const [isLoading, setIsLoading] = useState(false);

  const reverseGeocode = async (lat: number, lng: number): Promise<GeocodingResult | null> => {
    setIsLoading(true);
    try {
      // Using Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro na requisição de geocoding');
      }

      const data = await response.json();
      
      if (data.address) {
        const city = data.address.city || data.address.town || data.address.municipality || data.address.village || '';
        const state = data.address.state || '';
        
        // Extract state abbreviation (BR states)
        const stateAbbrev = getStateAbbreviation(state);
        
        return {
          city,
          state: stateAbbrev,
        };
      }

      toast.error('Não foi possível encontrar o endereço para essas coordenadas');
      return null;
    } catch (error) {
      console.error('Erro no geocoding reverso:', error);
      toast.error('Erro ao buscar endereço');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { reverseGeocode, isLoading };
}

function getStateAbbreviation(stateName: string): string {
  const states: Record<string, string> = {
    'Acre': 'AC',
    'Alagoas': 'AL',
    'Amapá': 'AP',
    'Amazonas': 'AM',
    'Bahia': 'BA',
    'Ceará': 'CE',
    'Distrito Federal': 'DF',
    'Espírito Santo': 'ES',
    'Goiás': 'GO',
    'Maranhão': 'MA',
    'Mato Grosso': 'MT',
    'Mato Grosso do Sul': 'MS',
    'Minas Gerais': 'MG',
    'Pará': 'PA',
    'Paraíba': 'PB',
    'Paraná': 'PR',
    'Pernambuco': 'PE',
    'Piauí': 'PI',
    'Rio de Janeiro': 'RJ',
    'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS',
    'Rondônia': 'RO',
    'Roraima': 'RR',
    'Santa Catarina': 'SC',
    'São Paulo': 'SP',
    'Sergipe': 'SE',
    'Tocantins': 'TO',
  };

  return states[stateName] || stateName.substring(0, 2).toUpperCase();
}
