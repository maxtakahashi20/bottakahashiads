const { ZodError } = require('zod');

function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: 'Dados inválidos',
          details: err.flatten()
        });
      }
      next(err);
    }
  };
}

module.exports = { validateBody };
