import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, Plus, Trash2, Loader2 } from "lucide-react";
import { savePopupQuiz, deletePopupQuiz, type PopupQuiz, type Difficulty } from "@/lib/popupQuizzes";
import { toast } from "sonner";
import { fmtTime } from "@/lib/ai";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  videoId: string;
  quizzes: PopupQuiz[];
  onChange: (q: PopupQuiz[]) => void;
}

export const QuizConfigDialog = ({ videoId, quizzes, onChange }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PopupQuiz[]>(quizzes);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setList(quizzes); }, [open, quizzes]);

  const update = (i: number, patch: Partial<PopupQuiz>) => {
    setList(l => l.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  };

  const updateOption = (i: number, oi: number, val: string) => {
    setList(l => l.map((q, idx) => {
      if (idx !== i) return q;
      const options = [...q.options];
      options[oi] = val;
      return { ...q, options };
    }));
  };

  const add = () => {
    setList(l => [...l, {
      id: `tmp-${Date.now()}`,
      time_seconds: 30,
      question: "New question",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_index: 0,
      explanation: "",
      difficulty: "medium",
    }]);
  };

  const remove = async (i: number) => {
    const q = list[i];
    if (q.id && !q.id.startsWith("tmp-")) await deletePopupQuiz(q.id);
    setList(l => l.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const saved: PopupQuiz[] = [];
      for (const q of list) saved.push(await savePopupQuiz(q, videoId, user.id));
      const sorted = saved.sort((a, b) => a.time_seconds - b.time_seconds);
      onChange(sorted);
      toast.success("Quiz timestamps saved");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Configure Pop Quizzes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto glass-card neon-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Teacher: Pop Quiz Timestamps</DialogTitle>
          <p className="text-xs text-muted-foreground">Configure when quizzes appear during playback. Saved to backend.</p>
        </DialogHeader>

        <div className="space-y-4">
          {list.map((q, i) => (
            <div key={q.id} className="glass rounded-lg p-3 space-y-2 border border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">At (sec)</label>
                  <Input
                    type="number" min={0} value={q.time_seconds}
                    onChange={e => update(i, { time_seconds: Number(e.target.value) })}
                    className="w-20 h-8"
                  />
                  <span className="text-xs font-mono text-primary">{fmtTime(q.time_seconds)}</span>
                  <Select value={q.difficulty || "medium"} onValueChange={(v) => update(i, { difficulty: v as Difficulty })}>
                    <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(i)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={q.question} onChange={e => update(i, { question: e.target.value })}
                placeholder="Question" rows={2} className="text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <input
                      type="radio" name={`correct-${i}`} checked={q.correct_index === oi}
                      onChange={() => update(i, { correct_index: oi })}
                      className="accent-primary"
                    />
                    <Input
                      value={opt} onChange={e => updateOption(i, oi, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
              <Input
                value={q.explanation || ""} onChange={e => update(i, { explanation: e.target.value })}
                placeholder="Explanation (shown after answer)" className="h-8 text-xs"
              />
            </div>
          ))}

          <Button onClick={add} variant="outline" size="sm" className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Quiz
          </Button>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-neon text-primary-foreground glow-cyan">
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
