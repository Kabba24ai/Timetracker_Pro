import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CorrectionModal, { CorrectionDraft } from '../components/admin/CorrectionModal';
import type { CorrectionPayload } from '../lib/admin';

// Proves the FRONTEND half of the correction round trip: the admin's tenant-local
// wall-clock entry is serialized to the correct UTC instant for the API. Combined
// with the backend TimezoneCorrectionRoundTripTest (which proves the instant is
// stored and returned unchanged and renders back to the same wall time), this
// guards against the +5h America/Chicago jump end to end.

async function applyAdjust(tz: string, time24: string): Promise<CorrectionPayload> {
  let captured: CorrectionPayload | null = null;
  const onSubmit = vi.fn(async (p: CorrectionPayload) => {
    captured = p;
  });
  const draft: CorrectionDraft = {
    mode: 'adjust',
    eventId: 42,
    kind: 'clock_out',
    kindLabel: 'Clock Out',
    date: '2026-08-20',
    time24,
  };
  render(<CorrectionModal draft={draft} tz={tz} onClose={() => {}} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /^Apply$/ }));
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return captured as unknown as CorrectionPayload;
}

describe('CorrectionModal — tenant-tz serialization (Bug 2)', () => {
  it('6:02 PM America/Chicago serializes to 23:02Z (the +5h-jump guard)', async () => {
    const p = await applyAdjust('America/Chicago', '18:02');
    expect(p.type).toBe('adjust');
    // 6:02 PM CDT (UTC-5) → 23:02 UTC. Never 04:02Z (double-convert) or a naive string.
    expect((p as { effective_at: string }).effective_at).toBe('2026-08-20T23:02:00.000Z');
    // And it round-trips back to 6:02 PM when displayed in the tenant zone.
    expect(
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(
        new Date((p as { effective_at: string }).effective_at),
      ),
    ).toBe('6:02 PM');
  });

  it('12:05 AM America/Chicago serializes to 05:05Z', async () => {
    const p = await applyAdjust('America/Chicago', '00:05');
    expect((p as { effective_at: string }).effective_at).toBe('2026-08-20T05:05:00.000Z');
  });

  it('12:05 PM America/Chicago serializes to 17:05Z', async () => {
    const p = await applyAdjust('America/Chicago', '12:05');
    expect((p as { effective_at: string }).effective_at).toBe('2026-08-20T17:05:00.000Z');
  });

  it('interpretation follows the tenant tz, not UTC (same wall clock differs on the wire)', async () => {
    const utc = await applyAdjust('UTC', '18:02');
    expect((utc as { effective_at: string }).effective_at).toBe('2026-08-20T18:02:00.000Z');
    const chicago = await applyAdjust('America/Chicago', '18:02');
    expect((chicago as { effective_at: string }).effective_at).toBe('2026-08-20T23:02:00.000Z');
  });
});
