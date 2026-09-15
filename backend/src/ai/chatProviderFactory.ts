import type { ChatProvider } from './chatProvider.js';
import type { OpenWebUIClient } from './openWebUIClient.js';
import { GeminiChatProvider } from './providers/geminiChatProvider.js';
import { OpenWebUIChatProvider } from './providers/openWebUIChatProvider.js';
import { RandomChatProvider } from './providers/randomChatProvider.js';

export type AIProviderName = 'openwebui' | 'gemini' | 'random';

export type ChatProviderConfiguration = {
  provider?: string;
  openWebUIApiKey: string;
  openWebUIModel: string;
  geminiApiKey: string;
  geminiModel: string;
};

export class ChatProviderConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ChatProviderConfigurationError';
  }
}

export function createChatProvider(
  configuration: ChatProviderConfiguration,
  openWebUIClient: OpenWebUIClient | null,
): ChatProvider {
  const provider = configuration.provider?.trim();

  if (provider === undefined || provider === '') {
    return openWebUIClient && configuration.openWebUIApiKey
      ? new OpenWebUIChatProvider(openWebUIClient, configuration.openWebUIModel)
      : new RandomChatProvider();
  }

  switch (provider) {
    case 'openwebui':
      if (!configuration.openWebUIApiKey || !openWebUIClient) {
        throw new ChatProviderConfigurationError(
          'AI_PROVIDER=openwebui requires a valid OPENWEBUI_API_KEY and OPENWEBUI_BASE_URL.',
        );
      }
      if (!configuration.openWebUIModel.trim()) {
        throw new ChatProviderConfigurationError(
          'AI_PROVIDER=openwebui requires OPENWEBUI_MODEL.',
        );
      }
      return new OpenWebUIChatProvider(
        openWebUIClient,
        configuration.openWebUIModel,
      );
    case 'gemini':
      try {
        return new GeminiChatProvider({
          apiKey: configuration.geminiApiKey,
          model: configuration.geminiModel,
        });
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Invalid Gemini settings.';
        throw new ChatProviderConfigurationError(
          `AI_PROVIDER=gemini configuration is invalid: ${message}`,
        );
      }
    case 'random':
      return new RandomChatProvider();
    default:
      throw new ChatProviderConfigurationError(
        `Unsupported AI_PROVIDER value: ${JSON.stringify(provider)}. Expected openwebui, gemini, or random.`,
      );
  }
}
