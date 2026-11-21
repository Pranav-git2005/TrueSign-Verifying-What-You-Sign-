import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const API_BASE = API_BASE_URL;

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;

    if (responseData && typeof responseData === "object") {
      const data = responseData as Record<string, unknown>;

      if (typeof data.message === "string") return data.message;
      if (typeof data.error === "string") return data.error;
    }

    return error.message || "Backend request failed";
  }

  return error instanceof Error
    ? error.message
    : "Unexpected error";
}
