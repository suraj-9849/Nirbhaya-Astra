"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import BackgroundStars from "@/assets/stars.png";
import { ActionButton } from "./action-button";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: [`start end`, "end start"],
  });
  const backgroundPositionY = useTransform(
    scrollYProgress,
    [0, 1],
    [-300, 300]
  );

  return (
    <>
      <motion.section
        animate={{ backgroundPositionX: BackgroundStars.width }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        className={
          "relative flex h-[492px] w-[95vw] items-center overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] md:h-[800px]"
        }
        style={{
          backgroundImage: `url(${BackgroundStars.src})`,
          backgroundPositionY,
        }}
        ref={sectionRef}
      >
        <div
          className={
            "absolute inset-0 bg-[radial-gradient(75%_75%_at_center_center,rgb(140,69,255,0.5)_15%,rgb(14,0,36,0.5)_78%,transparent)]"
          }
        />
        <div
          className={
            "absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-purple-500 bg-[radial-gradient(50%_50%_at_16.8%_18.3%,white,rgb(184,148,255)_37.7%,rgb(24,0,66))] shadow-[-20px_-20px_50px_rgb(255,255,255,0.5),-20px_-20px_80px_rgb(255,255,255,0.1),0_0_50px_rgb(140,69,255)] md:size-96"
          }
        />
        <motion.div
          style={{ translateY: "-50%", translateX: "-50%" }}
          animate={{ rotate: "1turn" }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className={
            "absolute left-1/2 top-1/2 size-[344px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white opacity-20 md:size-[580px]"
          }
        >
          <div
            className={
              "absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            }
          />
          <div
            className={
              "absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            }
          />
          <div
            className={
              "absolute left-full top-1/2 inline-flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white"
            }
          >
            <div className={"size-2 rounded-full bg-white"} />
          </div>
        </motion.div>
        <motion.div
          style={{ translateY: "-50%", translateX: "-50%" }}
          animate={{ rotate: "-1turn" }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className={
            "absolute left-1/2 top-1/2 size-[444px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/20 md:size-[780px]"
          }
        />
        <motion.div
          style={{ translateY: "-50%", translateX: "-50%" }}
          animate={{ rotate: "1turn" }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className={
            "absolute left-1/2 top-1/2 size-[544px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white opacity-20 md:size-[980px]"
          }
        >
          <div
            className={
              "absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            }
          />
          <div
            className={
              "absolute left-full top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            }
          />
        </motion.div>
        <div
          className={
            " mx-auto  flex flex-col items-center justify-center relative mt-16"
          }
        >
          <h1
            className={
              "bg-white  bg-[radial-gradient(100%_100%_at_top_left,white,white,rgb(74,32,138,0.5))] bg-clip-text text-center text-8xl font-semibold tracking-tighter text-transparent md:text-[168px] md:leading-none"
            }
          >
            Nirbhaya-Astra
          </h1>
          <p
            className={
              "mx-auto mt-5 max-w-xl text-center text-lg text-white/70 md:text-xl"
            }
          >
            Empowering women through technology and community support. Our
            mission is to create a world where everyone feels safe and secure.
          </p>
          <div className={"mt-8 flex justify-center"}>
            <ActionButton  href="/auth/signup" label={"Join us"} />
          </div>
        </div>
      </motion.section>
    </>
  );
}
