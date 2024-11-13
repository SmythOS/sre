import express, { Router } from 'express';
import { openaiRouter } from '../modules/openai/routes';
import config from '../config';

const router = express.Router();

const mainRouter = Router();

type Route = {
    rootPath: string;
    route: Router;
    requireAuth?: boolean;
};

const defaultRoutes: Route[] = [
    {
        rootPath: '/',
        route: openaiRouter,
    },
];

const devRoutes: Route[] = [];

defaultRoutes.forEach((route) => {
    mainRouter.use(route.rootPath, route.route);
});

if (config.env.NODE_ENV === 'development') {
    devRoutes.forEach((route) => {
        mainRouter.use(route.rootPath, route.route);
    });
}

export { mainRouter as routes };
