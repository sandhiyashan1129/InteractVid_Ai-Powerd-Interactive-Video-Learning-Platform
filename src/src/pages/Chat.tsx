import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Loader2, Sparkles } from "lucide-react";
import { callAI } from "@/lib/ai";
import ReactMarkdown from "react-markdown";

const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("chat_messages").select("*").eq("user_id", user.id).is("video_id", null).order("created_at").limit(50);
      setMessages((data || []).map(m => ({ role: m.role as any, content: m.content })));
    })();
  }, [user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const q = input.trim(); setInput(""); setBusy(true);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: q });
    try {
      const data = await callAI({ task: "chat", title: "General Learning", topic: "education", question: q, history: messages });
      setMessages([...next, { role: "assistant", content: data.reply }]);
      await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: data.reply });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-9rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3"><MessageCircle className="h-7 w-7 text-primary" /> Doubt Assistant</h1>
        <p className="text-muted-foreground">Your always-on AI tutor for any subject.</p>
      </div>

      <div className="flex-1 glass-card rounded-2xl p-4 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="h-10 w-10 mx-auto text-primary mb-3 animate-pulse-glow" />
              <p className="text-muted-foreground">Ask about any concept — I'm listening.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {["Explain Big-O notation", "What is a closure in JS?", "Newton's 3 laws"].map(s => (
                  <button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 rounded-full glass border border-primary/30 hover:border-primary text-primary">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-slide-in-right`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-primary/20 border border-primary/40" : "glass"}`}>
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-pre:my-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 inline animate-spin mr-2" /> AI is thinking…</div>}
        </div>

        <div className="flex gap-2 pt-3 border-t border-border/40 mt-3">
          <input
            className="flex-1 bg-input rounded-md px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="Type your doubt…" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !busy && send()}
          />
          <Button onClick={send} disabled={busy} className="bg-gradient-neon text-primary-foreground glow-cyan"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
