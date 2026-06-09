import { useState } from 'react';
import type { RegistryElement } from '@shared/types';

interface Props {
  element: RegistryElement;
  onSubmit: (cmd: string) => void;
  buildCmd: (id: string, value: string) => string;
}

export default function InputWidget({ element, onSubmit, buildCmd }: Props) {
  const [value, setValue] = useState('');
  return (
    <div className="widget-input">
      <label htmlFor={`w-${element.id}`}>{element.label}</label>
      <div className="widget-input-row">
        <input
          id={`w-${element.id}`}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          data-testid={`widget-${element.id}-input`}
          placeholder="Введите значение…"
        />
        <button
          type="button"
          className="widget-send"
          onClick={() => { onSubmit(buildCmd(element.id, value)); }}
          disabled={!value.length}
          data-testid={`widget-${element.id}-send`}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
