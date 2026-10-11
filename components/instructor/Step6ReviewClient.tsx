"use client";

import { useRouter } from "next/navigation";
import { Step6Review } from "./RegSteps";
import type { RegData } from "@/lib/db/instructor-registration";

export default function Step6ReviewClient({ csrf, data }: { csrf: string; data: RegData }) {
  const router = useRouter();
  return <Step6Review csrf={csrf} data={data} router={router} />;
}