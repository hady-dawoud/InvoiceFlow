import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import type { BusinessProfile } from "@/lib/business-profile";

export async function updateBusinessProfile(userId: string, profile: BusinessProfile): Promise<boolean> {
  const result = await db.update(user).set({
    businessName: profile.businessName,
    currency: profile.currency,
    taxId: profile.taxId,
    paymentInstructions: profile.paymentInstructions,
    updatedAt: new Date(),
  }).where(eq(user.id, userId));
  return result.rowsAffected > 0;
}
