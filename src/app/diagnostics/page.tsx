'use client';

import { useEffect, useState } from 'react';

type Recommendation = {
  action: string;
  expectedImpact: 'low' | 'medium' | 'high';
  reason: string;
  howTo: string;
};

export default function DiagnosticsPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6">📊 Diagnostics</h1>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-xl font-semibold mb-2">Waiting for data</h2>
        <p className="text-gray-300">
          Diagnostics API isn’t connected yet. Once the backend is added, this page will show:
        </p>
        <ul className="mt-3 list-disc list-inside text-gray-400">
          <li>“Why Today?” quick summary</li>
          <li>Views vs baseline trend</li>
          <li>Best-time heatmap</li>
          <li>Feature shifts (caption, hashtags, hooks)</li>
          <li>Ranked action steps before you post</li>
        </ul>
      </div>
    </main>
  );
}
