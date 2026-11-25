import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Match } from '../lib/types';

/** Evolución de los totales ronda a ronda. */
export function ScoreChart({ match }: { match: Match }) {
  const data = match.chart.map((c) => ({ name: `R${c.round}`, ...c.totals }));
  return (
    <div className="card h-72 p-3 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#1e2235" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#11131d', border: '1px solid #2e3650', borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {match.players.map((p) => (
            <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
