import { useEffect, useState } from "react";
import { Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** زر «إضافة إلى الشاشة الرئيسية» — يعمل تلقائيًا على أندرويد، ويعرض إرشادات على iOS */
export function InstallAppButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua));
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !isIos) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowIosHelp(true);
  }

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => void handleClick()}>
        <Smartphone className="size-4" />
        إضافة للشاشة الرئيسية
      </Button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة سُحُب إلى شاشة جوالك</DialogTitle>
            <DialogDescription>من متصفح Safari اتبعي الخطوتين:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <Share className="size-4 text-primary" />
              اضغطي زر المشاركة في شريط المتصفح.
            </li>
            <li className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              اختاري «إضافة إلى الشاشة الرئيسية».
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
