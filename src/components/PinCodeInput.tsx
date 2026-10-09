'use client';

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PIN_LENGTH, digitsOnly } from '@/lib/pin-rules';

interface PinCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the field (the boxes themselves are decorative). */
  label: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Plays the short horizontal shake (the parent toggles it back off with onShakeEnd). */
  shake?: boolean;
  onShakeEnd?: () => void;
  autoFocus?: boolean;
  describedBy?: string;
}

export interface PinCodeInputHandle {
  focus: () => void;
}

/**
 * Four equal square boxes backed by ONE real masked input (type=password, numeric keyboard, one-time-code autofill off).
 * The input sits invisibly over the boxes so typing, deleting, caret, selection and paste all behave natively; the
 * boxes only draw what was typed as red dots, never as text.
 */
const PinCodeInput = forwardRef<PinCodeInputHandle, PinCodeInputProps>(function PinCodeInput(
  { value, onChange, label, id, disabled, invalid, shake, onShakeEnd, autoFocus, describedBy }, ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  const activeIndex = Math.min(value.length, PIN_LENGTH - 1);

  return (
    <div
      className={`cv-pin ${shake ? 'cv-pin--shake' : ''} ${invalid ? 'cv-pin--invalid' : ''}`}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) onShakeEnd?.(); }}
      data-testid="pin-boxes"
    >
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          data-pin-box
          className={`cv-pin__box ${focused && !disabled && index === activeIndex ? 'cv-pin__box--active' : ''}`}
        >
          {index < value.length && <span className="cv-pin__dot" data-pin-dot />}
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        className="cv-pin__input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={PIN_LENGTH}
        enterKeyHint="done"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(digitsOnly(event.target.value).slice(0, PIN_LENGTH))}
        onPaste={(event) => {
          // a pasted code is reduced to its digits ("12 34", "1234\n") and capped at four
          event.preventDefault();
          onChange(digitsOnly(event.clipboardData.getData('text')).slice(0, PIN_LENGTH));
        }}
        // the caret always stays at the end, so a click in the middle can never edit a digit in place
        onSelect={(event) => {
          const input = event.currentTarget;
          if (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDrop={(event) => event.preventDefault()}
      />
    </div>
  );
});

export default PinCodeInput;
