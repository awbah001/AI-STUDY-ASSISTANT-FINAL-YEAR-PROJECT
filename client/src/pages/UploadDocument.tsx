import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { storagePut } from "@/lib/storage";

export default function UploadDocument() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractDocumentMutation = trpc.documents.extractDocumentText.useMutation();

  const createDocMutation = trpc.documents.create.useMutation({
    onSuccess: (doc) => {
      toast.success("Document uploaded successfully!");
      setLocation(`/document/${doc.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload document");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const validateFile = (selectedFile: File) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Please select a PDF, DOCX, or PPTX file");
      return false;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB");
      return false;
    }
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setIsUploading(true);
    try {
      const fileKey = `documents/${Date.now()}-${file.name}`;

      // Upload file to S3
      const fileBuffer = await file.arrayBuffer();
      const { url: fileUrl } = await storagePut(
        fileKey,
        new Uint8Array(fileBuffer),
        file.type
      );

      // Extract text from document using LLM
      let extractedText: string | undefined;
      const extractionToastId = toast.loading("Extracting text from document...");
      try {
        extractedText = await extractDocumentMutation.mutateAsync({ fileUrl });
        toast.success("Text extracted successfully", { id: extractionToastId });
      } catch (extractError) {
        console.warn("Document extraction failed, continuing without text:", extractError);
        toast.warning("Upload completed, but text extraction failed. AI features will retry when you generate.", {
          id: extractionToastId,
        });
      }

      // Create document in database
      createDocMutation.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        fileName: file.name,
        fileSize: file.size,
        fileUrl,
        fileKey,
        mimeType: file.type,
        extractedText,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Document</h1>
          <p className="text-muted-foreground mt-2">
            Upload a PDF, DOCX, or PPTX document to start learning with AI assistance
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
            <CardDescription>Provide information about your document</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Document Title *</label>
              <Input
                placeholder="e.g., Advanced Python Programming"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
              <Textarea
                placeholder="Add notes about this document..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">File (PDF, DOCX, PPTX) *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">{file.name}</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 w-full transition-all text-center cursor-pointer ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${
                    isDragActive ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <p className="font-medium">
                    {isDragActive ? "Drop your file here" : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-sm text-muted-foreground">PDF, DOCX, or PPTX up to 50MB</p>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!file || !title.trim() || isUploading || createDocMutation.isPending}
              size="lg"
              className="w-full"
            >
              {isUploading || createDocMutation.isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What happens next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex gap-2">
              <FileText className="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
              Your document will be securely stored and analyzed
            </p>
            <p className="flex gap-2">
              <FileText className="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
              You can ask questions about the content using AI chat
            </p>
            <p className="flex gap-2">
              <FileText className="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
              Generate summaries, flashcards, and quizzes automatically
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
