import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { AgentMap } from '@/components/agents/AgentMap';
import { MapPin, Search, Loader2, Upload, X, Camera, Trash2, Check, ChevronsUpDown, Plus } from 'lucide-react';

// Converts a UTC ISO string from Supabase to a local datetime-local input value (YYYY-MM-DDTHH:mm)
// WITHOUT re-converting to UTC — preserves the local (BRT) time the user entered
const toLocalInput = (isoString: string | null | undefined): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  // Use local timezone values to build the input string
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
};

// Converts a datetime-local string (YYYY-MM-DDTHH:mm) to a UTC ISO string
// using the browser's actual local timezone — works correctly for BRT and any other timezone
const toSupabaseTimestamp = (localStr: string | null | undefined): string | null => {
  if (!localStr) return null;
  const d = new Date(localStr); // browser parses as LOCAL time
  if (isNaN(d.getTime())) return null;
  return d.toISOString(); // converts local to UTC correctly
};


const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
  z.number().nullable().optional()
);

const ticketSchema = z.object({
  status: z.enum(['aberto', 'em_andamento', 'finalizado', 'cancelado']),
  client_id: z.string().min(1, 'Cliente é obrigatório'),
  vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
  main_agent_id: z.string().min(1, 'Selecione um agente'),
  main_agent_arrival: z.string().optional(),
  main_agent_departure: z.string().optional(),
  support_agents: z.array(z.object({
    id: z.string().optional(),
    agent_id: z.string().min(1, 'Selecione um agente de apoio'),
    arrival: z.string().optional(),
    departure: z.string().optional(),
    km_start: optionalNumber,
    km_end: optionalNumber,
    toll_cost: optionalNumber,
    food_cost: optionalNumber,
    other_costs: optionalNumber,
    compensation_base_value: optionalNumber,
    compensation_included_hours: optionalNumber,
    compensation_included_km: optionalNumber,
    compensation_extra_hour_rate: optionalNumber,
    compensation_extra_km_rate: optionalNumber,
    compensation_total: optionalNumber,
  })).default([]),
  plan_id: z.string().min(1, 'Plano é obrigatório'),
  service_type: z.enum(['alarme', 'averiguacao', 'preservacao', 'acompanhamento_logistico', 'sindicancia']),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(2, 'Estado é obrigatório').max(2),
  start_datetime: z.string().min(1, 'Data/hora início é obrigatória'),
  end_datetime: z.string().optional(),
  coordinates_lat: optionalNumber,
  coordinates_lng: optionalNumber,
  km_start: optionalNumber,
  km_end: optionalNumber,
  toll_cost: optionalNumber,
  food_cost: optionalNumber,
  other_costs: optionalNumber,
  summary: z.string().max(500).optional(),
  detailed_report: z.string().max(5000).optional(),
  operator_id: z.string().optional(),
  revenue_base_value: optionalNumber,
  revenue_included_hours: optionalNumber,
  revenue_included_km: optionalNumber,
  revenue_extra_hour_rate: optionalNumber,
  revenue_extra_km_rate: optionalNumber,
  revenue_discount_addition: optionalNumber,
  revenue_total: optionalNumber,
  main_agent_compensation_base_value: optionalNumber,
  main_agent_compensation_included_hours: optionalNumber,
  main_agent_compensation_included_km: optionalNumber,
  main_agent_compensation_extra_hour_rate: optionalNumber,
  main_agent_compensation_extra_km_rate: optionalNumber,
  main_agent_compensation_total: optionalNumber,
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface Client {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  description: string;
  client_id: string;
  plate_main: string;
}

interface Agent {
  id: string;
  name: string;
  is_armed: boolean | null;
}

interface Plan {
  id: string;
  name: string;
}

interface Operator {
  id: string;
  name: string;
}

interface ExistingPhoto {
  id: string;
  file_url: string;
  caption: string | null;
}

interface PhotoToUploadGroup {
  files: { file: File; preview: string }[];
  caption: string;
}

interface EditTicketDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTicketDialog({ ticketId, open, onOpenChange, onSuccess }: EditTicketDialogProps) {
  const { user } = useAuth();
  const { reverseGeocode, isLoading: isGeocoding } = useGeocoding();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cliente');
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotoGroups, setNewPhotoGroups] = useState<PhotoToUploadGroup[]>([]);
  const [openMainAgent, setOpenMainAgent] = useState(false);
  const [openSupport1, setOpenSupport1] = useState(false);
  const [openSupport2, setOpenSupport2] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      status: 'aberto',
      client_id: '',
      vehicle_id: '',
      main_agent_id: '',
      main_agent_arrival: '',
      main_agent_departure: '',
      support_agents: [],
      plan_id: '',
      service_type: 'acompanhamento_logistico',
      city: '',
      state: '',
      start_datetime: '',
      end_datetime: '',
      coordinates_lat: null,
      coordinates_lng: null,
      km_start: null,
      km_end: null,
      toll_cost: 0,
      food_cost: 0,
      other_costs: 0,
      summary: '',
      detailed_report: '',
      operator_id: '',
      revenue_base_value: 500.00,
      revenue_included_hours: 3.00,
      revenue_included_km: 50.00,
      revenue_extra_hour_rate: 90.00,
      revenue_extra_km_rate: 2.50,
      revenue_discount_addition: 0.00,
      revenue_total: 500.00,
      main_agent_compensation_base_value: 0,
      main_agent_compensation_included_hours: 3,
      main_agent_compensation_included_km: 50,
      main_agent_compensation_extra_hour_rate: 0,
      main_agent_compensation_extra_km_rate: 0,
      main_agent_compensation_total: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'support_agents',
  });

  const selectedClientId = form.watch('client_id');
  const coordLat = form.watch('coordinates_lat');
  const coordLng = form.watch('coordinates_lng');

  const watchedSupportAgents = form.watch('support_agents');

  // Main Agent Calculations
  const kmStart = form.watch('km_start');
  const kmEnd = form.watch('km_end');
  const kmRodado = kmStart && kmEnd && kmEnd >= kmStart ? kmEnd - kmStart : 0;
  const tollCost = form.watch('toll_cost') || 0;
  const foodCost = form.watch('food_cost') || 0;
  const otherCosts = form.watch('other_costs') || 0;
  const totalCost = tollCost + foodCost + otherCosts;

  // Support Agent Calculations (Dynamic)
  const supportTotals = watchedSupportAgents?.reduce((acc, agent) => {
    const kmStart = agent.km_start || 0;
    const kmEnd = agent.km_end || 0;
    const kmRodado = kmStart && kmEnd && kmEnd >= kmStart ? kmEnd - kmStart : 0;

    const toll = agent.toll_cost || 0;
    const food = agent.food_cost || 0;
    const other = agent.other_costs || 0;
    const totalCost = toll + food + other;

    return {
      km: acc.km + kmRodado,
      cost: acc.cost + totalCost
    };
  }, { km: 0, cost: 0 }) || { km: 0, cost: 0 };
  // Global Totals
  const totalKmGeral = kmRodado + supportTotals.km;
  const totalCustoGeral = totalCost + supportTotals.cost;

  // Faturamento Cliente Calculations
  const revenueBase = form.watch('revenue_base_value') || 0;
  const includedHours = form.watch('revenue_included_hours') || 0;
  const includedKm = form.watch('revenue_included_km') || 0;
  const extraHourRate = form.watch('revenue_extra_hour_rate') || 0;
  const extraKmRate = form.watch('revenue_extra_km_rate') || 0;
  const discountAddition = form.watch('revenue_discount_addition') || 0;

  const rStartDateTime = form.watch('start_datetime') || '';
  const rEndDateTime = form.watch('end_datetime') || '';
  let durationHours = 0;
  if (rStartDateTime && rEndDateTime) {
    const s = new Date(rStartDateTime).getTime();
    const e = new Date(rEndDateTime).getTime();
    if (e > s) {
      durationHours = (e - s) / (1000 * 60 * 60);
    }
  }

  const generatedExtraHours = Math.max(0, Math.ceil(durationHours - includedHours)); // Arredondamento pra cima nas horas se for regra comum (deixar decimal temporariamente)
  const exactExtraHours = Math.max(0, durationHours - includedHours);
  const extraKm = Math.max(0, totalKmGeral - includedKm); // usa kmGeral como base

  const costExtraHours = exactExtraHours * extraHourRate;
  const costExtraKm = extraKm * extraKmRate;
  const calculatedRevenueTotal = revenueBase + costExtraHours + costExtraKm + discountAddition;

  useEffect(() => {
    form.setValue('revenue_total', calculatedRevenueTotal);
  }, [calculatedRevenueTotal, form]);

  useEffect(() => {
    if (open) {
      fetchData();
      setActiveTab('cliente');
      setNewPhotoGroups([]);
    }
  }, [open]);

  useEffect(() => {
    if (ticketId && open && clients.length > 0) {
      fetchTicket();
      fetchPhotos();
    }
  }, [ticketId, open, clients.length]);


  useEffect(() => {
    if (selectedClientId) {
      const clientVehicles = vehicles.filter(v => v.client_id === selectedClientId);
      setFilteredVehicles(clientVehicles);
      
      if (clientVehicles.length === 1 && clientVehicles[0].plate_main === 'ALARME') {
        setTimeout(() => {
          form.setValue('vehicle_id', clientVehicles[0].id, { shouldValidate: true, shouldDirty: true });
        }, 0);
      }
    } else {
      setFilteredVehicles([]);
    }
  }, [selectedClientId, vehicles]);

  const fetchData = async () => {
    try {
      const [clientsRes, vehiclesRes, agentsRes, plansRes, operatorsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('vehicles').select('id, description, client_id, plate_main'),
        supabase.from('agents').select('id, name, is_armed').eq('status', 'ativo').order('name'),
        supabase.from('plans').select('id, name').order('name'),
        (supabase.from('operators' as any) as any).select('id, name').eq('active', true).order('name'),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
      if (plansRes.data) setPlans(plansRes.data);
      if (operatorsRes.data) setOperators(operatorsRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  const fetchTicket = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;

      // Fetch support agents separately
      const { data: supportAgentsData, error: agentsError } = await supabase
        .from('ticket_support_agents')
        .select(`
            id,
            agent_id,
            arrival,
            departure,
            km_start,
            km_end,
            toll_cost,
            food_cost,
            other_costs,
            compensation_base_value,
            compensation_included_hours,
            compensation_included_km,
            compensation_extra_hour_rate,
            compensation_extra_km_rate,
            compensation_total
        `)
        .eq('ticket_id', ticketId);

      if (agentsError) {
        console.error('Error fetching support agents:', agentsError);
        // Don't throw here, let the main ticket data load at least
      }

      if (data) {
        const ticket = data as any;
        // Construct array from separate query result
        const supportAgents = (supportAgentsData || [])?.map((sa: any) => ({
          id: sa.id,
          agent_id: sa.agent_id,
          arrival: toLocalInput(sa.arrival),
          departure: toLocalInput(sa.departure),
          km_start: sa.km_start,
          km_end: sa.km_end,
          toll_cost: sa.toll_cost || 0,
          food_cost: sa.food_cost || 0,
          other_costs: sa.other_costs || 0,
          compensation_base_value: sa.compensation_base_value,
          compensation_included_hours: sa.compensation_included_hours,
          compensation_included_km: sa.compensation_included_km,
          compensation_extra_hour_rate: sa.compensation_extra_hour_rate,
          compensation_extra_km_rate: sa.compensation_extra_km_rate,
          compensation_total: sa.compensation_total,
        })) || [];


        form.reset({
          status: ticket.status,
          client_id: ticket.client_id,
          vehicle_id: ticket.vehicle_id,
          main_agent_id: ticket.main_agent_id,
          main_agent_arrival: toLocalInput(ticket.main_agent_arrival),
          main_agent_departure: toLocalInput(ticket.main_agent_departure),
          support_agents: supportAgents,
          plan_id: ticket.plan_id,
          service_type: ticket.service_type,
          city: ticket.city,
          state: ticket.state,
          start_datetime: toLocalInput(ticket.start_datetime),
          end_datetime: toLocalInput(ticket.end_datetime),
          coordinates_lat: ticket.coordinates_lat ? Number(ticket.coordinates_lat) : null,
          coordinates_lng: ticket.coordinates_lng ? Number(ticket.coordinates_lng) : null,
          km_start: ticket.km_start ? Number(ticket.km_start) : null,
          km_end: ticket.km_end ? Number(ticket.km_end) : null,
          toll_cost: ticket.toll_cost ? Number(ticket.toll_cost) : null,
          food_cost: ticket.food_cost ? Number(ticket.food_cost) : null,
          other_costs: ticket.other_costs ? Number(ticket.other_costs) : null,
          summary: ticket.summary || '',
          detailed_report: ticket.detailed_report || '',
          operator_id: ticket.operator_id || '',
          revenue_base_value: ticket.revenue_base_value !== null ? Number(ticket.revenue_base_value) : 500.00,
          revenue_included_hours: ticket.revenue_included_hours !== null ? Number(ticket.revenue_included_hours) : 3.00,
          revenue_included_km: ticket.revenue_included_km !== null ? Number(ticket.revenue_included_km) : 50.00,
          revenue_extra_hour_rate: ticket.revenue_extra_hour_rate !== null ? Number(ticket.revenue_extra_hour_rate) : 90.00,
          revenue_extra_km_rate: ticket.revenue_extra_km_rate !== null ? Number(ticket.revenue_extra_km_rate) : 2.50,
          revenue_discount_addition: ticket.revenue_discount_addition !== null ? Number(ticket.revenue_discount_addition) : 0.00,
          revenue_total: ticket.revenue_total !== null ? Number(ticket.revenue_total) : 500.00,
          main_agent_compensation_base_value: ticket.main_agent_compensation_base_value !== null ? Number(ticket.main_agent_compensation_base_value) : 0,
          main_agent_compensation_included_hours: ticket.main_agent_compensation_included_hours !== null ? Number(ticket.main_agent_compensation_included_hours) : 0,
          main_agent_compensation_included_km: ticket.main_agent_compensation_included_km !== null ? Number(ticket.main_agent_compensation_included_km) : 0,
          main_agent_compensation_extra_hour_rate: ticket.main_agent_compensation_extra_hour_rate !== null ? Number(ticket.main_agent_compensation_extra_hour_rate) : 0,
          main_agent_compensation_extra_km_rate: ticket.main_agent_compensation_extra_km_rate !== null ? Number(ticket.main_agent_compensation_extra_km_rate) : 0,
          main_agent_compensation_total: ticket.main_agent_compensation_total !== null ? Number(ticket.main_agent_compensation_total) : 0,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar chamado:', error);
      toast.error('Erro ao carregar dados do chamado');
    }
  };

  const fetchPhotos = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from('ticket_photos')
        .select('id, file_url, caption')
        .eq('ticket_id', ticketId)
        .order('created_at');

      if (error) throw error;
      setExistingPhotos(data || []);
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
    }
  };

  const handlePhotoDelete = async (photoId: string, fileUrl: string) => {
    try {
      // Extract the storage path from the full URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/ticket-photos/TICKET_ID/filename
      const bucketName = 'ticket-photos';
      const bucketMarker = `/public/${bucketName}/`;
      const bucketIndex = fileUrl.indexOf(bucketMarker);
      const storagePath = bucketIndex >= 0
        ? fileUrl.slice(bucketIndex + bucketMarker.length)
        : `${ticketId}/${fileUrl.split('/').pop()}`;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (storageError) {
        console.error('Erro ao remover do storage:', storageError);
        // Continue to delete DB record even if storage fails
      }

      // Delete from DB
      const { error } = await supabase
        .from('ticket_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Foto removida com sucesso');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue('coordinates_lat', position.coords.latitude);
        form.setValue('coordinates_lng', position.coords.longitude);
        toast.success('Localização capturada');
      },
      () => toast.error('Erro ao obter localização')
    );
  };

  const handleReverseGeocode = async () => {
    const lat = form.getValues('coordinates_lat');
    const lng = form.getValues('coordinates_lng');

    if (!lat || !lng) {
      toast.error('Informe as coordenadas primeiro');
      return;
    }

    const result = await reverseGeocode(lat, lng);
    if (result) {
      form.setValue('city', result.city);
      form.setValue('state', result.state);
      toast.success('Cidade e estado preenchidos!');
    }
  };

  const addFilesToGroups = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newFiles = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setNewPhotoGroups(prev => {
      if (prev.length === 0) {
        // No groups yet — start the first one
        return [{ files: newFiles, caption: '' }];
      }
      // Add to the last open group (no 4-photo cap)
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        files: [...updated[updated.length - 1].files, ...newFiles],
      };
      return updated;
    });
  };

  const addFilesToGroup = (groupIndex: number, files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const newFiles = imageFiles.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setNewPhotoGroups(prev => {
      const updated = [...prev];
      updated[groupIndex] = { ...updated[groupIndex], files: [...updated[groupIndex].files, ...newFiles] };
      return updated;
    });
  };

  const addNewPhotoBlock = () => {
    setNewPhotoGroups(prev => [...prev, { files: [], caption: '' }]);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addFilesToGroups(Array.from(files));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFilesToGroups(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // Paste from clipboard (Ctrl+V)
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        setActiveTab('fotos');
        addFilesToGroups(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open]);

  const removeNewPhoto = (groupIndex: number, photoIndex: number) => {
    setNewPhotoGroups(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[groupIndex].files[photoIndex].preview);
      updated[groupIndex] = {
        ...updated[groupIndex],
        files: updated[groupIndex].files.filter((_, i) => i !== photoIndex),
      };
      return updated.filter(g => g.files.length > 0);
    });
  };

  const updateNewPhotoCaption = (groupIndex: number, caption: string) => {
    setNewPhotoGroups(prev => prev.map((g, i) => i === groupIndex ? { ...g, caption } : g));
  };

  const uploadNewPhotos = async () => {
    if (!ticketId || !user || newPhotoGroups.length === 0) return;

    for (const group of newPhotoGroups) {
      for (const photo of group.files) {
        const fileName = `${ticketId}/${Date.now()}-${photo.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('ticket-photos')
          .upload(fileName, photo.file);

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('ticket-photos')
          .getPublicUrl(fileName);

        await supabase.from('ticket_photos').insert({
          ticket_id: ticketId,
          file_url: urlData.publicUrl,
          caption: group.caption || null,
          uploaded_by_user_id: user.id,
        });
      }
    }
  };

  const validateBusinessRules = (data: TicketFormData): boolean => {
    if (data.km_start && data.km_end && data.km_end < data.km_start) {
      toast.error('KM Final deve ser maior ou igual ao KM Inicial');
      return false;
    }

    if (data.start_datetime && data.end_datetime) {
      const start = new Date(data.start_datetime);
      const end = new Date(data.end_datetime);
      if (end < start) {
        toast.error('Data/hora final deve ser posterior à data/hora inicial');
        return false;
      }
    }

    return true;
  };

  const onSubmit = async (data: TicketFormData) => {
    if (!ticketId) return;

    if (!validateBusinessRules(data)) return;

    // Validate photo captions before updating
    if (newPhotoGroups.some(group => group.files.length > 0 && !group.caption?.trim())) {
      toast.error('A legenda é obrigatória para todos os grupos de fotos adicionados.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Update Ticket (Main Info)
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({
          status: data.status,
          client_id: data.client_id,
          vehicle_id: data.vehicle_id,
          main_agent_id: data.main_agent_id,
          main_agent_arrival: toSupabaseTimestamp(data.main_agent_arrival),
          main_agent_departure: toSupabaseTimestamp(data.main_agent_departure),
          plan_id: data.plan_id,
          service_type: data.service_type,
          city: data.city,
          state: data.state,
          start_datetime: toSupabaseTimestamp(data.main_agent_arrival) || toSupabaseTimestamp(data.start_datetime),
          end_datetime: toSupabaseTimestamp(data.main_agent_departure) || toSupabaseTimestamp(data.end_datetime) || null,
          coordinates_lat: data.coordinates_lat || null,
          coordinates_lng: data.coordinates_lng || null,
          km_start: data.km_start || null,
          km_end: data.km_end || null,
          toll_cost: data.toll_cost || 0,
          food_cost: data.food_cost || 0,
          other_costs: data.other_costs || 0,
          summary: data.summary || null,
          detailed_report: data.detailed_report || null,
          revenue_base_value: data.revenue_base_value || 0,
          revenue_included_hours: data.revenue_included_hours || 0,
          revenue_included_km: data.revenue_included_km || 0,
          revenue_extra_hour_rate: data.revenue_extra_hour_rate || 0,
          revenue_extra_km_rate: data.revenue_extra_km_rate || 0,
          revenue_discount_addition: data.revenue_discount_addition || 0,
          revenue_total: data.revenue_total || 0,
          main_agent_compensation_base_value: data.main_agent_compensation_base_value || 0,
          main_agent_compensation_included_hours: data.main_agent_compensation_included_hours || 0,
          main_agent_compensation_included_km: data.main_agent_compensation_included_km || 0,
          main_agent_compensation_extra_hour_rate: data.main_agent_compensation_extra_hour_rate || 0,
          main_agent_compensation_extra_km_rate: data.main_agent_compensation_extra_km_rate || 0,
          main_agent_compensation_total: data.main_agent_compensation_total || 0,
        })
        .eq('id', ticketId);

      if (ticketError) throw ticketError;

      // 2. Sync Support Agents (Wrapped in try/catch to allow partial success)
      try {
        // A. Upsert existing/new agents
        const formAgentIds: string[] = [];

        if (data.support_agents && data.support_agents.length > 0) {
          const agentsToUpsert = data.support_agents.map(agent => ({
            id: agent.id,
            ticket_id: ticketId,
            agent_id: agent.agent_id,
            arrival: toSupabaseTimestamp(agent.arrival),
            departure: toSupabaseTimestamp(agent.departure),
            km_start: agent.km_start || null,
            km_end: agent.km_end || null,
            toll_cost: agent.toll_cost || 0,
            food_cost: agent.food_cost || 0,
            other_costs: agent.other_costs || 0,
            compensation_base_value: agent.compensation_base_value,
            compensation_included_hours: agent.compensation_included_hours,
            compensation_included_km: agent.compensation_included_km,
            compensation_extra_hour_rate: agent.compensation_extra_hour_rate,
            compensation_extra_km_rate: agent.compensation_extra_km_rate,
            compensation_total: agent.compensation_total,
          }));

          // Helper to check if string is valid UUID
          const isValidUUID = (uuid: string) => {
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return regex.test(uuid);
          };

          const toUpdate = agentsToUpsert.filter(a => a.id && isValidUUID(a.id));
          const toInsert = agentsToUpsert.filter(a => !a.id || !isValidUUID(a.id)).map(a => {
            const { id, ...rest } = a; // Drop invalid/temp ID
            return rest;
          });

          if (toUpdate.length > 0) {
            for (const item of toUpdate) {
              // Keep track of IDs we are updating/keeping
              if (item.id) formAgentIds.push(item.id);

              const { error } = await supabase
                .from('ticket_support_agents')
                .update(item)
                .eq('id', item.id);
              if (error) throw error;
            }
          }

          if (toInsert.length > 0) {
            const { data: inserted, error } = await supabase
              .from('ticket_support_agents')
              .insert(toInsert)
              .select('id');
            if (error) throw error;

            // Add freshly inserted IDs to the list so they aren't deleted by the cleanup step
            if (inserted) {
              inserted.forEach(row => formAgentIds.push(row.id));
            }
          }
        }

        // B. Delete removed agents
        // We want to delete any row in DB for this ticket that is NOT in formAgentIds.
        let query = supabase.from('ticket_support_agents').delete().eq('ticket_id', ticketId);

        if (formAgentIds.length > 0) {
          query = query.not('id', 'in', `(${formAgentIds.join(',')})`);
        }

        const { error: deleteError } = await query;
        if (deleteError) throw deleteError;

      } catch (agentError) {
        console.error('Erro ao sincronizar agentes de apoio:', agentError);
        toast.warning('Chamado salvo, mas houve erro ao atualizar agentes de apoio (tabela indisponível).');
        // Do not throw, continue to success
      }

      // Upload new photos
      if (newPhotoGroups.length > 0) {
        await uploadNewPhotos();
      }

      toast.success('Chamado atualizado com sucesso!');
      newPhotoGroups.forEach(g => g.files.forEach(p => URL.revokeObjectURL(p.preview)));
      setNewPhotoGroups([]);
      onOpenChange(false);
      onSuccess();

    } catch (error) {
      console.error('Erro ao atualizar chamado:', error);
      const msg = error instanceof Error ? error.message : (error as any)?.message || 'Erro desconhecido';
      toast.error(`Erro ao atualizar chamado: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Chamado</DialogTitle>
            <DialogDescription>Atualize os dados do chamado</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.error('Form validation errors:', errors);
                toast.error('Por favor, verifique os campos obrigatórios preenchidos incorretamente.');

                if (errors.status || errors.client_id || errors.vehicle_id || errors.plan_id || errors.service_type || errors.city || errors.state || errors.start_datetime) {
                  setActiveTab('cliente');
                  return;
                }

                if (errors.main_agent_id || errors.support_agents || errors.operator_id || errors.detailed_report) {
                  setActiveTab('agente');
                  return;
                }
              })} className="space-y-4 pr-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="cliente">Cliente</TabsTrigger>
                    <TabsTrigger value="agente">Agente/Despesas</TabsTrigger>
                    <TabsTrigger value="fotos">Fotos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="cliente" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="aberto">Aberto</SelectItem>
                              <SelectItem value="em_andamento">Em Andamento</SelectItem>
                              <SelectItem value="finalizado">Finalizado</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vehicle_id"
                      render={({ field }) => {
                        const isAlarmeOnly = filteredVehicles.length === 1 && filteredVehicles[0].plate_main === 'ALARME';
                        
                        return (
                          <FormItem className={isAlarmeOnly ? "hidden lg:block lg:opacity-50 lg:pointer-events-none" : ""}>
                            <FormLabel>{isAlarmeOnly ? "Veículo (Alarme Padrão)" : "Veículo *"}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedClientId || isAlarmeOnly}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={selectedClientId ? "Selecione o veículo" : "Selecione um cliente primeiro"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {filteredVehicles.map((vehicle) => (
                                  <SelectItem key={vehicle.id} value={vehicle.id}>
                                    {vehicle.description} - {vehicle.plate_main}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="plan_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plano *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o plano" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    {plan.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="service_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Serviço *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="alarme">Alarme</SelectItem>
                                <SelectItem value="averiguacao">Averiguação</SelectItem>
                                <SelectItem value="preservacao">Preservação</SelectItem>
                                <SelectItem value="acompanhamento_logistico">Acompanhamento Logístico</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade *</FormLabel>
                            <FormControl>
                              <Input placeholder="Cidade" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado *</FormLabel>
                            <FormControl>
                              <Input placeholder="UF" maxLength={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_datetime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data/Hora Início *</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_datetime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data/Hora Fim</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>


                    <div className="space-y-2">
                      <Label>Coordenadas</Label>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="coordinates_lat"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="any"
                                    placeholder="Latitude"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="coordinates_lng"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="any"
                                    placeholder="Longitude"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={getLocation} title="Localização atual">
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleReverseGeocode}
                          disabled={!coordLat || !coordLng || isGeocoding}
                          title="Buscar cidade/estado"
                        >
                          {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="agente" className="space-y-6 mt-4">
                    {/* Operador Responsável */}
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                      <FormField
                        control={form.control}
                        name="operator_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-primary flex items-center gap-2">
                              OPERADOR RESPONSÁVEL
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Selecione o operador" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Selecione...</SelectItem>
                                {operators.map((operator) => (
                                  <SelectItem key={operator.id} value={operator.id}>
                                    {operator.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      {/* Agente Principal */}
                      <div className="space-y-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-primary uppercase tracking-wider">Agente Principal</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => setIsMapDialogOpen(true)}
                          >
                            <MapPin className="h-3 w-3" />
                            BUSCA POR MAPA
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="main_agent_id"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-xs">Identificação do Agente</FormLabel>
                                <Popover open={openMainAgent} onOpenChange={setOpenMainAgent}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openMainAgent}
                                        className={cn(
                                          "w-full justify-between font-normal h-9 text-xs",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value
                                          ? agents.find((agent) => agent.id === field.value)?.name
                                          : "Selecione o agente de campo"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Pesquisar agente..." />
                                      <CommandList>
                                        <CommandEmpty>Nenhum agente encontrado.</CommandEmpty>
                                        <CommandGroup>
                                          {agents.map((agent) => (
                                            <CommandItem
                                              key={agent.id}
                                              value={agent.name}
                                              onSelect={() => {
                                                form.setValue("main_agent_id", agent.id);
                                                setOpenMainAgent(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  agent.id === field.value ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {agent.name} {agent.is_armed ? '(Armado)' : '(Desarmado)'}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div>
                            <Label className="text-xs">Veículo da Operação</Label>
                            <Input
                              value={filteredVehicles.find(v => v.id === form.watch('vehicle_id'))?.description || 'Selecione no menu Cliente'}
                              disabled
                              className="mt-1 h-9 bg-muted text-xs font-medium"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <FormField
                            control={form.control}
                            name="main_agent_arrival"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Chegada</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="main_agent_departure"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Saída</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                          <FormField
                            control={form.control}
                            name="km_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Inicial</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="km_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Final</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">KM Rodado</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold text-primary">
                              {kmRodado} km
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FormField
                            control={form.control}
                            name="toll_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Pedágio (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="food_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Alimentação (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="other_costs"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Outros (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">Total Agente</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                              {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4 border-b pb-2">
                        <h4 className="font-bold text-sm text-muted-foreground">AGENTE(S) DE APOIO</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({
                            agent_id: '',
                            arrival: '',
                            departure: '',
                            km_start: null,
                            km_end: null,
                            toll_cost: 0,
                            food_cost: 0,
                            other_costs: 0,
                          })}
                        >
                          + Adicionar Apoio
                        </Button>
                      </div>

                      {fields.map((fieldItem, index) => {
                        // Watch values for this specific field to calculate totals dynamically
                        const currentValues = form.watch(`support_agents.${index}`);
                        // Fallback for initial render or undefined
                        const agentValues = currentValues || fieldItem;

                        const kmRodado = (agentValues.km_start && agentValues.km_end && agentValues.km_end >= agentValues.km_start)
                          ? agentValues.km_end - agentValues.km_start
                          : 0;
                        const totalCusto = (agentValues.toll_cost || 0) + (agentValues.food_cost || 0) + (agentValues.other_costs || 0);

                        return (
                          <div key={fieldItem.id} className="space-y-4 p-4 border rounded-lg bg-muted/20 mt-4 relative">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                            <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Apoio {index + 1}</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.agent_id`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs">Agente</FormLabel>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                              "w-full justify-between font-normal h-9 text-xs",
                                              !field.value && "text-muted-foreground"
                                            )}
                                          >
                                            {field.value
                                              ? agents.find((agent) => agent.id === field.value)?.name
                                              : "Selecione"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                        <Command>
                                          <CommandInput placeholder="Pesquisar..." />
                                          <CommandList>
                                            <CommandEmpty>Não encontrado.</CommandEmpty>
                                            <CommandGroup>
                                              {agents.map((agent) => (
                                                <CommandItem
                                                  key={agent.id}
                                                  value={agent.name}
                                                  onSelect={() => {
                                                    form.setValue(`support_agents.${index}.agent_id`, agent.id);
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      agent.id === field.value ? "opacity-100" : "opacity-0"
                                                    )}
                                                  />
                                                  {agent.name} {agent.is_armed ? '(Armado)' : '(Desarmado)'}
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.arrival`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Chegada</FormLabel>
                                    <FormControl>
                                      <Input type="datetime-local" className="h-9 text-xs" {...field} value={field.value || ''} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.departure`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Saída</FormLabel>
                                    <FormControl>
                                      <Input type="datetime-local" className="h-9 text-xs" {...field} value={field.value || ''} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.km_start`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">KM Inicial</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.km_end`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">KM Final</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <div className="space-y-2">
                                <Label className="text-xs">KM Rodado</Label>
                                <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                                  {kmRodado} km
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.toll_cost`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Pedágio (R$)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        {...field}
                                        value={field.value ?? 0}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.food_cost`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Alimentação (R$)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        {...field}
                                        value={field.value ?? 0}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`support_agents.${index}.other_costs`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Outros (R$)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        {...field}
                                        value={field.value ?? 0}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <div className="space-y-2">
                                <Label className="text-xs">Total Apoio {index + 1}</Label>
                                <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                                  {totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resumo Geral da Operação */}
                    <div className="bg-secondary/10 p-4 rounded-lg border border-secondary/30 space-y-3">
                      <h4 className="font-bold text-sm text-secondary uppercase tracking-wider">Resumo Geral da Operação</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded-md border shadow-sm">
                          <Label className="text-xs text-muted-foreground">KM TOTAL RODADO (EQUIPE)</Label>
                          <div className="text-2xl font-black text-primary">
                            {totalKmGeral} <span className="text-sm">km</span>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-md border shadow-sm">
                          <Label className="text-xs text-muted-foreground">CUSTO TOTAL DA OPERAÇÃO</Label>
                          <div className="text-2xl font-black text-success">
                            {totalCustoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Descrição do Evento */}
                    <div className="space-y-4 pt-4 border-t">
                      <FormField
                        control={form.control}
                        name="detailed_report"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição do Evento</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Relatório detalhado do atendimento..."
                                className="resize-none min-h-[100px]"
                                rows={6}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="fotos" className="space-y-4 mt-4">
                    {/* Existing photos */}
                    {existingPhotos.length > 0 && (() => {
                      // Group photos by caption, preserving upload session order
                      const groups: { caption: string | null; photos: typeof existingPhotos }[] = [];
                      for (const photo of existingPhotos) {
                        const last = groups[groups.length - 1];
                        if (last && last.caption === photo.caption) {
                          last.photos.push(photo);
                        } else {
                          groups.push({ caption: photo.caption, photos: [photo] });
                        }
                      }
                      return (
                        <div className="space-y-4">
                          <Label className="font-medium">Fotos já anexadas</Label>
                          {groups.map((group, gi) => (
                            <div key={gi} className="border border-border rounded-lg p-3 space-y-2">
                              {group.caption && (
                                <p className="text-xs font-semibold text-primary">{group.caption}</p>
                              )}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {group.photos.map((photo) => (
                                  <div key={photo.id} className="relative group aspect-[4/3]">
                                    <img
                                      src={photo.file_url}
                                      alt={photo.caption || 'Foto do chamado'}
                                      className="w-full h-full object-cover rounded-lg border"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handlePhotoDelete(photo.id, photo.file_url)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Upload area */}
                    <div className="space-y-2">
                      <Label className="font-medium">Adicionar novas fotos</Label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging
                          ? 'border-primary bg-primary/5'
                          : 'border-muted-foreground/25'
                          }`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                      >
                        <input
                          type="file"
                          id="photo-upload-edit"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoAdd}
                          className="hidden"
                        />
                        <label htmlFor="photo-upload-edit" className="cursor-pointer">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex gap-2">
                              <Upload className="h-8 w-8 text-muted-foreground" />
                              <Camera className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Clique, arraste ou cole (Ctrl+V) fotos aqui
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* New photos preview */}
                    {newPhotoGroups.length > 0 && (
                      <div className="space-y-4">
                        <Label className="font-medium">Novos blocos de fotos</Label>
                        {newPhotoGroups.map((group, groupIndex) => (
                          <div key={groupIndex} className="border border-border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground uppercase">
                                Bloco {groupIndex + 1} — {group.files.length} foto{group.files.length !== 1 ? 's' : ''}
                              </p>
                              {/* Per-block add photos button */}
                              <label htmlFor={`block-upload-${groupIndex}`} className="cursor-pointer">
                                <input
                                  type="file"
                                  id={`block-upload-${groupIndex}`}
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files) addFilesToGroup(groupIndex, Array.from(e.target.files));
                                    e.target.value = '';
                                  }}
                                />
                                <span className="text-xs text-primary underline">
                                  + Adicionar fotos a este bloco
                                </span>
                              </label>
                            </div>
                            {group.files.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {group.files.map((photo, photoIndex) => (
                                  <div key={photoIndex} className="relative aspect-[4/3]">
                                    <img
                                      src={photo.preview}
                                      alt={`Foto ${photoIndex + 1}`}
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeNewPhoto(groupIndex, photoIndex)}
                                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {group.files.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Nenhuma foto ainda. Use o botão acima ou arraste para cá.</p>
                            )}
                            <div>
                              <Label htmlFor={`edit-group-caption-${groupIndex}`} className="text-xs font-semibold text-primary">
                                Descrição do bloco *
                              </Label>
                              <Textarea
                                id={`edit-group-caption-${groupIndex}`}
                                placeholder="Descreva obrigatoriamente este bloco de fotos..."
                                value={group.caption}
                                onChange={(e) => updateNewPhotoCaption(groupIndex, e.target.value)}
                                className="mt-1 resize-none"
                                rows={2}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Button to manually start a new block */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={addNewPhotoBlock}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Bloco de Fotos
                    </Button>
                  </TabsContent>

                </Tabs>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Selecionar Agente no Mapa
            </DialogTitle>
            <DialogDescription>
              Localize os agentes ativos no mapa e selecione o mais próximo do local do chamado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4">
            <AgentMap
              onSelect={(agentId) => {
                form.setValue('main_agent_id', agentId);
                setIsMapDialogOpen(false);
                toast.success("Agente selecionado no mapa!");
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
