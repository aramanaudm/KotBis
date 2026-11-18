import { environment } from '../../../environments/environment';

export const apiUrl = environment.apiUrl;

export function apiError(error: unknown): string {
  const httpError = error as {
    error?: { error?: string; message?: string };
    message?: string;
  };

  return (
    httpError?.error?.error ??
    httpError?.error?.message ??
    httpError?.message ??
    'Erreur serveur'
  );
}
