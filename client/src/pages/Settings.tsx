import { ChevronDown, ChevronUp, Download, Mic, Pencil, Plus, Star, Trash2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../components/AppShell';
import { GamesManager } from '../components/GamesManager';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerFormDialog } from '../components/PlayerFormDialog';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/Confirm';
import { Tabs } from '../components/ui/Segmented';
import { keys, useInvalidate, useMatches, usePlayers } from '../hooks/queries';
import { api } from '../lib/api';
import { VOICE_HELP } from '../lib/constants';
import { getBackup } from '../lib/local/backup';
import type { Player } from '../lib/types';
import { joinNames, shortDate } from '../lib/utils';

type Tab = 'jugadores' | 'juegos' | 'voz' | 'partidas';

function PlayersTab() {
  const { data: players = [] } = usePlayers();
  const [editing, setEditing] = useState<Player | null | undefined>(undefined);
  const invalidate = useInvalidate();
  const confirm = useConfirm();
  const favs = players.filter((p) => p.favorite);

  async function move(p: Player, d: -1 | 1) {
    const ids = favs.map((f) => f.id);
    const i = ids.indexOf(p.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await api.players.order(ids);
    await invalidate(keys.players);
  }

  async function remove(p: Player) {
    const ok = await confirm({
      title: `¿Eliminar a ${p.name}?`,
      description: 'Sus partidas jugadas se conservan, pero dejará de aparecer en las estadísticas.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await api.players.remove(p.id);
    await invalidate(keys.players, keys.stats);
    toast(`${p.name} eliminado`);
  }

  return (
    <div>
      <Button className="h-11 w-full" onClick={() => setEditing(null)}>
        <Plus className="size-4" /> Nuevo jugador
      </Button>
      <p className="mt-3 mb-3 text-xs text-zinc-500">
        ⭐ Los jugadores habituales se usan con «crea una partida… con los jugadores habituales», en este orden.
      </p>
      {players.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Todavía no hay jugadores. Crea el primero.</p>
      ) : (
        <ul className="space-y-2">
          {players.map((p) => {
            const fi = favs.findIndex((f) => f.id === p.id);
            return (
              <li key={p.id} className="card flex items-center gap-3 px-3 py-2.5">
                <PlayerAvatar avatar={p.avatar} color={p.color} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    {p.name} {p.favorite && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                  </p>
                  {p.favorite && <p className="text-xs text-zinc-500">Habitual nº {fi + 1}</p>}
                </div>
                {p.favorite && (
                  <div className="flex flex-col">
                    <button aria-label={`Subir a ${p.name}`} disabled={fi === 0} onClick={() => move(p, -1)} className="text-zinc-400 disabled:opacity-25">
                      <ChevronUp className="size-4" />
                    </button>
                    <button aria-label={`Bajar a ${p.name}`} disabled={fi === favs.length - 1} onClick={() => move(p, 1)} className="text-zinc-400 disabled:opacity-25">
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                )}
                <button aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)} className="rounded-lg p-2 text-zinc-400 hover:bg-surface-2">
                  <Pencil className="size-4" />
                </button>
                <button aria-label={`Eliminar ${p.name}`} onClick={() => remove(p)} className="rounded-lg p-2 text-zinc-400 hover:bg-surface-2">
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <PlayerFormDialog open={editing !== undefined} player={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function VoiceTab() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 rounded-[18px] border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-violet-100">
        <Mic className="mt-0.5 size-4 shrink-0" />
        <p>
          Pulsa el botón morado del micrófono (abajo a la derecha) en cualquier pantalla y di el comando. Funciona en español en Chrome (Android) y
          Safari (iPhone). También puedes escribirlo.
        </p>
      </div>
      {VOICE_HELP.map((c) => (
        <div key={c.title} className="card p-4">
          <p className="font-bold">{c.title}</p>
          <code className="mt-2 block rounded-lg bg-black/30 px-2 py-1.5 font-mono text-xs text-cyan-300">{c.syntax}</code>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {c.examples.map((e) => (
              <li key={e}>🎙️ «{e}»</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Copia de seguridad del modo local (GitHub Pages): exportar e importar todos los datos. */
function BackupCard() {
  const backup = getBackup();
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const confirm = useConfirm();
  if (!backup) return null;

  function download() {
    const blob = new Blob([JSON.stringify(backup!.export(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fun-party-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    const ok = await confirm({
      title: '¿Importar la copia?',
      description: 'Se sustituirán todos los jugadores, juegos y partidas de este dispositivo.',
      confirmLabel: 'Importar',
      danger: true,
    });
    if (fileRef.current) fileRef.current.value = '';
    if (!ok) return;
    try {
      await backup!.import(JSON.parse(await file.text()));
      await qc.invalidateQueries();
      toast.success('Copia importada');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo leer el archivo');
    }
  }

  return (
    <div className="card mt-6 p-4">
      <p className="font-bold">Copia de seguridad</p>
      <p className="mt-1 text-sm text-zinc-400">
        En la versión web los datos se guardan en este dispositivo
        {backup.persistent ? '' : ' (este navegador no permite guardarlos: se perderán al cerrar)'}. Exporta una copia para
        pasarlos a otro móvil o guardarlos.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={download}>
          <Download className="size-4" /> Exportar
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Importar
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}

function MatchesTab() {
  const { data: matches = [] } = useMatches();
  const invalidate = useInvalidate();
  const confirm = useConfirm();

  async function remove(id: string, name: string) {
    const ok = await confirm({ title: `¿Eliminar la partida de ${name}?`, description: 'No se puede deshacer.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await api.matches.remove(id);
    await invalidate(keys.matches, keys.stats);
  }

  return (
    <>
      {!matches.length && <p className="py-6 text-center text-sm text-zinc-500">Todavía no hay partidas.</p>}
    <ul className="space-y-2">
      {matches.map((m) => {
        const winners = m.players.filter((p) => m.winner_ids.includes(p.id)).map((p) => p.name);
        return (
          <li key={m.id} className="card flex items-center gap-3 px-3 py-2.5">
            <Link to={`/partida/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="text-2xl">{m.game_emoji}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.game_name}</p>
                <p className="truncate text-xs text-zinc-500">
                  {shortDate(m.created_at)} · {m.status === 'finished' ? `🏆 ${joinNames(winners)}` : 'En curso'}
                </p>
              </div>
            </Link>
            <button aria-label="Eliminar partida" onClick={() => remove(m.id, m.game_name)} className="rounded-lg p-2 text-zinc-400 hover:bg-surface-2">
              <Trash2 className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
      <BackupCard />
    </>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = (['jugadores', 'juegos', 'voz', 'partidas'].includes(params.get('tab') ?? '') ? params.get('tab') : 'jugadores') as Tab;
  return (
    <div>
      <PageHeader eyebrow="Configuración general" title="Ajustes" />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        options={[
          { value: 'jugadores', label: 'Jugadores' },
          { value: 'juegos', label: 'Juegos' },
          { value: 'voz', label: 'Voz' },
          { value: 'partidas', label: 'Partidas' },
        ]}
      />
      {tab === 'jugadores' && <PlayersTab />}
      {tab === 'juegos' && <GamesManager />}
      {tab === 'voz' && <VoiceTab />}
      {tab === 'partidas' && <MatchesTab />}
    </div>
  );
}
