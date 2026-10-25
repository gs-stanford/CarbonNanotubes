"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import styles from "@/app/api-guide/guide.module.css";

export function ApiCodeBlock({ code, language, label }: { code: string; language: string; label: string }) {
  const [state, setState] = useState<"ready" | "copied" | "failed">("ready");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
  }
  return <div className={styles.codeBlock}>
    <div className={styles.codeHeader}><span>{language}</span><div>
      <span role="status">{state === "copied" ? "Copied" : state === "failed" ? "Copy unavailable; select the code below." : ""}</span>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
        {state === "copied" ? <Check size={16}/> : <Copy size={16}/>}
      </button>
    </div></div>
    <pre tabIndex={0} aria-label={label}><code>{code}</code></pre>
  </div>;
}
