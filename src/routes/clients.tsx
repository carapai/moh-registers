import { createRoute } from "@tanstack/react-router";
import Client from "../components/client";
import Clients from "../components/clients";
import { ClientSchema, TrackedEntityResponse } from "../schemas";
import { RootRoute } from "./__root";
import { resourceQueryOptions } from "../query-options";
export const ClientsRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/clients",
    component: Clients,
    validateSearch: ClientSchema,
    loaderDeps: ({ search: { orgUnit } }) => ({ orgUnit }),
    loader: async ({ context: { engine, queryClient }, deps: { orgUnit } }) => {
        const data = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: "tracker/trackedEntities",
                params: {
                    orgUnit,
                    program: "ueBhWkWll5v",
                },
            }),
        );
        return data;
    },
});
export const ClientRoute = createRoute({
    getParentRoute: () => ClientsRoute,
    path: "/:clientId",
    component: Client,
});

export const ClientRoutes = ClientsRoute.addChildren([ClientRoute]);
