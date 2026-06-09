import type { RegistryElement } from '@shared/types';

interface Props {
  element: RegistryElement;
  onSubmit: (cmd: string) => void;
  buildCmd: (id: string, value: string) => string;
}

export default function SelectWidget({ element, onSubmit, buildCmd }: Props) {
  const options = element.options ?? [];
  return (
    <div className="widget-select">
      <label htmlFor={`w-${element.id}`}>{element.label}</label>
      <select
        id={`w-${element.id}`}
        data-testid={`widget-${element.id}`}
        defaultValue=""
        onChange={e => { if (e.target.value) onSubmit(buildCmd(element.id, e.target.value)); }}
      >
        <option value="" disabled>— выбрать —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
