interface FeatureCardProps {
  index: string;
  title: string;
  description: string;
}

export function FeatureCard({ index, title, description }: FeatureCardProps) {
  return (
    <li className="feature-row">
      <span className="feature-index" aria-hidden="true">
        {index}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </li>
  );
}
