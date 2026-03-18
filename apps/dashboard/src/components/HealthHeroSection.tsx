import { HealthGauge } from './HealthGauge';

interface ScoreBreakdown {
  visual: number;
  consistency?: number;
  accessibility?: number;
  performance?: number;
}

interface HealthHeroSectionProps {
  score: number;
  breakdown?: ScoreBreakdown;
  trendSummary: string;
}

export function HealthHeroSection({ score, breakdown, trendSummary }: HealthHeroSectionProps) {
  return (
    <section data-testid="hero-health-section" className="s-card-elevated p-8">
      <div className="flex flex-col items-center">
        <HealthGauge score={score} size={220} breakdown={breakdown} />
        <h2
          className="mt-4 text-lg font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Overall Health
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--s-text-tertiary)' }}>
          {trendSummary}
        </p>
      </div>
    </section>
  );
}
