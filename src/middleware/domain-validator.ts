import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

export interface DomainRequest extends Request {
  domainId: string;
}

export const validateDomainId = (req: Request, _res: Response, next: NextFunction) => {
  const domainId = req.headers['x-domain-id'] as string;

  if (!domainId) {
    throw new AppError(400, 'Missing x-domain-id header');
  }

  if (typeof domainId !== 'string' || domainId.trim().length === 0) {
    throw new AppError(400, 'Invalid x-domain-id header');
  }

  // Attach domain ID to request
  (req as DomainRequest).domainId = domainId.trim();

  next();
};
