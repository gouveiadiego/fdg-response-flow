// Pricing for AGENT payment (alarme)
export const ALARME_PRICING = {
    base: 100,
    includedHours: 0.5,
    includedKm: 50,
    extraHourRate: 20,
    extraKmRate: 1.50,
};

// Pricing for CLIENT billing (alarme) - different from agent payment
export const ALARME_CLIENT_PRICING = {
    base: 180,
    includedHours: 0.5, // 30 minutes
    includedKm: 50,
    extraHourRate: 40,
    extraKmRate: 2.50,
};

// Pricing per agent role based on armed/unarmed
export const ARMED_PRICING = { base: 300, includedHours: 3, includedKm: 50, extraHourRate: 45, extraKmRate: 1.50 };
export const UNARMED_PRICING = { base: 280, includedHours: 3, includedKm: 50, extraHourRate: 40, extraKmRate: 1.50 };

/**
 * Determine if the agent acting in a given role should be priced as ARMED or UNARMED,
 * based on the plan name and their role (principal or support).
 */
export function getIsArmedByPlan(
    planName: string | null | undefined,
    agentRole: 'principal' | 'apoio_1' | 'apoio_2' | string,
    agentIsArmed: boolean
): boolean {
    if (!planName) return agentIsArmed;
    const name = planName.toLowerCase();
    const isSupport = agentRole !== 'principal';

    if (name.includes('armado + 1 desarmado') || name.includes('armado+1 desarmado')) {
        return !isSupport; // principal=armed, support=unarmed
    }
    if (name.includes('2 agente') && name.includes('armado')) return true;  // 2 armed
    if (name.includes('1 agente') && name.includes('armado') && !name.includes('desarmado')) return true;
    if (name.includes('1 agente') && name.includes('desarmado') && !name.includes('armado + ')) return false;
    return agentIsArmed; // fallback
}

interface CalculationParams {
    planName: string | null | undefined;
    agentRole: 'principal' | 'apoio_1' | 'apoio_2' | string;
    agentIsArmed: boolean;
    durationHours: number;
    totalKm: number;
}

export function calculateAgentHonorary(params: CalculationParams) {
    const isAlarme = params.planName?.toLowerCase().includes('alarme') ?? false;
    const agentIsArmedByPlan = getIsArmedByPlan(params.planName, params.agentRole, params.agentIsArmed);
    const pricing = isAlarme ? ALARME_PRICING : (agentIsArmedByPlan ? ARMED_PRICING : UNARMED_PRICING);

    const extraKm = Math.max(0, params.totalKm - pricing.includedKm);
    const extraHours = Math.max(0, params.durationHours - pricing.includedHours);

    const costExtraKm = extraKm * pricing.extraKmRate;
    const costExtraHours = extraHours * pricing.extraHourRate;
    
    return pricing.base + costExtraHours + costExtraKm;
}
