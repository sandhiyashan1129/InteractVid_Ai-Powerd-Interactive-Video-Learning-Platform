// AI helper for IntractctVid: summary, quiz, notes, timeline, chat, subtitles, translate
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Body = {
  task: "summary" | "quiz" | "notes" | "timeline" | "chat" | "subtitles" | "translate" | "explain" | "search" | "exam";
  title: string;
  topic?: string;
  description?: string;
  duration?: number;
  question?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  cues?: { start: number; end: number; text: string }[];
  target_lang?: string;
  chosen?: string;
  correct_answer?: string;
  query?: string;
  difficulty?: "easy" | "medium" | "hard";
  num_questions?: number;
};

async function callAI(messages: any[], tools?: any[], tool_choice?: any) {
  const body: any = { model: MODEL, messages };
  if (tools) { body.tools = tools; body.tool_choice = tool_choice; }
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 429) throw new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (r.status === 402) throw new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`AI gateway error: ${r.status} ${await r.text()}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const b = (await req.json()) as Body;
    const ctx = `Video title: "${b.title}". Topic: ${b.topic || "general education"}. ${b.description ? "Description: " + b.description : ""} ${b.duration ? "Duration: ~" + Math.round(b.duration) + "s." : ""}`;

    if (b.task === "summary") {
      const sys = "You are an expert tutor. From the video metadata, infer the likely subject and produce a concise study aid. Return ONLY valid JSON via the tool.";
      const data = await callAI(
        [{ role: "system", content: sys }, { role: "user", content: ctx }],
        [{ type: "function", function: { name: "produce_summary", parameters: { type: "object", properties: { summary: { type: "string" }, key_points: { type: "array", items: { type: "string" } } }, required: ["summary", "key_points"] } } }],
        { type: "function", function: { name: "produce_summary" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "quiz") {
      const data = await callAI(
        [{ role: "system", content: "You are a quiz master. Create challenging but fair MCQs from the topic. Return ONLY via the tool." }, { role: "user", content: ctx }],
        [{ type: "function", function: { name: "produce_quiz", parameters: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, correct_index: { type: "integer" }, explanation: { type: "string" } }, required: ["question", "options", "correct_index", "explanation"] } } }, required: ["questions"] } } }],
        { type: "function", function: { name: "produce_quiz" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "notes") {
      const data = await callAI(
        [{ role: "system", content: "You are a note-taking assistant. Produce structured markdown lecture notes." }, { role: "user", content: ctx + "\n\nProduce well-formatted markdown notes with headings, bullet points, examples, and a key terms section." }]
      );
      const content = data.choices[0].message.content;
      return new Response(JSON.stringify({ notes: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "timeline") {
      const dur = b.duration || 600;
      const data = await callAI(
        [{ role: "system", content: "Create a likely timeline of topics inside the video, evenly distributed across the duration." }, { role: "user", content: ctx + `\n\nDuration is ~${dur}s. Return 5-8 chapter markers.` }],
        [{ type: "function", function: { name: "produce_timeline", parameters: { type: "object", properties: { chapters: { type: "array", items: { type: "object", properties: { title: { type: "string" }, time_seconds: { type: "integer" }, description: { type: "string" } }, required: ["title", "time_seconds", "description"] } } }, required: ["chapters"] } } }],
        { type: "function", function: { name: "produce_timeline" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "subtitles") {
      const dur = Math.max(60, b.duration || 300);
      const data = await callAI(
        [{ role: "system", content: "You generate plausible English subtitle cues for an educational video using ONLY its metadata. Distribute cues evenly across the duration. Each cue 4-10 seconds. Aim for ~12-20 cues." }, { role: "user", content: ctx + `\n\nDuration ~${dur}s. Return cues that explain the topic step-by-step.` }],
        [{ type: "function", function: { name: "produce_subtitles", parameters: { type: "object", properties: { cues: { type: "array", items: { type: "object", properties: { start: { type: "number" }, end: { type: "number" }, text: { type: "string" } }, required: ["start", "end", "text"] } } }, required: ["cues"] } } }],
        { type: "function", function: { name: "produce_subtitles" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "translate") {
      const lang = b.target_lang || "Spanish";
      const cues = b.cues || [];
      const data = await callAI(
        [{ role: "system", content: `Translate subtitle texts to ${lang}. Preserve order and timestamps. Return via tool.` }, { role: "user", content: JSON.stringify(cues.map(c => c.text)) }],
        [{ type: "function", function: { name: "translated", parameters: { type: "object", properties: { texts: { type: "array", items: { type: "string" } } }, required: ["texts"] } } }],
        { type: "function", function: { name: "translated" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      const out = cues.map((c, i) => ({ ...c, text: args.texts[i] || c.text }));
      return new Response(JSON.stringify({ cues: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "explain") {
      const sys = "You are a kind tutor. The student answered a quiz question incorrectly. Briefly explain (2-3 sentences) why their answer is wrong and why the correct answer is right. Be encouraging.";
      const userMsg = `Question: ${b.question}\nStudent's answer: ${b.chosen}\nCorrect answer: ${b.correct_answer}\nVideo topic: ${b.topic || b.title}`;
      const data = await callAI([{ role: "system", content: sys }, { role: "user", content: userMsg }]);
      return new Response(JSON.stringify({ explanation: data.choices[0].message.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "search") {
      const dur = b.duration || 600;
      const data = await callAI(
        [{ role: "system", content: "You are a semantic video search engine. Given a query, return the most likely timestamps (in seconds) inside the video where the topic is discussed, with a brief reason. Be realistic about distribution across duration." },
         { role: "user", content: `Video: "${b.title}" (topic: ${b.topic || "general"}, duration ~${dur}s)\nQuery: ${b.query}\nReturn 3-5 results.` }],
        [{ type: "function", function: { name: "search_results", parameters: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { time_seconds: { type: "integer" }, snippet: { type: "string" }, relevance: { type: "number" } }, required: ["time_seconds", "snippet", "relevance"] } } }, required: ["results"] } } }],
        { type: "function", function: { name: "search_results" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "exam") {
      const n = b.num_questions || 10;
      const data = await callAI(
        [{ role: "system", content: "Create a comprehensive exam covering the entire video topic. Mix easy, medium, and hard questions. Return ONLY via tool." },
         { role: "user", content: ctx + `\n\nGenerate ${n} exam questions covering all key concepts.` }],
        [{ type: "function", function: { name: "produce_exam", parameters: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, correct_index: { type: "integer" }, difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, explanation: { type: "string" } }, required: ["question", "options", "correct_index", "difficulty", "explanation"] } } }, required: ["questions"] } } }],
        { type: "function", function: { name: "produce_exam" } }
      );
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (b.task === "chat") {
      const sys = `You are an AI doubt-clearing tutor for the video "${b.title}" (topic: ${b.topic || "general"}). Answer the student's question clearly, with examples. Use markdown.`;
      const messages = [
        { role: "system", content: sys },
        ...(b.history || []).slice(-10),
        { role: "user", content: b.question || "" },
      ];
      const data = await callAI(messages);
      return new Response(JSON.stringify({ reply: data.choices[0].message.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown task" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
