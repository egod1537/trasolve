import { Component, useState } from 'react';
import { API_ROUTES } from '@trasolve/shared';
import { listOpenWebUIModels, type OpenWebUIModel } from '@/features/ai-chat';
import { MapAiPanel } from '@/features/ai-chat';
import '@/pages/testbed/styles/testbed.css';
import '@/pages/testbed/styles/ai-chat-test.css';
import { NL, useL } from '@/shared/i18n';

function AiChatTestContent() {
  const L = useL();
  const [conversation, setConversation] = useState(0);
  const [models, setModels] = useState<OpenWebUIModel[]>([]);
  const [modelsPending, setModelsPending] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('');

  const loadModels = async () => {
    if (modelsPending) {
      return;
    }
    setModelsPending(true);
    setModelsError(null);
    try {
      const response = await listOpenWebUIModels();
      setModels(response.models);
      setModelsLoaded(true);
      setSelectedModel((current) =>
        response.models.some((model) => model.id === current) ? current : '',
      );
    } catch (cause) {
      setModels([]);
      setModelsLoaded(false);
      setSelectedModel('');
      setModelsError(
        cause instanceof Error
          ? cause.message
          : L(
              'testbed:aiChatTestPage.aiChatTestContent.text.modelListCouldNotBeLoaded',
            ),
      );
    } finally {
      setModelsPending(false);
    }
  };

  return (
    <main className="testbed-page ai-chat-test-page">
      <header className="testbed-header">
        <a href="/testbed">
          {L('testbed:aiChatTestPage.aiChatTestContent.text.testbedList')}
        </a>
        <h1>
          {L('testbed:aiChatTestPage.aiChatTestContent.title.aiChatTestBed')}
        </h1>
        <p>
          {L(
            'testbed:aiChatTestPage.aiChatTestContent.description.checkConversationsWaitResponsesDisplayErrors',
          )}
        </p>
      </header>
      <div className="ai-chat-test-toolbar">
        <code>
          {NL('POST')} {API_ROUTES.chat}
        </code>
        <button
          type="button"
          onClick={() => setConversation((value) => value + 1)}
        >
          {L(
            'testbed:aiChatTestPage.aiChatTestContent.action.resetConversation',
          )}
        </button>
      </div>
      <p className="ai-chat-test-hint">
        {L(
          'testbed:aiChatTestPage.aiChatTestContent.description.sendEnterBreakLineShiftEnter',
        )}
      </p>
      <section
        className="ai-chat-test-models"
        aria-labelledby="ai-models-title"
      >
        <div>
          <h2 id="ai-models-title">
            {L(
              'testbed:aiChatTestPage.aiChatTestContent.title.openwebuiModels',
            )}
          </h2>
          <code>
            {NL('GET')} {API_ROUTES.openWebUIModels}
          </code>
        </div>
        <button
          type="button"
          disabled={modelsPending}
          onClick={() => void loadModels()}
        >
          {modelsPending
            ? L('testbed:aiChatTestPage.aiChatTestContent.action.loading')
            : L(
                'testbed:aiChatTestPage.aiChatTestContent.action.viewModelList',
              )}
        </button>
        {modelsError ? <p role="alert">{modelsError}</p> : null}
        {modelsLoaded ? (
          models.length ? (
            <label className="ai-chat-test-model-selector">
              {L('testbed:aiChatTestPage.aiChatTestContent.label.requestModel')}
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
              >
                <option value="">
                  {L(
                    'testbed:aiChatTestPage.aiChatTestContent.text.serverDefaultModelOpenwebuiModel',
                  )}
                </option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.id})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p role="status">
              {L(
                'testbed:aiChatTestPage.aiChatTestContent.description.thereNoModelsAvailable',
              )}
            </p>
          )
        ) : null}
      </section>
      <div className="ai-chat-test-panel">
        <MapAiPanel
          key={conversation}
          open
          model={selectedModel || undefined}
          onClose={() => window.location.assign('/testbed')}
        />
      </div>
    </main>
  );
}

export default class AiChatTestPage extends Component {
  public render() {
    return <AiChatTestContent />;
  }
}
