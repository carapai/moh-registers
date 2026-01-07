import { createRoute } from "@tanstack/react-router";
import { PatientTable } from "../components/patient-table";
import { ClientSchema } from "../schemas";
import { RootRoute } from "./__root";
export const TrackedEntitiesRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entities",
    component: PatientTable,
    validateSearch: ClientSchema,
});
