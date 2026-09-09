import { Component } from 'react';
import '../styles/testbed.css';

const testbeds = [
  {
    href: '/testbed/google-maps',
    title: 'Google Maps',
    description:
      '실제 Google API로 장소 검색, 지도 이벤트, 경로 탐색을 실행하고 결과와 디버그 로그를 확인합니다.',
  },
  {
    href: '/testbed/ai-chat',
    title: 'AI Chat',
    description:
      '실제 채팅 API로 대화를 주고받으며 응답 대기 애니메이션, 대화 이력, 오류 표시를 확인합니다.',
  },
];

export default class TestbedPage extends Component {
  public render() {
    return (
      <main className="testbed-page">
        <header className="testbed-header">
          <a href="/">Trasolve 홈</a>
          <h1>Test Bed</h1>
          <p>기능을 직접 실행하고 확인할 수 있는 개발용 디버그 페이지입니다.</p>
        </header>
        <nav aria-label="테스트베드 목록">
          <ul className="testbed-list">
            {testbeds.map(({ href, title, description }) => (
              <li key={href}>
                <a className="testbed-card" href={href}>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <span className="testbed-card-action">테스트베드 열기 →</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    );
  }
}
