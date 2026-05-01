import type { SquadVerifyResponse } from "@/types/squad";

export async function verifySquadPayment(
  transactionRef: string,
): Promise<SquadVerifyResponse> {
  const res = await fetch(
    `/api/squad/verify?ref=${encodeURIComponent(transactionRef)}`,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      (error as { error?: string }).error ??
        `Verification failed: ${res.status}`,
    );
  }

  return res.json() as Promise<SquadVerifyResponse>;
}
