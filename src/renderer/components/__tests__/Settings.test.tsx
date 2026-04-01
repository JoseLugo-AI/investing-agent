import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Settings } from '../Settings';

describe('Settings', () => {
  it('renders API key inputs', () => {
    render(<Settings onSave={vi.fn()} onClear={vi.fn()} hasKeys={false} />);
    expect(screen.getByPlaceholderText('API Key ID (PK...)')).toBeDefined();
    expect(screen.getByPlaceholderText('Secret Key (SK...)')).toBeDefined();
  });

  it('calls onSave with key values', () => {
    const onSave = vi.fn();
    render(<Settings onSave={onSave} onClear={vi.fn()} hasKeys={false} />);

    fireEvent.change(screen.getByPlaceholderText('API Key ID (PK...)'), {
      target: { value: 'PKTEST' },
    });
    fireEvent.change(screen.getByPlaceholderText('Secret Key (SK...)'), {
      target: { value: 'SKTEST' },
    });
    fireEvent.click(screen.getByText('Save Keys'));

    expect(onSave).toHaveBeenCalledWith('PKTEST', 'SKTEST');
  });

  it('shows connected state when keys exist', () => {
    render(<Settings onSave={vi.fn()} onClear={vi.fn()} hasKeys={true} />);
    expect(screen.getByText('Connected to Alpaca Paper Trading')).toBeDefined();
  });

  it('shows Claude connected via Claude Code', () => {
    render(<Settings onSave={vi.fn()} onClear={vi.fn()} hasKeys={true} />);
    expect(screen.getByText('Claude AI connected via Claude Code')).toBeInTheDocument();
  });

  it('shows risk limits section', () => {
    render(<Settings onSave={vi.fn()} onClear={vi.fn()} hasKeys={true} />);
    expect(screen.getByText('Risk Limits')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
