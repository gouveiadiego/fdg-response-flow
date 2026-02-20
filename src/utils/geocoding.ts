export async function geocodeAddress(fullAddress: string, fallbackCityState?: string): Promise<{ lat: number; lon: number } | null> {
    try {
        // Attempt 1: Full address precision
        const response1 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
        const data1 = await response1.json();

        if (data1 && data1.length > 0) {
            return {
                lat: parseFloat(data1[0].lat),
                lon: parseFloat(data1[0].lon)
            };
        }

        // Attempt 2: Fallback to region (City, State)
        if (fallbackCityState) {
            console.log("Geocoding fallback triggered for:", fallbackCityState);
            const response2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackCityState)}`);
            const data2 = await response2.json();

            if (data2 && data2.length > 0) {
                return {
                    lat: parseFloat(data2[0].lat),
                    lon: parseFloat(data2[0].lon)
                };
            }
        }

        return null; // Both attempts failed
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}
