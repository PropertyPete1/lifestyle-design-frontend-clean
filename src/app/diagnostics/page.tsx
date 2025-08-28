'use client';

import { useEffect, useState } from 'react';

type Recommendation = {
  action: string;
  expectedImpact: 'low' | 'medium' | 'high';
  reason: string;
  howTo: string;
};

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    setReport({
      todaySummary: 'Your captions are shorter than usual; posts at 6–7pm perform 30% better.',
      deltas: { medianViews: 3200, medianViewsChangePct: -45 },
      topFeatureShifts: [
        { feature: 'Caption length', baselineValue: 220, currentValue: 90, change: '-59%' },
        { feature: 'Trending audio usage', baselineValue: '4/week', currentValue: '0/week', change: '-100%' }
      ],
      rankedRecommendations: [
        { action: 'Increase captions back to 200+ chars', expectedImpact: 'high', reason: 'Longer captions correlated with 40% higher reach', howTo: 'Add 2–3 sentences of story/context' },
        { action: 'Reintroduce trending audio 3–4x/week', expectedImpact: 'high', reason: 'Trending audios boosted reach in baseline era', howTo: 'Enable audio toggle in Settings' },
        { action: 'Shift some posts to Tue/Thu evenings', expectedImpact: 'medium', reason: 'Your best historic slots were Tue/Thu 7–9pm', howTo: 'Schedule next post in Smart Scheduler' }
      ] as Recommendation[]
    });
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6 drop-shadow-[0_0_10px_#00eaff]">📊 Diagnostics Report</h1>
      {loading && <p>Loading…</p>}
      {!loading && report && (
        <div className="space-y-6">Sections…</div>
      )}
    </div>
  );
}
