import React from 'react';
import { RefreshCw } from 'lucide-react';

export type PeriodMode = 'current' | 'previous' | 'custom';

interface Props {
  mode: PeriodMode;
  onModeChange: (m: PeriodMode) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

/**
 * Current / Previous / Custom pay-period selector, matching the Admin Time Review
 * controls. The canonical pay-period boundaries are resolved server-side; Custom
 * supplies explicit From/To dates. Purely presentational — it owns no data.
 */
const PeriodControls: React.FC<Props> = ({
  mode,
  onModeChange,
  from,
  to,
  onFromChange,
  onToChange,
  onRefresh,
  loading,
}) => (
  <div className="flex flex-wrap items-end gap-3">
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
      {(['current', 'previous', 'custom'] as PeriodMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
            mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {m === 'custom' ? 'Custom' : `${m} period`}
        </button>
      ))}
    </div>

    {mode === 'custom' && (
      <>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            aria-label="From"
            value={from}
            max={to}
            onChange={(e) => onFromChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            aria-label="To"
            value={to}
            min={from}
            onChange={(e) => onToChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </>
    )}

    <button
      onClick={onRefresh}
      disabled={loading || (mode === 'custom' && (!from || !to))}
      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      <span>Refresh</span>
    </button>
  </div>
);

export default PeriodControls;
