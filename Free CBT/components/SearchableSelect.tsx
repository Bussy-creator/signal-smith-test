"use client";

import { useEffect, useId, useState } from "react";

export interface SearchableOption {
  value: string;
  label: string;
}

interface Props {
  options: SearchableOption[];
  value: string; // the committed option `value`, or "" if none/invalid
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * A type-to-search dropdown built on a native <input> + <datalist>. The
 * person can type to filter, but onChange only ever fires with a value
 * from `options` — typing something that doesn't exactly match any
 * option's label leaves the selection unset (empty) rather than accepting
 * free text, and on blur the input snaps back to whatever the last valid
 * selection was.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  className
}: Props) {
  const datalistId = useId();
  const [text, setText] = useState("");

  // Keep the visible text in sync when the committed value changes
  // externally (e.g. a parent resetting the field, or editing an existing
  // record into the form).
  useEffect(() => {
    const match = options.find((o) => o.value === value);
    setText(match ? match.label : "");
  }, [value, options]);

  function findByLabel(label: string) {
    return options.find((o) => o.label.toLowerCase() === label.trim().toLowerCase());
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);
    const match = findByLabel(next);
    onChange(match ? match.value : "");
  }

  function handleBlur() {
    const match = findByLabel(text);
    if (match) {
      setText(match.label);
      onChange(match.value);
    } else {
      // Not a valid option — refuse the free text, revert to the last
      // committed selection (or empty if there wasn't one).
      const committed = options.find((o) => o.value === value);
      setText(committed ? committed.label : "");
      if (!committed) onChange("");
    }
  }

  return (
    <div className={className}>
      <input
        list={datalistId}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm disabled:opacity-50"
      />
      <datalist id={datalistId}>
        {options.map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </div>
  );
}
