
export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body: any;
}

export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string; // Body is a string; handlers are responsible for JSON.stringify.
}

// Defines the standard signature for all framework-agnostic handlers.
export type HttpHandler = (req: HttpRequest) => Promise<HttpResponse>;