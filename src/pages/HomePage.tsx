import { HeroSection } from '../components/home';
import { StatsCounter } from '../components/home';
import { FeaturedRoutes } from '../components/home';
import { UpcomingEvents } from '../components/home';
import { AirQualityWidget } from '../components/home';
import { WhyJoinSection } from '../components/home';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsCounter />
      <AirQualityWidget />
      <FeaturedRoutes />
      <UpcomingEvents />
      <WhyJoinSection />
    </>
  );
}
