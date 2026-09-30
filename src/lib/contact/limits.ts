// Shared by the form (maxLength) and the API; no dependencies so it is cheap in the client bundle.
export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000 } as const;
