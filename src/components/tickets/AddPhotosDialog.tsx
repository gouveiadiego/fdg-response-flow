import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, X, Loader2 } from 'lucide-react';

interface PhotoGroup {
  files: { file: File; preview: string }[];
  caption: string;
}

interface AddPhotosDialogProps {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddPhotosDialog({ ticketId, open, onOpenChange, onSuccess }: AddPhotosDialogProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const totalPhotos = groups.reduce((sum, g) => sum + g.files.length, 0);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    // Distribute into groups of 4
    const newGroups: PhotoGroup[] = [];
    let remaining = [...newFiles];

    // Try to fill the last existing group first
    if (groups.length > 0) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup.files.length < 4) {
        const spotsAvailable = 4 - lastGroup.files.length;
        const toAdd = remaining.splice(0, spotsAvailable);
        const updatedGroups = [...groups];
        updatedGroups[updatedGroups.length - 1] = {
          ...lastGroup,
          files: [...lastGroup.files, ...toAdd],
        };
        setGroups(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            files: [...updated[updated.length - 1].files, ...toAdd],
          };
          // Add remaining as new groups
          while (remaining.length > 0) {
            updated.push({ files: remaining.splice(0, 4), caption: '' });
          }
          return updated;
        });
        e.target.value = '';
        return;
      }
    }

    // All into new groups of 4
    setGroups(prev => {
      const updated = [...prev];
      while (remaining.length > 0) {
        updated.push({ files: remaining.splice(0, 4), caption: '' });
      }
      return updated;
    });

    e.target.value = '';
  };

  const removePhoto = (groupIndex: number, photoIndex: number) => {
    setGroups(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[groupIndex].files[photoIndex].preview);
      updated[groupIndex] = {
        ...updated[groupIndex],
        files: updated[groupIndex].files.filter((_, i) => i !== photoIndex),
      };
      // Remove empty groups
      return updated.filter(g => g.files.length > 0);
    });
  };

  const updateGroupCaption = (groupIndex: number, caption: string) => {
    setGroups(prev => prev.map((g, i) => i === groupIndex ? { ...g, caption } : g));
  };

  const handleUpload = async () => {
    if (!user || totalPhotos === 0) return;

    if (groups.some(group => group.files.length > 0 && !group.caption?.trim())) {
      toast.error('A legenda é obrigatória para todos os grupos de fotos adicionados.');
      return;
    }

    setIsUploading(true);
    try {
      for (const group of groups) {
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

      toast.success(`${totalPhotos} foto(s) adicionada(s) com sucesso!`);

      groups.forEach(g => g.files.forEach(p => URL.revokeObjectURL(p.preview)));
      setGroups([]);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao adicionar fotos:', error);
      toast.error('Erro ao adicionar fotos');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      groups.forEach(g => g.files.forEach(p => URL.revokeObjectURL(p.preview)));
      setGroups([]);
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Fotos</DialogTitle>
          <DialogDescription>
            As fotos são agrupadas em blocos de 4. Cada bloco tem uma descrição compartilhada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Arraste fotos ou clique para selecionar
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoAdd}
                  className="hidden"
                  id="add-photo-upload"
                />
                <Label htmlFor="add-photo-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Fotos
                    </span>
                  </Button>
                </Label>
              </div>
            </div>
          </div>

          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Grupo {groupIndex + 1} — {group.files.length} foto{group.files.length !== 1 ? 's' : ''}
              </p>
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
                      onClick={() => removePhoto(groupIndex, photoIndex)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor={`group-caption-${groupIndex}`} className="text-xs font-semibold text-primary">
                  Descrição do grupo *
                </Label>
                <Textarea
                  id={`group-caption-${groupIndex}`}
                  placeholder="Descreva obrigatoriamente este grupo de fotos..."
                  value={group.caption}
                  onChange={(e) => updateGroupCaption(groupIndex, e.target.value)}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>
            </div>
          ))}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={totalPhotos === 0 || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar {totalPhotos} Foto{totalPhotos !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
