import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      organizationId?: string;
    }
    
    interface User {
      id: string;
      userId: string;
      email: string;
      name?: string;
      organizationId?: string;
      avatarURL?: string;
      phone?: string;
    }
  }
}

export {};
