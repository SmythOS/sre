import Joi from 'joi';

export const createSetting = {
  body: Joi.object({
    key: Joi.string().required(),
    value: Joi.string().required(),
  }),
};

export const getSetting = {
  params: Joi.object({
    key: Joi.string().required(),
  }),
};

export const deleteSetting = {
  params: Joi.object({
    key: Joi.string().required(),
  }),
};

export const createComponent = {
  body: Joi.object({
    name: Joi.string().required(),
    data: Joi.string().required(),
    collectionId: Joi.string().optional().allow(null),
    order: Joi.number().optional().allow(null),
    visible: Joi.boolean().optional().allow(null),
  }),
};

export const updateComponent = {
  body: Joi.object({
    name: Joi.string().optional().allow(null),
    data: Joi.string().optional().allow(null),
    collectionId: Joi.string().optional().allow(null),
    order: Joi.number().optional().allow(null),
    visible: Joi.boolean().optional().allow(null),
  }),
  params: Joi.object({
    componentId: Joi.string().required(),
  }),
};

export const createCollection = {
  body: Joi.object({
    name: Joi.string().required(),
    icon: Joi.string().optional().allow(null),
    order: Joi.number().optional().allow(null),
    visible: Joi.boolean().optional().allow(null),
    color: Joi.string().optional().allow(null),
  }),
};

export const updateCollection = {
  body: Joi.object({
    name: Joi.string().optional().allow(null),
    icon: Joi.string().optional().allow(null),
    order: Joi.number().optional().allow(null),
    visible: Joi.boolean().optional().allow(null),
    color: Joi.string().optional().allow(null),
  }),
  params: Joi.object({
    collectionId: Joi.string().required(),
  }),
};

export const collectionIdParam = {
  params: Joi.object({
    collectionId: Joi.string().required(),
  }),
};

export const componentIdParam = {
  params: Joi.object({
    componentId: Joi.string().required(),
  }),
};
