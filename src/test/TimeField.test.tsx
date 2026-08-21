import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeField, { Clock } from '../components/admin/TimeField';

// Controlled harness mirroring real usage: state holds the Clock, TimeField edits
// it. The readout exposes the committed numeric value so we assert the PARENT
// value, not just the input text.
function Harness({ initial }: { initial: Clock }) {
  const [c, setC] = useState<Clock>(initial);
  return (
    <div>
      <TimeField value={c} onChange={setC} label="Test" />
      <span data-testid="readout">
        {c.h}:{String(c.m).padStart(2, '0')} {c.ampm}
      </span>
    </div>
  );
}

const minuteOf = () => screen.getByLabelText('Test Minute') as HTMLInputElement;
const hourOf = () => screen.getByLabelText('Test Hour') as HTMLInputElement;

describe('TimeField — two-digit entry (Bug 1)', () => {
  it('typing 27 into a field showing 02 yields 27, not 02', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 6, m: 2, ampm: 'PM' }} />);
    expect(minuteOf().value).toBe('02'); // padded while idle
    await user.click(minuteOf());
    await user.keyboard('27');
    expect(minuteOf().value).toBe('27');
    expect(screen.getByTestId('readout').textContent).toContain(':27');
  });

  it('typing 05 yields 05', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 9, m: 0, ampm: 'AM' }} />);
    await user.click(minuteOf());
    await user.keyboard('05');
    expect(minuteOf().value).toBe('05');
    expect(screen.getByTestId('readout').textContent).toContain(':05');
  });

  it('typing 59 yields 59', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 9, m: 0, ampm: 'AM' }} />);
    await user.click(minuteOf());
    await user.keyboard('59');
    expect(minuteOf().value).toBe('59');
  });

  it('a single intermediate digit is NOT auto-padded during entry', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 9, m: 0, ampm: 'AM' }} />);
    await user.click(minuteOf());
    await user.keyboard('2');
    expect(minuteOf().value).toBe('2'); // not "02"
  });

  it('normalizes to two digits on blur', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 9, m: 0, ampm: 'AM' }} />);
    await user.click(minuteOf());
    await user.keyboard('5');
    expect(minuteOf().value).toBe('5');
    await user.tab(); // blur
    expect(minuteOf().value).toBe('05');
    expect(screen.getByTestId('readout').textContent).toContain(':05');
  });

  it('rejects an out-of-range 60+ minute (clamped to 59 on blur)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 9, m: 0, ampm: 'AM' }} />);
    await user.click(minuteOf());
    await user.keyboard('60');
    await user.tab();
    expect(minuteOf().value).toBe('59');
    expect(screen.getByTestId('readout').textContent).toContain(':59');
  });

  it('hour supports natural two-digit replacement (11)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 6, m: 2, ampm: 'PM' }} />);
    await user.click(hourOf());
    await user.keyboard('11');
    expect(hourOf().value).toBe('11');
    expect(screen.getByTestId('readout').textContent).toContain('11:');
  });

  it('supports Tab navigation Hour → Minute → AM/PM', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 6, m: 2, ampm: 'PM' }} />);
    hourOf().focus();
    expect(document.activeElement).toBe(hourOf());
    await user.tab();
    expect(document.activeElement).toBe(minuteOf());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Test AM/PM'));
  });

  it('mouse-click editing replaces the value naturally', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ h: 6, m: 2, ampm: 'PM' }} />);
    await user.click(minuteOf()); // mouse focus
    await user.keyboard('45');
    expect(minuteOf().value).toBe('45');
  });
});
