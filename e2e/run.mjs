/**
 * Recorrido E2E de Fun Party con Playwright.
 *
 * Uso:  BASE_URL=http://localhost:8001 node e2e/run.mjs
 * Requiere `npm i -D playwright` y un Chrome/Chromium (CHROME_PATH opcional).
 * Recorre todas las pantallas, pulsa los botones principales, comprueba la lógica
 * de puntuación contra la API y guarda capturas en e2e/screenshots/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:8001';
const OUT = path.join(here, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, locale: 'es-ES', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

let step = 0;
const shot = async (name) => page.screenshot({ path: path.join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
const api = async (p, opts) => (await fetch(`${BASE}/api${p}`, opts)).json();
const assert = (cond, msg) => {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
};
const toastText = async () => (await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | ');
const voice = async (text) => {
  await page.getByRole('button', { name: 'Comando de voz' }).first().click();
  await page.getByLabel('Escribe un comando').fill(text);
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.waitForTimeout(700);
};

// 1. Inicio vacío
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.getByText('No hay partidas en curso').waitFor();
await shot('inicio-vacio');
assert(await page.getByRole('heading', { name: /Fun Party/ }).isVisible(), 'Inicio: título visible');

// 2. Ajustes › Jugadores: alta de jugadores
await page.getByRole('link', { name: 'Ajustes' }).click();
for (const [name, fav] of [['Alejandro', true], ['Fran', true], ['Mariló', true], ['Diego', false]]) {
  await page.getByRole('button', { name: 'Nuevo jugador' }).click();
  await page.getByLabel('Nombre').fill(name);
  if (fav) await page.getByRole('button', { name: 'Jugador habitual' }).click();
  await page.getByRole('button', { name: 'Crear jugador' }).click();
  await page.getByText(name, { exact: true }).first().waitFor();
}
await shot('ajustes-jugadores');
let players = await api('/players');
assert(players.length === 4 && players.filter((p) => p.favorite).length === 3, 'Jugadores creados (3 habituales)');
assert(new Set(players.map((p) => p.color)).size === 4, 'Cada jugador recibe un color distinto');
// reordenar: bajar a Alejandro
await page.getByRole('button', { name: 'Bajar a Alejandro' }).click();
await page.waitForTimeout(400);
players = await api('/players');
assert(players[0].name === 'Fran' && players[1].name === 'Alejandro', 'Reordenar habituales');
await page.getByRole('button', { name: 'Subir a Alejandro' }).click();
await page.waitForTimeout(400);

// 3. Juegos
await page.getByRole('link', { name: 'Juegos' }).last().click();
await page.getByText('Skyjo').first().waitFor();
await shot('juegos');
await page.getByPlaceholder('Buscar juego o editorial...').fill('mattel');
assert((await page.getByText('Mattel', { exact: true }).count()) === 2, 'Buscar por editorial (UNO y UNO Team)');
await page.getByPlaceholder('Buscar juego o editorial...').fill('');
await page.getByRole('button', { name: /Juegos ocultos \(4\)/ }).click();
assert((await page.getByRole('button', { name: 'Mostrar' }).count()) === 4, '4 juegos ocultos con botón Mostrar');
await page.getByRole('button', { name: 'Volver a mis juegos' }).click();
await page.getByRole('button', { name: 'Añadir' }).click();
await page.getByText('Añadir juego', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Prefiero rellenarlo yo' }).click();
await page.getByPlaceholder('Ej. Dobble', { exact: true }).fill('Dobble');
await page.getByRole('radio', { name: 'Solo uno por anotación' }).click();
await page.getByLabel('Puntuación objetivo').fill('5');
await page.getByRole('button', { name: 'Crear juego' }).click();
await page.waitForURL(/\/juegos\/.+/);
assert((await api('/games')).some((g) => g.name === 'Dobble' && g.is_custom && g.entry_mode === 'free'), 'Alta manual de juego');

// 4. Ficha de Skyjo
await page.goto(`${BASE}/juegos/skyjo`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Skyjo' }).waitFor();
await shot('ficha-skyjo');
assert(await page.getByText('Cómo se juega, paso a paso').isVisible(), 'Ficha: normas paso a paso');
await page.getByRole('button', { name: 'Editar parámetros' }).click();
await page.getByText('Configurar Skyjo').waitFor();
await page.getByRole('radio', { name: 'Presupuesto que se gasta' }).click();
assert(await page.getByText('Presupuesto inicial por nº de jugadores').isVisible(), 'Config: modo presupuesto muestra presupuestos');
await shot('config-skyjo');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Gestionar' }).click();
await page.getByText('Imágenes de Skyjo').waitFor();
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Ocultar juego' }).click();
await page.waitForURL(/\/juegos$/);
assert((await api('/games/skyjo')).hidden === true, 'Ocultar juego');
await api('/games/skyjo', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hidden: false }) });

// 5. Nueva partida de Skyjo con habituales
await page.goto(`${BASE}/nueva`, { waitUntil: 'domcontentloaded' });
await page.getByText('Elige un juego').waitFor();
await page.getByRole('button', { name: 'Skyjo', exact: true }).click();
await page.getByRole('button', { name: 'Habituales' }).click();
await page.getByText('Orden de juego · 3 jugadores').waitFor();
await shot('nueva-skyjo');
assert(await page.getByText('(oficial)').isVisible(), 'Nueva: ajustes oficiales');
await page.getByRole('button', { name: 'Empezar partida' }).click();
await page.waitForURL(/\/partida\//);
const skyjoId = page.url().split('/').pop();

// 6. Puntuación en Skyjo
await page.getByText('Le toca a').waitFor();
await shot('partida-skyjo');
await page.getByRole('button', { name: '1', exact: true }).click();
await page.getByRole('button', { name: '2', exact: true }).click();
await page.getByRole('button', { name: 'Anotar 12 a Alejandro' }).click();
await page.getByRole('button', { name: /Anotar 0 a Fran/ }).waitFor();
await page.getByRole('button', { name: '2', exact: true }).click();
await page.getByRole('button', { name: 'Cambiar signo' }).click();
await page.getByRole('button', { name: 'Anotar -2 a Fran' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Saltar' }).click();
await page.waitForTimeout(500);
let m = await api(`/matches/${skyjoId}`);
assert(JSON.stringify(m.rounds[0].entries.map((e) => e.value)) === '[12,-2,0]', 'Ronda 1: 12, -2 y Saltar=0');
assert(m.current_round === 2 && m.ranking[0].total === -2, 'Ronda 2 y Fran lidera con -2');
// Anotar fuera de turno y deshacer
await page.getByRole('button', { name: /Mariló 0/ }).click();
assert(await page.getByText('Anotando a (turno de Alejandro)').isVisible(), 'Tocar jugador anota fuera de turno');
await page.getByRole('button', { name: '+10' }).click();
await page.getByRole('button', { name: '+5' }).click();
await page.getByRole('button', { name: 'Anotar 15 a Mariló' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Deshacer' }).click();
await page.waitForTimeout(400);
m = await api(`/matches/${skyjoId}`);
assert(m.rounds.length === 1, 'Deshacer borra la última anotación');
// Ronda completa
const fillRound = async (vals) => {
  await page.getByRole('button', { name: 'Ronda', exact: true }).click();
  const inputs = page.locator('[role=dialog] input');
  for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(String(vals[i]));
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(500);
};
await fillRound([50, 30, 45]);
await fillRound([25, 10, 10]);
await page.getByText('está a 13 puntos de llegar a 100').waitFor();
assert(true, 'Aviso: «Alejandro está a 13 puntos de llegar a 100 y cerrar la partida»');
await shot('partida-aviso');
// Corregir la ronda 1
await page.locator('tbody tr').first().click();
await page.getByText('Editar ronda 1').waitFor();
await page.locator('[role=dialog] input').first().fill('13');
await page.getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(500);
m = await api(`/matches/${skyjoId}`);
assert(m.totals[m.players[0].id] === 88, 'Corregir ronda: Alejandro pasa a 88');
await page.getByRole('tab', { name: 'Evolución' }).click();
await page.locator('.recharts-surface').first().waitFor();
await page.getByRole('tab', { name: 'Marcador' }).click();
// Resumen y normas
await page.getByRole('button', { name: 'Resumen' }).click();
await page.getByText('Faltan 12 puntos').waitFor();
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Normas' }).click();
await page.getByText('Normas · Skyjo').waitFor();
await page.keyboard.press('Escape');
// Fin de partida
await fillRound([20, 5, 5]);
await page.getByText('¡Gana la partida!').waitFor();
await shot('celebracion');
m = await api(`/matches/${skyjoId}`);
assert(m.status === 'finished' && m.players.find((p) => p.id === m.winner_ids[0]).name === 'Fran', 'Skyjo termina al superar 100: gana Fran (43)');
assert(m.ranking.map((r) => r.total).join() === '43,60,108', 'Clasificación final 43 · 60 · 108');
await page.getByRole('button', { name: 'Marcador' }).first().click();
await page.getByRole('button', { name: 'Más opciones' }).click();
await page.getByRole('button', { name: 'Reabrir partida' }).click();
await page.waitForTimeout(500);
assert((await toastText()).includes('La partida ya ha alcanzado su condición de fin'), 'Reabrir bloqueado si se cumple la condición de fin');
await page.getByRole('button', { name: 'Revancha' }).first().click();
await page.waitForURL((u) => !u.toString().endsWith(skyjoId));
assert((await api(`/matches/${page.url().split('/').pop()}`)).rounds.length === 0, 'Revancha crea partida nueva');
// Terminar ahora → empate
await page.getByRole('button', { name: '2', exact: true }).click();
await page.getByRole('button', { name: 'Anotar 2 a Alejandro' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Más opciones' }).click();
await page.getByRole('button', { name: 'Terminar partida ahora' }).click();
await page.getByText('¡Empate en la victoria!').waitFor();
assert(true, 'Terminar ahora: empate Fran y Mariló');
await page.getByRole('button', { name: 'Marcador' }).first().click();
await page.getByRole('button', { name: 'Más opciones' }).click();
await page.getByRole('button', { name: 'Reabrir partida' }).click();
await page.getByText('Le toca a').waitFor();
assert(true, 'Reabrir partida terminada a mano');

// 7. Voz (escrita)
await voice('Nueva partida de UNO para 2 jugadores');
await page.waitForURL(/\/partida\//);
await page.getByText('UNO').first().waitFor();
assert((await toastText()).includes('Partida de UNO creada con Alejandro, Fran'), 'Voz: crear partida de UNO para 2');
const unoId = page.url().split('/').pop();
await voice('Alejandro, 20 puntos');
await page.getByRole('button', { name: 'Saltar' }).click();
await page.waitForTimeout(400);
await voice('Alejandro, cuatrocientos puntos');
m = await api(`/matches/${unoId}`);
assert(m.totals[m.players[0].id] === 420 && m.turn_offset === 1, 'Voz: anotar en la partida abierta (+ Saltar en modo libre)');
assert(m.alerts[0] === '🔥 Alejandro está a 80 puntos de ganar la partida', 'Aviso de UNO');
await shot('partida-uno');
await voice('¿Quién va ganando?');
assert((await toastText()).includes('Va ganando Alejandro con 420 puntos'), 'Voz: ¿quién va ganando?');
await voice('Deshacer');
assert((await api(`/matches/${unoId}`)).rounds.length === 1, 'Voz: deshacer');
await voice('Finalizar partida');
assert((await api(`/matches/${unoId}`)).status === 'finished', 'Voz: finalizar partida');
await page.keyboard.press('Escape');

// 8. La Cuenta (presupuesto) por voz
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await voice('Crea una partida de La Cuenta con los jugadores habituales');
await page.waitForURL(/\/partida\//);
const cuentaId = page.url().split('/').pop();
await page.getByText('Le toca a').waitFor();
for (const d of ['8', '5', '0']) await page.getByRole('button', { name: d, exact: true }).click();
await page.getByRole('button', { name: 'Alejandro paga 850 €' }).click();
await page.getByText('solo tiene 50 €').waitFor();
await shot('partida-la-cuenta');
m = await api(`/matches/${cuentaId}`);
assert(m.settings.start_score === 900 && m.totals[m.players[0].id] === 50, 'La Cuenta: 3 jugadores empiezan con 900 € y pagar resta');
await voice('Skyjo, Fran, 7 puntos');
assert((await toastText()).includes('No hay ninguna partida de Skyjo en curso') || (await toastText()).includes('Skyjo:'), 'Voz: anotar indicando el juego');

// 9. Virus (victorias)
await page.goto(`${BASE}/nueva?juego=virus`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Habituales' }).click();
await page.getByRole('button', { name: 'Empezar partida' }).click();
await page.getByRole('button', { name: /gana la ronda \(\+1 victorias\)/ }).click();
await page.waitForTimeout(400);
await shot('partida-virus');
const virusId = page.url().split('/').pop();
assert((await api(`/matches/${virusId}`)).rounds.length === 1, 'Virus: botón de victoria directa');

// 10. UNO Team por parejas
await page.goto(`${BASE}/nueva?juego=uno-team`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Habituales' }).click();
assert(await page.getByText('Por parejas: elige un número par de jugadores (mínimo 4)').isVisible(), 'Parejas: exige nº par (mínimo 4)');
await page.getByRole('button', { name: /Diego$/ }).click();
await page.getByRole('region', { name: 'Parejas' }).waitFor();
await page.getByRole('radio', { name: '✋ Elegir yo' }).click();
assert(await page.getByText('Cada equipo debe tener exactamente 2 jugadores').isVisible(), 'Parejas manuales: validación');
await page.getByRole('radio', { name: '🎲 Sorteo automático' }).click();
await shot('nueva-parejas');
await page.getByRole('button', { name: 'Empezar partida' }).click();
await page.waitForURL(/\/partida\//);
m = await api(`/matches/${page.url().split('/').pop()}`);
assert(m.players.length === 2 && m.players.every((p) => p.member_ids.length === 2), 'UNO Team: 2 parejas');

// 11. Dashboard
await page.getByRole('link', { name: 'Dashboard' }).click();
await page.getByText('Podio de victorias').waitFor();
await shot('dashboard');
const stats = await api('/stats');
assert(stats.finished_matches === 2 && stats.active_matches === 4, 'Dashboard: partidas terminadas contadas');
await page.getByRole('button', { name: 'Reiniciar' }).click();
await page.getByRole('button', { name: 'Reiniciar' }).last().click();
await page.getByText(/Contando desde el/).waitFor();
await page.getByRole('button', { name: 'Deshacer' }).click();
await page.getByText('Podio de victorias').waitFor();
assert((await api('/stats')).reset_at === null, 'Dashboard: reiniciar y deshacer');

// 12. Ajustes: voz y partidas, Inicio con partidas en curso
await page.goto(`${BASE}/ajustes?tab=voz`, { waitUntil: 'domcontentloaded' });
await page.getByText('Anotar en la partida abierta').waitFor();
await shot('ajustes-voz');
await page.getByRole('tab', { name: 'Partidas' }).click();
await page.getByText(/🏆/).first().waitFor();
await shot('ajustes-partidas');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Partidas en curso' }).waitFor();
await page.locator('a[href^="/partida/"]').first().waitFor();
await shot('inicio-con-partidas');
assert((await page.locator('a[href^="/partida/"]').count()) >= 3, 'Inicio: lista de partidas en curso');

// Vista de escritorio para comparar con la original
await page.setViewportSize({ width: 1568, height: 715 });
await page.goto(`${BASE}/juegos`, { waitUntil: 'domcontentloaded' });
await page.getByText('Skyjo').first().waitFor();
await page.screenshot({ path: path.join(OUT, 'desktop-juegos.png') });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: path.join(OUT, 'desktop-inicio.png') });
await page.goto(`${BASE}/partida/${cuentaId}`, { waitUntil: 'domcontentloaded' });
await page.getByText('Le toca a').waitFor();
await page.screenshot({ path: path.join(OUT, 'desktop-partida.png') });

const real = errors.filter((e) => !/Failed to load resource|ERR_|net::/.test(e));
console.log(real.length ? `\nErrores de consola:\n${real.join('\n')}` : '\nSin errores de JavaScript en consola.');
await browser.close();
if (real.length) process.exit(1);
console.log('\nE2E OK');
