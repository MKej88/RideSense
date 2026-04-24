export type ApiErrorCode =
  | "UGYLDIG_INPUT"
  | "MANGLENDE_DATA"
  | "EKSTERN_TJENESTE_FEIL"
  | "INTERN_FEIL";

export interface ApiErrorDetails {
  code: ApiErrorCode;
  message: string;
  advice: string;
}

export interface ApiErrorBody {
  ok: false;
  error: ApiErrorDetails;
}

export function createApiError(
  code: ApiErrorCode,
  message: string,
  advice: string
): ApiErrorBody {
  return {
    ok: false,
    error: {
      code,
      message,
      advice
    }
  };
}

export function mapUnexpectedApiError(
  error: unknown,
  options?: {
    externalAdvice?: string;
    internalAdvice?: string;
  }
): ApiErrorDetails {
  const message = error instanceof Error ? error.message : "Ukjent feil";
  const normalizedMessage = message.toLowerCase();
  const hasProviderName =
    normalizedMessage.includes("met api") ||
    normalizedMessage.includes("overpass") ||
    normalizedMessage.includes("geonorge") ||
    normalizedMessage.includes("kartverket") ||
    normalizedMessage.includes("nominatim") ||
    normalizedMessage.includes("open-meteo") ||
    normalizedMessage.includes("værtjenesten") ||
    normalizedMessage.includes("karttjenesten");
  const isExternalServiceError =
    normalizedMessage === "fetch failed" ||
    /svarte med\s\d{3}/i.test(message) ||
    normalizedMessage.includes("svarte ikke raskt nok") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("etimedout") ||
    (normalizedMessage.includes("kunne ikke hente") && hasProviderName);

  if (isExternalServiceError) {
    return {
      code: "EKSTERN_TJENESTE_FEIL",
      message: "Vi fikk ikke svar fra en ekstern tjeneste akkurat nå.",
      advice: options?.externalAdvice || "Vent litt og prøv igjen."
    };
  }

  return {
    code: "INTERN_FEIL",
    message: "Noe gikk galt i tjenesten vår.",
    advice: options?.internalAdvice || "Prøv på nytt om noen minutter."
  };
}

export function getErrorMessageForUi(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const maybeBody = payload as {
    error?: {
      message?: unknown;
      advice?: unknown;
    };
  };

  const message =
    typeof maybeBody.error?.message === "string" ? maybeBody.error.message.trim() : "";
  const advice = typeof maybeBody.error?.advice === "string" ? maybeBody.error.advice.trim() : "";

  if (message && advice) {
    return `${message} Råd: ${advice}`;
  }

  if (message) {
    return message;
  }

  return fallback;
}
