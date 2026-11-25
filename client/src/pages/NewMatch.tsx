import { ArrowDown, ArrowUp, Check, Play, Star, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../components/AppShell';
import { GameIcon } from '../components/GameIcon';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerFormDialog } from '../components/PlayerFormDialog';
import { Segmented } from '../components/ui/Segmented';
import { keys, useGames, useInvalidate, useMatches, usePlayers } from '../hooks/queries';
import { api } from '../lib/api';
import { PLAYER_COLORS } from '../lib/constants';
import type { EndType, Game, Player, WinCondition } from '../lib/types';
import { alpha, cn, norm, ruleText } from '../lib/utils';

interface Seat {
  id: string;
  color: string;
}

interface ScoreCfg {
  win_condition: WinCondition;
  end_type: EndType;
  target_score: string;
  rounds_count: string;
  start_score: string;
  alert_margin: string;
}

function defaultsFor(g: Game, count: number): ScoreCfg {
  const n = String(count);
  return {
    win_condition: g.win_condition,
    end_type: g.mode === 'countdown' ? 'zero' : g.end_type,
    target_score: String(g.target_by_players?.[n] ?? g.target_score ?? ''),
    rounds_count: String(g.rounds_count ?? ''),
    start_score: String(g.start_scores?.[n] ?? g.start_score_default ?? 0),
    alert_margin: String(g.alert_margin ?? 0),
  };
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function Step({ n, title, extra, children }: { n: number; title: string; extra?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
        <span className="flex size-6 items-center justify-center rounded-lg bg-violet-500/15 text-xs text-violet-300">{n}</span>
        {title}
        {extra && <span className="text-sm font-normal text-zinc-500">{extra}</span>}
      </h2>
      {children}
    </section>
  );
}

export default function NewMatch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: games = [] } = useGames();
  const { data: players = [] } = usePlayers();
  const { data: matches = [] } = useMatches();

  const [gameId, setGameId] = useState<string | null>(params.get('juego'));
  const [q, setQ] = useState('');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [cfg, setCfg] = useState<ScoreCfg | null>(null);
  const [newName, setNewName] = useState('');
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [teamMode, setTeamMode] = useState<'auto' | 'manual'>('auto');
  const [autoTeams, setAutoTeams] = useState<string[][]>([]);
  const [manualTeam, setManualTeam] = useState<Record<string, number>>({});
  const [swapPick, setSwapPick] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const prefilled = useRef(false);

  const game = games.find((g) => g.id === gameId) ?? null;
  const visibleGames = useMemo(() => {
    const t = norm(q);
    return games.filter((g) => (!g.hidden || g.id === gameId) && (!t || norm(`${g.name} ${g.manufacturer}`).includes(t)));
  }, [games, q, gameId]);

  // "Nueva partida con los mismos jugadores": ?desde=<id de partida>
  useEffect(() => {
    const from = params.get('desde');
    if (!from || prefilled.current || !matches.length || !players.length) return;
    const m = matches.find((x) => x.id === from);
    if (!m) return;
    prefilled.current = true;
    setGameId(m.game_id);
    const ids = m.players.flatMap((p) => (p.member_ids.length ? p.member_ids : [p.id]));
    setSeats(
      ids
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p))
        .map((p) => ({ id: p.id, color: m.players.find((s) => s.id === p.id)?.color ?? p.color })),
    );
  }, [params, matches, players]);

  // Ajustes oficiales al cambiar de juego o de nº de jugadores.
  const count = seats.length;
  useEffect(() => {
    if (game) setCfg(defaultsFor(game, Math.max(count, game.min_players)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, count, game?.id]);

  // Sorteo automático de parejas.
  const seatKey = seats.map((s) => s.id).join(',');
  useEffect(() => {
    if (!game?.teams) return;
    const ids = shuffle(seats.map((s) => s.id));
    const t: string[][] = [];
    for (let i = 0; i < ids.length; i += 2) t.push(ids.slice(i, i + 2));
    setAutoTeams(t);
    setManualTeam({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatKey, game?.teams]);

  const playerById = (id: string) => players.find((p) => p.id === id);

  function addPlayer(p: Player) {
    setSeats((s) => {
      if (s.some((x) => x.id === p.id)) return s.filter((x) => x.id !== p.id);
      const used = new Set(s.map((x) => x.color.toUpperCase()));
      const color = used.has(p.color.toUpperCase()) ? PLAYER_COLORS.find((c) => !used.has(c.hex))?.hex ?? p.color : p.color.toUpperCase();
      return [...s, { id: p.id, color }];
    });
  }

  function addFavorites() {
    const favs = players.filter((p) => p.favorite);
    if (!favs.length) return toast.message('Aún no tienes jugadores habituales. Márcalos con ★ en Ajustes › Jugadores.');
    const limit = game?.max_players ?? favs.length;
    setSeats([]);
    favs.slice(0, limit).forEach((p) => addPlayer(p));
  }

  async function addByName() {
    const name = newName.trim();
    if (!name) return;
    const existing = players.find((p) => norm(p.name) === norm(name));
    if (existing) {
      if (!seats.some((s) => s.id === existing.id)) addPlayer(existing);
      setNewName('');
      return;
    }
    try {
      const p = await api.players.create({ name });
      await invalidate(keys.players);
      addPlayer(p);
      setNewName('');
      toast.success(`${p.name} añadido`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function move(i: number, d: -1 | 1) {
    setSeats((s) => {
      const r = [...s];
      [r[i], r[i + d]] = [r[i + d], r[i]];
      return r;
    });
  }

  function pickColor(seatId: string, hex: string) {
    setSeats((s) => {
      const mine = s.find((x) => x.id === seatId)!;
      return s.map((x) => (x.id === seatId ? { ...x, color: hex } : x.color === hex ? { ...x, color: mine.color } : x));
    });
    setColorFor(null);
  }

  // Equipos finales según el modo.
  const nTeams = Math.floor(count / 2);
  const teams: string[][] = useMemo(() => {
    if (!game?.teams) return [];
    if (teamMode === 'auto') return autoTeams;
    return Array.from({ length: nTeams }, (_, t) => seats.filter((s) => manualTeam[s.id] === t).map((s) => s.id));
  }, [game?.teams, teamMode, autoTeams, manualTeam, seats, nTeams]);

  function assignManual(pid: string, team: number) {
    setManualTeam((m) => {
      const next = { ...m };
      const members = Object.entries(next).filter(([id, t]) => t === team && id !== pid);
      if (members.length >= 2) {
        // Equipo lleno: se intercambian.
        const [otherId] = members[0];
        if (next[pid] !== undefined) next[otherId] = next[pid];
        else delete next[otherId];
      }
      next[pid] = team;
      return next;
    });
  }

  function swapAuto(pid: string) {
    if (!swapPick) return setSwapPick(pid);
    if (swapPick === pid) return setSwapPick(null);
    setAutoTeams((t) => t.map((team) => team.map((id) => (id === swapPick ? pid : id === pid ? swapPick : id))));
    setSwapPick(null);
  }

  // Validación (mensajes tal cual la original).
  const problems: string[] = [];
  if (!game) problems.push('Elige un juego');
  else {
    if (count < game.min_players) problems.push(`Mínimo ${game.min_players} jugadores`);
    if (count > game.max_players) problems.push(`Máximo ${game.max_players} jugadores`);
    if (game.teams) {
      if (count < 4 || count % 2) problems.push('Por parejas: elige un número par de jugadores (mínimo 4)');
      else if (teamMode === 'manual' && teams.some((t) => t.length !== 2)) problems.push('Cada equipo debe tener exactamente 2 jugadores');
    }
    if (cfg && cfg.end_type === 'target' && !(Number(cfg.target_score) > 0)) problems.push('Indica la puntuación objetivo');
    if (cfg && cfg.end_type === 'rounds' && !(Number(cfg.rounds_count) > 0)) problems.push('Indica el número de rondas');
  }

  const official = game && cfg ? JSON.stringify(cfg) === JSON.stringify(defaultsFor(game, Math.max(count, game.min_players))) : false;

  async function start() {
    if (!game || !cfg || problems.length) return;
    setStarting(true);
    try {
      const m = await api.matches.create({
        game_id: game.id,
        players: seats,
        teams: game.teams ? teams : undefined,
        settings: {
          win_condition: cfg.win_condition,
          end_type: cfg.end_type,
          target_score: cfg.target_score === '' ? null : Number(cfg.target_score),
          rounds_count: cfg.rounds_count === '' ? null : Number(cfg.rounds_count),
          start_score: Number(cfg.start_score) || 0,
          alert_margin: Number(cfg.alert_margin) || 0,
        },
      });
      await invalidate(keys.matches, keys.stats);
      navigate(`/partida/${m.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const label = game?.entry_label ?? 'puntos';

  return (
    <div>
      <PageHeader eyebrow="Nueva partida" title="Prepara la mesa" />

      <Step n={1} title="Juego">
        <input className="field" placeholder="Buscar juego..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {visibleGames.map((g) => (
            <button
              key={g.id}
              onClick={() => setGameId(g.id)}
              aria-pressed={gameId === g.id}
              className={cn('flex w-[78px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border bg-surface p-2', gameId === g.id ? 'border-2' : 'border-line')}
              style={gameId === g.id ? { borderColor: g.color, background: alpha(g.color, 0.12) } : undefined}
            >
              <GameIcon game={g} alt="" className="size-12" />
              <span className="w-full truncate text-center text-[11px] font-semibold">{g.name}</span>
            </button>
          ))}
        </div>
        {game && <p className="mt-2 text-sm text-zinc-400">{game.description}</p>}
      </Step>

      <Step n={2} title="Jugadores" extra={game ? `(${game.min_players}–${game.max_players})` : undefined}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={addFavorites} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-amber-200">
            <Star className="size-4 fill-amber-400 text-amber-400" /> Habituales
          </button>
          <button onClick={() => setCreatingPlayer(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-semibold">
            <UserPlus className="size-4" /> Personalizar nuevo
          </button>
        </div>

        {seats.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Orden de juego · {seats.length} jugadores</p>
            <ol className="space-y-2">
              {seats.map((s, i) => {
                const p = playerById(s.id);
                if (!p) return null;
                return (
                  <li key={s.id} className="card relative flex items-center gap-2.5 px-3 py-2">
                    <span className="w-4 font-mono text-xs text-zinc-500">{i + 1}</span>
                    <PlayerAvatar avatar={p.avatar} color={s.color} size="sm" />
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
                    <button aria-label={`Color de ${p.name}`} onClick={() => setColorFor(colorFor === s.id ? null : s.id)} className="size-8 rounded-full" style={{ background: s.color }} />
                    <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 text-zinc-400 disabled:opacity-30">
                      <ArrowUp className="size-4" />
                    </button>
                    <button aria-label="Bajar" disabled={i === seats.length - 1} onClick={() => move(i, 1)} className="p-1.5 text-zinc-400 disabled:opacity-30">
                      <ArrowDown className="size-4" />
                    </button>
                    <button aria-label={`Quitar a ${p.name}`} onClick={() => setSeats((x) => x.filter((y) => y.id !== s.id))} className="p-1.5 text-zinc-400">
                      <X className="size-4" />
                    </button>
                    {colorFor === s.id && (
                      <div className="absolute top-12 right-2 z-20 w-56 rounded-xl border border-line bg-[#11131d] p-2.5 shadow-xl">
                        <div className="grid grid-cols-8 gap-1.5">
                          {PLAYER_COLORS.map((c) => {
                            const taken = seats.some((x) => x.id !== s.id && x.color === c.hex);
                            return (
                              <button
                                key={c.hex}
                                aria-label={c.name}
                                onClick={() => pickColor(s.id, c.hex)}
                                className={cn('flex aspect-square items-center justify-center rounded-full', taken && 'opacity-30')}
                                style={{ background: c.hex }}
                              >
                                {s.color === c.hex && <Check className="size-3 text-white" />}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[11px] text-zinc-500">Cada jugador tiene un color único en la partida.</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {players.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {players.map((p) => {
              const on = seats.some((s) => s.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addPlayer(p)}
                  aria-pressed={on}
                  className={cn('flex h-9 items-center gap-1.5 rounded-full border pr-3 pl-1 text-sm font-medium', on ? 'border-violet-500/60 bg-violet-500/15' : 'border-line bg-surface')}
                >
                  <PlayerAvatar avatar={p.avatar} color={p.color} size="sm" />
                  {p.name}
                  {p.favorite && <Star className="size-3 fill-amber-400 text-amber-400" />}
                </button>
              );
            })}
          </div>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addByName();
          }}
        >
          <input className="field h-11 flex-1" placeholder="Añadir jugador por nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" disabled={!newName.trim()} className="h-11 rounded-xl border border-line px-3 text-sm text-zinc-300 disabled:opacity-40">
            Añadir
          </button>
        </form>
      </Step>

      {game?.teams && count >= 4 && count % 2 === 0 && (
        <Step n={3} title="Parejas">
          <Segmented
            value={teamMode}
            onChange={setTeamMode}
            options={[
              { value: 'auto', label: '🎲 Sorteo automático' },
              { value: 'manual', label: '✋ Elegir yo' },
            ]}
          />
          <div className="card mt-3 p-2.5">
            {teamMode === 'auto' ? (
              <>
                <div className="space-y-2">
                  {autoTeams.map((t, i) => {
                    const color = seats.find((s) => s.id === t[0])?.color ?? '#8B5CF6';
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: alpha(color, 0.12) }}>
                        <span className="w-14 text-[11px] leading-tight font-bold tracking-wider uppercase" style={{ color }}>
                          Equipo {i + 1}
                        </span>
                        {t.map((id) => {
                          const p = playerById(id);
                          const s = seats.find((x) => x.id === id);
                          return (
                            p && (
                              <button
                                key={id}
                                onClick={() => swapAuto(id)}
                                className={cn('flex h-8 items-center gap-1.5 rounded-full bg-black/25 pr-3 pl-1 text-sm', swapPick === id && 'ring-2 ring-violet-400')}
                              >
                                <PlayerAvatar avatar={p.avatar} color={s?.color ?? p.color} size="xs" />
                                {p.name}
                              </button>
                            )
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <p className="text-xs text-zinc-500">Toca dos jugadores para cambiarlos de pareja</p>
                  <button
                    onClick={() => {
                      const ids = shuffle(seats.map((s) => s.id));
                      const t: string[][] = [];
                      for (let i = 0; i < ids.length; i += 2) t.push(ids.slice(i, i + 2));
                      setAutoTeams(t);
                    }}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs"
                  >
                    Sortear
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="px-1 pb-2 text-xs text-zinc-500">
                  Toca el número del equipo de cada jugador (2 por equipo). Si el equipo está lleno, se intercambian.
                </p>
                {seats.map((s) => {
                  const p = playerById(s.id);
                  return (
                    p && (
                      <div key={s.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5">
                        <PlayerAvatar avatar={p.avatar} color={s.color} size="sm" />
                        <span className="flex-1 text-sm font-semibold">{p.name}</span>
                        {Array.from({ length: nTeams }, (_, t) => (
                          <button
                            key={t}
                            aria-label={`Equipo ${t + 1}`}
                            onClick={() => assignManual(s.id, t)}
                            className={cn('size-9 rounded-lg border text-sm', manualTeam[s.id] === t ? 'border-violet-500 bg-violet-600 text-white' : 'border-line')}
                          >
                            {t + 1}
                          </button>
                        ))}
                      </div>
                    )
                  );
                })}
                <div className="mt-2 space-y-0.5 px-1 text-xs">
                  {teams.map((t, i) => (
                    <p key={i}>
                      <b>Equipo {i + 1}:</b> {t.map((id) => playerById(id)?.name).join(' y ') || '—'}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </Step>
      )}

      {game && cfg && (
        <Step n={game.teams ? 4 : 3} title="Puntuación">
          <div className="card space-y-3 p-3.5">
            <p className="text-sm text-zinc-300">
              {ruleText({
                mode: game.mode,
                win_condition: cfg.win_condition,
                end_type: cfg.end_type,
                target_score: Number(cfg.target_score) || null,
                rounds_count: Number(cfg.rounds_count) || null,
                entry_label: label,
                start: Number(cfg.start_score) || 0,
              })}{' '}
              {official && <span className="text-xs text-emerald-400">(oficial)</span>}
            </p>
            <Segmented
              value={cfg.win_condition}
              onChange={(v) => setCfg({ ...cfg, win_condition: v })}
              options={[
                { value: 'high', label: 'Gana el que más' },
                { value: 'low', label: 'Gana el que menos' },
              ]}
            />
            {game.mode === 'countdown' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Presupuesto inicial ({label})</label>
                  <input type="number" inputMode="numeric" className="field font-mono" value={cfg.start_score} onChange={(e) => setCfg({ ...cfg, start_score: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Avisar a falta de</label>
                  <input type="number" inputMode="numeric" className="field font-mono" value={cfg.alert_margin} onChange={(e) => setCfg({ ...cfg, alert_margin: e.target.value })} />
                </div>
              </div>
            ) : (
              <>
                <Segmented
                  value={cfg.end_type}
                  onChange={(v) => setCfg({ ...cfg, end_type: v })}
                  options={[
                    { value: 'target', label: 'A puntos' },
                    { value: 'rounds', label: 'A rondas' },
                    { value: 'manual', label: 'Libre' },
                  ]}
                />
                {cfg.end_type !== 'manual' && (
                  <div className="grid grid-cols-2 gap-2">
                    {cfg.end_type === 'target' ? (
                      <div>
                        <label className="label text-xs">Objetivo ({label})</label>
                        <input type="number" inputMode="numeric" className="field font-mono" value={cfg.target_score} onChange={(e) => setCfg({ ...cfg, target_score: e.target.value })} />
                      </div>
                    ) : (
                      <div>
                        <label className="label text-xs">Nº de rondas</label>
                        <input type="number" inputMode="numeric" className="field font-mono" value={cfg.rounds_count} onChange={(e) => setCfg({ ...cfg, rounds_count: e.target.value })} />
                      </div>
                    )}
                    {cfg.end_type === 'target' && (
                      <div>
                        <label className="label text-xs">Avisar a falta de</label>
                        <input type="number" inputMode="numeric" className="field font-mono" value={cfg.alert_margin} onChange={(e) => setCfg({ ...cfg, alert_margin: e.target.value })} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Step>
      )}

      <div className="sticky bottom-[72px] z-30 mt-6 -mx-4 bg-gradient-to-t from-[#090A10] via-[#090A10]/95 to-transparent px-4 pt-4 pb-2">
        {problems.length > 0 && <p className="mb-2 text-center text-xs text-amber-400">{problems.join(' · ')}</p>}
        <button
          onClick={start}
          disabled={problems.length > 0 || starting}
          className="flex h-14 w-[calc(100%-4.5rem)] items-center justify-center gap-2 rounded-[18px] bg-violet-600 text-lg font-bold text-white disabled:opacity-50"
        >
          <Play className="size-5 fill-current" /> Empezar partida
        </button>
      </div>

      <PlayerFormDialog open={creatingPlayer} onClose={() => setCreatingPlayer(false)} onSaved={(p) => addPlayer(p)} />
    </div>
  );
}
