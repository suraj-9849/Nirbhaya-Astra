import PostDetail from "@/components/PostDetail";
import React from "react";

type Params = Promise<{ id: string }>;

async function Page({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <div className="h-full">
      <PostDetail id={id} />
    </div>
  );
}

export default Page;
