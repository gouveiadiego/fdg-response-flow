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

interface PhotoToUpload {
  file: File;
  preview: string;
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
  const [photos, setPhotos] = useState<PhotoToUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos: PhotoToUpload[] = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        caption: '',
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
    // Reset input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    setPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, caption } : photo
    ));
  };

  const handleUpload = async () => {
    if (!user || photos.length === 0) return;

    setIsUploading(true);
    try {
      for (const photo of photos) {
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
          caption: photo.caption || null,
          uploaded_by_user_id: user.id,
        });
      }

      toast.success(`${photos.length} foto(s) adicionada(s) com sucesso!`);
      
      // Cleanup
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotos([]);
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
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotos([]);
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Fotos</DialogTitle>
          <DialogDescription>
            Adicione novas fotos ao chamado. Você pode incluir legendas para cada foto.
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

          {photos.length > 0 && (
            <div className="space-y-4">
              {photos.map((photo, index) => (
                <div key={index} className="flex gap-4 p-4 border border-border rounded-lg">
                  <div className="relative flex-shrink-0">
                    <img
                      src={photo.preview}
                      alt={`Foto ${index + 1}`}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={`caption-${index}`}>Legenda (opcional)</Label>
                    <Textarea
                      id={`caption-${index}`}
                      placeholder="Descreva esta foto..."
                      value={photo.caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                      className="mt-1 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={photos.length === 0 || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar {photos.length} Foto{photos.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
