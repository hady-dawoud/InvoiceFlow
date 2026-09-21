import { describe, expect, it } from "vitest";
import { decideStripeAction, type StripeEventLike } from "@/lib/stripe-events";

function event(type: string, object: Record<string, unknown>): StripeEventLike {
  return { type, data: { object } };
}

describe("decideStripeAction", () => {
  it("grants Pro on checkout completion with user metadata", () => {
    const action = decideStripeAction(
      event("checkout.session.completed", {
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { userId: "u1" },
      }),
    );
    expect(action).toEqual({
      type: "grant_pro",
      userId: "u1",
      customerId: "cus_123",
      subscriptionId: "sub_123",
    });
  });

  it("falls back to client_reference_id for the user", () => {
    const action = decideStripeAction(
      event("checkout.session.completed", {
        customer: "cus_1",
        client_reference_id: "u2",
      }),
    );
    expect(action).toMatchObject({ type: "grant_pro", userId: "u2" });
  });

  it("ignores checkout sessions it cannot attribute", () => {
    expect(decideStripeAction(event("checkout.session.completed", { customer: "cus_1" })))
      .toMatchObject({ type: "ignore" });
    expect(
      decideStripeAction(event("checkout.session.completed", { metadata: { userId: "u1" } })),
    ).toMatchObject({ type: "ignore" });
  });

  it("revokes Pro when a subscription is deleted", () => {
    expect(
      decideStripeAction(event("customer.subscription.deleted", { id: "sub_9", customer: "cus_9" })),
    ).toEqual({ type: "revoke_pro", subscriptionId: "sub_9", customerId: "cus_9" });
  });

  it("revokes on canceled/unpaid status updates", () => {
    for (const status of ["canceled", "unpaid"]) {
      expect(
        decideStripeAction(
          event("customer.subscription.updated", { id: "sub_9", customer: "cus_9", status }),
        ).type,
      ).toBe("revoke_pro");
    }
  });

  it("keeps Pro for active, trialing and past_due statuses", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      const action = decideStripeAction(
        event("customer.subscription.updated", { id: "sub_9", customer: "cus_9", status }),
      );
      expect(action).toMatchObject({ type: "ignore", reason: `status ${status} keeps Pro` });
    }
  });

  it("ignores unrelated events", () => {
    expect(decideStripeAction(event("invoice.paid", { id: "in_1" })).type).toBe("ignore");
    expect(decideStripeAction(event("customer.created", { id: "cus_1" })).type).toBe("ignore");
  });
});
