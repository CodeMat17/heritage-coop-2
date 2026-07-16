export {};

// Create a type for the Roles
export type Roles = "content-admin" | "assist-admin" | "finance-admin" | "super-admin";

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles;
    };
  }
}
