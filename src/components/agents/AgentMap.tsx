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
import { Search, MapPin, UserCheck, Phone, Shield, Navigation, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

interface Agent {
    id: string;
    name: string;
    phone: string;
    is_armed: boolean;
    performance_level: string;
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

export function AgentMap() {
    const navigate = useNavigate();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([-23.55052, -46.633309]); // São Paulo default
    const [searchPoint, setSearchPoint] = useState<[number, number] | null>(null);
    const [zoom, setZoom] = useState(13);

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const { data, error } = await supabase
                .from('agents')
                .select('id, name, phone, is_armed, performance_level, latitude, longitude')
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
        return [...agents].sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }, [agents, searchPoint]);

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
                <form onSubmit={handleSearch} className="flex gap-2">
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
                                    radius={5000} // 5km circle
                                    pathOptions={{ color: 'var(--primary)', fillColor: 'var(--primary)', fillOpacity: 0.1 }}
                                />
                            </>
                        )}

                        {agents.map((agent) => (
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
                                            onClick={() => navigate(`/tickets?agentId=${agent.id}`)}
                                        >
                                            Criar Chamado
                                        </Button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>

            <div className="space-y-4 h-[650px] overflow-y-auto pr-2">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    {searchPoint ? 'Próximos ao Local' : 'Todos os Agentes'}
                    <Badge variant="secondary" className="ml-auto">{sortedAgents.length}</Badge>
                </h3>

                {sortedAgents.map((agent, index) => (
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
                            <div className="flex gap-1">
                                {agent.is_armed && (
                                    <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                                        <Shield className="h-2 w-2 mr-1" />
                                        Armado
                                    </Badge>
                                )}
                                <Badge variant="outline" className={`h-4 px-1 text-[9px] ${agent.performance_level === 'otimo' ? 'text-emerald-600 border-emerald-200' :
                                    agent.performance_level === 'bom' ? 'text-blue-600 border-blue-200' : 'text-destructive border-destructive/20'
                                    }`}>
                                    {agent.performance_level.toUpperCase()}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {sortedAgents.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Nenhum agente localizado no mapa.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
