import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, UserCheck, Phone, Shield, Navigation, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { NewDemandDialog } from './NewDemandDialog';
import { useGeocoding } from '@/hooks/useGeocoding';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icon for search center
const searchCenterIcon = L.divIcon({
    html: `<div class="w-6 h-6 bg-primary rounded-full border-4 border-white shadow-lg animate-pulse"></div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

// Custom icon for unmet agent demands (red pin)
const demandIcon = L.divIcon({
    html: `<div class="w-6 h-6 bg-destructive rounded-full border-[3px] border-white shadow-[0_0_10px_rgba(239,68,68,0.7)] flex items-center justify-center animate-pulse"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

interface Agent {
    id: string;
    name: string;
    phone: string;
    is_armed: boolean;
    performance_level: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    has_alarm_skill: boolean;
    has_investigation_skill: boolean;
    has_preservation_skill: boolean;
    has_logistics_skill: boolean;
    has_auditing_skill: boolean;
    distance?: number;
}

interface AgentDemand {
    id: string;
    city: string;
    state: string;
    notes: string | null;
    latitude: number | null;
    longitude: number | null;
    distance?: number;
}

interface MapUpdaterProps {
    center: [number, number];
    zoom: number;
}

function MapUpdater({ center, zoom }: MapUpdaterProps) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

interface AgentMapProps {
    onSelect?: (agentId: string) => void;
    onEdit?: (agentId: string) => void;
}

export function AgentMap({ onSelect, onEdit }: AgentMapProps) {
    const navigate = useNavigate();
    const { reverseGeocode } = useGeocoding();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [demands, setDemands] = useState<AgentDemand[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([-23.55052, -46.633309]); // São Paulo default
    const [searchPoint, setSearchPoint] = useState<[number, number] | null>(null);
    const [zoom, setZoom] = useState(13);
    
    // Demands state
    const [isDemandDialogOpen, setIsDemandDialogOpen] = useState(false);
    const [searchCity, setSearchCity] = useState('');
    const [searchState, setSearchState] = useState('');

    // Filters
    const [showActive, setShowActive] = useState(true);
    const [showDemands, setShowDemands] = useState(true);

    useEffect(() => {
        fetchAgents();
        fetchDemands();
    }, []);

    const fetchAgents = async () => {
        try {
            const { data, error } = await supabase
                .from('agents')
                .select('id, name, phone, is_armed, performance_level, latitude, longitude, address, has_alarm_skill, has_investigation_skill, has_preservation_skill, has_logistics_skill, has_auditing_skill')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .eq('status', 'ativo');

            if (error) throw error;
            setAgents(data || []);
        } catch (error) {
            console.error('Erro ao buscar agentes para o mapa:', error);
            toast.error('Erro ao carregar mapa');
        } finally {
            setLoading(false);
        }
    };

    const fetchDemands = async () => {
        try {
            const { data, error } = await supabase
                .from('agent_demands')
                .select('id, city, state, notes, latitude, longitude')
                .eq('status', 'pendente');

            if (error && error.code !== '42P01') throw error;
            if (data) setDemands(data);
        } catch (error: any) {
            console.error('Erro ao buscar demandas para o mapa:', error);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    const deg2rad = (deg: number) => deg * (Math.PI / 180);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery) return;

        setIsSearching(true);
        try {
            // Nominatim search
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=BR`);
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);

                setMapCenter([lat, lon]);
                setSearchPoint([lat, lon]);
                setZoom(14);
                
                const geoResult = await reverseGeocode(lat, lon);
                if (geoResult) {
                    setSearchCity(geoResult.city);
                    setSearchState(geoResult.state);
                } else {
                    setSearchCity(searchQuery.split(',')[0].trim());
                    setSearchState('');
                }

                // Calculate distances and sort
                const agentsWithDistance = agents.map(agent => ({
                    ...agent,
                    distance: calculateDistance(lat, lon, agent.latitude!, agent.longitude!)
                })).sort((a, b) => (a.distance || 0) - (b.distance || 0));

                setAgents(agentsWithDistance);

                if (agentsWithDistance.length > 0) {
                    toast.success(`Agente mais próximo está a ${agentsWithDistance[0].distance?.toFixed(1)}km`);
                }
            } else {
                toast.error('Localização não encontrada');
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            toast.error('Erro ao buscar localização');
        } finally {
            setIsSearching(false);
        }
    };

    const sortedAgents = useMemo(() => {
        if (!searchPoint) return agents;
        return [...agents]
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }, [agents, searchPoint]);

    const sortedDemands = useMemo(() => {
        if (!searchPoint) return demands;
        return [...demands]
            .map(d => ({
                ...d,
                distance: (d.latitude && d.longitude) ? calculateDistance(searchPoint[0], searchPoint[1], d.latitude, d.longitude) : undefined
            }))
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }, [demands, searchPoint]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[600px] border rounded-lg bg-muted/20">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p>Carregando mapa...</p>
                </div>
            </div>
        );
    }

    const visibleAgents = showActive ? sortedAgents : [];
    const visibleDemands = showDemands ? sortedDemands : [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 w-full max-w-md">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Digite endereço ou coordenadas (ex: -23.55, -46.63)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button type="submit" disabled={isSearching}>
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                        </Button>
                    </form>

                    <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <Button 
                            type="button" 
                            variant={showActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowActive(!showActive)}
                            className={`whitespace-nowrap ${!showActive ? "text-primary border-primary/50" : ""}`}
                        >
                            <UserCheck className="w-4 h-4 mr-2" />
                            Agentes Ativos
                        </Button>
                        <Button 
                            type="button" 
                            variant={showDemands ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => setShowDemands(!showDemands)}
                            className={`whitespace-nowrap ${!showDemands ? "text-destructive border-destructive/50" : ""}`}
                        >
                            <MapPin className="w-4 h-4 mr-2" />
                            Em Prospecção
                        </Button>
                    </div>
                </div>

                <div className="h-[600px] rounded-lg border overflow-hidden relative z-0">
                    <MapContainer
                        center={mapCenter}
                        zoom={zoom}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <MapUpdater center={mapCenter} zoom={zoom} />

                        {searchPoint && (
                            <>
                                <Marker position={searchPoint} icon={searchCenterIcon}>
                                    <Popup>Ponto de Busca</Popup>
                                </Marker>
                                <Circle
                                    center={searchPoint}
                                    radius={50000} // 50km circle
                                    pathOptions={{ color: 'var(--primary)', fillColor: 'var(--primary)', fillOpacity: 0.1 }}
                                />
                            </>
                        )}

                        {showDemands && demands.map((demand) => {
                            // Provide a fallback center-of-brazil coordinate if null
                            const lat = demand.latitude ?? -14.2350;
                            const lng = demand.longitude ?? -51.9253;
                            
                            return (
                                <Marker
                                    key={`demand-${demand.id}`}
                                    position={[lat, lng]}
                                    icon={demandIcon}
                                >
                                <Popup className="demand-popup">
                                    <div className="p-1 space-y-2 max-w-[220px]">
                                        <h3 className="font-bold text-sm text-destructive flex items-center gap-1">
                                            <MapPin className="h-4 w-4" /> Falta de Agente
                                        </h3>
                                        <p className="text-xs font-semibold">{demand.city} - {demand.state}</p>
                                        {demand.notes && (
                                            <p className="text-xs text-muted-foreground italic border-t pt-1 mt-1 text-balance">"{demand.notes}"</p>
                                        )}
                                    </div>
                                </Popup>
                                </Marker>
                            );
                        })}

                        {/* Se tiver busca, mostra só o raio de 50km (sortedAgents). Se não, mostra todos. */}
                        {showActive && (searchPoint ? sortedAgents : agents).map((agent) => (
                            <Marker
                                key={agent.id}
                                position={[agent.latitude!, agent.longitude!]}
                            >
                                <Popup className="agent-popup">
                                    <div className="p-1 space-y-2">
                                        <h3 className="font-bold text-sm">{agent.name}</h3>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Phone className="h-3 w-3" />
                                            {agent.phone}
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                            <Badge variant={agent.is_armed ? "destructive" : "secondary"} className="text-[10px] h-4">
                                                {agent.is_armed ? 'Armado' : 'Desarmado'}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] h-4">
                                                {agent.performance_level.toUpperCase()}
                                            </Badge>
                                        </div>
                                        {agent.distance !== undefined && (
                                            <p className="text-[10px] font-semibold text-primary">
                                                A {agent.distance.toFixed(1)}km de distância
                                            </p>
                                        )}
                                        <Button
                                            size="sm"
                                            className="w-full h-7 text-[10px] mt-2"
                                            onClick={() => {
                                                if (onSelect) {
                                                    onSelect(agent.id);
                                                } else {
                                                    navigate(`/tickets?agentId=${agent.id}`);
                                                }
                                            }}
                                        >
                                            {onSelect ? 'Selecionar Agente' : 'Criar Chamado'}
                                        </Button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>

            <div className="space-y-4 h-[650px] overflow-y-auto pr-2">
                <div className="space-y-3 mb-4">
                    <h3 className="font-bold text-lg flex items-center justify-between">
                        {searchPoint ? 'Próximos ao Local' : 'Agentes e Demandas'}
                        <div className="flex gap-2 ml-auto">
                            {showActive && <Badge variant="secondary">{visibleAgents.length}</Badge>}
                            {showDemands && <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-none">{visibleDemands.length}</Badge>}
                        </div>
                    </h3>

                    {searchPoint && (
                        <Card className="bg-destructive/5 border-destructive/20 shadow-sm">
                            <CardContent className="p-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-destructive">
                                    Não tem ninguém perto?
                                </div>
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => setIsDemandDialogOpen(true)}
                                >
                                    Registrar Falta
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {visibleDemands.map((demand) => (
                    <Card
                        key={`list-demand-${demand.id}`}
                        className="cursor-pointer border-destructive/30 hover:border-destructive transition-colors bg-destructive/5"
                        onClick={() => {
                            if (demand.latitude && demand.longitude) {
                                setMapCenter([demand.latitude, demand.longitude]);
                                setZoom(16);
                            }
                        }}
                    >
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-sm font-bold text-destructive flex items-center gap-1">
                                    <MapPin className="h-4 w-4" /> Falta de Agente
                                </CardTitle>
                                {demand.distance !== undefined && (
                                    <span className="text-xs font-bold text-destructive">{demand.distance.toFixed(1)}km</span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2">
                            <p className="text-sm font-semibold">{demand.city} - {demand.state}</p>
                            {demand.notes && (
                                <p className="text-xs text-muted-foreground italic border-t border-destructive/10 pt-2 mt-1 line-clamp-2">"{demand.notes}"</p>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {visibleAgents.map((agent, index) => (
                    <Card
                        key={agent.id}
                        className={`cursor-pointer hover:border-primary transition-colors ${index === 0 && searchPoint ? 'border-primary bg-primary/5 shadow-md' : ''}`}
                        onClick={() => {
                            setMapCenter([agent.latitude!, agent.longitude!]);
                            setZoom(16);
                        }}
                    >
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-sm truncate">{agent.name}</CardTitle>
                                {agent.distance !== undefined && (
                                    <span className="text-xs font-bold text-primary">{agent.distance.toFixed(1)}km</span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{agent.phone}</span>
                            </div>
                            {agent.address && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{agent.address}</span>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-1">
                                {agent.is_armed && (
                                    <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                                        <Shield className="h-2 w-2 mr-0.5" />
                                        ARM
                                    </Badge>
                                )}
                                {agent.has_alarm_skill && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px] text-amber-600 border-amber-200 bg-amber-50">
                                        ALR
                                    </Badge>
                                )}
                                {agent.has_investigation_skill && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px] text-violet-600 border-violet-200 bg-violet-50">
                                        AVR
                                    </Badge>
                                )}
                                {agent.has_preservation_skill && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px] text-cyan-600 border-cyan-200 bg-cyan-50">
                                        PRE
                                    </Badge>
                                )}
                                {agent.has_logistics_skill && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px] text-teal-600 border-teal-200 bg-teal-50">
                                        LOG
                                    </Badge>
                                )}
                                {agent.has_auditing_skill && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px] text-orange-600 border-orange-200 bg-orange-50">
                                        AUD
                                    </Badge>
                                )}
                                <Badge variant="outline" className={`h-4 px-1 text-[9px] ${agent.performance_level === 'otimo' ? 'text-emerald-600 border-emerald-200' :
                                    agent.performance_level === 'bom' ? 'text-blue-600 border-blue-200' : 'text-destructive border-destructive/20'
                                    }`}>
                                    {agent.performance_level.toUpperCase()}
                                </Badge>
                            </div>
                            {onEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-7 text-xs gap-1.5 mt-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(agent.id);
                                    }}
                                >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {visibleAgents.length === 0 && visibleDemands.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm mb-4">Nenhum registro localizado no mapa.</p>
                        {searchPoint && (
                            <Button 
                                variant="destructive" 
                                onClick={() => setIsDemandDialogOpen(true)}
                                className="w-full"
                            >
                                <MapPin className="mr-2 h-4 w-4" />
                                Registrar Falta de Agente para "{searchCity || searchQuery}"
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <NewDemandDialog 
                open={isDemandDialogOpen} 
                onOpenChange={setIsDemandDialogOpen} 
                onSuccess={() => {
                   fetchDemands();
                   toast.success("Demanda registrada e mapa atualizado!");
                }} 
                initialCity={searchCity}
                initialState={searchState}
            />
        </div>
    );
}
