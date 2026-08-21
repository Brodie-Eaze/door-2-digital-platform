'use client';

import { PartnerShell } from '@/components/PartnerShell';
import { Section, KpiCard } from '@d2d/ui-web';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CONVERSION_WEEKS, CONVERSION_SUMMARY } from '@/lib/fixtures';

const COLORS = {
  door: '#3B82F6',
  insideSales: '#0F172A',
  retargeting: '#94A3B8',
};

export default function ConversionsPage() {
  const totalConversions = CONVERSION_SUMMARY.reduce((a, c) => a + c.value, 0);

  return (
    <PartnerShell pageTitle="Conversions">
      <div className="space-y-6">
        <Section title="May 2026 — conversion attribution">
          <div className="grid grid-cols-3 gap-4">
            {CONVERSION_SUMMARY.map((cs) => {
              const pct = ((cs.value / totalConversions) * 100).toFixed(1);
              return (
                <KpiCard
                  key={cs.label}
                  label={cs.label}
                  value={cs.value.toLocaleString()}
                  hint={`${pct}% of total · ${cs.rake}% rake`}
                />
              );
            })}
          </div>
        </Section>

        <Section title="Weekly trend — door / inside-sales / retargeting">
          <div className="card p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={CONVERSION_WEEKS} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'var(--font-inter)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'var(--font-inter)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 12,
                    fontFamily: 'var(--font-inter)',
                  }}
                />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-inter)' }}
                />
                <Bar dataKey="door" name="Door" fill={COLORS.door} radius={[2, 2, 0, 0]} />
                <Bar
                  dataKey="insideSales"
                  name="Inside sales"
                  fill={COLORS.insideSales}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="retargeting"
                  name="Retargeting"
                  fill={COLORS.retargeting}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Attribution definitions">
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Door-closed (15% rake)',
                desc: 'Conversion completed at the door by a D2D knocker during a canvass session. Attribution is assigned at knock time; verified by signature capture.',
                color: COLORS.door,
              },
              {
                label: 'Inside-sales (10% rake)',
                desc: 'Prospect captured at the door but converted by the inside-sales team via follow-up call or SMS. Knocker retains origination credit.',
                color: COLORS.insideSales,
              },
              {
                label: 'Retargeting (5% rake)',
                desc: 'Prospect who did not convert at the door but was re-engaged via a Meta / Google / TikTok retargeting ad. Click attributed via UTM + hashed email match.',
                color: COLORS.retargeting,
              },
            ].map((item) => (
              <div key={item.label} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <p className="text-muted text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PartnerShell>
  );
}
