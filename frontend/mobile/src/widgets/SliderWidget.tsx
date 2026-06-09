import { useEffect, useState } from 'react';
import type { RegistryElement } from '@shared/types';

interface Props {
  element: RegistryElement;
  onSubmit: (cmd: string) => void;
  buildCmd: (id: string, value: number) => string;
}

function snapToStep(v: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((v - min) / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(clamped.toFixed(10));
}

export default function SliderWidget({ element, onSubmit, buildCmd }: Props) {
  const min = element.min ?? 0;
  const max = element.max ?? 100;
  const step = element.step ?? 1;
  const [value, setValue] = useState(() => snapToStep((min + max) / 2, min, max, step));

  useEffect(() => {
    setValue(snapToStep((min + max) / 2, min, max, step));
  }, [min, max, step]);

  return (
    <div className="widget-slider">
      <div className="widget-slider-row">
        <label htmlFor={`w-${element.id}`}>{element.label}</label>
        <span className="widget-slider-value" data-testid={`widget-${element.id}-value`}>{value}</span>
      </div>
      <input
        id={`w-${element.id}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={`widget-${element.id}`}
        onChange={e => setValue(Number(e.target.value))}
        onPointerUp={() => onSubmit(buildCmd(element.id, value))}
        onKeyUp={() => onSubmit(buildCmd(element.id, value))}
      />
    </div>
  );
}
