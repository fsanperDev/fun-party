/**
 * Prueba de humo de la versión GitHub Pages (modo local, sin servidor).
 * Uso: VITE_STORAGE=local VITE_BASE=/fun-party/ npm run build -w client, sirve client/dist bajo /fun-party/
 * (con 404.html como respuesta por defecto) y ejecuta: PAGES_URL=http://localhost:8090/fun-party/ node e2e/pages.mjs
 */
const { chromium } = await import('playwright');
const B = process.env.PAGES_URL ?? 'http://localhost:8090/fun-party/';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:430,height:900}, acceptDownloads:true });
const p = await ctx.newPage();
const errors=[]; p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>m.type()==='error'&&!/Failed to load resource/.test(m.text())&&errors.push(m.text()));
const ok=(c,m)=>{ if(!c) throw new Error('✗ '+m); console.log('✓ '+m); };
const W={waitUntil:'domcontentloaded'};
await p.goto(B,W); await p.getByText('No hay partidas en curso').waitFor();
ok(true,'Inicio carga en /fun-party/');
await p.getByRole('link',{name:'Juegos'}).last().click(); await p.getByText('Skyjo').first().waitFor();
ok((await p.locator('a[href],button').filter({hasText:'Magilano'}).count())>=1,'Catálogo de juegos sembrado en el navegador');
await p.goto(B+'ajustes',W);
for (const n of ['Ana','Luis','Eva']) { await p.getByRole('button',{name:'Nuevo jugador'}).click(); await p.getByLabel('Nombre').fill(n); await p.getByRole('button',{name:'Jugador habitual'}).click(); await p.getByRole('button',{name:'Crear jugador'}).click(); await p.getByText(n,{exact:true}).first().waitFor(); }
ok(true,'Jugadores creados');
await p.getByRole('button',{name:'Comando de voz'}).click(); await p.getByLabel('Escribe un comando').fill('Crea una partida de Skyjo con los jugadores habituales'); await p.getByRole('button',{name:'Enviar'}).click();
await p.waitForURL(/\/fun-party\/partida\//); const url=p.url();
ok(true,'Voz: partida creada → '+url.replace(B,''));
await p.getByRole('button',{name:'5',exact:true}).click(); await p.getByRole('button',{name:'Anotar 5 a Ana'}).click();
await p.getByRole('button',{name:/Anotar 0 a Luis/}).waitFor();
ok(true,'Anotar puntos');
// recarga en ruta profunda (404.html) y persistencia IndexedDB
await p.reload(W); await p.getByText('Le toca a').waitFor();
ok(await p.getByText('Luis',{exact:true}).first().isVisible(),'Recargar /partida/... funciona (404.html)');
ok(/^1\s+5\s+—/m.test(await p.locator('tbody').innerText()),'Los puntos persisten tras recargar (IndexedDB)');
// nueva pestaña: misma base de datos
const p2=await ctx.newPage(); await p2.goto(B,W); await p2.getByText('Skyjo').first().waitFor();
ok(await p2.getByText(/Turno de Luis/).isVisible(),'Datos visibles en otra pestaña');
// copia de seguridad
await p2.goto(B+'ajustes?tab=partidas',W); await p2.getByText('Copia de seguridad').waitFor();
const [dl]=await Promise.all([p2.waitForEvent('download'), p2.getByRole('button',{name:'Exportar'}).click()]);
const file=await dl.path(); const data=JSON.parse((await import('node:fs')).readFileSync(file,'utf8'));
ok(data.app==='fun-party'&&data.players.length===3&&data.matches.length===1&&data.games.length===20,'Exportar copia JSON');
// importar en un contexto limpio (otro "móvil")
const ctx2=await b.newContext({viewport:{width:430,height:900}}); const q=await ctx2.newPage();
await q.goto(B+'ajustes?tab=partidas',W); await q.getByText('Copia de seguridad').waitFor();
await q.locator('input[type=file]').setInputFiles(file); await q.getByRole('button',{name:'Importar'}).last().click();
await q.getByText('Copia importada').waitFor(); await q.goto(B,W); await q.getByText(/Turno de Luis/).waitFor();
ok(true,'Importar copia en otro dispositivo');
// la ficha no ofrece BGG y la IA explica que no está disponible
await p.goto(B+'juegos/skyjo',W); await p.getByRole('button',{name:'Gestionar'}).click();
ok(!(await p.getByText('boardgamegeek.com').count()),'Sin importación BGG en la versión estática');
await p.keyboard.press('Escape');
await p.goto(B+'dashboard',W); await p.getByText('Dashboard').first().waitFor();

console.log(errors.length? 'ERRORES: '+errors.join('\n') : 'Sin errores JS'); await b.close();
