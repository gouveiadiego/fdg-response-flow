import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowUpRight,
  Activity
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityItem {
  id: string;
  code: string;
  status: string;
  updated_at: string;
  client_name: string;
  type: 'creation' | 'update' | 'completion' | 'cancellation';
}

interface ActivityFeedProps {
  tickets: any[];
  title?: string;
  onViewDetails: (id: string) => void;
}

const ActivityFeed = ({ tickets, title = "Atividades Recentes", onViewDetails }: ActivityFeedProps) => {
  // Process tickets to create a feed
  const feedItems: ActivityItem[] = tickets
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 15)
    .map(t => {
      let type: ActivityItem['type'] = 'update';
      if (t.status === 'aberto' && t.created_at === t.updated_at) type = 'creation';
      if (t.status === 'finalizado') type = 'completion';
      if (t.status === 'cancelado') type = 'cancellation';

      return {
        id: t.id,
        code: t.code,
        status: t.status,
        updated_at: t.updated_at,
        client_name: t.clients?.name || 'Cliente',
        type
      };
    });

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'creation': return <PlusCircle className="h-4 w-4 text-blue-500" />;
      case 'completion': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'cancellation': return <XCircle className="h-4 w-4 text-rose-500" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getLabel = (type: ActivityItem['type'], code: string, client: string) => {
    switch (type) {
      case 'creation': return (
        <span>Novo chamado <span className="font-bold text-foreground">{code}</span> aberto para <span className="font-medium text-foreground">{client}</span></span>
      );
      case 'completion': return (
        <span>Chamado <span className="font-bold text-foreground">{code}</span> foi <span className="text-emerald-600 font-semibold">concluído</span></span>
      );
      case 'cancellation': return (
        <span>Chamado <span className="font-bold text-foreground">{code}</span> foi <span className="text-rose-600 font-semibold">cancelado</span></span>
      );
      default: return (
        <span>Chamado <span className="font-bold text-foreground">{code}</span> de <span className="font-medium text-foreground">{client}</span> atualizado</span>
      );
    }
  };

  return (
    <Card className="border-none shadow-md bg-card/60 backdrop-blur-md overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px] px-6">
          <div className="space-y-6 pb-6 pt-2">
            {feedItems.length > 0 ? (
              feedItems.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex gap-4 relative">
                  {/* Timeline line */}
                  {index !== feedItems.length - 1 && (
                    <div className="absolute left-2 top-6 bottom-[-1.5rem] w-px bg-border" />
                  )}
                  
                  <div className="z-10 mt-1 bg-background rounded-full p-0.5 border">
                    {getIcon(item.type)}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground leading-snug">
                      {getLabel(item.type, item.code, item.client_name)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: ptBR })}
                      </span>
                      <button 
                        onClick={() => onViewDetails(item.id)}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        Ver detalhes <ArrowUpRight className="h-2 w-2" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground italic text-sm">
                Nenhuma atividade recente encontrada.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
