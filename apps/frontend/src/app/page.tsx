
import { CallToAction } from '@/components/call-to-action';
import { Features } from '@/components/features';
import { HeroSection } from '@/components/HeroSection';
import SiteFooter from '@/components/site-footer';

export default function Home() {
  return (
    <div className='max-w-screen bg-black text-white flex items-center justify-center flex-col' > 
      <HeroSection />
      <Features />
      <CallToAction />
      <SiteFooter />
    </div>
  );
}
