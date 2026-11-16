import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Smooth scrolling plus scroll-triggered reveals for any `[data-reveal]` element.
 * Skipped entirely when the visitor prefers reduced motion.
 */
export function initMotion(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  for (const el of gsap.utils.toArray<HTMLElement>('[data-reveal]')) {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  }

  // A reveal whose start the visitor can never scroll to (the last lines of a page, or a page
  // shorter than the window) would otherwise stay invisible. Play those straight away, and
  // check again whenever ScrollTrigger re-measures the page, for example after photos load.
  const revealUnreachable = () => {
    const maxScroll = ScrollTrigger.maxScroll(window);
    for (const trigger of ScrollTrigger.getAll()) {
      if (trigger.start > maxScroll) trigger.animation?.play();
    }
  };
  ScrollTrigger.addEventListener('refresh', revealUnreachable);
  revealUnreachable();
}
