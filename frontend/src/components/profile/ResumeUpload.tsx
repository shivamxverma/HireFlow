"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, X, Download } from "lucide-react";

export function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Resume Upload</h2>
        <p className="text-sm text-muted-foreground">Upload your latest PDF resume. This will be used to auto-fill applications.</p>
      </div>

      {!file ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-primary/50 hover:border-zinc-500 bg-muted/30 hover:bg-muted/50'}`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-muted hover:bg-muted/80 rounded-full">
              <UploadCloud className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-1">PDF files only (max 5MB)</p>
            </div>
            <label className="cursor-pointer">
              <Button type="button" variant="outline" className="mt-4 border-border hover:border-primary/50 bg-muted" asChild>
                <span>Browse Files</span>
              </Button>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-border bg-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">{file.name}</h4>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB • Uploaded just now</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-emerald-400">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="text-muted-foreground hover:text-red-400">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
