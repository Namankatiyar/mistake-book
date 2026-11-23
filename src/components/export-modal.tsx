"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  FileDown,
  Square,
  CheckSquare,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Check,
  Loader2,
  X,
  Moon,
} from "lucide-react";
import { Modal, Button, IconButton, SubjectIcon, Toggle } from "@/components/ui";
import { useLibrary } from "@/lib/library";
import { useSettings } from "@/lib/settings";
import {
  MISTAKE_TYPES,
  mistakeById,
  type Question,
} from "@/lib/model";
import { getSyllabus, chapterById } from "@/lib/syllabus";
import {
  generateContinuousPdf,
  detectDarkMode,
  type ColumnFormat,
  type MetadataOptions,
  type ExportProgress,
} from "@/lib/pdf-export";

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  initialSubjectId?: string | null;
  initialChapterId?: string | null;
  initialMistake?: string;
  initialSource?: string;
  initialStash?: string;
};

type AnalysisState = {
  isDark: boolean;
  previewUrl: string;
};

function OneColumnIcon({ className }: { className?: string }) {
  return (
    <svg
      width="34"
      height="40"
      viewBox="0 0 34 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="1.5"
        y="1.5"
        width="31"
        height="37"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line x1="6.5" y1="9" x2="27.5" y2="9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="6.5" y1="16" x2="27.5" y2="16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="6.5" y1="23" x2="27.5" y2="23" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="6.5" y1="30" x2="27.5" y2="30" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function TwoColumnsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="34"
      height="40"
      viewBox="0 0 34 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="1.5"
        y="1.5"
        width="31"
        height="37"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line x1="17" y1="1.5" x2="17" y2="38.5" stroke="currentColor" strokeWidth="1.75" />
      <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="6" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="6" y1="23" x2="12" y2="23" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="6" y1="30" x2="12" y2="30" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="22" y1="9" x2="28" y2="9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="22" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="22" y1="23" x2="28" y2="23" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="22" y1="30" x2="28" y2="30" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ExportModal({
  open,
  onClose,
  initialSubjectId,
  initialChapterId,
  initialMistake = "all",
  initialSource = "all",
  initialStash = "active",
}: ExportModalProps) {
  const { questions, sources } = useLibrary();
  const { settings } = useSettings();
  const syllabus = useMemo(() => getSyllabus(settings.examMode), [settings.examMode]);

  // Stepper state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Filter state
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedMistakeIds, setSelectedMistakeIds] = useState<string[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Step 2: PDF Layout & Dark mode options
  const [columnFormat, setColumnFormat] = useState<ColumnFormat>("2");
  const [showAnswers, setShowAnswers] = useState(false);
  const [metadata, setMetadata] = useState<MetadataOptions>({
    showSubject: true,
    showChapter: true,
    showMistake: true,
    showSource: true,
  });

  // Dark mode image recognition state
  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState<Record<string, AnalysisState>>({});
  const [inversions, setInversions] = useState<Record<string, boolean>>({});
  const [darkModeInversionEnabled, setDarkModeInversionEnabled] = useState(true);

  // Step 3: Generation & Progress state
  const [progress, setProgress] = useState<ExportProgress>({
    stage: "analyzing",
    current: 0,
    total: 0,
    message: "Preparing export…",
  });
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  pdfUrlRef.current = pdfUrl;
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset or seed state when opening modal
  useEffect(() => {
    if (!open) {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        setPdfUrl(null);
      }
      setPdfBlob(null);
      setStep(1);
      setErrorMsg(null);
      setShowAnswers(false);
      setDarkModeInversionEnabled(true);
      setInversions({});
      setImageAnalysis({});
      return;
    }

    // Initialize subject filters
    const activeSubIds = initialSubjectId
      ? [initialSubjectId]
      : syllabus.map((s) => s.id);
    setSelectedSubjectIds(activeSubIds);

    // Initialize mistake filters
    const activeMistakeIds =
      initialMistake && initialMistake !== "all" && initialMistake !== "none"
        ? [initialMistake]
        : MISTAKE_TYPES.map((m) => m.id);
    setSelectedMistakeIds(activeMistakeIds);

    // Initialize source filters
    const activeSrcIds =
      initialSource && initialSource !== "all" && initialSource !== "none"
        ? [initialSource]
        : sources.map((s) => s.id);
    setSelectedSourceIds(activeSrcIds);
  }, [open, initialSubjectId, initialChapterId, initialMistake, initialSource, initialStash, syllabus, sources]);

  // Questions filtered by tag pills
  const selectedQuestions = useMemo(() => {
    const subSet = new Set(selectedSubjectIds);
    const misSet = new Set(selectedMistakeIds);
    const srcSet = new Set(selectedSourceIds);

    return questions.filter((q) => {
      if (initialStash === "active" && q.stashed) return false;
      if (initialStash === "stashed" && !q.stashed) return false;
      if (!subSet.has(q.subjectId)) return false;
      if (q.mistakeId && !misSet.has(q.mistakeId)) return false;
      if (q.sourceId && !srcSet.has(q.sourceId)) return false;
      return true;
    });
  }, [questions, selectedSubjectIds, selectedMistakeIds, selectedSourceIds, initialStash]);

  // Run Dark Mode Recognition whenever moving to Step 2
  useEffect(() => {
    if (step !== 2) return;

    let cancelled = false;
    const questionsToAnalyze = selectedQuestions.filter((q) => !imageAnalysis[q.id]);

    if (questionsToAnalyze.length === 0) return;

    setAnalyzingImages(true);

    const runAnalysis = async () => {
      const results: Record<string, AnalysisState> = {};
      const newInversions: Record<string, boolean> = {};

      for (const q of questionsToAnalyze) {
        if (cancelled) break;
        try {
          const res = await detectDarkMode(q.image);
          results[q.id] = { isDark: res.isDark, previewUrl: res.previewUrl };
          if (res.isDark && darkModeInversionEnabled && inversions[q.id] === undefined) {
            newInversions[q.id] = true;
          }
        } catch {
          results[q.id] = { isDark: false, previewUrl: "" };
        }
      }

      if (!cancelled) {
        setImageAnalysis((prev) => ({ ...prev, ...results }));
        setInversions((prev) => ({ ...newInversions, ...prev }));
        setAnalyzingImages(false);
      }
    };

    void runAnalysis();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedQuestions, darkModeInversionEnabled]);

  const handleToggleDarkModeInversion = (checked?: boolean) => {
    const nextState = checked !== undefined ? checked : !darkModeInversionEnabled;
    setDarkModeInversionEnabled(nextState);
    if (!nextState) {
      setInversions({});
    } else {
      const nextInv: Record<string, boolean> = {};
      const hasDarkDetected = selectedQuestions.some((q) => imageAnalysis[q.id]?.isDark);
      for (const q of selectedQuestions) {
        if (hasDarkDetected) {
          if (imageAnalysis[q.id]?.isDark) {
            nextInv[q.id] = true;
          }
        } else {
          nextInv[q.id] = true;
        }
      }
      setInversions(nextInv);
    }
  };

  const toggleSingleInversion = (id: string) => {
    setInversions((prev) => {
      const next = {
        ...prev,
        [id]: !prev[id],
      };
      const anyInverted = Object.values(next).some(Boolean);
      setDarkModeInversionEnabled(anyInverted);
      return next;
    });
  };

  // Step 3 Generation Trigger
  const generationTriggeredRef = useRef(false);

  useEffect(() => {
    if (step !== 3 || generationTriggeredRef.current) return;
    generationTriggeredRef.current = true;

    setErrorMsg(null);
    setProgress({
      stage: "processing",
      current: 0,
      total: selectedQuestions.length,
      message: "Starting PDF generation…",
    });

    const runGenerate = async () => {
      try {
        const blob = await generateContinuousPdf({
          questions: selectedQuestions,
          sources,
          columnFormat,
          metadata,
          showAnswers,
          inversions,
          onProgress: (p) => setProgress(p),
        });

        const url = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPdfUrl(url);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "PDF generation failed");
        setProgress((prev) => ({ ...prev, stage: "error", message: "Failed to generate PDF" }));
      }
    };

    void runGenerate();
  }, [step, selectedQuestions, sources, columnFormat, metadata, showAnswers, inversions]);

  const handleGoToStep3 = () => {
    generationTriggeredRef.current = false;
    setPdfBlob(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setStep(3);
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `jee-questions-export-${dateStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Export Questions to PDF"
      className="max-h-[90vh] w-full max-w-[740px] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-none items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-soft text-fg border border-line/40">
            <FileDown className="h-4 w-4" />
          </div>
          <h2 className="text-[16px] font-semibold text-fg">Export Questions to PDF</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-fg p-1.5 rounded-[6px] transition-colors"
          aria-label="Close export modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Body per Step */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* ==================== STEP 1: FILTER & SELECT ==================== */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Tag Filter Combo Strip */}
            <div className="rounded-[10px] border border-line bg-surface/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  Filter by Tag Combos
                </span>
                <span className="text-[12px] text-muted">
                  {selectedQuestions.length} matches in database
                </span>
              </div>

              {/* Subject Tag Pills */}
              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-fg">Subjects</span>
                <div className="flex flex-wrap gap-1.5">
                  {syllabus.map((s) => {
                    const active = selectedSubjectIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubjectIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((id) => id !== s.id)
                              : [...prev, s.id]
                          );
                        }}
                        className={`inline-flex items-center gap-1 rounded-[6px] border pl-1.5 pr-2.5 py-1 text-[12px] transition-colors ${
                          active
                            ? "border-fg/30 bg-soft font-medium text-fg"
                            : "border-line bg-surface text-muted hover:border-line/80 hover:text-fg"
                        }`}
                      >
                        <SubjectIcon subject={s.id} size={14} />
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mistake Type Tag Pills */}
              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-fg">Mistake Types</span>
                <div className="flex flex-wrap gap-1.5">
                  {MISTAKE_TYPES.map((m) => {
                    const active = selectedMistakeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMistakeIds((prev) =>
                            prev.includes(m.id)
                              ? prev.filter((id) => id !== m.id)
                              : [...prev, m.id]
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] transition-colors ${
                          active
                            ? "border-fg/30 bg-soft font-medium text-fg"
                            : "border-line bg-surface text-muted hover:border-line/80 hover:text-fg"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            m.tone === "red"
                              ? "bg-red"
                              : m.tone === "orange"
                              ? "bg-orange"
                              : "bg-yellow"
                          }`}
                        />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source Tag Pills (if any exist) */}
              {sources.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[12px] font-medium text-fg">Sources</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map((src) => {
                      const active = selectedSourceIds.includes(src.id);
                      return (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => {
                            setSelectedSourceIds((prev) =>
                              prev.includes(src.id)
                                ? prev.filter((id) => id !== src.id)
                                : [...prev, src.id]
                            );
                          }}
                          className={`rounded-[6px] border px-2.5 py-1 text-[12px] transition-colors ${
                            active
                              ? "border-fg/30 bg-soft font-medium text-fg"
                              : "border-line bg-surface text-muted hover:border-line/80 hover:text-fg"
                          }`}
                        >
                          {src.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== STEP 2: LAYOUT & DARK MODE ==================== */}
        {step === 2 && (
          <div className="space-y-6 py-1">
            {/* PDF PAGE LAYOUT */}
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                PDF Page Layout
              </span>

              <div className="grid grid-cols-2 gap-4">
                {/* 1 Column Card */}
                <button
                  type="button"
                  onClick={() => setColumnFormat("1")}
                  className={`group relative flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
                    columnFormat === "1"
                      ? "border-zinc-400 dark:border-zinc-400 bg-surface/80 ring-1 ring-zinc-400/20"
                      : "border-line bg-surface/30 hover:border-line/90 hover:bg-surface/50"
                  }`}
                >
                  {columnFormat === "1" && (
                    <Check className="absolute top-4 right-4 h-4 w-4 text-fg stroke-[2.5]" />
                  )}
                  <OneColumnIcon
                    className={`mb-3.5 transition-colors ${
                      columnFormat === "1" ? "text-fg" : "text-muted group-hover:text-fg"
                    }`}
                  />
                  <span className="text-[15px] font-semibold text-fg">1 Column</span>
                  <p className="mt-1 text-[13px] text-muted leading-relaxed">
                    Full-width questions. Best for wide screenshots.
                  </p>
                </button>

                {/* 2 Columns Card */}
                <button
                  type="button"
                  onClick={() => setColumnFormat("2")}
                  className={`group relative flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
                    columnFormat === "2"
                      ? "border-zinc-400 dark:border-zinc-400 bg-surface/80 ring-1 ring-zinc-400/20"
                      : "border-line bg-surface/30 hover:border-line/90 hover:bg-surface/50"
                  }`}
                >
                  {columnFormat === "2" && (
                    <Check className="absolute top-4 right-4 h-4 w-4 text-fg stroke-[2.5]" />
                  )}
                  <TwoColumnsIcon
                    className={`mb-3.5 transition-colors ${
                      columnFormat === "2" ? "text-fg" : "text-muted group-hover:text-fg"
                    }`}
                  />
                  <span className="text-[15px] font-semibold text-fg">2 Columns</span>
                  <p className="mt-1 text-[13px] text-muted leading-relaxed">
                    Newspaper flow. Compact and paper-saving.
                  </p>
                </button>
              </div>
            </div>

            {/* Question metadata strip */}
            <div className="space-y-2.5">
              <div>
                <h3 className="text-[14px] font-semibold text-fg">Question metadata strip</h3>
                <p className="text-[13px] text-muted mt-0.5">
                  Badges shown above each question.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {[
                  { key: "showSubject", label: "Subject" },
                  { key: "showChapter", label: "Chapter" },
                  { key: "showMistake", label: "Mistake Type" },
                  { key: "showSource", label: "Source" },
                ].map(({ key, label }) => {
                  const isChecked = metadata[key as keyof MetadataOptions];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setMetadata((prev) => ({
                          ...prev,
                          [key]: !prev[key as keyof MetadataOptions],
                        }))
                      }
                      className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer ${
                        isChecked
                          ? "border-line bg-soft text-fg hover:border-fg/30"
                          : "border-line/60 bg-surface/30 text-muted hover:border-line hover:text-fg"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-fg stroke-[2]" />
                      ) : (
                        <Square className="h-4 w-4 text-muted stroke-[1.75]" />
                      )}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Answers toggle */}
            <div className="space-y-3.5 pt-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-fg">
                    Include answers
                  </h3>
                  <p className="text-[13px] text-muted mt-0.5">
                    Render answer texts below each question.
                  </p>
                </div>

                <div className="shrink-0">
                  <Toggle
                    checked={showAnswers}
                    onChange={(v) => setShowAnswers(v)}
                    label="Include answers below each question"
                  />
                </div>
              </div>
            </div>

            {/* Dark mode screenshot inversion */}
            <div className="space-y-3.5 pt-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-fg">
                    Dark mode screenshot inversion
                  </h3>
                  <p className="text-[13px] text-muted mt-0.5">
                    Turns dark backgrounds into white paper for printing.
                  </p>
                </div>

                <div className="shrink-0">
                  <Toggle
                    checked={darkModeInversionEnabled}
                    onChange={(v) => handleToggleDarkModeInversion(v)}
                    label="Dark mode screenshot inversion"
                  />
                </div>
              </div>

              {analyzingImages && (
                <div className="flex items-center gap-2 text-[12px] text-muted py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Analyzing screenshot luminance on client-side canvas…</span>
                </div>
              )}

              {/* Grid of question thumbnails with instant preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[260px] overflow-y-auto pt-1">
                {selectedQuestions.map((q) => {
                  const analysis = imageAnalysis[q.id];
                  const isInverted = !!inversions[q.id];
                  const ch = chapterById(q.chapterId);

                  return (
                    <div
                      key={q.id}
                      className="group relative rounded-[8px] border border-line bg-surface overflow-hidden flex flex-col"
                    >
                      {/* Live Thumbnail Preview */}
                      <div className="relative aspect-4/3 w-full bg-soft/40 overflow-hidden flex items-center justify-center">
                        {analysis?.previewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={analysis.previewUrl}
                            alt="Question preview"
                            className={`max-h-full max-w-full object-contain transition-all duration-150 ${
                              isInverted ? "invert contrast-[0.98]" : ""
                            }`}
                          />
                        ) : (
                          <div className="text-[11px] text-muted">Loading…</div>
                        )}

                        {/* Dark Detected Badge */}
                        {analysis?.isDark && (
                          <span className="absolute top-1.5 left-1.5 rounded-[4px] bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-xs backdrop-blur-xs flex items-center gap-1">
                            <Moon className="h-2.5 w-2.5" />
                            Dark
                          </span>
                        )}
                      </div>

                      {/* Controls Footer */}
                      <div className="p-2 flex items-center justify-between border-t border-line/60 bg-bg">
                        <span className="text-[11px] text-muted truncate max-w-[90px]">
                          {ch?.name || "Question"}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSingleInversion(q.id)}
                          className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium transition-colors cursor-pointer ${
                            isInverted
                              ? "bg-fg text-bg font-semibold"
                              : "bg-soft text-muted hover:text-fg"
                          }`}
                        >
                          {isInverted ? "Inverted" : "Normal"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: GENERATION & DOWNLOAD ==================== */}
        {step === 3 && (
          <div className="space-y-6 py-2">
            {/* Progress Status Card */}
            <div className="rounded-[10px] border border-line bg-surface/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {progress.stage === "done" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : progress.stage === "error" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red/10 text-red">
                      !
                    </div>
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-fg" />
                  )}
                  <div>
                    <h3 className="text-[14px] font-semibold text-fg">
                      {progress.stage === "done"
                        ? "PDF Ready for Download"
                        : progress.stage === "error"
                        ? "Export Encountered an Error"
                        : "Generating PDF in Browser…"}
                    </h3>
                    <p className="text-[12px] text-muted">{progress.message}</p>
                  </div>
                </div>

                {progress.stage === "done" && pdfBlob && (
                  <span className="text-[12px] font-medium text-muted">
                    {(pdfBlob.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {progress.stage !== "done" && progress.stage !== "error" && (
                <div className="w-full h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-fg transition-all duration-200 ease-out"
                    style={{
                      width: `${
                        progress.total > 0
                          ? Math.round((progress.current / progress.total) * 100)
                          : 15
                      }%`,
                    }}
                  />
                </div>
              )}

              {errorMsg && (
                <div className="rounded-[6px] border border-red/30 bg-red/10 p-3 text-[12px] text-red">
                  {errorMsg}
                </div>
              )}

              {/* Action Buttons when Done */}
              {progress.stage === "done" && pdfUrl && (
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button size="md" variant="primary" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download PDF
                  </Button>
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => window.open(pdfUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Open in Full Viewer
                  </Button>
                  <Button
                    size="md"
                    variant="ghost"
                    onClick={() => setStep(2)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Adjust Settings
                  </Button>
                </div>
              )}
            </div>

            {/* Embedded Live PDF Preview */}
            {pdfUrl && (
              <div className="space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  Live Document Preview
                </span>
                <div className="w-full h-[360px] rounded-[10px] border border-line overflow-hidden bg-soft/50 shadow-xs">
                  <iframe
                    src={pdfUrl}
                    title="PDF Preview"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex flex-none items-center justify-between border-t border-line px-6 py-4 bg-bg">
        <div>
          {step > 1 && step < 3 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2)}
              className="gap-1.5 text-muted hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onClose} className="text-muted hover:text-fg">
            Cancel
          </Button>

          {step === 1 && (
            <Button
              size="sm"
              variant="primary"
              disabled={selectedQuestions.length === 0}
              onClick={() => setStep(2)}
              className="gap-1.5"
            >
              <span>Configure Layout &amp; Colors</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {step === 2 && (
            <Button
              size="sm"
              variant="primary"
              disabled={selectedQuestions.length === 0}
              onClick={handleGoToStep3}
              className="gap-1.5 font-semibold"
            >
              <span>Generate PDF</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {step === 3 && progress.stage === "done" && (
            <Button size="sm" variant="primary" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
