import { BadgeCheck, ShieldAlert, CheckCircle2, CircleX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { VerificationResult } from "@/lib/verification";

type VerificationStatusCardProps = Readonly<{ result: VerificationResult }>;

export function VerificationStatusCard({ result }: VerificationStatusCardProps) {
  const passedFactors = result.factors.filter((factor) => factor.achieved).length;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {result.eligible ? (
            <BadgeCheck className="h-5 w-5 text-primary" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          )}
          Verification Status
        </CardTitle>
        <CardDescription>
          {result.eligible
            ? "You meet the requirements for a verified creator badge."
            : "Complete the checklist below to become a verified creator."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Score</span>
            <span>
              {result.totalPoints}/{result.maxPoints} pts
            </span>
          </div>
          <Progress value={result.percentage} aria-label="Verification progress" />
          <div className="text-xs text-muted-foreground">
            Threshold: {result.threshold} pts · Factors passed: {passedFactors}/{result.factors.length}
          </div>
        </div>

        <div className="space-y-3">
          {result.factors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
            >
              {factor.achieved ? (
                <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500" />
              ) : (
                <CircleX className="mt-1 h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{factor.label}</span>
                  <span className="text-xs text-muted-foreground">{factor.points} pts</span>
                </div>
                <p className="text-xs text-muted-foreground">{factor.description}</p>
                {factor.metadata?.details?.length ? (
                  <div className="space-y-0.5">
                    {factor.metadata.details.map((detail) => (
                      <p key={`${factor.id}-${detail}`} className="text-xs text-muted-foreground">
                        {detail}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
