import { useEffect, useState } from "react";
import { accessibleFileUrl } from "@/lib/privateFiles";

export function usePrivateFileUrl(value?: string | null) {
  const [result, setResult] = useState<{ source: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (value) void accessibleFileUrl(value).then(url => {
      if (active) setResult({ source: value, url });
    }).catch(() => { if (active) setResult(null); });
    return () => { active = false; };
  }, [value]);
  return value && result?.source === value ? result.url : undefined;
}
