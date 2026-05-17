"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LLMSettingsDialog } from "@/components/llm/settings-dialog";

export function LLMSettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Brain className="h-4 w-4" />
        AI 设置
      </Button>
      <LLMSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
