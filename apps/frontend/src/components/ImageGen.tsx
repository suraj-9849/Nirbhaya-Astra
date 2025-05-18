"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { useState } from "react";
import Image from "next/image";
import { Skeleton } from "./ui/skeleton";
import { SparklesIcon } from "lucide-react";
import Link from "next/link";

// Updated Zod validation schema for form
const FormSchema = z.object({
  generatedText: z.string(),
  prompt: z.string().min(3, { message: "Please specify the image prompt." }),
});

export default function ImageGen({
  text,
  setResImage,
}: {
  text: string;
  setResImage: (resImage: string) => void;
}) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      generatedText: text || "",
      prompt: "",
    },
  });

  const [imageOptions, setImageOptions] = useState<string[] | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  const promptSuggestions = [
    "Good Morning",
    "Good Night",
    "Sunset",
    "Mountains",
    "Ocean",
  ];

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true); // Start loading state
    try {
      const res = await axios.post("/api/generate-image", {
        prompt: data.prompt,
        generatedText: data.generatedText,
      });

      console.log("Image options generated:", res.data.images);
      const urls = res.data.image_urls || res.data.images;
      if (urls && urls.length > 0) {
        setImageOptions(urls);
      } else {
        console.error("No image URLs found in response", res.data);
        alert("No images found. Please try a different prompt.");
      }
    } catch (error) {
      console.error("Error generating images:", error);
      alert("Error generating images. Please try again later.");
    } finally {
      setIsLoading(false); // End loading state
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    form.setValue("prompt", suggestion);
  };

  const handleImageSelect = (imageUrl: string) => {
    setSelectedImage(imageUrl); // Set the selected image as final
    setResImage(imageUrl); // Update the parent component with the final image URL
  };

  const handleTextOptionClick = (text: string) => {
    setSelectedText(text); // Set the selected text
    setSelectedModel("titan"); // Set the model to Titan (updated from Gemini)
    form.setValue("generatedText", text); // Update the form field with the selected text
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-4xl mx-auto space-y-9 w-full"
      >
        <FormField
          control={form.control}
          name="generatedText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Generated Text</FormLabel>
              <FormControl>
                <Textarea {...field} value={text} rows={8} />
              </FormControl>

              <div className="flex items-center gap-2 font-medium text-slate-700 float-right text-sm">
                <SparklesIcon size={18} />
                <h1>
                  Generated with{" "}
                  <Link
                    href={"https://aws.amazon.com/bedrock/"}
                    target="_blank"
                    className="underline underline-offset-2 text-blue-600"
                  >
                    Titan Text G1 - Express (Amazon Bedrock)
                  </Link>
                </h1>
              </div>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image Prompt</FormLabel>
              <FormControl>
                <Input
                  className=""
                  placeholder="Enter Image Prompt (e.g., Good Morning, Sunset)"
                  {...field}
                />
              </FormControl>
              <div className="flex gap-2 mt-2">
                {promptSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="bg-slate-200 text-slate-700 text-sm px-3 py-1 rounded-xl hover:bg-slate-300 transition duration-150"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Get Images from Unsplash
        </Button>
      </form>

      {isLoading ? (
        // Skeleton loader shown while the images are being generated
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold">Fetching Images...</h2>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-[192px] w-full bg-gray-300" />
            ))}
          </div>
        </div>
      ) : imageOptions && imageOptions.length > 0 ? (
        <div className="mt-6 space-y-4 mb-6">
          <h2 className="text-xl font-semibold">Select an Image</h2>
          <div className="grid grid-cols-3 gap-4">
            {imageOptions.map((imageUrl, index) => (
              <div
                key={index}
                className="cursor-pointer shadow hover:shadow-lg hover:scale-105 duration-200"
                onClick={() => handleImageSelect(imageUrl)}
              >
                <div className="relative w-full h-48 overflow-hidden rounded-md">
                  <Image
                    src={imageUrl}
                    alt={`Image ${index + 1}`}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Form>
  );
}
