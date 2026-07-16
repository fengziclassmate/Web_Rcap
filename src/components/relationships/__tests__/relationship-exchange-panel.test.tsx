import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationshipExchangePanel } from "@/components/relationships/relationship-exchange-panel";
import { defaultResearchWorkflowState } from "@/lib/research-workflow";
import * as relationshipApi from "@/lib/relationships-api";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/relationships-api", () => ({
    fetchRelationshipWorkspace: vi.fn(async () => ({
      contacts: [{
        id: "c4d4ad73-421a-4d7f-8564-237eb6bb7dd2",
        name: "张老师",
        alias: "张导",
        relationshipType: "mentor",
        organization: "研究院",
        role: "",
        phone: "",
        email: "",
        notes: "",
        importantDates: [],
        aiUsageAllowed: false,
        archivedAt: null,
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      }],
      records: [],
    })),
    createRelationshipContact: vi.fn(),
    createRelationshipRecord: vi.fn(async () => ({ id: "record-1" })),
    uploadRelationshipAttachment: vi.fn(async () => undefined),
    patchRelationshipFollowUp: vi.fn(),
    patchRelationshipRecord: vi.fn(),
    removeRelationshipRecord: vi.fn(),
    removeRelationshipAttachment: vi.fn(),
    clearRelationshipWorkspace: vi.fn(),
    archiveRelationshipContact: vi.fn(),
    downloadRelationshipExport: vi.fn(),
}));

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RelationshipExchangePanel
        userId="user-1"
        tasks={[]}
        events={[]}
        workflow={defaultResearchWorkflowState}
        onCreateTask={() => "task-1"}
        onCreateEvent={() => "event-1"}
      />
    </QueryClientProvider>,
  );
}

describe("RelationshipExchangePanel", () => {
  it("opens the quick add flow and exposes advanced fields on demand", async () => {
    renderPanel();
    expect(await screen.findByRole("heading", { name: "人情往来" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /记一笔往来/ }));
    expect(screen.getByRole("heading", { name: "记一笔往来" })).toBeTruthy();
    expect(screen.queryByText(/附件（PDF/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "更多背景信息" }));
    expect(screen.getByText(/附件（PDF/)).toBeTruthy();
  });

  it("submits a basic given record with an optional value", async () => {
    renderPanel();
    await screen.findByRole("heading", { name: "人情往来" });
    fireEvent.click(screen.getByRole("button", { name: /记一笔往来/ }));
    fireEvent.click(screen.getByRole("button", { name: "我给予" }));
    fireEvent.change(screen.getByLabelText("联系人"), { target: { value: "c4d4ad73-421a-4d7f-8564-237eb6bb7dd2" } });
    fireEvent.change(screen.getByLabelText("事件标题"), { target: { value: "提供论文修改帮助" } });
    fireEvent.change(screen.getByLabelText("第 1 项内容"), { target: { value: "逐段修改论文" } });
    fireEvent.change(screen.getByLabelText("第 1 项金额"), { target: { value: "88.50" } });
    fireEvent.click(screen.getByRole("button", { name: "保存往来" }));

    await waitFor(() => expect(relationshipApi.createRelationshipRecord).toHaveBeenCalled());
    expect(vi.mocked(relationshipApi.createRelationshipRecord).mock.calls.at(-1)?.[0]).toMatchObject({
      direction: "given",
      title: "提供论文修改帮助",
      items: [{ itemName: "逐段修改论文", estimatedValueMinor: 8850, currency: "CNY" }],
    });
  });
});
