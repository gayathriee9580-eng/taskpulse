import { validationResult } from 'express-validator';
import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware to check express-validator validation results
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return sendError(res, 400, 'Validation failed for request data', formattedErrors);
  }
  next();
};

export default validate;
