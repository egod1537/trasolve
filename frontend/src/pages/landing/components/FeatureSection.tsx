import { FeatureCard } from './FeatureCard';

const features = [
  {
    title: '여행 일정',
    description: '날짜별로 방문할 장소와 시간을 정리합니다.',
  },
  {
    title: '이동 경로',
    description: '장소 간 위치와 이동 순서를 일정과 함께 확인합니다.',
  },
  {
    title: '여행 템플릿',
    description: '다른 일정 구조를 참고해 여행 계획을 시작합니다.',
  },
];

export function FeatureSection() {
  return (
    <section
      className="features"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <h2 id="features-title">일정과 경로를 함께 관리합니다.</h2>
      </div>
      <ol className="feature-list">
        {features.map((feature, index) => (
          <FeatureCard
            key={feature.title}
            {...feature}
            index={String(index + 1).padStart(2, '0')}
          />
        ))}
      </ol>
    </section>
  );
}
