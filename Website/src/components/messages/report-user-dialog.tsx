"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ReportCategory } from "@/lib/types";

const REPORT_CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string; helper: string }> = [
  {
    value: "harassment_or_bullying",
    label: "Harassment or bullying",
    helper: "Threats, targeted insults, or coordinated harassment.",
  },
  {
    value: "hate_or_violence",
    label: "Hate or violence",
    helper: "Slurs, extremist praise, or inciting violence against protected groups.",
  },
  {
    value: "sexual_or_graphic_content",
    label: "Sexual or graphic content",
    helper: "Explicit imagery, exploitation, or gore.",
  },
  {
    value: "fraud_or_scam",
    label: "Fraud or scam",
    helper: "Phishing, payment fraud, or attempts to obtain sensitive data.",
  },
  {
    value: "impersonation",
    label: "Impersonation",
    helper: "Fake profile or deceptive identity use.",
  },
  {
    value: "spam",
    label: "Spam",
    helper: "Mass unsolicited messages or repeated promotions.",
  },
  {
    value: "other",
    label: "Other",
    helper: "Any other violation of policies or law (describe below).",
  },
];

const REPORT_GUIDELINES: string[] = [
  "Only submit reports for genuine violations; false reports may impact your account.",
  "Provide specific details and examples so moderators can review quickly.",
  "Attach any relevant links or screenshots using the evidence field (optional).",
];

export type ReportFormValues = {
  category: ReportCategory | "";
  description: string;
  evidence: string;
};

const INITIAL_VALUES: ReportFormValues = {
  category: "",
  description: "",
  evidence: "",
};

type ReportUserDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: { category: ReportCategory; description: string; evidenceUrls: string[] }) => Promise<void> | void;
  isSubmitting?: boolean;
  userDisplayName?: string | null;
};

export function ReportUserDialog({ isOpen, onClose, onSubmit, isSubmitting = false, userDisplayName }: ReportUserDialogProps) {
  const [values, setValues] = useState<ReportFormValues>(INITIAL_VALUES);
  const [error, setError] = useState<string | null>(null);

  const evidenceUrls = useMemo(() => {
    return values.evidence
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }, [values.evidence]);

  const resetForm = () => {
    setValues(INITIAL_VALUES);
    setError(null);
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? void 0 : closeAndReset())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Report {userDisplayName ? userDisplayName : "this user"}</DialogTitle>
          <DialogDescription>
            Use this form to flag behaviour that violates our community guidelines. Reports are confidential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="report-category">Category</Label>
            <Select
              value={values.category}
              onValueChange={(value) => setValues((prev) => ({ ...prev, category: value as ReportCategory }))}
              disabled={isSubmitting}
            >
              <SelectTrigger id="report-category">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col text-left">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.helper}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">Details</Label>
            <Textarea
              id="report-description"
              placeholder="Describe what happened, including dates or message excerpts."
              minLength={10}
              value={values.description}
              disabled={isSubmitting}
              onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Provide enough context so moderators understand the situation quickly.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-evidence">Evidence links (optional)</Label>
            <Input
              id="report-evidence"
              placeholder="https://..."
              value={values.evidence}
              disabled={isSubmitting}
              onChange={(event) => setValues((prev) => ({ ...prev, evidence: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Separate multiple URLs with commas or line breaks.</p>
          </div>

          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">Reporting guidelines</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {REPORT_GUIDELINES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={closeAndReset} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              setError(null);
              if (!values.category) {
                setError("Please choose a category");
                return;
              }

              if (values.description.trim().length < 10) {
                setError("Please include at least 10 characters describing the issue");
                return;
              }

              try {
                await onSubmit({
                  category: values.category as ReportCategory,
                  description: values.description.trim(),
                  evidenceUrls,
                });
                resetForm();
                onClose();
              } catch (submissionError: any) {
                const message = submissionError?.message ?? "Could not submit report";
                setError(message);
              }
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
