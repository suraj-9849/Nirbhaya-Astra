'use client';

import { ActionButton } from '@/components/action-button';
import BackgroundStars from '@/assets/stars.png';
import BackgroundGrid from '@/assets/grid-lines.png';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useTransform,
} from 'framer-motion';
import { RefObject, useEffect, useRef } from 'react';

const useRelativeMousePosition = (to: RefObject<HTMLElement>) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const updateMousePosition = (event: MouseEvent) => {
    if (!to.current) return;
    const { top, left } = to.current.getBoundingClientRect();
    mouseX.set(event.x - left);
    mouseY.set(event.y - top);
  };

  useEffect(() => {
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  });
  return [mouseX, mouseY];
};

export function CallToAction() {
  const sectionRef = useRef<HTMLElement>(null);
  const borderedDivRef = useRef<HTMLDivElement>(null!);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: [`start end`, 'end start'],
  });
  const backgroundPositionY = useTransform(
    scrollYProgress,
    [0, 1],
    [-300, 300]
  );

  const [mouseX, mouseY] = useRelativeMousePosition(borderedDivRef);
  const maskImage = useMotionTemplate`radial-gradient(50% 50% at ${mouseX}px ${mouseY}px, black, transparent)`;

  return (
    <>
      <section className={'py-20 md:py-24'} ref={sectionRef}>
        <div className={'container'}>
          <motion.div
            animate={{ backgroundPositionX: BackgroundStars.width }}
            transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
            className={
              'group relative overflow-hidden rounded-xl border border-muted px-6 py-24'
            }
            style={{
              backgroundImage: `url(${BackgroundStars.src})`,
              backgroundPositionY,
            }}
          >
            <div
              className={
                'absolute inset-0 bg-[rgb(74,32,138)] bg-blend-overlay transition duration-700 [mask-image:radial-gradient(50%_50%_at_50%_35%,black,transparent)] group-hover:opacity-0'
              }
              style={{ backgroundImage: `url(${BackgroundGrid.src})` }}
            />
            <motion.div
              className={
                'absolute inset-0 bg-[rgb(74,32,138)] opacity-0 bg-blend-overlay transition duration-700 group-hover:opacity-100'
              }
              style={{
                backgroundImage: `url(${BackgroundGrid.src})`,
                maskImage: maskImage,
              }}
              ref={borderedDivRef}
            />
            <div className={'relative'}>
              <h2
                className={'text-center text-5xl font-medium tracking-tighter'}
              >
                Nirbhaya Astra.
              </h2>
              <p
                className={
                  'mx-auto mt-5 w-1/2 px-4 text-center text-lg tracking-tight text-white/70 md:text-xl'
                }
              >
                Be part of the solution by creating an account today and helping
                us build a safer community for everyone
              </p>
              <div className={'mt-8 flex justify-center'}>
                <ActionButton href='/auth/signup' label={'Join us'} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
