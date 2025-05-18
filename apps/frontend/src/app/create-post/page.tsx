"use client";

import React, { useState, useEffect } from "react";
import { InputForm } from "@/components/InputForm";
import Share from "@/components/Share";
import HorizontalLinearStepper from "@/components/MultiStep";
import ImageGen from "@/components/ImageGen";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "../../../contexts/AuthContext";

function Page() {
  const [resImage, setResImage] = useState<string | null>(null);
  const [resText, setText] = useState<string | null>(null);
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (resText) {
      setActiveStep(1);
    }
  }, [resText]);

  useEffect(() => {
    if (resImage) {
      setActiveStep(2);
    }
  }, [resImage]);

  useEffect(() => {
    if (shared) {
      setActiveStep(4);
    }
  }, [shared]);

  const stepContent = [
    <InputForm key="step1" setText={setText} />,
    <ImageGen key="step2" text={resText || ""} setResImage={setResImage} />, // Step 2
    <Share
      key="step3"
      imageURL={resImage || ""}
      setShared={setShared}
      resText={resText || ""}
    />,
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center -mt-[150px]">
          <h1 className="text-2xl font-bold">Please sign in to continue</h1>
          <Button>
            <Link
              href="/auth/login"
              className="text-white bg-blue-500 hover:bg-blue-700 px-4 py-2 rounded"
            >
              Sign In
            </Link>
          </Button>
          <p className="mt-4 text-gray-600">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-blue-500 hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <HorizontalLinearStepper
        activeStep={activeStep}
        stepContent={stepContent}
      />
    </div>
  );
}

export default Page;
