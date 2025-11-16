"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ReportCategory, ReportStatus, UserBan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, ShieldAlert, ShieldCheck, Undo2, UserMinus } from "lucide-react";

const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  action_taken: "Action taken",
  dismissed: "Dismissed",
};

const BAN_PRESETS = [
  { value: "1", label: "1 day", days: 1 },
  { value: "3", label: "3 days", days: 3 },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "indefinite", label: "Indefinite" },
  { value: "custom", label: "Custom date" },
] as const;

const STATUS_FILTERS: Array<{ value: ReportStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "action_taken", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

export type ModerationReport = {
  id: number;
  category: ReportCategory;
  status: ReportStatus;
  description: string | null;
  evidence_urls: string[];
  created_at: string;
  reporter_profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  reported_profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  resolution_note: string | null;
};

export type ActiveBan = UserBan & {
  user_profile?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export function ModeratorDashboard() {
  const { toast } = useToast();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [bans, setBans] = useState<ActiveBan[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [bansLoading, setBansLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("pending");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isUpdatingReport, setIsUpdatingReport] = useState(false);
  const [isIssuingBan, setIsIssuingBan] = useState(false);
  const [banPreset, setBanPreset] = useState<typeof BAN_PRESETS[number]["value"]>("7");
  const [banCustomDate, setBanCustomDate] = useState<string>("");
  const [banReason, setBanReason] = useState("Policy violation");
  const [banFormError, setBanFormError] = useState<string | null>(null);
  const [bansLoadError, setBansLoadError] = useState<string | null>(null);
  const [bansSetupRequired, setBansSetupRequired] = useState(false);
  const [liftingBanIds, setLiftingBanIds] = useState<string[]>([]);
  const [resolutionNote, setResolutionNote] = useState("");
  const [reportStatusOverride, setReportStatusOverride] = useState<ReportStatus | "">("");
  const [justBannedUserIds, setJustBannedUserIds] = useState<string[]>([]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch("/api/moderation/reports", { credentials: "include" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load reports");
      }

      setReports(Array.isArray(payload?.reports) ? (payload.reports as ModerationReport[]) : []);
    } catch (error: any) {
      console.error("Failed to load reports", error);
      toast({ title: "Error", description: error?.message ?? "Unable to load reports", variant: "destructive" });
    } finally {
      setReportsLoading(false);
    }
  }, [toast]);

  const loadBans = useCallback(async () => {
    setBansLoading(true);
    try {
      setBansLoadError(null);
      setBansSetupRequired(false);

      const response = await fetch("/api/moderation/bans?status=active", { credentials: "include" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load bans");
      }

      if (payload?.setupRequired) {
        setBans([]);
        setBansSetupRequired(true);
      } else {
        setBans(Array.isArray(payload?.bans) ? (payload.bans as ActiveBan[]) : []);
      }
    } catch (error: any) {
      console.error("Failed to load bans", error);
      const message = error?.message ?? "Unable to load bans";
      setBansLoadError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setBansLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadReports();
    void loadBans();
  }, [loadReports, loadBans]);

  useEffect(() => {
    setReportStatusOverride("");
    setResolutionNote("");
    setBanFormError(null);
  }, [selectedReportId]);

  useEffect(() => {
    if (justBannedUserIds.length > 0) {
      setJustBannedUserIds([]);
    }
  }, [bans]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => (statusFilter === "all" ? true : report.status === statusFilter));
  }, [reports, statusFilter]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  const handleReportStatusUpdate = useCallback(
    async (reportId: number, nextStatus: ReportStatus, note: string) => {
      setIsUpdatingReport(true);
      try {
        const response = await fetch("/api/moderation/reports", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId, status: nextStatus, resolutionNote: note }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to update report");
        }

        toast({ title: "Report updated", description: `Status set to ${REPORT_STATUS_LABEL[nextStatus]}.` });
        setResolutionNote("");
        setReportStatusOverride("");
        await loadReports();
      } catch (error: any) {
        console.error("Failed to update report", error);
        toast({ title: "Error", description: error?.message ?? "Could not update report", variant: "destructive" });
      } finally {
        setIsUpdatingReport(false);
      }
    },
    [loadReports, toast]
  );

  const computeBanExpiry = useCallback(() => {
    if (banPreset === "indefinite") {
      return null;
    }

    if (banPreset === "custom") {
      return banCustomDate ? new Date(banCustomDate).toISOString() : null;
    }

    const preset = BAN_PRESETS.find((item) => item.value === banPreset);
    if (!preset || !("days" in preset)) {
      return null;
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + preset.days);
    return expires.toISOString();
  }, [banCustomDate, banPreset]);

  const handleIssueBan = useCallback(async () => {
    setBanFormError(null);

    if (!selectedReport?.reported_profile?.id) {
      setBanFormError("Cannot determine reported user");
      return;
    }

    const expiresAt = computeBanExpiry();
    if (banPreset === "custom" && !expiresAt) {
      setBanFormError("Provide a custom end date");
      return;
    }

    setIsIssuingBan(true);

    try {
      const response = await fetch("/api/moderation/bans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedReport.reported_profile.id,
          reason: banReason.trim() || "Policy violation",
          expiresAt,
          sourceReportId: selectedReport.id,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to issue ban");
      }

      toast({
        title: "Ban issued",
        description: expiresAt ? "The user has been suspended." : "Indefinite suspension applied.",
      });
      setJustBannedUserIds((prev) =>
        selectedReport.reported_profile?.id ? [...new Set([...prev, selectedReport.reported_profile.id])] : prev
      );
      setBanReason("Policy violation");
      setBanCustomDate("");
      setBanPreset("7");
      await Promise.all([loadBans(), loadReports()]);
    } catch (error: any) {
      console.error("Failed to issue ban", error);
      setBanFormError(error?.message ?? "Could not create ban");
    } finally {
      setIsIssuingBan(false);
    }
  }, [banReason, banPreset, computeBanExpiry, loadBans, loadReports, selectedReport, toast]);

  const handleLiftBan = useCallback(
    async (banId: string, liftReason: string) => {
      setLiftingBanIds((prev) => (prev.includes(banId) ? prev : [...prev, banId]));
      try {
        const payloadReason = liftReason?.trim().length ? liftReason.trim() : "Lifted by moderator";
        const response = await fetch("/api/moderation/bans", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ banId, liftReason: payloadReason }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to lift ban");
        }

        toast({ title: "Ban removed", description: "The user can access the platform again." });
        await loadBans();
      } catch (error: any) {
        console.error("Failed to lift ban", error);
        toast({ title: "Error", description: error?.message ?? "Could not lift ban", variant: "destructive" });
      }
      finally {
        setLiftingBanIds((prev) => prev.filter((id) => id !== banId));
      }
    },
    [loadBans, toast]
  );

  const showBanForm = useMemo(() => {
    if (!selectedReport?.reported_profile?.id) {
      return false;
    }

    const alreadyBanned = bans.some((ban) => ban.user_profile?.id === selectedReport.reported_profile?.id);
    if (alreadyBanned) {
      return false;
    }

    if (justBannedUserIds.includes(selectedReport.reported_profile.id)) {
      return false;
    }

    return true;
  }, [bans, selectedReport, justBannedUserIds]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <CardTitle>Incoming reports</CardTitle>
            <CardDescription>Newest reports first. Select a card to view full context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportsLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading reports…
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="rounded-md border border-dashed border-muted-foreground/40 py-12 text-center text-sm text-muted-foreground">
                No reports match this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report) => {
                  const isSelected = report.id === selectedReportId;
                  const reporter = report.reporter_profile;
                  const reported = report.reported_profile;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedReportId(report.id)}
                      className={cn(
                        "w-full rounded-lg border bg-card p-4 text-left shadow-sm transition",
                        isSelected
                          ? "border-primary shadow-primary/20"
                          : "border-border hover:border-primary/40 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                            <span>•</span>
                            <span>{report.category.replace(/_/g, " ")}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-foreground">
                            {report.description ?? "No additional description provided."}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {reporter && (
                              <span>
                                Reporter: <strong>{reporter.display_name ?? reporter.username ?? reporter.id}</strong>
                              </span>
                            )}
                            {reported && (
                              <span>
                                Reported: <strong>{reported.display_name ?? reported.username ?? reported.id}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={report.status === "pending" ? "destructive" : "outline"}>
                          {REPORT_STATUS_LABEL[report.status]}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active bans</CardTitle>
            <CardDescription>Lift bans when users resolve issues or after manual review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bansSetupRequired ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-6 text-sm text-blue-900">
                <p className="font-semibold">Finish setup</p>
                <p className="mt-1">
                  No ban records found. Run the `moderation_schema.sql` script in Supabase so bans and moderator controls work.
                </p>
              </div>
            ) : bansLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading bans…
              </div>
            ) : bansLoadError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive">
                <p className="font-semibold">Unable to load bans</p>
                <p className="mt-1">{bansLoadError}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadBans()}>
                  Retry
                </Button>
              </div>
            ) : bans.length === 0 ? (
              <div className="rounded-md border border-dashed border-muted-foreground/40 py-10 text-center text-sm text-muted-foreground">
                No active bans at the moment.
              </div>
            ) : (
              <div className="space-y-3">
                {bans.map((ban) => {
                  const issuedDate = format(new Date(ban.created_at), "dd MMM yyyy HH:mm");
                  const expiresLabel = ban.expires_at
                    ? format(new Date(ban.expires_at), "dd MMM yyyy HH:mm")
                    : "Indefinite";
                  return (
                    <div key={ban.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {ban.user_profile?.display_name ?? ban.user_profile?.username ?? ban.user_id}
                            </p>
                            <p className="text-xs text-muted-foreground">Issued {issuedDate}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Reason: {ban.reason ?? "Not specified"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires: {expiresLabel}
                          </p>
                        </div>
                        <div className="flex flex-col items-stretch gap-2 md:items-end">
                          <Textarea
                            placeholder="Add lift reason"
                            className="h-24 min-w-[220px] text-sm"
                            onChange={(event) => {
                              const value = event.target.value;
                              setBans((prev) =>
                                prev.map((entry) =>
                                  entry.id === ban.id
                                    ? {
                                        ...entry,
                                        lift_reason: value,
                                      }
                                    : entry
                                )
                              );
                            }}
                            value={ban.lift_reason ?? ""}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={liftingBanIds.includes(ban.id)}
                            onClick={() => handleLiftBan(ban.id, ban.lift_reason ?? "Lifted by moderator")}
                          >
                            {liftingBanIds.includes(ban.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Undo2 className="h-4 w-4" />
                            )}
                            Lift ban
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Report details</CardTitle>
            <CardDescription>Approve, dismiss, or escalate to a ban.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedReport ? (
              <div className="space-y-6">
                <div className="space-y-3 rounded-md border border-muted-foreground/40 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldAlert className="h-4 w-4" />
                    <span>{selectedReport.category.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-sm text-foreground">
                    {selectedReport.description ?? "No additional description was provided."}
                  </p>
                  {selectedReport.evidence_urls?.length ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                      <ul className="space-y-1 text-sm text-primary">
                        {selectedReport.evidence_urls.map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-status">Status</Label>
                    <Select
                      value={reportStatusOverride || selectedReport.status}
                      onValueChange={(value) => setReportStatusOverride(value as ReportStatus)}
                    >
                      <SelectTrigger id="report-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REPORT_STATUS_LABEL) as ReportStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>
                            {REPORT_STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resolution-note">Resolution note</Label>
                    <Textarea
                      id="resolution-note"
                      className="min-h-[92px]"
                      placeholder="Add moderator notes for auditing and future reference."
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={isUpdatingReport}
                      onClick={() => void handleReportStatusUpdate(selectedReport.id, "dismissed", resolutionNote)}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Dismiss report
                    </Button>
                    <Button
                      className="gap-2"
                      disabled={isUpdatingReport}
                      onClick={() => {
                        const nextStatus = (reportStatusOverride || selectedReport.status) as ReportStatus;
                        void handleReportStatusUpdate(selectedReport.id, nextStatus, resolutionNote);
                      }}
                    >
                      <Loader2 className={cn("h-4 w-4", isUpdatingReport ? "animate-spin" : "hidden")}
                      />
                      Save status
                    </Button>
                  </div>
                </div>

                {showBanForm ? (
                  <div className="space-y-4 rounded-md border border-muted-foreground/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <UserMinus className="h-4 w-4" />
                      Ban reported user
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ban-reason">Ban reason</Label>
                      <Textarea
                        id="ban-reason"
                        className="min-h-[80px]"
                        value={banReason}
                        onChange={(event) => setBanReason(event.target.value)}
                        placeholder="Describe the policy violation and any enforcement guidance."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ban length</Label>
                      <Select value={banPreset} onValueChange={(value) => setBanPreset(value as typeof BAN_PRESETS[number]["value"]) }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BAN_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {banPreset === "custom" && (
                      <div className="space-y-2">
                        <Label htmlFor="ban-custom-date">Custom end</Label>
                        <Input
                          id="ban-custom-date"
                          type="datetime-local"
                          value={banCustomDate}
                          onChange={(event) => setBanCustomDate(event.target.value)}
                        />
                      </div>
                    )}
                    {banFormError && <p className="text-sm font-medium text-destructive">{banFormError}</p>}
                    <Button disabled={isIssuingBan} className="w-full" onClick={() => void handleIssueBan()}>
                      {isIssuingBan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Issue ban
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="font-medium">Ban already applied</p>
                    <p>This user currently has an active suspension tied to this report.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-muted-foreground/40 py-12 text-center text-sm text-muted-foreground">
                Select a report to view details and enforce policy actions.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
