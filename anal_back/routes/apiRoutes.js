import { Router } from 'express';

export function createRoutes() {
  const router = Router();
  // ...existing code or add desired API routes...
  router.get('/status', (req, res) => {
    res.json({ status: 'API is active' });
  });
  return router;
}
