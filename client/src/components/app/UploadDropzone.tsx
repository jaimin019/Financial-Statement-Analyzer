import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X } from "lucide-react";
import { sessionApi } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { extractErrorMessage } from "@/lib/api";

interface Props {
  onUploaded: (sessionId: string) => void;
}

export function UploadDropzone({ onUploaded }: Props) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return showToast("File too large (max 25MB)", "error");
    setUploading(true); setFilename(file.name); setProgress(0);
    try {
      const r = await sessionApi.upload(file, (p) => setProgress(Math.min(10, Math.round(p / 10))));
      showToast("Uploaded — analyzing in background", "success");
      onUploaded(r.sessionId);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setUploading(false); setFilename(null); setProgress(0);
    }
  }, [onUploaded, showToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 cursor-pointer transition-all ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border-strong hover:border-primary/60 hover:bg-surface/30"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center text-center">
        <motion.div
          animate={isDragActive ? { y: -6 } : { y: 0 }}
          className="size-14 rounded-2xl grid place-items-center mb-4"
          style={{ background: "oklch(0.82 0.17 165 / 0.15)" }}
        >
          <Upload className="size-6 text-primary" />
        </motion.div>
        <h3 className="text-lg font-semibold tracking-tight">Drop a statement to analyze</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV or PDF · up to 25MB · HDFC, ICICI, SBI, Zerodha, Groww and more
        </p>
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 w-full max-w-sm"
            >
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" />
                <span className="truncate text-foreground">{filename}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                  className="h-full bg-primary"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
