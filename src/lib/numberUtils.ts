/**
 * Parses a numeric value from a string or number, handling Brazilian decimal commas.
 * If the value is invalid or empty, it returns the provided default value (default is 0).
 */
export const parseSafeNumber = (value: any, defaultValue: number = 0): number => {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }
    
    if (typeof value === 'number') {
        return isNaN(value) ? defaultValue : value;
    }
    
    if (typeof value === 'string') {
        // Replace comma with dot and remove any non-numeric chars except dot and minus
        const processed = value.replace(',', '.').replace(/[^\d.-]/g, '');
        const parsed = parseFloat(processed);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    
    return defaultValue;
};
