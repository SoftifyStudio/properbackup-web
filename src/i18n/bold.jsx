import React from 'react';

/** Parses `before **highlight** after` into inline nodes (no nesting). */
export function boldPartsReact(str) {
  if (str == null || str === '') return null;
  const parts = String(str).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-text1">
          {m[1]}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
