import { Request } from 'express';

// Extend Express Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      organizationId?: string;
      /** @deprecated Use organizationId */
      tenantId?: string;
    }
    
    // Extend the User interface from Passport
    interface User {
      id: string;
      userId: string;
      email: string;
      name?: string;
      organizationId?: string;
      /** @deprecated Use organizationId */
      tenantId?: string;
      compId?: string;
      compName?: string;
      roleInCompany?: string;
      isAdmin?: boolean;
      avatarURL?: string;
      phone?: string;
    }
  }
}

export {};
