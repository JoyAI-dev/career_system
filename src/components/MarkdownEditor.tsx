'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

type Props = {
  id?: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  required?: boolean;
  preview?: 'edit' | 'preview' | 'live';
};

export function MarkdownEditor({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder,
  minHeight = 200,
  required,
  preview = 'edit',
}: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const handleChange = useCallback(
    (val?: string) => {
      const newVal = val ?? '';
      if (!isControlled) setInternalValue(newVal);
      onChange?.(newVal);
    },
    [isControlled, onChange],
  );

  return (
    <div data-color-mode="light">
      <input type="hidden" name={name} value={currentValue} />
      <MDEditor
        id={id}
        textareaProps={{ placeholder }}
        value={currentValue}
        onChange={handleChange}
        preview={preview}
        height={minHeight}
      />
      {required && !currentValue && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
          required
          value=""
          onChange={() => {}}
        />
      )}
    </div>
  );
}
