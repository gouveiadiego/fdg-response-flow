import { useEffect, useState, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map as MapIcon, Navigation, Flame, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fix for default marker icons in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface DashboardMapProps {
  tickets: any[];
  onViewDetails: (id: string) => void;
}

const statusColors: Record<string, string> = {
  aberto: '#3b82f6', // blue-500
  em_andamento: '#f59e0b', // amber-500
  finalizado: '#10b981', // emerald-500
  cancelado: '#6b7280', // gray-500
};

const DashboardMap = ({ tickets, onViewDetails }: DashboardMapProps) => {
  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [heatmapTickets, setHeatmapTickets] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers');

  useEffect(() => {
    // Standard view: Filter tickets that are active
    const active = tickets.filter(t => 
      t.coordinates_lat && 
      t.coordinates_lng && 
      (t.status === 'aberto' || t.status === 'em_andamento')
    );
    setActiveTickets(active);

    // Heatmap view: All tickets with valid coords regardless of status
    const allWithCoords = tickets.filter(t => 
      t.coordinates_lat && 
      t.coordinates_lng
    );
    setHeatmapTickets(allWithCoords);
  }, [tickets]);

  // Create custom icons based on status
  const createIcon = (status: string) => {
    return L.divIcon({
      className: 'custom-icon',
      html: `<div style="
        background-color: ${statusColors[status] || '#3b82f6'};
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  const RecenterMap = ({ tickets }: { tickets: any[] }) => {
    const map = useMap();
    useEffect(() => {
      if (tickets.length > 0) {
        const bounds = L.latLngBounds(tickets.map(t => [t.coordinates_lat, t.coordinates_lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }, [tickets, map]);
    return null;
  };

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden flex flex-col h-full min-h-[450px]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-primary" />
          {viewMode === 'markers' ? 'Operações em Tempo Real' : 'Mapa de Inteligência Estratégica'}
        </CardTitle>
        <div className="flex gap-2">
          <div className="flex bg-muted p-1 rounded-lg border mr-4">
            <Button 
              variant={viewMode === 'markers' ? "default" : "ghost"} 
              size="sm" 
              className="h-7 text-[10px] px-2 font-bold"
              onClick={() => setViewMode('markers')}
            >
              <Landmark className="h-3 w-3 mr-1" />
              LIVE
            </Button>
            <Button 
              variant={viewMode === 'heatmap' ? "default" : "ghost"} 
              size="sm" 
              className="h-7 text-[10px] px-2 font-bold"
              onClick={() => setViewMode('heatmap')}
            >
              <Flame className="h-3 w-3 mr-1" />
              CALOR
            </Button>
          </div>
          
          {viewMode === 'markers' && (
            <div className="hidden sm:flex gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-blue-500 uppercase">Aberto</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold text-amber-500 uppercase">Em Curso</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative min-h-[380px]">
        <style>
          {`
            @keyframes pulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            }
            .leaflet-container {
              background: #0f172a !important; /* matches slate-900 */
              font-family: inherit;
            }
            .leaflet-popup-content-wrapper {
              background: rgba(15, 23, 42, 0.9) !important;
              color: white !important;
              backdrop-filter: blur(8px);
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 12px;
            }
            .leaflet-popup-tip {
              background: rgba(15, 23, 42, 0.9) !important;
            }
          `}
        </style>
        
        <MapContainer 
          center={[-23.5505, -46.6333]} 
          zoom={5} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          <RecenterMap tickets={viewMode === 'markers' ? activeTickets : heatmapTickets} />

          {viewMode === 'markers' ? (
            activeTickets.map((ticket) => (
              <Marker 
                key={ticket.id} 
                position={[ticket.coordinates_lat, ticket.coordinates_lng]}
                icon={createIcon(ticket.status)}
              >
                <Popup>
                  <div className="p-1 space-y-2 min-w-[200px]">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-black text-primary">{ticket.code}</span>
                      <Badge variant="outline" className="text-[10px] uppercase h-4 px-1 border-white/20 text-white">
                        {ticket.service_type}
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold leading-tight">{ticket.clients?.name}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Navigation className="h-2 w-2" />
                        {ticket.city}, {ticket.state}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <button 
                        onClick={() => onViewDetails(ticket.id)}
                        className="w-full h-7 bg-primary rounded-md text-[10px] font-bold hover:bg-primary/90 transition-colors"
                      >
                        VER DETALHES
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))
          ) : (
            <>
              {heatmapTickets.map((ticket) => (
                <Fragment key={`heat-${ticket.id}`}>
                  {/* Multiple overlapping circles to create the heat effect */}
                  <Circle
                    center={[ticket.coordinates_lat, ticket.coordinates_lng]}
                    radius={1500}
                    pathOptions={{
                      fillColor: '#f59e0b', // amber-500
                      fillOpacity: 0.03,
                      stroke: false,
                    }}
                  />
                  <Circle
                    center={[ticket.coordinates_lat, ticket.coordinates_lng]}
                    radius={800}
                    pathOptions={{
                      fillColor: '#ef4444', // red-500
                      fillOpacity: 0.05,
                      stroke: false,
                    }}
                  />
                  <Circle
                    center={[ticket.coordinates_lat, ticket.coordinates_lng]}
                    radius={300}
                    pathOptions={{
                      fillColor: '#991b1b', // red-800
                      fillOpacity: 0.1,
                      stroke: false,
                    }}
                  />
                </Fragment>
              ))}
            </>
          )}
        </MapContainer>
        
        {activeTickets.length === 0 && (
          <div className="absolute inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <MapIcon className="h-10 w-10 text-slate-500 mx-auto opacity-20" />
              <p className="text-slate-400 font-medium italic">Nenhum chamado ativo no mapa agora.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardMap;
