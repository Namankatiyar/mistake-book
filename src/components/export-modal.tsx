"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  FileDown,
  Square,
  CheckSquare,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Moon,
  Check,
  Loader2,
} from "lucide-react";
import { Modal, Button, IconButton, SubjectIcon } from "@/components/ui";
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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Step 2: PDF Layout & Dark mode options
  const [columnFormat, setColumnFormat] = useState<ColumnFormat>("2");
  const [metadata, setMetadata] = useState<MetadataOptions>({
    showSubject: true,
    showChapter: true,
    showMistake: true,
    showSource: true,
    showAnswerKey: true,
  });

  // Dark mode image recognition state
  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState<Record<string, AnalysisState>>({});
  const [inversions, setInversions] = useState<Record<string, boolean>>({});

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

    // Pre-populate question selection based on current page filters
    let initialList = questions.filter((q) =>
      initialStash === "active" ? !q.stashed : initialStash === "stashed" ? q.stashed : true
    );
    if (initialChapterId) {
      initialList = initialList.filter((q) => q.chapterId === initialChapterId);
    } else if (initialSubjectId) {
      initialList = initialList.filter((q) => q.subjectId === initialSubjectId);
    }
    if (initialMistake === "none") {
      initialList = initialList.filter((q) => !q.mistakeId);
    } else if (initialMistake !== "all") {
      initialList = initialList.filter((q) => q.mistakeId === initialMistake);
    }
    if (initialSource === "none") {
      initialList = initialList.filter((q) => !q.sourceId);
    } else if (initialSource !== "all") {
      initialList = initialList.filter((q) => q.sourceId === initialSource);
    }

    setSelectedQuestionIds(new Set(initialList.map((q) => q.id)));
  }, [open, initialSubjectId, initialChapterId, initialMistake, initialSource, initialStash, syllabus, sources, questions]);

  // Questions filtered by tag pills
  const availableQuestions = useMemo(() => {
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

  // Sync selected questions when filters change
  const handleToggleAllAvailable = () => {
    const allSelected = availableQuestions.every((q) => selectedQuestionIds.has(q.id));
    const next = new Set(selectedQuestionIds);
    if (allSelected) {
      for (const q of availableQuestions) next.delete(q.id);
    } else {
      for (const q of availableQuestions) next.add(q.id);
    }
    setSelectedQuestionIds(next);
  };

  const handleToggleQuestion = (id: string) => {
    const next = new Set(selectedQuestionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQuestionIds(next);
  };

  // Selected questions ordered
  const selectedQuestions = useMemo(() => {
    return questions.filter((q) => selectedQuestionIds.has(q.id));
  }, [questions, selectedQuestionIds]);

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
          if (res.isDark && inversions[q.id] === undefined) {
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
  }, [step, selectedQuestions]);

  // Dark mode counters
  const darkDetectedCount = useMemo(() => {
    return selectedQuestions.filter((q) => imageAnalysis[q.id]?.isDark).length;
  }, [selectedQuestions, imageAnalysis]);

  const allDarkInverted = useMemo(() => {
    const darkOnes = selectedQuestions.filter((q) => imageAnalysis[q.id]?.isDark);
    if (darkOnes.length === 0) return false;
    return darkOnes.every((q) => inversions[q.id]);
  }, [selectedQuestions, imageAnalysis, inversions]);

  const toggleAllDarkInversions = () => {
    const next = { ...inversions };
    const targetState = !allDarkInverted;
    for (const q of selectedQuestions) {
      if (imageAnalysis[q.id]?.isDark) {
        next[q.id] = targetState;
      }
    }
    setInversions(next);
  };

  const toggleSingleInversion = (id: string) => {
    setInversions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
  }, [step, selectedQuestions, sources, columnFormat, metadata, inversions]);

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
      className="h-[88vh] max-h-[88vh] w-full max-w-[820px] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-none items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-soft text-fg">
            <FileDown className="h-4 w-4" />
          </div>
          <h2 className="text-[16px] font-semibold text-fg">Export Questions to PDF</h2>
        </div>

        <IconButton name="x" label="Close export modal" onClick={onClose} />
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
                  {availableQuestions.length} matches in database
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

            {/* Questions Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-medium text-fg">
                  Questions to Include ({selectedQuestions.length} of {availableQuestions.length} selected)
                </span>
                <button
                  type="button"
                  onClick={handleToggleAllAvailable}
                  className="text-[12px] font-medium text-muted hover:text-fg underline underline-offset-2"
                >
                  {availableQuestions.every((q) => selectedQuestionIds.has(q.id))
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {availableQuestions.length === 0 ? (
                <div className="rounded-[8px] border border-line bg-surface/30 p-8 text-center text-muted text-[13px]">
                  No questions match the selected tag filters. Try enabling more subjects or mistake tags above.
                </div>
              ) : (
                <div className="panel divide-y divide-line max-h-[340px] overflow-y-auto">
                  {availableQuestions.map((q) => {
                    const isSelected = selectedQuestionIds.has(q.id);
                    const ch = chapterById(q.chapterId);
                    const m = mistakeById(q.mistakeId);
                    const src = q.sourceId ? sources.find((s) => s.id === q.sourceId) : null;

                    return (
                      <div
                        key={q.id}
                        onClick={() => handleToggleQuestion(q.id)}
                        className={`flex items-center gap-3.5 px-4 py-2.5 cursor-pointer transition-colors ${
                          isSelected ? "bg-soft/50" : "hover:bg-soft/20"
                        }`}
                      >
                        <button
                          type="button"
                          className="shrink-0 text-muted hover:text-fg"
                          aria-label={isSelected ? "Deselect question" : "Select question"}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-fg" />
                          ) : (
                            <Square className="h-4 w-4 text-muted" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-fg truncate">
                            {ch?.name || "Unknown Chapter"}
                          </span>

                          {m && (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] border ${
                                m.tone === "red"
                                  ? "border-red/20 bg-red/10 text-red"
                                  : m.tone === "orange"
                                  ? "border-orange/20 bg-orange/10 text-orange"
                                  : "border-yellow/20 bg-yellow/10 text-yellow"
                              }`}
                            >
                              {m.label}
                            </span>
                          )}

                          {src && (
                            <span className="text-[11px] text-muted bg-soft px-1.5 py-0.5 rounded-[3px]">
                              {src.name}
                            </span>
                          )}

                          {q.answerKey && (
                            <span className="text-[11px] text-muted">
                              Ans: {q.answerKey}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== STEP 2: LAYOUT & DARK MODE ==================== */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Layout Column Format Selection */}
            <div className="rounded-[10px] border border-line bg-surface/40 p-4 space-y-3">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                PDF Page Layout
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setColumnFormat("1")}
                  className={`flex flex-col items-start gap-1.5 rounded-[8px] border p-3.5 text-left transition-all ${
                    columnFormat === "1"
                      ? "border-fg bg-soft/80 shadow-xs"
                      : "border-line bg-surface hover:border-line/80"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[13px] font-semibold text-fg">1 Column</span>
                    {columnFormat === "1" && <Check className="h-4 w-4 text-fg" />}
                  </div>
                  <p className="text-[12px] text-muted leading-relaxed">
                    Full-width questions. Ideal for wide computer screenshots, long equations, and spacious printing.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setColumnFormat("2")}
                  className={`flex flex-col items-start gap-1.5 rounded-[8px] border p-3.5 text-left transition-all ${
                    columnFormat === "2"
                      ? "border-fg bg-soft/80 shadow-xs"
                      : "border-line bg-surface hover:border-line/80"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[13px] font-semibold text-fg">2 Columns</span>
                    {columnFormat === "2" && <Check className="h-4 w-4 text-fg" />}
                  </div>
                  <p className="text-[12px] text-muted leading-relaxed">
                    Newspaper booklet flow (fills Column 1, then Column 2). Highly compact and paper-saving.
                  </p>
                </button>
              </div>
            </div>

            {/* Metadata Badges Toggle */}
            <div className="rounded-[10px] border border-line bg-surface/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[13px] font-semibold text-fg">Question Metadata Strip</h4>
                  <p className="text-[12px] text-muted">
                    Compact badges above each question screenshot in the PDF.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                {[
                  { key: "showSubject", label: "Subject" },
                  { key: "showChapter", label: "Chapter" },
                  { key: "showMistake", label: "Mistake Type" },
                  { key: "showSource", label: "Source" },
                  { key: "showAnswerKey", label: "Answer Key" },
                ].map(({ key, label }) => {
                  const val = metadata[key as keyof MetadataOptions];
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
                      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] transition-colors ${
                        val
                          ? "border-fg/40 bg-soft font-medium text-fg"
                          : "border-line bg-surface text-muted hover:text-fg"
                      }`}
                    >
                      {val ? (
                        <CheckSquare className="h-3.5 w-3.5 text-fg" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-muted" />
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Client-side Dark Mode Detection & Inversion Grid */}
            <div className="rounded-[10px] border border-line bg-surface/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-muted" />
                    <h4 className="text-[13px] font-semibold text-fg">
                      Dark Mode Screenshot Inversion
                    </h4>
                  </div>
                  <p className="text-[12px] text-muted">
                    Inverts dark backgrounds to pure white paper for clear printing and ink-saving.
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={allDarkInverted ? "outline" : "ghost"}
                  onClick={toggleAllDarkInversions}
                  disabled={darkDetectedCount === 0}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
                  {allDarkInverted ? "Undo All Dark Inversions" : `Invert Detected (${darkDetectedCount})`}
                </Button>
              </div>

              {analyzingImages && (
                <div className="flex items-center gap-2 text-[12px] text-muted py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Analyzing screenshot luminance on client-side canvas…</span>
                </div>
              )}

              {/* Grid of question thumbnails with instant preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pt-1">
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
                          className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium transition-colors ${
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
      <div className="flex flex-none items-center justify-between border-t border-line px-6 py-3.5 bg-bg">
        <div>
          {step > 1 && step < 3 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2)}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          {step === 1 && (
            <Button
              size="sm"
              variant="primary"
              disabled={selectedQuestions.length === 0}
              onClick={() => setStep(2)}
            >
              Configure Layout &amp; Colors
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}

          {step === 2 && (
            <Button
              size="sm"
              variant="primary"
              disabled={selectedQuestions.length === 0}
              onClick={handleGoToStep3}
            >
              Generate PDF
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}

          {step === 3 && progress.stage === "done" && (
            <Button size="sm" variant="primary" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
