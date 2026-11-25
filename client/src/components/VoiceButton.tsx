import { useQueryClient } from '@tanstack/react-query';
import { Mic, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { keys } from '../hooks/queries';
import { api } from '../lib/api';
import { emitPanel, getRecognition, speak } from '../lib/speech';
import type { Game, Match, Player } from '../lib/types';
import { fmt, joinNames } from '../lib/utils';
import { matchName, parseCommand } from '../lib/voice';

/** Botón flotante del micrófono + panel "Comando de voz" (también admite texto). */
export function VoiceButton() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const recRef = useRef<ReturnType<typeof getRecognition>>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const supported = typeof window !== 'undefined' && !!getRecognition();

  const routeMatchId = location.pathname.match(/^\/partida\/([^/]+)/)?.[1] ?? null;

  const refresh = (m?: Match) => {
    if (m) qc.setQueryData(keys.match(m.id), m);
    qc.invalidateQueries({ queryKey: keys.matches, exact: true });
    qc.invalidateQueries({ queryKey: keys.stats });
  };

  async function load() {
    const [games, players, matches] = await Promise.all([
      qc.fetchQuery({ queryKey: keys.games, queryFn: api.games.list, staleTime: 30_000 }),
      qc.fetchQuery({ queryKey: keys.players, queryFn: api.players.list, staleTime: 30_000 }),
      qc.fetchQuery({ queryKey: keys.matches, queryFn: api.matches.list, staleTime: 0 }),
    ]);
    return { games: games as Game[], players: players as Player[], matches: matches as Match[] };
  }

  /** Partida "abierta": la de la pantalla actual o, si no, la última en curso. */
  function openMatch(matches: Match[]) {
    return (
      matches.find((m) => m.id === routeMatchId && m.status === 'active') ??
      matches.find((m) => m.status === 'active') ??
      null
    );
  }

  async function execute(raw: string) {
    const input = raw.trim();
    if (!input) return;
    setBusy(true);
    try {
      const { games, players, matches } = await load();
      const cmd = parseCommand(input, games);
      const current = openMatch(matches);
      const needMatch = () => {
        if (!current) throw new Error('No hay ninguna partida en curso');
        return current;
      };

      switch (cmd.type) {
        case 'score': {
          const target = cmd.game
            ? matches.find((m) => m.status === 'active' && m.game_id === cmd.game!.id)
            : current;
          if (!target) throw new Error(cmd.game ? `No hay ninguna partida de ${cmd.game.name} en curso` : 'No hay ninguna partida en curso');
          const seat =
            matchName(cmd.playerText, target.players) ??
            target.players.find((p) => p.member_names.some((n) => matchName(cmd.playerText, [{ name: n }])));
          if (!seat) throw new Error(`No encuentro a «${cmd.playerText}» en la partida de ${target.game_name}`);
          const m = await api.matches.score(target.id, seat.id, cmd.value);
          refresh(m);
          const msg = `${m.game_name}: ${seat.name} ${fmt(cmd.value)} ${m.settings.entry_label} (total ${fmt(m.totals[seat.id])})`;
          toast.success(msg);
          speak(`${seat.name}, ${fmt(cmd.value)}. Total ${fmt(m.totals[seat.id])}`);
          if (target.id !== routeMatchId) navigate(`/partida/${m.id}`);
          break;
        }
        case 'create': {
          if (!cmd.game) throw new Error(`No conozco el juego «${cmd.gameText}»`);
          const g = cmd.game;
          const favs = players.filter((p) => p.favorite);
          const wanted = cmd.count ?? Math.min(favs.length, g.max_players);
          const chosen = favs.slice(0, wanted);
          if (g.teams || chosen.length < Math.max(g.min_players, wanted)) {
            toast.message(`Elige los jugadores para ${g.name}`);
            navigate(`/nueva?juego=${encodeURIComponent(g.id)}`);
            break;
          }
          const m = await api.matches.create({ game_id: g.id, players: chosen.map((p) => ({ id: p.id })) });
          refresh(m);
          toast.success(`Partida de ${g.name} creada con ${chosen.map((p) => p.name).join(', ')}`);
          speak(`Partida de ${g.name} creada`);
          navigate(`/partida/${m.id}`);
          break;
        }
        case 'finish': {
          const m = await api.matches.finish(needMatch().id);
          refresh(m);
          const winners = m.players.filter((p) => m.winner_ids.includes(p.id)).map((p) => p.name);
          const msg = winners.length > 1 ? `Empate: ganan ${joinNames(winners)}` : `¡Gana ${winners[0] ?? 'nadie'}!`;
          toast.success(msg);
          speak(msg);
          navigate(`/partida/${m.id}`);
          break;
        }
        case 'undo': {
          const m = await api.matches.undo(needMatch().id);
          refresh(m);
          toast('Deshecho');
          break;
        }
        case 'skip': {
          const m = await api.matches.skip(needMatch().id);
          refresh(m);
          const next = m.players.find((p) => p.id === m.current_player_id);
          toast(`Turno de ${next?.name ?? '—'}`);
          break;
        }
        case 'who': {
          const m = needMatch();
          const leaders = m.ranking.filter((r) => r.position === 1);
          const names = leaders.map((r) => m.players.find((p) => p.id === r.player_id)?.name ?? '');
          const total = fmt(leaders[0]?.total ?? 0);
          const msg =
            names.length > 1
              ? `Van empatados ${joinNames(names)} con ${total} ${m.settings.entry_label}`
              : `Va ganando ${names[0]} con ${total} ${m.settings.entry_label}`;
          toast.success(msg);
          speak(msg);
          break;
        }
        case 'summary':
        case 'rules': {
          const m = needMatch();
          if (m.id !== routeMatchId) navigate(`/partida/${m.id}?ver=${cmd.type === 'summary' ? 'resumen' : 'normas'}`);
          else emitPanel(cmd.type);
          break;
        }
        default:
          throw new Error(`No he entendido «${input}». Mira los comandos en Ajustes › Voz.`);
      }
      setOpen(false);
      setText('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const rec = getRecognition();
    if (!rec) return;
    recRef.current?.abort();
    recRef.current = rec;
    setHeard('');
    setListening(true);
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setHeard(finalText || interim);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed') toast.error('Permite el acceso al micrófono para usar la voz');
    };
    rec.onend = () => {
      setListening(false);
      if (finalText) void execute(finalText);
    };
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  useEffect(() => {
    if (open && supported) startListening();
    if (!open) {
      recRef.current?.abort();
      setListening(false);
      setHeard('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        aria-label="Comando de voz"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[84px] z-50 flex size-16 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_10px_40px_-8px_rgba(139,92,246,0.8)] transition-transform duration-150 hover:bg-violet-500 active:scale-90"
      >
        <Mic className="size-6" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="relative w-full max-w-md rounded-2xl border border-line bg-[#0e0f18] p-5 shadow-2xl"
                role="dialog"
                aria-label="Comando de voz"
              >
                <div className="flex items-center justify-between">
                  <p className="eyebrow text-[11px]">Comando de voz</p>
                  <button aria-label="Cerrar" onClick={() => setOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-100">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="my-4 flex flex-col items-center gap-3">
                  <button
                    onClick={() => (listening ? recRef.current?.stop() : startListening())}
                    disabled={!supported}
                    aria-label={listening ? 'Dejar de escuchar' : 'Escuchar'}
                    className="relative flex size-20 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40"
                  >
                    {listening && <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/40" />}
                    <Mic className="relative size-8" />
                  </button>
                  <p className="min-h-6 text-center text-lg font-semibold text-zinc-100">
                    {busy ? 'Procesando…' : heard || (supported ? (listening ? 'Te escucho…' : 'Pulsa para hablar') : 'Escribe el comando')}
                  </p>
                  {!supported && (
                    <p className="text-center text-xs text-zinc-500">Este navegador no admite reconocimiento de voz.</p>
                  )}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void execute(text);
                  }}
                >
                  <input
                    className="field h-11 flex-1"
                    placeholder="O escríbelo: Skyjo, Pablo, 50 puntos"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    aria-label="Escribe un comando"
                  />
                  <button
                    type="submit"
                    disabled={busy || !text.trim()}
                    aria-label="Enviar"
                    className="flex size-11 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-50"
                  >
                    <Send className="size-4" />
                  </button>
                </form>
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                  Ejemplos: «La Cuenta, Pablo, 100 puntos» · «Crea una partida de Skyjo con los jugadores habituales» · «Finalizar
                  partida» · «Deshacer» · «¿Quién gana?»
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
