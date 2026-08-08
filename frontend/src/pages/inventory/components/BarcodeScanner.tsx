import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}

/** Camera-based barcode/QR scan using the device's webcam (works on desktop and mobile browsers alike). */
export default function BarcodeScanner({ open, onClose, onDetect }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, err) => {
      if (cancelled) return;
      if (result) {
        onDetect(result.getText());
        controlsRef.current?.stop();
        onClose();
      }
      // NotFoundException fires on every unsuccessful frame — that's normal, not an error to surface.
      if (err && err.name !== "NotFoundException") {
        setError(err.message || "Scan error");
      }
    }).then((controls) => {
      if (cancelled) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
    }).catch((e) => setError(e?.message || "Could not access the camera"));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="w-5 h-5" /> Scan Barcode / QR</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">Point the camera at a material's barcode or QR code.</p>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </DialogContent>
    </Dialog>
  );
}
