import type { ChatRequest, ChatResponse } from '@trasolve/shared';
import type { ChatProvider } from '../chatProvider.js';
import { OpenWebUIClient, OpenWebUIClientError } from '../openWebUIClient.js';

export class OpenWebUIChatProvider implements ChatProvider {
  public constructor(client: OpenWebUIClient, defaultModel: string) {
    this.client = client;
    this.defaultModel = defaultModel.trim();
  }

  public async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model ?? this.defaultModel;
    if (!model) {
      throw new OpenWebUIClientError(
        'configuration',
        'The OpenWebUI chat model is not configured.',
      );
    }
    const result = await this.client.chat({
      model,
      messages: request.messages,
    });
    return { message: result.message };
  }

  private readonly client: OpenWebUIClient;
  private readonly defaultModel: string;
}
