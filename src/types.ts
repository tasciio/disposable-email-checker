export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  API_RATE_LIMIT?: RateLimitBinding;
  ALLOWED_ORIGINS?: string;
}

export interface WorkerApp {
  fetch(request: Request, env: Env): Promise<Response>;
}

