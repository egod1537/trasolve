import { Component, useState } from 'react';
import { API_ROUTES } from '@trasolve/shared';
import { listOpenWebUIModels, type OpenWebUIModel } from '../../api/openwebui';
import { MapAiPanel } from '../../shared/components/chat/MapAiPanel';
import './styles/testbed.css';
import './styles/ai-chat-test.css';

function AiChatTestContent() {
  const [conversation, setConversation] = useState(0);
  const [models, setModels] = useState<OpenWebUIModel[]>([]);
  const [modelsPending, setModelsPending] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

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
    } catch (cause) {
      setModels([]);
      setModelsLoaded(false);
      setModelsError(
        cause instanceof Error
          ? cause.message
          : '모델 목록을 불러올 수 없습니다.',
      );
    } finally {
      setModelsPending(false);
    }
  };

  return (
    <main className="testbed-page ai-chat-test-page">
      <header className="testbed-header">
        <a href="/testbed">← 테스트베드 목록</a>
        <h1>AI Chat Test Bed</h1>
        <p>실제 채팅 API로 대화, 응답 대기, 오류 표시를 확인합니다.</p>
      </header>
      <div className="ai-chat-test-toolbar">
        <code>POST {API_ROUTES.chat}</code>
        <button
          type="button"
          onClick={() => setConversation((value) => value + 1)}
        >
          대화 초기화
        </button>
      </div>
      <p className="ai-chat-test-hint">
        Enter로 전송 · Shift+Enter로 줄바꿈 · 초기화하면 진행 중인 요청도
        취소됩니다.
      </p>
      <section
        className="ai-chat-test-models"
        aria-labelledby="ai-models-title"
      >
        <div>
          <h2 id="ai-models-title">OpenWebUI Models</h2>
          <code>GET {API_ROUTES.openWebUIModels}</code>
        </div>
        <button
          type="button"
          disabled={modelsPending}
          onClick={() => void loadModels()}
        >
          {modelsPending ? '불러오는 중…' : '모델 목록 조회'}
        </button>
        {modelsError ? <p role="alert">{modelsError}</p> : null}
        {modelsLoaded ? (
          models.length ? (
            <ul>
              {models.map((model) => (
                <li key={model.id}>
                  <strong>{model.name}</strong>
                  <code>{model.id}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">사용 가능한 모델이 없습니다.</p>
          )
        ) : null}
      </section>
      <div className="ai-chat-test-panel">
        <MapAiPanel
          key={conversation}
          open
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
