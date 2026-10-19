import React, { useEffect, useState } from 'react';

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
  onKeyboardStateChange?: (isOpen: boolean) => void;
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

export const AccentBar: React.FC<AccentBarProps> = ({
  activeInputRef,
  onKeyboardStateChange,
}) => {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [viewportBottom, setViewportBottom] = useState<number | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      const vv = window.visualViewport;
      if (vv) {
        setViewportBottom(Math.round(vv.offsetTop + vv.height));
      } else {
        setViewportBottom(window.innerHeight);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement && !e.target.readOnly && !e.target.disabled) {
        activeInputRef.current = e.target;
        setIsInputFocused(true);
        onKeyboardStateChange?.(true);
        updateViewport();
        setTimeout(() => {
          updateViewport();
          e.target instanceof HTMLElement &&
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 120);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const stillFocused =
          active instanceof HTMLInputElement && !active.readOnly && !active.disabled;
        setIsInputFocused(stillFocused);
        onKeyboardStateChange?.(stillFocused);
        updateViewport();
      }, 60);
    };

    updateViewport();
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateViewport);
      vv.addEventListener('scroll', updateViewport);
    }
    window.addEventListener('resize', updateViewport);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (vv) {
        vv.removeEventListener('resize', updateViewport);
        vv.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
    };
  }, [activeInputRef, onKeyboardStateChange]);

  const handleInsert = (char: string) => {
    const target =
      activeInputRef.current ||
      (document.activeElement instanceof HTMLInputElement ? document.activeElement : null);

    if (!target || target.disabled || target.readOnly) {
      return;
    }

    insertTextIntoInput(target, char);
  };

  if (!isInputFocused) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-0 z-50 px-1.5 py-1.5 select-none tr-keyboard-accessory"
      style={
        viewportBottom !== null
          ? {
              top: `${viewportBottom}px`,
              transform: 'translateY(-100%)',
            }
          : {
              bottom: 0,
            }
      }
      aria-label="Czech diacritic keys"
    >
      <div className="max-w-lg mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
        {CZECH_ACCENTS.map((char) => (
          <button
            key={char}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              handleInsert(char);
            }}
            className="min-w-[29px] flex-1 h-[36px] px-1 font-semibold text-[16px] leading-none flex items-center justify-center shrink-0 cursor-pointer tr-keycap"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
