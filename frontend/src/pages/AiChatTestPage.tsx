import { Component, useState } from 'react';
import { API_ROUTES } from '@trasolve/shared';
import { MapAiPanel } from '../components/map/MapAiPanel';
import '../styles/map.css';
import '../styles/testbed.css';
import '../styles/ai-chat-test.css';

function AiChatTestContent() {
  const [conversation, setConversation] = useState(0);

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
