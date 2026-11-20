export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface LlmRequest { system: string; userText: string; image?: { base64: string; mediaType: MediaType }; maxTokens: number; /** true when the reply must be a JSON object (document reading). Text answers leave this off. */ expectJson?: boolean }
/** Anything that can read a document image and return text. Real, mock and oracle clients implement this. */
export interface LlmStats { calls: number; inputTokens: number; outputTokens: number; modelVersion?: string }
export interface LlmClient { complete(req: LlmRequest): Promise<string>; stats?: LlmStats }
export type IssueCode = 'wrong_document' | 'invalid_output' | 'service_error' | 'bad_image';
export class ExtractionError extends Error {
  constructor(public code: IssueCode, message: string = code, public detail: string = '') { super(message); }   // never put document content in message or detail. `detail` is for setup tools only and is never sent to browsers
}
