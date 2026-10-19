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
      className="px-3 pb-2.5 select-none"
      aria-label="Czech diacritic keys"
    >
      <div className="max-w-md mx-auto rounded-full px-2.5 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar tr-pill-glass">
        {CZECH_ACCENTS.map((char) => (
          <button
            key={char}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              handleInsert(char);
            }}
            className="min-w-[30px] flex-1 h-[34px] px-1.5 font-medium text-[16px] leading-none flex items-center justify-center shrink-0 cursor-pointer tr-keycap"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
