import { ImagePlus, Link2, Loader2, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { keys, useInvalidate } from '../hooks/queries';
import { api, LOCAL_MODE } from '../lib/api';
import type { Game } from '../lib/types';
import { cn, imageFileToDataUrl } from '../lib/utils';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

/** "Imágenes de <juego>": subir foto, pegar enlace, importar de BGG, elegir icono (★) y quitar. */
export function ImagesDialog({ game, open, onClose }: { game: Game; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [bgg, setBgg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidate();

  async function save(images: string[], image_url: string | null) {
    await api.games.update(game.id, { images, image_url });
    await invalidate(keys.games, keys.game(game.id));
  }

  const add = async (src: string) => {
    if (game.images.includes(src)) return;
    await save([...game.images, src], game.image_url ?? src);
  };

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await add(await imageFileToDataUrl(f));
      toast.success('Foto añadida');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function addUrl() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return toast.error('Pega un enlace que empiece por https://');
    await add(u);
    setUrl('');
  }

  async function importBgg() {
    setBusy(true);
    try {
      await api.games.importBgg(game.id, bgg.trim());
      await invalidate(keys.games, keys.game(game.id));
      setBgg('');
      toast.success('Imágenes importadas');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(src: string) {
    const images = game.images.filter((i) => i !== src);
    await save(images, game.image_url === src ? images[0] ?? null : game.image_url);
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Imágenes de ${game.name}`} description="La marcada con ★ es el icono del juego en toda la app.">
      <div className="space-y-3 pt-2">
        {game.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {game.images.map((src) => (
              <div key={src.slice(0, 120) + src.length} className={cn('relative aspect-square overflow-hidden rounded-xl border-2', game.image_url === src ? 'border-violet-500' : 'border-transparent')}>
                <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                <button
                  aria-label="Usar como icono"
                  onClick={() => save(game.images, src)}
                  className="absolute bottom-1 left-1 rounded-lg bg-black/70 p-1.5 text-white"
                >
                  <Star className={cn('size-3.5', game.image_url === src && 'fill-amber-400 text-amber-400')} />
                </button>
                <button aria-label="Quitar imagen" onClick={() => remove(src)} className="absolute right-1 bottom-1 rounded-lg bg-black/70 p-1.5 text-rose-300">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <Button className="h-11 w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Subir foto
        </Button>
        <div className="flex gap-2">
          <input className="field h-11 flex-1" placeholder="Pegar enlace de imagen (https://...)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button variant="outline" size="icon" aria-label="Añadir enlace" onClick={addUrl}>
            <Link2 className="size-4" />
          </Button>
        </div>
        {!LOCAL_MODE && (
        <div className="rounded-2xl border border-line p-3">
          <p className="mb-2 text-xs text-zinc-400">Importar imágenes oficiales: pega el enlace del juego en boardgamegeek.com</p>
          <div className="flex gap-2">
            <input className="field h-10 flex-1 text-sm" placeholder="https://boardgamegeek.com/boardgame/…" value={bgg} onChange={(e) => setBgg(e.target.value)} />
            <Button variant="outline" className="h-10" onClick={importBgg} disabled={!bgg.trim() || busy}>
              Importar
            </Button>
          </div>
        </div>
        )}
      </div>
    </Dialog>
  );
}
