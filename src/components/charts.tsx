import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Activity, Units } from '../types';
import { addDays, dateLabel, fmtInt, fmtP, sod, unitL, unitM, weekStart } from '../lib/format';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, color: 'var(--ink)', boxShadow: 'var(--lift)', fontSize: 13 };

export function WeekSteps({ map, goal }: { map: Map<number, number>; goal: number }) {
  const today = sod(Date.now());
  const rows = Array.from({ length: 7 }, (_, i) => {
    const t = addDays(today, i - 6);
    return { t, label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), steps: map.get(t) || 0 };
  });
  return (
    <div className="h-40" role="img" aria-label={`Steps for the last 7 days: ${rows.map(r => `${dateLabel(r.t)} ${fmtInt(r.steps)}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, (max: number) => Math.max(max, goal * 1.15)]} />
          <Tooltip cursor={{ fill: 'var(--cobalt-soft)' }} contentStyle={tipStyle}
            labelFormatter={(_, p) => (p?.[0] ? dateLabel((p[0].payload as { t: number }).t) : '')} formatter={v => [fmtInt(Number(v)), 'steps']} />
          <ReferenceLine y={goal} stroke="var(--mango)" strokeDasharray="4 4" strokeWidth={1.5} />
          <Bar dataKey="steps" radius={[10, 10, 10, 10]} barSize={26} isAnimationActive={false}>
            {rows.map(r => <Cell key={r.t} fill={r.steps >= goal ? 'var(--mango)' : 'var(--bar-soft)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyDistance({ acts, units, weekGoal }: { acts: Activity[]; units: Units; weekGoal: number }) {
  const ws = weekStart(Date.now()), U = unitM(units);
  const rows = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(ws, (i - 7) * 7), e = addDays(s, 7);
    const d = acts.filter(a => a.start >= s && a.start < e).reduce((x, a) => x + a.distance, 0) / U;
    return { s, label: new Date(s).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), d: +d.toFixed(2), current: i === 7 };
  });
  return (
    <div className="h-44" role="img" aria-label={`Distance per week in ${unitL(units)}: ${rows.map(r => `${r.label} ${r.d}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} />
          <YAxis hide domain={[0, (max: number) => Math.max(max, weekGoal * 1.1, 1)]} />
          <Tooltip cursor={{ fill: 'var(--cobalt-soft)' }} contentStyle={tipStyle} labelFormatter={l => `Week of ${l}`} formatter={v => [`${v} ${unitL(units)}`, 'distance']} />
          {weekGoal > 0 && <ReferenceLine y={weekGoal} stroke="var(--cobalt)" strokeDasharray="4 4" strokeOpacity={0.6} />}
          <Bar dataKey="d" radius={[10, 10, 10, 10]} barSize={26} isAnimationActive={false}>
            {rows.map(r => <Cell key={r.s} fill={r.current ? 'var(--cobalt)' : 'var(--bar-soft)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaceTrend({ acts, units }: { acts: Activity[]; units: Units }) {
  const rows = acts.filter(a => a.distance >= 500 && a.duration > 0).slice(0, 12).reverse()
    .map(a => ({ t: a.start, label: new Date(a.start).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), pace: Math.round(a.duration / (a.distance / unitM(units))) }));
  if (rows.length < 2) return null;
  return (
    <div className="h-44" role="img" aria-label={`Average pace per ${unitL(units)}, oldest to newest: ${rows.map(r => fmtP(r.pace)).join(', ')}`}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} />
          {/* reversed: faster (smaller) pace sits higher */}
          <YAxis reversed width={44} axisLine={false} tickLine={false} domain={['dataMin - 15', 'dataMax + 15']} tickFormatter={v => fmtP(Number(v))} />
          <Tooltip contentStyle={tipStyle} labelFormatter={(_, p) => (p?.[0] ? dateLabel((p[0].payload as { t: number }).t) : '')} formatter={v => [`${fmtP(Number(v))} /${unitL(units)}`, 'pace']} />
          <Line dataKey="pace" stroke="var(--cobalt)" strokeWidth={3} dot={{ r: 4, fill: 'var(--surface)', strokeWidth: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
