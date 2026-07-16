"use client";

import { useEffect } from "react";
import { initErrorBuffer } from "@/lib/error-buffer";

/** Mounts once from the root layout to start capturing client error telemetry. */
export function ErrorBufferInit() {
  useEffect(() => {
    initErrorBuffer();
  }, []);
  return null;
}
