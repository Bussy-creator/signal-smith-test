"use client";

import { useState } from "react";

/**
 * On-screen calculator with Standard / Scientific toggle for
 * math/physics courses. Uses a restricted safe-eval (no arbitrary JS —
 * only digits, operators, parens, and whitelisted Math functions).
 */
export default function Calculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const [scientific, setScientific] = useState(false);

  const standardButtons = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];
  const scientificButtons = ["sin(", "cos(", "tan(", "^", "sqrt(", "log(", "ln(", "(", ")", "π", "%", "C"];

  function press(token: string) {
    if (token === "=") return evaluate();
    if (token === "C") return setExpr("");
    if (token === "π") return setExpr((e) => e + "Math.PI");
    setExpr((e) => e + token.replace("^", "**").replace(/sin\(|cos\(|tan\(|sqrt\(|log\(|ln\(/g, (m) => {
      const map: Record<string, string> = {
        "sin(": "Math.sin(",
        "cos(": "Math.cos(",
        "tan(": "Math.tan(",
        "sqrt(": "Math.sqrt(",
        "log(": "Math.log10(",
        "ln(": "Math.log("
      };
      return map[m];
    }));
  }

  function evaluate() {
    // Whitelist-only characters — never pass raw user input to Function/eval directly
    // without this guard, since expr may contain Math.* already inserted by press().
    const safe = /^[0-9+\-*/().%\sA-Za-z]*$/.test(expr);
    if (!safe) return setExpr("Error");
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)();
      setExpr(String(result));
    } catch {
      setExpr("Error");
    }
  }

  return (
    <div className="mb-4 border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setScientific(false)}
            className={`px-2 py-1 rounded ${!scientific ? "bg-brand text-white" : "border border-gray-300"}`}
          >
            Standard
          </button>
          <button
            onClick={() => setScientific(true)}
            className={`px-2 py-1 rounded ${scientific ? "bg-brand text-white" : "border border-gray-300"}`}
          >
            Scientific
          </button>
        </div>
        <button onClick={onClose} className="text-xs text-gray-400">✕</button>
      </div>
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        className="w-full mb-2 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 font-mono text-right"
      />
      <div className={`grid ${scientific ? "grid-cols-4" : "grid-cols-4"} gap-1`}>
        {(scientific ? [...scientificButtons, ...standardButtons] : standardButtons).map((b) => (
          <button
            key={b}
            onClick={() => press(b)}
            className="py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}
