import { createRoute, redirect } from "@tanstack/react-router";
import React from "react";
import { RootRoute } from "./__root";
export const IndexRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/",
    component: IndexRouteComponent,
    beforeLoad: () => {
        throw redirect({
            to: "/tracked-entities",
        });
    },
});

function IndexRouteComponent() {
    return <div>Welcome to the Wizard App</div>;
}
