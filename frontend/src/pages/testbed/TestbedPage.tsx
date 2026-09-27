import '@/pages/testbed/styles/testbed.css';
import { useL, type Localize } from '@/shared/i18n';

const getTestbeds = (L: Localize) => [
  {
    href: '/testbed/localization',
    get title() {
      return L('testbed:localizationTestPage.title.localizationTestBed');
    },
    get description() {
      return L(
        'testbed:testbedPage.testbeds.description.checkLocaleSpecificResourcesFallbackInterpolation',
      );
    },
  },
  {
    href: '/testbed/tcache-route',
    get title() {
      return L('testbed:testbedPage.testbeds.title.tcacheRoute');
    },
    get description() {
      return L(
        'testbed:testbedPage.testbeds.description.checkRequestProgressResultsCommunicationTimeline',
      );
    },
  },
  {
    href: '/testbed/troute',
    get title() {
      return L('testbed:testbedPage.testbeds.title.trouteIntegration');
    },
    get description() {
      return L(
        'testbed:testbedPage.testbeds.description.trouteOptimizeRequestsThroughTrasolveBackend',
      );
    },
  },
  {
    href: '/testbed/google-maps',
    get title() {
      return L('testbed:testbedPage.testbeds.title.googleMaps');
    },
    get description() {
      return L(
        'testbed:testbedPage.testbeds.description.runPlaceSearchesMapEventsRoute',
      );
    },
  },
  {
    href: '/testbed/ai-chat',
    get title() {
      return L('testbed:testbedPage.testbeds.title.aiChat');
    },
    get description() {
      return L(
        'testbed:testbedPage.testbeds.description.sendReceiveConversationsUsingRealChat',
      );
    },
  },
  {
    href: '/testbed/google-oauth',
    get title() {
      return L('testbed:testbedPage.testbeds.title.googleOauth');
    },
    get description() {
      return L(
        'testbed:testbedPage.testbeds.description.runRealGoogleOauthLoginFlow',
      );
    },
  },
];

export default function TestbedPage() {
  const L = useL();
  const testbeds = getTestbeds(L);
  return (
    <main className="testbed-page">
      <header className="testbed-header">
        <a href="/">{L('testbed:testbedPage.render.text.trasolveHome')}</a>
        <h1>{L('testbed:testbedPage.render.title.testBed')}</h1>
        <p>
          {L(
            'testbed:testbedPage.render.description.thisDebugPageDevelopmentWhereYou',
          )}
        </p>
      </header>
      <nav aria-label={L('testbed:testbedPage.render.ariaLabel.testbedList')}>
        <ul className="testbed-list">
          {testbeds.map(({ href, title, description }) => (
            <li key={href}>
              <a className="testbed-card" href={href}>
                <h2>{title}</h2>
                <p>{description}</p>
                <span className="testbed-card-action">
                  {L('testbed:testbedPage.render.text.openTestbed')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
