// Available OpenRouter models for judge creation
export const AVAILABLE_MODELS = [
  "google/gemini-2.5-flash-preview-09-2025",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "xai/grok-4-fast-reasoning",
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

// Model display names for UI
export const MODEL_DISPLAY_NAMES: Record<AvailableModel, string> = {
  "google/gemini-2.5-flash-preview-09-2025": "Google Gemini 2.5 Flash",
  "anthropic/claude-haiku-4.5": "Anthropic Claude Haiku 4.5",
  "openai/gpt-5-mini": "OpenAI GPT-5 Mini",
  "xai/grok-4-fast-reasoning": "xAI Grok 4 Fast Reasoning",
};
