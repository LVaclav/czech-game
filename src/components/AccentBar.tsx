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
      className="w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1.5 select-none"
      aria-label="Czech diacritic characters"
    >
      <div className="max-w-5xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider px-1.5 shrink-0 hidden sm:inline">
          Háčky & Čárky
        </span>
        {CZECH_ACCENTS.map((char) => (
          <button
            key={char}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              // Prevent focus loss on iOS Safari & desktop
              e.preventDefault();
              handleInsert(char);
            }}
            className="min-w-[34px] h-9 px-2 rounded-lg bg-slate-800 hover:bg-indigo-600/80 active:bg-indigo-500 active:scale-95 text-slate-100 font-semibold text-base flex items-center justify-center transition-all border border-slate-700/70 shadow-xs shrink-0 cursor-pointer"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
