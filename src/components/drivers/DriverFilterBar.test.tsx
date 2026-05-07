import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverFilterBar } from './DriverFilterBar';
import type { DriverFilters } from '@/types/drivers';

const baseFilters: DriverFilters = {
  manufacturers: [],
  driverClasses: [],
  approvalStatuses: [],
  criticalities: [],
  affectsDevicesOnly: true,
  freeText: '',
};

describe('DriverFilterBar', () => {
  it('shows free-text input value and calls onChange when typing', () => {
    const onChange = vi.fn();
    render(
      <DriverFilterBar
        filters={baseFilters}
        onChange={onChange}
        manufacturers={['Dell Inc.']}
        driverClasses={['Video']}
        catalogAvailable
      />
    );
    const input = screen.getByPlaceholderText(/search drivers/i);
    fireEvent.change(input, { target: { value: 'graphics' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ freeText: 'graphics' }));
  });

  it('disables criticality filter when catalog unavailable', () => {
    render(
      <DriverFilterBar
        filters={baseFilters}
        onChange={() => {}}
        manufacturers={[]}
        driverClasses={[]}
        catalogAvailable={false}
      />
    );
    const trigger = screen.getByRole('button', { name: /criticality/i });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
  });

  it('toggles affectsDevicesOnly when the pill is clicked', () => {
    const onChange = vi.fn();
    render(
      <DriverFilterBar
        filters={baseFilters}
        onChange={onChange}
        manufacturers={[]}
        driverClasses={[]}
        catalogAvailable
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /affects devices/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ affectsDevicesOnly: false }));
  });
});
