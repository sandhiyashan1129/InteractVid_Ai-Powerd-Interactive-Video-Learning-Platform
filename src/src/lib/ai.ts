import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function callAI(payload: any) {
  const { data, error } = await supabase.functions.invoke("ai-video-tools", { body: payload });
  if (error) {
    const msg = (error as any).context?.body ? await (async () => {
      try { const t = await (error as any).context.body.text(); return JSON.parse(t).error; } catch { return error.message; }
    })() : error.message;
    toast.error(msg || "AI request failed");
    throw error;
  }
  return data;
}

export const ytId = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
};

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};
