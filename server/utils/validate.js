// Runs express-validator chains and answers 400 with the first problem found.
const { validationResult } = require('express-validator');

function validate(chains) {
    return async (req, res, next) => {
        for (const chain of chains) await chain.run(req);
        const result = validationResult(req);
        if (result.isEmpty()) return next();

        const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
        res.status(400).json({ message: errors[0].message, errors });
    };
}

module.exports = validate;
