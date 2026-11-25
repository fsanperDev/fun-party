import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let app: ReturnType<typeof createApp>['app'];

beforeEach(() => {
  app = createApp({ dbFile: ':memory:' }).app;
});

async function makePlayers(...names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const r = await request(app).post('/api/players').send({ name, favorite: true });
    expect(r.status).toBe(200);
    ids.push(r.body.id);
  }
  return ids;
}

describe('API', () => {
  it('siembra los 20 juegos del catálogo (4 ocultos)', async () => {
    const r = await request(app).get('/api/games');
    expect(r.body).toHaveLength(20);
    expect(r.body.filter((g: { hidden: boolean }) => g.hidden)).toHaveLength(4);
    expect(r.body[0].name).toBe('Skyjo');
  });

  it('crea jugadores con color libre y avatar por defecto, sin nombres duplicados', async () => {
    const a = await request(app).post('/api/players').send({ name: 'Alejandro', color: '#0EA5E9' });
    const b = await request(app).post('/api/players').send({ name: 'Prueba' });
    expect(b.body.avatar).toBe('🃏');
    expect(b.body.color).toBe('#8B5CF6');
    expect(a.body.favorite).toBe(false);
    const dup = await request(app).post('/api/players').send({ name: 'alejandro' });
    expect(dup.status).toBe(400);
  });

  it('reordena habituales', async () => {
    const [a, b, c] = await makePlayers('A', 'B', 'C');
    const r = await request(app).put('/api/players/order').send({ ids: [c, a, b] });
    expect(r.body.map((p: { name: string }) => p.name)).toEqual(['C', 'A', 'B']);
  });

  it('usa el presupuesto según el nº de jugadores en La Cuenta', async () => {
    const ids = await makePlayers('A', 'B', 'C');
    const r = await request(app).post('/api/matches').send({ game_id: 'la-cuenta', players: ids });
    expect(r.status).toBe(200);
    expect(r.body.settings.start_score).toBe(900);
    expect(r.body.totals[ids[0]]).toBe(900);
  });

  it('respeta el mínimo de jugadores', async () => {
    const ids = await makePlayers('A', 'B');
    const r = await request(app).post('/api/matches').send({ game_id: 'flip7', players: ids });
    expect(r.status).toBe(400);
    expect(r.body.detail).toBe('Mínimo 3 jugadores');
  });

  it('flujo completo: anotar, ronda, editar, terminar, revancha, estadísticas', async () => {
    const [a, f] = await makePlayers('Alejandro', 'Fran');
    const m = (await request(app).post('/api/matches').send({ game_id: 'skyjo', players: [a, f] })).body;
    let r = await request(app).post(`/api/matches/${m.id}/scores`).send({ player_id: a, value: 60 });
    expect(r.body.current_player_id).toBe(f);
    r = await request(app).post(`/api/matches/${m.id}/scores`).send({ player_id: f, value: 10 });
    expect(r.body.current_round).toBe(2);
    r = await request(app)
      .post(`/api/matches/${m.id}/rounds`)
      .send({ entries: [{ player_id: a, value: 45 }, { player_id: f, value: '' }] });
    expect(r.body.status).toBe('active');
    expect(r.body.round_complete).toBe(false);
    r = await request(app).post(`/api/matches/${m.id}/scores`).send({ player_id: f, value: 5 });
    expect(r.body.status).toBe('finished');
    expect(r.body.winner_ids).toEqual([f]);
    r = await request(app).post(`/api/matches/${m.id}/reopen`);
    expect(r.status).toBe(400);
    const rid = r.body ? (await request(app).get(`/api/matches/${m.id}`)).body.rounds[1].id : '';
    r = await request(app).put(`/api/matches/${m.id}/rounds/${rid}`).send({ entries: [{ player_id: a, value: 1 }, { player_id: f, value: 5 }] });
    expect(r.body.status).toBe('active');
    r = await request(app).post(`/api/matches/${m.id}/finish`);
    expect(r.body.manually_finished).toBe(true);
    const re = await request(app).post(`/api/matches/${m.id}/rematch`);
    expect(re.body.rounds).toEqual([]);
    expect(re.body.status).toBe('active');
    const s = (await request(app).get('/api/stats')).body;
    expect(s.finished_matches).toBe(1);
    expect(s.active_matches).toBe(1);
    expect(s.players[0].name).toBe('Fran');
    expect(s.players[0].wins).toBe(1);
    expect(s.recent[0].winner_names).toEqual(['Fran']);
  });

  it('reiniciar y deshacer el reinicio de estadísticas', async () => {
    const [a, f] = await makePlayers('A', 'B');
    const m = (await request(app).post('/api/matches').send({ game_id: 'skyjo', players: [a, f] })).body;
    await request(app).post(`/api/matches/${m.id}/finish`);
    let s = (await request(app).post('/api/stats/reset')).body;
    expect(s.finished_matches).toBe(0);
    expect(s.can_undo_reset).toBe(true);
    s = (await request(app).post('/api/stats/reset/undo')).body;
    expect(s.finished_matches).toBe(1);
    expect(s.reset_at).toBeNull();
  });

  it('crea partidas por parejas', async () => {
    const ids = await makePlayers('A', 'B', 'C', 'D');
    const r = await request(app)
      .post('/api/matches')
      .send({ game_id: 'uno-team', players: ids, teams: [[ids[0], ids[2]], [ids[1], ids[3]]] });
    expect(r.body.players).toHaveLength(2);
    expect(r.body.players[0].name).toBe('A y C');
    expect(r.body.players[0].member_ids).toEqual([ids[0], ids[2]]);
  });

  it('edita y restablece los parámetros oficiales de un juego', async () => {
    let r = await request(app).put('/api/games/skyjo').send({ target_score: 50, hidden: true });
    expect(r.body.target_score).toBe(50);
    r = await request(app).post('/api/games/skyjo/reset');
    expect(r.body.target_score).toBe(100);
    expect(r.body.hidden).toBe(true);
  });

  it('la IA sin clave responde 503 con un mensaje claro', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await request(app).post('/api/games/ai').send({ name: 'Dobble' });
    expect(r.status).toBe(503);
  });
});
