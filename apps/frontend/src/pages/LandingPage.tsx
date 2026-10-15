import { Navigate } from "react-router";
import { useAuth } from "../features/auth/hooks/useAuth";
import { FullPageSpinner } from "../components/ui/Spinner";
import { LandingNav } from "../features/landing/components/LandingNav";
import { Hero } from "../features/landing/components/Hero";
import { ConsolePreview } from "../features/landing/components/ConsolePreview";
import { WhySection } from "../features/landing/components/WhySection";
import { HowSection } from "../features/landing/components/HowSection";
import { DeploysSection } from "../features/landing/components/DeploysSection";
import { GatesSection } from "../features/landing/components/GatesSection";
import { FleetSection } from "../features/landing/components/FleetSection";
import { ActivitySection } from "../features/landing/components/ActivitySection";
import { Testimonials } from "../features/landing/components/Testimonials";
import { OpenSourceSection } from "../features/landing/components/OpenSourceSection";
import { ChangelogSection } from "../features/landing/components/ChangelogSection";
import { InstallSection } from "../features/landing/components/InstallSection";
import { LandingFooter } from "../features/landing/components/LandingFooter";
import "../features/landing/landing.css";

/**
 * "/" for visitors. Signed-in users go straight to the console, so every
 * existing redirect to "/" (login, verify, onboarding, GitHub sign-in) still
 * lands them on their projects. If the API is down the page still shows.
 */
export default function LandingPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (user) return <Navigate to="/projects" replace />;

  return (
    <div className="landing">
      <LandingNav />
      <main>
        <Hero />
        <ConsolePreview />
        <WhySection />
        <HowSection />
        <DeploysSection />
        <GatesSection />
        <FleetSection />
        <ActivitySection />
        <Testimonials />
        <OpenSourceSection />
        <ChangelogSection />
        <InstallSection />
      </main>
      <LandingFooter />
    </div>
  );
}
