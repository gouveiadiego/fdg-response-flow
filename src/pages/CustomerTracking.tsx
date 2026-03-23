import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, CheckCircle2, Clock, Info, ExternalLink, RefreshCw, XCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrackingData {
  id: string;
  code: string;
  status: string;
  service_type: string;
  city: string;
  state: string;
  created_at: string;
  start_datetime: string | null;
  end_datetime: string | null;
  main_agent_arrival: string | null;
  main_agent_departure: string | null;
  client_name: string;
  vehicle_description: string | null;
  vehicle_plate: string | null;
  main_agent_first_name: string | null;
  photos: {
    file_url: string;
    caption: string | null;
    created_at: string;
  }[] | null;
}

const serviceTypeLabels: Record<string, string> = {
  alarme: 'Alarme',
  averiguacao: 'Averiguação',
  preservacao: 'Preservação',
  acompanhamento_logistico: 'Acompanhamento Logístico',
  sindicancia: 'Sindicância',
};

const CustomerTracking = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrackingData = async (isRefresh = false) => {
    if (!id) {
      setError('ID do chamado não fornecido.');
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);

    try {
      const { data: result, error: rpcError } = await (supabase.rpc as any)('get_ticket_tracking_info', {
        p_ticket_id: id
      });

      if (rpcError) throw rpcError;

      if (!result) {
        setError('Chamado não encontrado ou você não tem permissão para acessá-lo.');
      } else {
        setData(result as TrackingData);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados de rastreio:', err);
      setError('Erro ao carregar as informações do acompanhamento.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchTrackingData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <div className="h-10 w-10 animate-spin flex items-center justify-center rounded-full border-4 border-slate-200 border-t-primary"></div>
          <p className="font-medium animate-pulse">Buscando informações do chamado...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-red-100">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <div className="bg-red-50 p-4 rounded-full">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Ops! Algo deu errado</h2>
            <p className="text-slate-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAlarme = data.service_type === 'alarme' || data.vehicle_description === 'Base do Cliente';
  const isCanceled = data.status === 'cancelado';
  const isFinished = data.status === 'finalizado';

  // Timeline Progress Logic
  const steps = [
    {
      id: 'aberto',
      label: 'Solicitação Recebida',
      description: 'Equipe de operações ciente do evento.',
      timestamp: data.created_at,
      completed: true,
      active: data.status === 'aberto',
    },
    {
      id: 'deslocamento',
      label: 'Equipe em Deslocamento',
      description: data.main_agent_first_name 
        ? `Agente ${data.main_agent_first_name} a caminho do local.`
        : 'Agente despachado para o local.',
      timestamp: data.start_datetime || null,
      completed: data.status !== 'aberto' || !!data.start_datetime,
      active: data.status === 'em_andamento' && !data.main_agent_arrival,
    },
    {
      id: 'no_local',
      label: 'Equipe no Local',
      description: 'O agente chegou e iniciou o atendimento.',
      timestamp: data.main_agent_arrival,
      completed: !!data.main_agent_arrival,
      active: data.status === 'em_andamento' && !!data.main_agent_arrival,
    },
    {
      id: 'finalizado',
      label: 'Atendimento Concluído',
      description: 'A operação foi finalizada com sucesso.',
      timestamp: data.main_agent_departure || data.end_datetime,
      completed: isFinished,
      active: isFinished,
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Premium Header */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-4 md:px-8 border-b-4 border-primary relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
        </div>
        
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <img src="/logo-fdg-premium.png" alt="Falco Peregrinus" className="h-12 w-auto mb-4 object-contain brightness-0 invert" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo-fdg.png';
                }} 
              />
              <h1 className="text-2xl font-bold tracking-tight">Acompanhamento Fácil</h1>
              <p className="text-slate-400 text-sm mt-1">Transparência e Rapidez em Tempo Real</p>
            </div>
            {isFinished ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0 pointer-events-none px-3 py-1 text-sm font-semibold">
                CONCLUÍDO
              </Badge>
            ) : isCanceled ? (
              <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 pointer-events-none px-3 py-1 text-sm font-semibold">
                CANCELADO
              </Badge>
            ) : (
              <Badge className="bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border-0 pointer-events-none px-3 py-1 text-sm font-semibold animate-pulse">
                EM OPERAÇÃO
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-8 relative z-20 space-y-6">
        
        {/* Info Card */}
        <Card className="shadow-lg border-0 rounded-xl overflow-hidden backdrop-blur-xl bg-white/95">
          <div className="bg-primary/5 px-6 py-4 border-b flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-primary tracking-wider uppercase mb-0.5">Protocolo</p>
              <p className="text-lg font-bold text-slate-800">{data.code || 'N/A'}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchTrackingData(true)} 
              disabled={refreshing}
              className="text-slate-500 hover:text-primary gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
          
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Cliente</p>
                  <p className="font-medium text-slate-900">{data.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Local da Ocorrência
                  </p>
                  <p className="font-medium text-slate-900">{data.city} / {data.state}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Serviço
                  </p>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">
                    {serviceTypeLabels[data.service_type] || data.service_type}
                  </Badge>
                </div>
                {!isAlarme && data.vehicle_description && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase mb-1 flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Veículo / Alvo
                    </p>
                    <p className="font-medium text-slate-900 text-sm">
                      {data.vehicle_description} 
                      {data.vehicle_plate && <span className="ml-1 px-1.5 py-0.5 bg-slate-100 border rounded text-xs font-mono">{data.vehicle_plate}</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {isCanceled ? (
          <Card className="border-red-100 bg-red-50 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 font-medium">Este chamado foi cancelado e a operação interrompida.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-0 rounded-xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4 px-6 flex flex-row items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold text-slate-800">Linha do Tempo da Operação</CardTitle>
            </CardHeader>
            <CardContent className="p-6 px-4 md:px-8">
              <div className="relative pt-4 pl-4 md:pl-8 border-l-2 border-slate-100 ml-4 md:ml-8 space-y-10">
                {steps.map((step, index) => {
                  const isLast = index === steps.length - 1;
                  
                  return (
                    <div key={step.id} className="relative">
                      {/* Node Icon */}
                      <div className={`absolute -left-[27px] md:-left-[43px] top-0.5 h-6 w-6 md:h-8 md:w-8 rounded-full border-[3px] bg-white flex items-center justify-center transition-all duration-500 ${
                        step.active 
                          ? 'border-primary ring-4 ring-primary/20 scale-110' 
                          : step.completed 
                            ? 'border-primary bg-primary' 
                            : 'border-slate-200'
                      }`}>
                        {step.completed && !step.active ? (
                          <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-white" />
                        ) : step.active ? (
                          <div className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-primary animate-pulse" />
                        ) : null}
                      </div>

                      {/* Content */}
                      <div className={`pl-2 md:pl-4 ${!step.completed && !step.active ? 'opacity-40' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-1 gap-1">
                          <h3 className={`font-bold text-sm md:text-base ${step.active ? 'text-primary' : step.completed ? 'text-slate-800' : 'text-slate-500'}`}>
                            {step.label}
                          </h3>
                          {step.timestamp && (
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full w-max">
                              {format(new Date(step.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs md:text-sm ${step.active ? 'text-slate-700' : 'text-slate-500'}`}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photo Gallery Section */}
        {data.photos && data.photos.length > 0 && (
          <Card className="shadow-lg border-0 rounded-xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b pb-4 px-6 flex flex-row items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold text-slate-800">Registros Fotográficos</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {data.photos.map((photo, i) => (
                  <div key={i} className="group relative aspect-square rounded-lg overflow-hidden border bg-slate-100 ring-offset-2 hover:ring-2 hover:ring-primary transition-all">
                    <img 
                      src={photo.file_url} 
                      alt={photo.caption || `Foto ${i + 1}`} 
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => window.open(photo.file_url, '_blank')}
                    />
                    {photo.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white p-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-4 text-center italic">
                Clique nas fotos para ampliar
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer info */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Falco Peregrinus</p>
          <p className="text-[9px] text-slate-400 px-8 text-balance">
            Este link é privado e destinado apenas ao acompanhamento deste chamado específico. 
            Não compartilhe com pessoas não autorizadas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerTracking;
