import type { ChatRequest, ChatResponse } from '@trasolve/shared';
import type { ChatProvider } from '../chatProvider.js';
import { OpenWebUIClient, OpenWebUIClientError } from '../openWebUIClient.js';

export class OpenWebUIChatProvider implements ChatProvider {
  public constructor(client: OpenWebUIClient, model: string) {
    this.client = client;
    this.model = model.trim();
  }

  public async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.model) {
      throw new OpenWebUIClientError(
        'configuration',
        'The OpenWebUI chat model is not configured.',
      );
    }
    const result = await this.client.chat({
      model: this.model,
      messages: request.messages,
    });
    return { message: result.message };
  }

  private readonly client: OpenWebUIClient;
  private readonly model: string;
}
