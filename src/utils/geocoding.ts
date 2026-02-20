export async function geocodeAddress(fullAddress: string, fallbackCityState?: string): Promise<{ lat: number; lon: number } | null> {
    try {
        // Respect Nominatim's strict 1 req/sec limit universally.
        // This ensures that if this function is called immediately after a CEP lookup (which also hits Nominatim), 
        // it won't be blocked by a 429 Too Many Requests response, which was causing the "double click" requirement.
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Attempt 1: Full address precision
        const response1 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);

        if (!response1.ok) {
            console.error('Nominatim API error on Attempt 1:', response1.statusText);
        } else {
            const data1 = await response1.json();
            if (data1 && data1.length > 0) {
                return {
                    lat: parseFloat(data1[0].lat),
                    lon: parseFloat(data1[0].lon)
                };
            }
        }

        // Attempt 2: Fallback to region (City, State)
        if (fallbackCityState) {
            console.log("Geocoding fallback triggered for:", fallbackCityState);
            // Respect Nominatim's 1 req/sec limit before attempting fallback
            await new Promise(resolve => setTimeout(resolve, 1100));

            const response2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackCityState)}`);

            if (response2.ok) {
                const data2 = await response2.json();
                if (data2 && data2.length > 0) {
                    return {
                        lat: parseFloat(data2[0].lat),
                        lon: parseFloat(data2[0].lon)
                    };
                }
            }
        }

        return null; // Both attempts failed
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}
