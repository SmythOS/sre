import { NextFunction } from 'express';
import Joi, { ObjectSchema, Schema } from 'joi';
import ApiError from '../utils/apiError';

type AnyObject = {
    [x: string]: any;
};

const pick = (object: AnyObject, keys: string[]) =>
    keys.reduce((newObject: AnyObject, key) => {
        if (object && Object.prototype.hasOwnProperty.call(object, key)) {
            // eslint-disable-next-line no-param-reassign
            newObject[key] = object[key];
        }
        return newObject;
    }, {});

type SchemaObject = {
    body?: ObjectSchema<any> | Schema;
    query?: ObjectSchema<any> | Schema;
    params?: ObjectSchema<any> | Schema;
};

const validate = (schema: SchemaObject) => (req: any, _res: any, next: NextFunction) => {
    const validSchema = pick(schema, ['params', 'query', 'body']);
    const object = pick(req, Object.keys(validSchema));
    const { value, error } = Joi.compile(validSchema)
        .prefs({ errors: { label: 'key' }, abortEarly: false })
        .validate(object);

    if (error) {
        const errorMessage = error.details.map((details) => details.message).join(', ');
        return next(new ApiError(400, errorMessage));
    }
    Object.assign(req, value);
    return next();
};

export { validate };
