"use client";

import { useEffect } from "react";
import { useAuth } from "@jettoptx/auth/next";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams } from "next/navigation";

export function ConvexUserSync() {
  const { isSignedIn, xProfile, isLoaded } = useAuth();
  const upsertFromXOAuth = useMutation(api.users.upsertFromXOAuth);
  const searchParams = useSearchParams();
  const shouldSync = searchParams.get("sync") === "true";

  useEffect(() => {
    const syncUser = async () => {
      if (!isLoaded || !isSignedIn || !xProfile?.id || !shouldSync) return;

      try {
        await upsertFromXOAuth({
          xId: xProfile.id,
          username: xProfile.username,
          displayName: xProfile.name || xProfile.username,
          avatarUrl: xProfile.profile_image_url ?? "",
          verified: xProfile.verified,
        });
        console.log("✅ Convex user loaded/updated for x:", xProfile.username);

        // Optional: clean up the sync param from URL
        const url = new URL(window.location.href);
        url.searchParams.delete("sync");
        window.history.replaceState({}, "", url.toString());
      } catch (error) {
        console.error("Failed to sync user to Convex:", error);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, xProfile, upsertFromXOAuth, shouldSync]);

  return null; // This is a silent sync component
}
