import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { tenantWallClockToUtcIso, toTenantDatetimeLocal } from '../lib/tz';
import CorrectionModal from '../components/admin/CorrectionModal';
import type { CorrectionPayload } from '../lib/admin';

// The suite runs with process.env.TZ = 'Asia/Kolkata' (see src/test/setup.ts),
// i.e. a browser/device timezone that is deliberately NOT the tenant TimeTracker
// timezone (America/Chicago). These tests prove wall-clock handling ignores the
// device timezone and uses the tenant timezone the server provides.

const TENANT_TZ = 'America/Chicago';

describe('device timezone is different from the tenant timezone', () => {
  it('confirms the test browser is not in the tenant zone', () => {
    // Chicago is UTC-5 (CDT) / UTC-6 (CST): getTimezoneOffset would be 300/360.
    const offset = new Date('2026-09-14T12:00:00Z').getTimezoneOffset();
    expect(offset).not.toBe(300);
    expect(offset).not.toBe(360);
  });
});

describe('tenant wall-clock ⇄ UTC (tz-explicit, browser-independent)', () => {
  it('interprets an entered wall-clock time in the tenant timezone', () => {
    // 7:00 AM in Chicago (CDT, Sep) is 12:00 UTC — NOT 01:30 UTC (which is what
    // 7:00 AM in the device zone, Kolkata +5:30, would give).
    expect(tenantWallClockToUtcIso('2026-09-14T07:00', TENANT_TZ)).toBe('2026-09-14T12:00:00.000Z');
    expect(tenantWallClockToUtcIso('2026-09-14T07:00', 'Asia/Kolkata')).toBe('2026-09-14T01:30:00.000Z');
  });

  it('handles standard time (CST, winter) via DST-aware offset', () => {
    // 7:00 AM Chicago in January is CST (UTC-6) → 13:00 UTC.
    expect(tenantWallClockToUtcIso('2026-01-14T07:00', TENANT_TZ)).toBe('2026-01-14T13:00:00.000Z');
  });

  it('pre-fills a datetime-local from an instant in tenant wall-clock', () => {
    // 12:00 UTC shows as 07:00 in Chicago (not 17:30, the Kolkata rendering).
    expect(toTenantDatetimeLocal('2026-09-14T12:00:00Z', TENANT_TZ)).toBe('2026-09-14T07:00');
  });
});

describe('CorrectionModal submits the correct instant in the tenant timezone', () => {
  it('adjust: 7:00 AM tenant time → the 12:00 UTC instant, not a browser-local one', async () => {
    let submitted: CorrectionPayload | null = null;
    const onSubmit = vi.fn(async (p: CorrectionPayload) => {
      submitted = p;
    });

    render(
      <CorrectionModal
        draft={{ mode: 'adjust', eventId: 42, kindLabel: 'Clock In', effectiveAt: '2026-09-14T15:00:00Z' }}
        tz={TENANT_TZ}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    // The field is pre-filled in tenant time; set it explicitly to 07:00.
    const input = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-09-14T07:00' } });

    fireEvent.click(screen.getByRole('button', { name: /^Apply$/ }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(submitted!.type).toBe('adjust');
    expect(submitted!.event_id).toBe(42);
    // 7:00 AM America/Chicago = 12:00 UTC — proves tenant-tz conversion, not the
    // device zone (which would yield 01:30 UTC).
    expect(submitted!.effective_at).toBe('2026-09-14T12:00:00.000Z');
  });
});
