import type { RegistryElement } from '@shared/types';

interface Props {
  element: RegistryElement;
  onSubmit: (cmd: string) => void;
  buildCmd: (id: string) => string;
}

export default function ButtonWidget({ element, onSubmit, buildCmd }: Props) {
  return (
    <button
      className="widget-button"
      onClick={() => onSubmit(buildCmd(element.id))}
      data-testid={`widget-${element.id}`}
      aria-label={element.label}
    >
      {element.label}
    </button>
  );
}
