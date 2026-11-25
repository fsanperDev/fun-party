/**
 * Integraciones externas opcionales.
 *
 * La app original permite (1) crear la ficha de un juego con IA y (2) importar
 * imágenes desde BoardGameGeek. Su implementación interna no es observable desde
 * el navegador, así que aquí se reconstruyen de forma explícita y OPCIONAL:
 *  - IA: API de Anthropic, solo si existe ANTHROPIC_API_KEY.
 *  - BGG: XML API2, que exige un token de aplicación (BGG_API_TOKEN).
 * Sin las variables de entorno, los endpoints responden con un mensaje claro.
 */
import { HttpError } from './http.js';

const BGG_BASE = 'https://boardgamegeek.com/xmlapi2';

export const integrations = {
  aiEnabled: () => Boolean(process.env.ANTHROPIC_API_KEY),
  bggEnabled: () => Boolean(process.env.BGG_API_TOKEN),
};

function bggHeaders() {
  return { Authorization: `Bearer ${process.env.BGG_API_TOKEN}` };
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export function bggIdFromUrl(url: string): number | null {
  const m = url.match(/boardgame(?:expansion)?\/(\d+)/i) ?? url.match(/^(\d+)$/);
  return m ? Number(m[1]) : null;
}

export interface BggThing {
  id: number;
  name: string | null;
  image: string | null;
  thumbnail: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  publisher: string | null;
}

export async function bggThing(id: number): Promise<BggThing> {
  if (!integrations.bggEnabled())
    throw new HttpError(503, 'Importar desde BoardGameGeek requiere configurar BGG_API_TOKEN en el servidor.');
  const res = await fetch(`${BGG_BASE}/thing?id=${id}`, { headers: bggHeaders() });
  if (!res.ok) throw new HttpError(502, `BoardGameGeek respondió ${res.status}`);
  const xml = await res.text();
  const tag = (t: string) => {
    const m = xml.match(new RegExp(`<${t}>\\s*([^<]+?)\\s*</${t}>`));
    return m ? decode(m[1]) : null;
  };
  const attr = (t: string) => {
    const m = xml.match(new RegExp(`<${t}[^>]*value="([^"]*)"`));
    return m ? decode(m[1]) : null;
  };
  const name = xml.match(/<name type="primary"[^>]*value="([^"]*)"/);
  const pub = xml.match(/<link type="boardgamepublisher"[^>]*value="([^"]*)"/);
  return {
    id,
    name: name ? decode(name[1]) : null,
    image: tag('image'),
    thumbnail: tag('thumbnail'),
    minPlayers: Number(attr('minplayers')) || null,
    maxPlayers: Number(attr('maxplayers')) || null,
    publisher: pub ? decode(pub[1]) : null,
  };
}

export async function bggSearch(name: string): Promise<number | null> {
  if (!integrations.bggEnabled()) return null;
  const q = encodeURIComponent(name);
  const res = await fetch(`${BGG_BASE}/search?query=${q}&type=boardgame&exact=1`, { headers: bggHeaders() });
  if (!res.ok) return null;
  const xml = await res.text();
  const m = xml.match(/<item type="boardgame" id="(\d+)"/);
  return m ? Number(m[1]) : null;
}

export interface AiGameSheet {
  name: string;
  emoji: string;
  category: string;
  description: string;
  manufacturer: string;
  objective: string;
  setup: string[];
  rules: string[];
  scoring_notes: string[];
  mode: 'points' | 'countdown';
  win_condition: 'high' | 'low';
  end_type: 'target' | 'rounds' | 'manual' | 'zero';
  target_score: number | null;
  rounds_count: number | null;
  start_score_default: number;
  entry_mode: 'round' | 'free';
  entry_label: string;
  default_entry: number | null;
  alert_margin: number;
  min_players: number;
  max_players: number;
  teams: boolean;
  aliases: string[];
}

const AI_PROMPT = (name: string) => `Eres un experto en juegos de mesa y de cartas. Prepara la ficha del juego "${name}" para una app de marcador en español de España.
Responde SOLO con un objeto JSON válido (sin markdown) con estas claves:
name (nombre oficial), emoji (1 emoji), category (2-3 palabras, p. ej. "Descarte / Memoria"), description (1 frase),
manufacturer (editorial), objective (1 frase), setup (array de pasos), rules (array de pasos de cómo se juega),
scoring_notes (array de notas de puntuación),
mode ("points" si se suman puntos, "countdown" si cada jugador gasta un presupuesto),
win_condition ("high" si gana quien tiene más, "low" si gana quien tiene menos),
end_type ("target" si termina al llegar a una puntuación, "rounds" si se juega un nº fijo de rondas, "zero" si termina cuando alguien llega a 0, "manual" si no hay fin claro),
target_score (número o null), rounds_count (número o null), start_score_default (número, 0 salvo presupuestos),
entry_mode ("round" si todos puntúan cada ronda, "free" si cada anotación es de un solo jugador),
entry_label (unidad: "puntos", "victorias", "fichas"...), default_entry (1 si se cuentan victorias de ronda, si no null),
alert_margin (número para avisar cuando alguien esté cerca del final), min_players, max_players,
teams (true si se juega por parejas), aliases (array de formas en que alguien podría pronunciar el nombre en español).
Si el juego no tiene puntuación propia (gana el último superviviente), usa victorias: entry_label "victorias", default_entry 1, end_type "target", target_score 3, entry_mode "free".`;

export async function generateGameSheet(name: string): Promise<AiGameSheet> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError(503, 'La creación con IA requiere configurar ANTHROPIC_API_KEY en el servidor.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-5-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: AI_PROMPT(name) }],
    }),
  });
  if (!res.ok) throw new Error(`La IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json) as AiGameSheet;
}
