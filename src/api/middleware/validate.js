function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });

    if (error) {
      return res.status(422).json({
        error: 'validation_error',
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
    }

    req[target] = value;
    next();
  };
}

module.exports = { validate };
