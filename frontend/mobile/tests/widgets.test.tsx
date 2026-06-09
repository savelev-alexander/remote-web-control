import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ButtonWidget from '../src/widgets/ButtonWidget';
import InputWidget from '../src/widgets/InputWidget';
import SelectWidget from '../src/widgets/SelectWidget';
import ToggleWidget from '../src/widgets/ToggleWidget';
import SliderWidget from '../src/widgets/SliderWidget';
import { buildClickCmd, buildInputCmd, buildSelectCmd, buildToggleCmd, buildSlideCmd } from '@shared/api';
import type { RegistryElement } from '@shared/types';

function btn(id: string, label = 'Click', kind: RegistryElement['kind'] = 'button'): RegistryElement {
  return { id, kind, label };
}

describe('widgets', () => {
  it('ButtonWidget emits CLICK on tap', () => {
    const onSubmit = vi.fn();
    render(<ButtonWidget element={btn('btn-buy', 'Buy')} onSubmit={onSubmit} buildCmd={buildClickCmd} />);
    fireEvent.click(screen.getByText('Buy'));
    expect(onSubmit).toHaveBeenCalledWith('CLICK:btn-buy');
  });

  it('InputWidget emits INPUT on send', () => {
    const onSubmit = vi.fn();
    const el: RegistryElement = { id: 'name', kind: 'input', label: 'Name' };
    render(<InputWidget element={el} onSubmit={onSubmit} buildCmd={buildInputCmd} />);
    fireEvent.change(screen.getByTestId('widget-name-input'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByTestId('widget-name-send'));
    expect(onSubmit).toHaveBeenCalledWith('INPUT:name:Alice');
  });

  it('SelectWidget emits SELECT on change', () => {
    const onSubmit = vi.fn();
    const el: RegistryElement = { id: 'size', kind: 'select', label: 'Size', options: ['S', 'M', 'L'] };
    render(<SelectWidget element={el} onSubmit={onSubmit} buildCmd={buildSelectCmd} />);
    fireEvent.change(screen.getByTestId('widget-size'), { target: { value: 'M' } });
    expect(onSubmit).toHaveBeenCalledWith('SELECT:size:M');
  });

  it('ToggleWidget emits TOGGLE on click', () => {
    const onSubmit = vi.fn();
    const el: RegistryElement = { id: 'dark', kind: 'toggle', label: 'Dark' };
    render(<ToggleWidget element={el} onSubmit={onSubmit} buildCmd={buildToggleCmd} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onSubmit).toHaveBeenCalledWith('TOGGLE:dark:true');
    fireEvent.click(screen.getByRole('switch'));
    expect(onSubmit).toHaveBeenCalledWith('TOGGLE:dark:false');
  });

  it('SliderWidget emits SLIDE on pointerup', () => {
    const onSubmit = vi.fn();
    const el: RegistryElement = { id: 'vol', kind: 'slider', label: 'Vol', min: 0, max: 100, step: 5 };
    render(<SliderWidget element={el} onSubmit={onSubmit} buildCmd={buildSlideCmd} />);
    const input = screen.getByTestId('widget-vol');
    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.pointerUp(input);
    expect(onSubmit).toHaveBeenCalledWith('SLIDE:vol:75');
  });

  it('SliderWidget does NOT emit on mid-drag change', () => {
    const onSubmit = vi.fn();
    const el: RegistryElement = { id: 'vol', kind: 'slider', label: 'Vol', min: 0, max: 100 };
    render(<SliderWidget element={el} onSubmit={onSubmit} buildCmd={buildSlideCmd} />);
    fireEvent.change(screen.getByTestId('widget-vol'), { target: { value: '30' } });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('SliderWidget snaps the initial midpoint to the step grid', () => {
    const onSubmit = vi.fn();
    const el: RegistryElement = { id: 'vol', kind: 'slider', label: 'Vol', min: 0, max: 10, step: 3 };
    render(<SliderWidget element={el} onSubmit={onSubmit} buildCmd={buildSlideCmd} />);
    expect(screen.getByTestId('widget-vol-value').textContent).toBe('6');
  });

  it('SliderWidget resyncs the value when min/max change for the same id', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <SliderWidget element={{ id: 'vol', kind: 'slider', label: 'Vol', min: 0, max: 100 }}
                    onSubmit={onSubmit} buildCmd={buildSlideCmd} />);
    expect(screen.getByTestId('widget-vol-value').textContent).toBe('50');
    rerender(
      <SliderWidget element={{ id: 'vol', kind: 'slider', label: 'Vol', min: 0, max: 10 }}
                    onSubmit={onSubmit} buildCmd={buildSlideCmd} />);
    expect(screen.getByTestId('widget-vol-value').textContent).toBe('5');
  });
});
