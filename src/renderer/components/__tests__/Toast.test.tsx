import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastContainer, useToast } from '../Toast';
import React from 'react';

function TestComponent() {
  const { addToast, toasts } = useToast();
  return (
    <>
      <button onClick={() => addToast({ type: 'success', title: 'Order Filled', message: 'AAPL x5 filled at $178.25' })}>
        Add Toast
      </button>
      <ToastContainer toasts={toasts} />
    </>
  );
}

describe('Toast', () => {
  it('renders toast when added', () => {
    render(<TestComponent />);
    act(() => { screen.getByText('Add Toast').click(); });
    expect(screen.getByText('Order Filled')).toBeDefined();
    expect(screen.getByText('AAPL x5 filled at $178.25')).toBeDefined();
  });

  it('applies correct class for toast type', () => {
    render(<TestComponent />);
    act(() => { screen.getByText('Add Toast').click(); });
    const toast = screen.getByText('Order Filled').closest('.toast');
    expect(toast?.classList.contains('toast-success')).toBe(true);
  });
});
