import { createRoute } from "@tanstack/react-router";
import Client from "../components/client";
import Clients from "../components/clients";
import TrackedEntities from "../components/tracked-entities";
import { ClientSchema } from "../schemas";
import { RootRoute } from "./__root";
export const ClientsRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/clients",
    component: Clients,
    validateSearch: ClientSchema,
});
export const ClientIndexRoute = createRoute({
    getParentRoute: () => ClientsRoute,
    path: "/",
    component: TrackedEntities,
    validateSearch: ClientSchema,
});
export const ClientRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/clients/$clientId",
    component: Client,
});

export const ClientRoutes = ClientsRoute.addChildren([ClientIndexRoute]);
