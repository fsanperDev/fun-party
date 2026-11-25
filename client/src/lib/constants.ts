export const PLAYER_COLORS = [
  { name: 'Violeta', hex: '#8B5CF6' },
  { name: 'Esmeralda', hex: '#10B981' },
  { name: 'Rubí', hex: '#F43F5E' },
  { name: 'Ámbar', hex: '#F59E0B' },
  { name: 'Cian', hex: '#06B6D4' },
  { name: 'Naranja', hex: '#F97316' },
  { name: 'Índigo', hex: '#6366F1' },
  { name: 'Lima', hex: '#84CC16' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Turquesa', hex: '#14B8A6' },
  { name: 'Amarillo', hex: '#EAB308' },
  { name: 'Cielo', hex: '#0EA5E9' },
  { name: 'Rojo', hex: '#EF4444' },
  { name: 'Fucsia', hex: '#D946EF' },
  { name: 'Plata', hex: '#94A3B8' },
  { name: 'Bronce', hex: '#A16207' },
];

export const PLAYER_AVATARS = [
  '🦊', '🦁', '🐼', '🦄', '🐯', '🐲', '👽', '🥷',
  '👑', '🧙‍♂️', '🃏', '🤖', '🐱', '🐻', '🦉', '⭐',
  '🐸', '🐵', '🐧', '🦖', '🐙', '🦈', '🍕', '🎲',
  '👻', '🤠', '🧛', '🐨', '🦋', '🌵', '🍩', '🚀',
];

export const GAME_EMOJIS = ['🎴', '🃏', '🎲', '🂡', '🔴', '🟢', '🔵', '⭐', '🔥', '🍀', '🎯', '🏆', '🧠', '🐉', '🍣', '💎'];

export const CONFETTI = ['🎉', '✨', '🎊', '⭐', '🃏', '🏆'];

/** Comandos de voz tal cual se documentan en Ajustes › Voz de la app original. */
export const VOICE_HELP: { title: string; syntax: string; examples: string[] }[] = [
  {
    title: 'Anotar puntuación',
    syntax: '<Juego>, <Jugador>, <Puntos> puntos',
    examples: ['La Cuenta, Pablo, 100 puntos', 'Skyjo, Alejandro, 50 puntos', 'Skyjo, Mariló, menos 3 puntos'],
  },
  {
    title: 'Anotar en la partida abierta',
    syntax: '<Jugador>, <Puntos> puntos',
    examples: ['Diego, 12 puntos (dentro de la pantalla de una partida)'],
  },
  {
    title: 'Crear partida',
    syntax: '[Fun Party,] crea una partida de <Juego> [para N jugadores] [con los jugadores habituales]',
    examples: [
      'Créame una partida de Skyjo con los jugadores habituales',
      'Nueva partida de La Cuenta para 4 jugadores',
      'Vamos a jugar a UNO (también vale empezando por «Fun Party»)',
    ],
  },
  {
    title: 'Finalizar partida',
    syntax: 'Finalizar partida',
    examples: ['Finalizar partida', 'Terminar la partida (termina la partida abierta y anuncia al ganador)'],
  },
  { title: 'Deshacer', syntax: 'Deshacer', examples: ['Deshacer (borra la última puntuación)'] },
  {
    title: 'Siguiente jugador',
    syntax: 'Siguiente jugador',
    examples: ['Siguiente jugador (pasa el turno; en juegos por ronda anota 0)'],
  },
  { title: '¿Quién gana?', syntax: '¿Quién gana?', examples: ['¿Quién va ganando? (te lo dice en voz alta)'] },
  { title: 'Ver resumen / normas', syntax: 'Resumen · Normas', examples: ['Resumen', 'Normas'] },
];
