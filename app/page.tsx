import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/sections/Hero";
import OrchestrationBand from "@/components/sections/OrchestrationBand";
import ValueProps from "@/components/sections/ValueProps";
import Chapters from "@/components/sections/Chapters";
import LifecycleStartBuild from "@/components/sections/LifecycleStartBuild";
import LifecycleSellScale from "@/components/sections/LifecycleSellScale";
import ToolsSystems from "@/components/sections/ToolsSystems";
import Industries from "@/components/sections/Industries";
import FinalCTA from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <OrchestrationBand />
        <ValueProps />
        <Chapters />
        <LifecycleStartBuild />
        <LifecycleSellScale />
        <ToolsSystems />
        <Industries />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
