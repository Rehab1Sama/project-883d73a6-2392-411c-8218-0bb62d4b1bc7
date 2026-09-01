import { useEffect, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/assistant.functions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenantContext } from "@/hooks/useTenantContext";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "أعطني ملخصًا سريعًا عن أداء الشهر",
  "كم عدد الطالبات النشطات؟",
  "كيف أضيف حلقة جديدة؟",
];

/** مساعدة ذكية عائمة داخل لوحات التحكم */
export function AssistantWidget() {
  const params = useParams({ strict: false }) as { slug?: string };
  const { isPlatformOwner } = useAuth();
  const { hasFeature, featuresLoading } = useTenantContext();
  const ask = useServerFn(askAssistant);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "أهلًا بكِ 🌿 اسأليني عن أرقام مقرأتكِ أو عن طريقة تنفيذ أي إجراء داخل اللوحة." },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // مالكة المنصة تراها دائمًا (كل الصفحات، بما فيها لوحة المنصة).
  // غيرها لا يراها إلا داخل مقرأة فعّلت لها ميزة "ai_assistant" صراحةً؛
  // هذا للإخفاء بالواجهة فقط — التحقق الفعلي والملزم في askAssistant
  // نفسها على الخادم.
  const canSeeWidget = isPlatformOwner || (!!params.slug && !featuresLoading && hasFeature("ai_assistant"));

  if (!canSeeWidget) return null;

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({
        data: { slug: params.slug ?? null, messages: next.filter((m) => m.role !== "assistant" || m !== next[0]).slice(-12) },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "حدث خطأ غير متوقع، حاولي مرة أخرى." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-4 start-4 z-50 flex h-[min(32rem,80vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <p className="font-display text-sm font-bold">المساعدة الذكية</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-md p-1 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ms-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> جارٍ التفكير…
              </div>
            ) : null}
            {messages.length === 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتبي سؤالك…"
              disabled={busy}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="إرسال">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-xl transition hover:opacity-90"
        >
          <Sparkles className="size-4" />
          المساعدة الذكية
        </button>
      )}
    </>
  );
}
