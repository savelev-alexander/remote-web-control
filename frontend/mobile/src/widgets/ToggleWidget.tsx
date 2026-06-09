import { useState } from 'react';
import type { RegistryElement } from '@shared/types';

interface Props {
  element: RegistryElement;
  onSubmit: (cmd: string) => void;
  buildCmd: (id: string, value: boolean) => string;
}

export default function ToggleWidget({ element, onSubmit, buildCmd }: Props) {
  const [on, setOn] = useState(false);
  return (
    <label className="widget-toggle" data-testid={`widget-${element.id}`}>
      <span className="widget-toggle-label">{element.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={`widget-switch ${on ? 'on' : 'off'}`}
        onClick={() => { const next = !on; setOn(next); onSubmit(buildCmd(element.id, next)); }}
      >
        <span className="widget-switch-knob" />
      </button>
    </label>
  );
}
