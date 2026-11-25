# Auditoría funcional de la app original

**Origen:** `https://fun-scorekeeper--4z00dk6z.preview.emergentagent.com` (auditada el 25/11/2026).

**Método:** se recorrió la app en un navegador real: todas las pantallas, diálogos y menús. Se leyeron las respuestas JSON de su API (`/api/games`, `/players`, `/matches`, `/stats`) y se jugaron partidas de prueba para observar la lógica de puntuación (todas se borraron después). El código fuente del backend no es observable y el del frontend no se copió. Esta reconstrucción es código nuevo que reproduce el comportamiento observado.

## 1. Tecnología observada

- Frontend: React + Vite + TypeScript, Tailwind CSS v4 (paleta zinc/violeta, fondo `#090A10`, degradados radiales violeta y cian), componentes shadcn/Base UI, TanStack Query, React Router, Motion, Recharts y Sonner. Fuentes: Plus Jakarta Sans (texto) y JetBrains Mono (cifras).
- Backend: API REST bajo `/api` con base de datos documental (ids UUID y fechas ISO).

## 2. Inventario de pantallas y funcionalidades

### Navegación
Barra inferior fija con Inicio, Juegos, Nueva, Dashboard y Ajustes, más un botón flotante de micrófono en todas las pantallas.

### Inicio (`/`)
Antetítulo «MARCADOR DE CARTAS», título «Fun Party.» y lema. Botones «Nueva partida» y «Juegos».
«Partidas en curso» muestra un contador y tarjetas con el icono del juego, «Ronda N · Turno de X · Lidera Y» y los avatares. Si no hay ninguna, aparece un texto de ayuda con un ejemplo de voz. Al final hay un enlace a los comandos de voz.

### Juegos (`/juegos`, también en Ajustes › Juegos)
- Buscador por juego o editorial.
- «Añadir» abre un diálogo con dos opciones: «Crear ficha con IA» o «Prefiero rellenarlo yo».
- «Juegos ocultos (n)» muestra los ocultos con el botón «Mostrar»; «Volver a mis juegos» regresa a la lista normal.
- Tarjetas con portada, franja del color del juego, nombre, editorial y la regla de fin.

### Ficha de juego (`/juegos/:id`)
- Cabecera con categoría, nombre, editorial, «N–M jugadores» y descripción.
- Botones «Jugar», «Editar parámetros» y «Ocultar juego».
- «Imágenes» con galería horizontal y «Gestionar»: subir foto, pegar enlace, importar de BoardGameGeek, ★ para elegir el icono y quitar imágenes.
- Secciones Objetivo, Preparación (numerada), Cómo se juega (numerada) y Puntuación (★), más «EN FUN PARTY · regla» y «Reglamento oficial del fabricante».
- «Configurar <juego>» edita:
  - Nombre, etiqueta, icono y color.
  - Tipo de marcador (Sumar puntos / Presupuesto que se gasta; el presupuesto se define por nº de jugadores 2–8 con un valor por defecto).
  - Quién gana (Más / Menos puntos) y fin de la partida (Puntuación / Nº rondas / Manual).
  - Cómo se anota (Todos puntúan cada ronda / Solo uno por anotación).
  - Mínimo y máximo de jugadores, margen de alerta y valor rápido.
  - Parejas / equipos.
  - Fabricante, reglamento, descripción, objetivo, preparación, normas, puntuación y nombres para la voz.
  - Botones «Guardar parámetros» y «Restablecer valores oficiales».

### Nueva partida (`/nueva`)
1. **Juego:** buscador y carrusel; al elegir uno se muestra su descripción.
2. **Jugadores (mín–máx):**
   - «Habituales», «Personalizar nuevo» (abre el diálogo de jugador) y fichas para añadir o quitar jugadores.
   - «Añadir jugador por nombre» crea un jugador persistente (avatar 🃏 y el primer color libre).
   - «Orden de juego» permite subir, bajar y quitar jugadores, y elegir el color de cada uno con un selector («Cada jugador tiene un color único en la partida»).
3. **Parejas** (solo en juegos por equipos): «🎲 Sorteo automático» (con «Sortear» y «Toca dos jugadores para cambiarlos de pareja») o «✋ Elegir yo» (botones de equipo; «Si el equipo está lleno, se intercambian»).
4. **Puntuación:**
   - Resumen de la regla con la marca «(oficial)».
   - Gana el que más / el que menos.
   - A puntos / A rondas / Libre, con los campos «Objetivo» y «Avisar a falta de».

Mensajes de validación: «Elige un juego», «Mínimo N jugadores», «Por parejas: elige un número par de jugadores (mínimo 4)» y «Cada equipo debe tener exactamente 2 jugadores».

### Partida (`/partida/:id`)
- **Cabecera:** «RONDA N» o «PARTIDA TERMINADA», icono y nombre del juego, la regla y los botones Resumen, Normas y ⋯.
- **Avisos de cercanía al fin** (textos literales):
  - Gana el que menos: `⚠️ X está a N puntos de llegar a T y cerrar la partida`
  - Gana el que más: `🔥 X está a N puntos de ganar la partida`
  - Presupuesto: `💸 X solo tiene N €: ¡a punto de arruinarse!`
- **Tarjetas de jugador:** total en su color, trofeo para el líder y marca de turno. Tocar a otro jugador permite anotarle fuera de turno («ANOTANDO A (TURNO DE X)»).
- **Teclado:** «LE TOCA A», total y «faltan N», valor de la ronda, atajos +N, Borrar, 0–9, ± y ⌫.
  - Botón «Anotar N a X» o, en presupuesto, «X paga N €» (± desactivado). Está desactivado con valor 0.
  - Deshacer · Saltar · Ronda (modo ronda) o Resumen (modo libre).
  - Juegos de victorias: botón único «X gana la ronda (+1 victorias)».
- **«Ronda N completa»:** todos a la vez; una casilla vacía quita esa puntuación.
- **Marcador y Evolución:** tocar una ronda abre «Editar ronda N», con Eliminar.
- **Resumen:** posiciones con «Límite alcanzado» o «Faltan N puntos» y «N rondas jugadas».
- **Menú ⋯:** Terminar partida ahora o Reabrir partida, Nueva partida con los mismos jugadores y Eliminar partida.
- **Celebración:** confeti de emojis, corona, ganador o «A y B – ¡Empate en la victoria!», podio de 3, Marcador y Revancha.
- **Notificaciones:** «X: +N puntos / Total: T», «Ronda anotada», «Ronda corregida», «Deshecho» y «Partida reabierta».
- **Error al reabrir:** «La partida ya ha alcanzado su condición de fin. Edita las puntuaciones para continuar.»

### Dashboard (`/dashboard`)
- «Reiniciar» lleva a «Contando desde el {fecha}» con la opción «Deshacer».
- Cifras: Jugadas, En curso y Juegos.
- Podio de victorias con el primero al centro y corona.
- «Victorias»: gráfico de barras con filtros «🎲 Todos» y uno por juego.
- Jugadores («N partidas · X% victorias», WINS), Por juego (partidas y 👑 líder) y Últimas partidas.

### Ajustes (`/ajustes?tab=jugadores|juegos|voz|partidas`)
- **Jugadores:**
  - Nuevo jugador.
  - Lista con ★ y «Habitual nº k», ▲▼ para ordenar, editar y borrar.
  - Diálogo con nombre, 32 avatares, 16 colores (los usados aparecen atenuados) y «Jugador habitual».
- **Juegos:** el mismo gestor que en la pantalla Juegos.
- **Voz:** guía completa de comandos.
- **Partidas:** historial «fecha · 🏆 ganador» con papelera.

### Voz
Comandos documentados en la app: anotar `<Juego>, <Jugador>, <Puntos> puntos` (también «menos N»), anotar en la partida abierta, crear partida (`[Fun Party,] crea una partida de <Juego> [para N jugadores] [con los jugadores habituales]`), finalizar, deshacer, siguiente jugador, ¿quién gana? (respuesta hablada), resumen y normas. El panel «Comando de voz» muestra «Te escucho…» y una caja de texto alternativa.

Respuestas observadas:
- «Skyjo: Mariló 7 puntos (total 7)»
- «Va ganando Fran con 0 puntos»
- «Partida de UNO creada con Alejandro, Fran»

## 3. Catálogo de juegos (20)

| Juego | Marcador | Gana | Fin | Anotación |
|---|---|---|---|---|
| Skyjo | puntos | menos | 100 | ronda |
| Flip 7 | puntos | más | 200 | ronda |
| La Cuenta | presupuesto (900–1400 € según jugadores) | más | 0 € | libre |
| UNO | puntos | más | 500 | libre |
| UNO Team (parejas) | puntos | más | 500 | libre |
| Virus! | victorias (+1) | más | 3 | libre |
| Pili Pili | Pilis | menos | 7 | ronda |
| Trio | victorias (+1) | más | 3 | libre |
| Sushi Go! | puntos | más | 3 rondas | ronda |
| Exploding Kittens | victorias (+1) | más | 3 | libre |
| Cubilete | manos (+1) | más | 5 | libre |
| Dominó | puntos | más | 100 | libre |
| Exploding Minions\* | victorias (+1) | más | 3 | libre |
| Flip 7: With a Vengeance\* | puntos | más | 200 | ronda |
| Skull King\* | puntos | más | 10 rondas | ronda |
| Zombie Kittens\* | victorias (+1) | más | 3 | libre |
| 6 Nimmt! (oculto) | cabezas | menos | 66 | ronda |
| Love Letter (oculto) | fichas (6/5/4/3 según jugadores) | más | 4 | libre |
| Chinchón (oculto) | puntos | menos | 100 | ronda |
| Cabo (oculto) | puntos | menos | 100 | ronda |

\* Juegos añadidos con IA en la app original. Se incluyen con sus datos tal como estaban. Todas las normas, preparaciones, notas de puntuación y alias de voz se han conservado.

## 4. Lógica de puntuación comprobada

Cada caso está cubierto por un test en `server/test/scoring.test.ts`.

1. **Modo ronda** (Skyjo):
   - Le toca al primer jugador sin anotación en la ronda abierta.
   - Al completarse, empieza la siguiente ronda por el primer jugador.
   - «Saltar» anota 0.
2. **Modo libre** (UNO):
   - Cada anotación es una ronda.
   - El turno es `jugadores[(nº anotaciones + turn_offset) mod n]` y «Saltar» suma 1 a `turn_offset`.
   - «Deshacer» no cambia `turn_offset`.
3. **Anotar fuera de turno:** se guarda en la ronda abierta y el turno sigue en quien le tocaba.
4. **Deshacer** borra la última anotación (y la ronda, si queda vacía).
5. **Fin por objetivo:** en modo ronda se comprueba al cerrar la ronda; en modo libre, al momento.
6. **Presupuesto:** el total es el saldo inicial menos lo pagado y la partida termina cuando alguien llega a 0.
7. **Ranking de competición:** 1, 1, 3. Ganan todos los que quedan primeros (empate).
8. **«Terminar partida ahora»:** gana quien vaya primero en ese momento y la partida se puede reabrir.
9. **Reabrir** se rechaza si se sigue cumpliendo la condición de fin. Corregir una ronda vuelve a evaluar el estado.
10. **Revancha:** mismo juego, mismos jugadores y mismos ajustes, con el marcador a cero.

## 5. Lo que no se pudo descubrir desde el navegador

No se ha inventado nada de esto. Se ha reconstruido de forma explícita y está documentado:

| Aspecto | Qué se hizo |
|---|---|
| Código del backend y base de datos | Backend nuevo (Express + SQLite) con la misma API observada. |
| «Crear ficha con IA»: proveedor, modelo y prompt | Opcional, con la API de Anthropic (`ANTHROPIC_API_KEY`). Sin clave se desactiva con un mensaje. |
| Importación de imágenes de BoardGameGeek | Opcional con `BGG_API_TOKEN` (la API XML de BGG exige token). Importa la imagen principal; la original obtenía 6 imágenes por un método no observable. |
| Regla exacta de los atajos +N | Se aplica la escala observada: objetivo ≤150 → +1 +5 +10; ~500 → +5 +10 +20 +50; ≥800 → +10 +50 +100 +200. |
| Avisos en juegos por nº de rondas o manuales | No se observó ninguno, así que no se muestra ninguno. |
| Texto de la regla en el modo «Manual» | No observado. Se usa «Sin límite: termina cuando decidáis». |
| Anotar dos veces al mismo jugador en una ronda abierta | No observado. Se suma a su anotación de esa ronda. |
| Nombre de los equipos y estadísticas por parejas | No observado. El equipo se llama «A y B» y las victorias cuentan para cada miembro. |
| Gramática de voz más allá de los ejemplos | Parser propio que cubre los ejemplos y variantes razonables (números en palabras, alias de juegos, nombres sin tildes). |
| Confirmación al borrar jugadores o partidas | No se probó en el original para no borrar sus datos. Aquí se pide confirmación dentro de la app. |
| Nombres de jugador duplicados | No observado. Se impiden, porque la voz identifica a los jugadores por su nombre. |

## 6. Diferencias deliberadas

- **Sushi Go!** mostraba «Fin al llegar a null puntos» (objetivo vacío con fin por objetivo). Aquí su fin es por 3 rondas y se muestra «Se juegan 3 rondas».
- Un juego creado por ti se puede **eliminar** desde su configuración (en el original solo se observó la opción de ocultar).
- El catálogo empieza **sin jugadores**: los jugadores del original son datos personales y no se incluyen.
- Las fotos subidas por el usuario en el original (Cubilete, Exploding Minions) no se incluyen. Esas fichas usan las imágenes públicas de BGG.
