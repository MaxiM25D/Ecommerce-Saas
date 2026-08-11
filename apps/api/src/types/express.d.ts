export type AuthContext = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    platformRole: "USER" | "SUPERADMIN";
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  role: "OWNER" | "ADMIN" | "STAFF";
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
