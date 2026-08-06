export type AuthContext = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
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
