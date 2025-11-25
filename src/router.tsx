import { QueryClient } from "@tanstack/react-query";
import {
	createHashHistory,
	createRouter,
	ErrorComponent,
} from "@tanstack/react-router";
import React from "react";
import Spinner from "./components/Spinner";
import { RootRoute } from "./routes/__root";
import { ClientRoutes } from "./routes/clients";
import { IndexRoute } from "./routes/index";

const routeTree = RootRoute.addChildren([IndexRoute, ClientRoutes]);
export const router = createRouter({
    routeTree,
    defaultPendingComponent: () => <Spinner />,
    defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
    history: createHashHistory(),
    context: { queryClient: new QueryClient(), engine: undefined! },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
