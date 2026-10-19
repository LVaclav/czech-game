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

/**
 * Authentic iOS Keyboard Accessory Row (#D1D5DB tray with #FFFFFF 5px-radius keycaps)
 */
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
      className="w-full px-1.5 py-1.5 select-none ios-keyboard-tray"
      aria-label="Czech diacritic keyboard keys"
    >
      <div className="max-w-xl mx-auto flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
        {CZECH_ACCENTS.map((char) => (
          <button
            key={char}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              handleInsert(char);
            }}
            className="min-w-[31px] flex-1 h-[38px] px-1 font-normal text-[18px] leading-none flex items-center justify-center shrink-0 cursor-pointer ios-keycap"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
