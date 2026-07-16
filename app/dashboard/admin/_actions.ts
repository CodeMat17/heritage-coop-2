"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

export type AdminUserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
};

export async function listAdmins(): Promise<
  { users: AdminUserRow[] } | { message: string }
> {
  const { sessionClaims } = await auth();

  if (sessionClaims?.metadata?.role !== "super-admin") {
    return { message: "Not Authorized" };
  }

  const client = await clerkClient();

  try {
    const res = await client.users.getUserList({ limit: 500 });
    const users: AdminUserRow[] = res.data
      .filter((u) => Boolean((u.publicMetadata as { role?: string })?.role))
      .map((u) => ({
        id: u.id,
        email:
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress ??
          u.emailAddresses[0]?.emailAddress ??
          null,
        firstName: u.firstName,
        lastName: u.lastName,
        role: (u.publicMetadata as { role?: string })?.role ?? null,
      }));
    return { users };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Failed to list admins" };
  }
}

export async function searchUsers(
  query: string,
): Promise<{ users: AdminUserRow[] } | { message: string }> {
  const { sessionClaims } = await auth();

  if (sessionClaims?.metadata?.role !== "super-admin") {
    return { message: "Not Authorized" };
  }

  const email = query.trim();

  if (!email) {
    return { users: [] };
  }

  const client = await clerkClient();

  try {
    const res = await client.users.getUserList({
      emailAddress: [email],
      limit: 20,
    });
    const users: AdminUserRow[] = res.data.map((u) => ({
      id: u.id,
      email:
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        null,
      firstName: u.firstName,
      lastName: u.lastName,
      role: (u.publicMetadata as { role?: string })?.role ?? null,
    }));
    return { users };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Failed to search users" };
  }
}

export async function setRole(formData: FormData) {
  const { sessionClaims } = await auth();

  // Check that the user trying to set the Role is an admin
  if (sessionClaims?.metadata?.role !== "super-admin") {
    return { message: "Not Authorized" };
  }

  // Initialize `clerkClient`
  const client = await clerkClient();

  try {
    // Use the `updateUserMetadata()` method to update the user's Role
    const res = await client.users.updateUserMetadata(
      formData.get("id") as string,
      {
        publicMetadata: { role: formData.get("role") },
      },
    );
    return { message: res.publicMetadata };
  } catch (err) {
    return { message: err };
  }
}

export async function removeRole(formData: FormData) {
  const { sessionClaims } = await auth();

  // Check that the user trying to remove the Role is an admin
  if (sessionClaims?.metadata?.role !== "super-admin") {
    return { message: "Not Authorized" };
  }

  const client = await clerkClient();

  try {
    const res = await client.users.updateUserMetadata(
      formData.get("id") as string,
      {
        publicMetadata: { role: null },
      },
    );
    return { message: res.publicMetadata };
  } catch (err) {
    return { message: err };
  }
}
