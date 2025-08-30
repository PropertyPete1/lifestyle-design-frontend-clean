"use client";
import { useEffect, useState } from "react";

type Shift = { feature:string; baselineValue:number|string; currentValue:number|string; change:string };
type Rec = { action:string; expectedImpact:'low'|'medium'|'high'; reason:string; howTo:string };

interface Report {
  todaySummary?: string;
  deltas?: { medianPlays?: number; medianPlaysChangePct?: number; frequencyPerWeekBaseline:number; frequencyPerWeekCurrent:number };
  byTimeHeatmap?: Array<{ dow:number; hour:number; medianPlays?: number; count:number }>;
  topFeatureShifts?: Shift[];
  correlations?: Array<{ feature:string; withMedian?: number; withoutMedian?: number; liftPct?: number }>;
  rankedRecommendations?: Rec[];
}

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report|null>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/api/diagnostics/report?platform=instagram&days=90`;
        const res = await fetch(url);
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}${txt ? ' – ' + txt : ''}`);
        }
        const data = await res.json();
        setReport(data);
      } catch (e:any) {
        setError(e.message || "Failed to load diagnostics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cellColor = (v?: number) => {
    if (v == null) return "bg-gray-800";
    if (v > 15000) return "bg-green-600/70";
    if (v > 10000) return "bg-green-600/50";
    if (v > 5000)  return "bg-yellow-600/60";
    if (v > 2500)  return "bg-orange-600/50";
    return "bg-gray-700/70";
  };

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6 drop-shadow-[0_0_10px_rgba(0,234,255,0.35)]">📊 Diagnostics</h1>

      {loading && <p>Loading…</p>}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 p-6 text-red-100 whitespace-pre-wrap">{error}</div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xl font-semibold mb-1">Why Today?</h2>
            <p className="text-gray-300">{report.todaySummary || "—"}</p>
            <div className="mt-3 text-sm text-gray-400">
              <span className="mr-4">Median plays: <b>{report.deltas?.medianPlays ?? "—"}</b></span>
              <span>Change vs baseline: <b>{report.deltas?.medianPlaysChangePct ?? "—"}%</b></span>
            </div>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xl font-semibold mb-3">Best Time Heatmap (median plays)</h2>
            <div className="grid" style={{gridTemplateColumns:"80px repeat(24,minmax(16px,1fr))",gap:6}}>
              <div></div>
              {Array.from({length:24}).map((_,h)=>(<div key={h} className="text-xs text-gray-400 text-center">{h}</div>))}
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label,dow)=> (
                <>
                  <div className="text-xs text-gray-400">{label}</div>
                  {Array.from({length:24}).map((_,h)=>{
                    const cell = report.byTimeHeatmap?.find(c=>c.dow===dow && c.hour===h);
                    return <div key={`${dow}-${h}`} className={`h-5 rounded ${cellColor(cell?.medianPlays)}`} title={`${label} ${h}:00 — ${cell?.medianPlays ?? 0} median`} />;
                  })}
                </>
              ))}
            </div>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xl font-semibold mb-2">What Changed (Baseline → Current)</h2>
            <ul className="space-y-1 text-gray-300">
              {report.topFeatureShifts?.map((s,i)=> (
                <li key={i} className="flex justify-between border-b border-gray-800/50 py-2">
                  <span>{s.feature}</span>
                  <span className="text-gray-400">{String(s.baselineValue)} → {String(s.currentValue)} ({s.change})</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xl font-semibold mb-2">What Moves Views</h2>
            {(!report.correlations || report.correlations.length===0) ? (
              <p className="text-gray-400">No correlation signals detected in the current window.</p>
            ) : (
              <ul className="space-y-2">
                {report.correlations?.map((c,i)=> (
                  <li key={i} className="flex items-center justify-between border-b border-gray-800/50 pb-2">
                    <span className="text-gray-200">{c.feature}</span>
                    <span className="text-xs text-gray-400">
                      with: <b>{c.withMedian ?? '—'}</b> vs without: <b>{c.withoutMedian ?? '—'}</b>
                      {typeof c.liftPct==='number' && (
                        <span className={`ml-3 px-2 py-0.5 rounded ${c.liftPct>=0?'bg-green-700/50':'bg-red-700/50'}`}>{c.liftPct>=0?'+':''}{c.liftPct}%</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xl font-semibold mb-2">Do This Next</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {report.rankedRecommendations?.map((r,i)=> (
                <div key={i} className="border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{r.action}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${r.expectedImpact==='high'?'bg-pink-700/60':r.expectedImpact==='medium'?'bg-yellow-700/60':'bg-gray-700/60'}`}>{r.expectedImpact}</span>
                  </div>
                  <p className="text-gray-300 mt-2">{r.reason}</p>
                  <p className="text-gray-400 text-sm mt-1 italic">{r.howTo}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
