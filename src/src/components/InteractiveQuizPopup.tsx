import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { callAI } from "@/lib/ai";
import type { PopupQuiz } from "@/lib/popupQuizzes";

export type { PopupQuiz };

interface Props {
  quiz: PopupQuiz;
  videoTitle?: string;
  videoTopic?: string;
  onAnswered: (selectedIndex: number, correct: boolean) => void;
  onClose: () => void;
  onReplaySegment?: () => void;
  attemptNumber?: number; // 1 for first try, 2+ for retry
}

export const InteractiveQuizPopup = ({ quiz, videoTitle, videoTopic, onAnswered, onClose, onReplaySegment, attemptNumber = 1 }: Props) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [show, setShow] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [explLoading, setExplLoading] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  const submit = async () => {
    if (selected === null) return;
    const correct = selected === quiz.correct_index;
    setSubmitted(true);
    onAnswered(selected, correct);
    if (!correct) {
      // Fetch AI explanation
      setExplLoading(true);
      try {
        const data = await callAI({
          task: "explain", title: videoTitle || "", topic: videoTopic,
          question: quiz.question,
          chosen: quiz.options[selected],
          correct_answer: quiz.options[quiz.correct_index],
        });
        setAiExplanation(data.explanation || quiz.explanation || "");
      } catch { setAiExplanation(quiz.explanation || ""); }
      finally { setExplLoading(false); }
    } else {
      // auto-resume after correct
      setTimeout(() => { setShow(false); setTimeout(onClose, 250); }, 1500);
    }
  };

  const handleRetry = () => {
    if (onReplaySegment) onReplaySegment();
    setShow(false);
    setTimeout(onClose, 250);
  };

  const continueAnyway = () => {
    setShow(false);
    setTimeout(onClose, 250);
  };

  const isCorrect = submitted && selected === quiz.correct_index;
  const diffColor = quiz.difficulty === "hard" ? "text-destructive" : quiz.difficulty === "easy" ? "text-success" : "text-primary";

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center transition-all duration-300",
        show ? "opacity-100 backdrop-blur-md bg-background/60" : "opacity-0 backdrop-blur-0"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "glass-card neon-border rounded-2xl p-6 w-[92%] max-w-md shadow-2xl",
          "transition-all duration-300 ease-out",
          show ? "scale-100 opacity-100" : "scale-90 opacity-0"
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5 animate-pulse-glow" />
            {attemptNumber > 1 ? `Retry · Attempt ${attemptNumber}` : "Quick Check"}
          </div>
          <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border", diffColor, "border-current")}>
            {quiz.difficulty || "medium"}
          </span>
        </div>
        <h3 className="font-display text-lg font-bold mb-4 leading-snug">{quiz.question}</h3>

        <div className="space-y-2 mb-4">
          {quiz.options.map((opt, i) => {
            const isSel = selected === i;
            const showCorrect = submitted && i === quiz.correct_index;
            const showWrong = submitted && isSel && i !== quiz.correct_index;
            return (
              <button
                key={i}
                disabled={submitted}
                onClick={() => setSelected(i)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border text-sm transition-smooth flex items-center gap-2",
                  showCorrect && "bg-success/15 border-success text-foreground",
                  showWrong && "bg-destructive/15 border-destructive",
                  !submitted && isSel && "bg-primary/15 border-primary glow-cyan",
                  !submitted && !isSel && "border-border hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                {showCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                {showWrong && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                {!submitted && (
                  <span className={cn(
                    "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-mono shrink-0",
                    isSel ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground"
                  )}>{String.fromCharCode(65 + i)}</span>
                )}
                <span className="min-w-0">{opt}</span>
              </button>
            );
          })}
        </div>

        {submitted ? (
          <div className={cn(
            "rounded-lg p-3 text-sm animate-fade-in",
            isCorrect ? "bg-success/15 border border-success/40" : "bg-destructive/15 border border-destructive/40"
          )}>
            <div className="font-semibold mb-1">
              {isCorrect ? "✓ Correct! +10 XP" : "✗ Not quite — let's revisit"}
            </div>
            {explLoading ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Generating explanation…</div>
            ) : (
              <p className="text-xs text-muted-foreground">{aiExplanation || quiz.explanation}</p>
            )}
            {isCorrect ? (
              <p className="text-xs text-primary mt-2">Resuming video…</p>
            ) : (
              <div className="flex gap-2 mt-3">
                {onReplaySegment && (
                  <Button onClick={handleRetry} size="sm" className="flex-1 bg-gradient-neon text-primary-foreground glow-cyan">
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Replay & Retry
                  </Button>
                )}
                <Button onClick={continueAnyway} size="sm" variant="outline" className="flex-1">
                  Continue
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={submit}
            disabled={selected === null}
            className="w-full bg-gradient-neon text-primary-foreground glow-cyan disabled:opacity-40"
          >
            Submit Answer
          </Button>
        )}
      </div>
    </div>
  );
};
