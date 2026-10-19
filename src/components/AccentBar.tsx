import React from 'react';

const CZECH_ACCENTS = [
  'á',
  'č',
  'ď',
  'é',
  'ě',
  'í',
  'ň',
  'ó',
  'ř',
  'š',
  'ť',
  'ú',
  'ů',
  'ý',
  'ž',
];

interface AccentBarProps {
  activeInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

/**
 * Inserts a Czech diacritic character into the currently focused input element
 * without blurring the input or dismissing the iOS virtual keyboard.
 */
export function insertTextIntoInput(input: HTMLInputElement, char: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const nextValue = input.value.slice(0, start) + char + input.value.slice(end);

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, nextValue);
  } else {
    input.value = nextValue;
  }

  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);

  const nextCursor = start + char.length;
  input.setSelectionRange(nextCursor, nextCursor);
  input.focus();
}

export const AccentBar: React.FC<AccentBarProps> = ({ activeInputRef }) => {
  const handleInsert = (char: string) => {
    const target =
      activeInputRef.current ||
      (document.activeElement instanceof HTMLInputElement ? document.activeElement : null);

    if (!target || target.disabled || target.readOnly) {
      return;
    }

    insertTextIntoInput(target, char);
  };

  return (
    <div
      className="w-full border-t px-2 py-1.5 select-none transition-colors"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="Czech diacritic characters"
    >
      <div className="max-w-5xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 shrink-0 hidden sm:inline"
          style={{ color: 'var(--text-muted)' }}
        >
          Háčky
        </span>
        {CZECH_ACCENTS.map((char) => (
          <button
            key={char}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              handleInsert(char);
            }}
            className="min-w-[34px] h-9 px-2 rounded-xl font-semibold text-base flex items-center justify-center transition-all border active:scale-95 shrink-0 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
