import { createRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import MedicalRegistry from "../components/medical-registry";
import { resourceQueryOptions } from "../query-options";
import { ClientSchema, TrackedEntityResponse } from "../schemas";
import { RootRoute } from "./__root";
export const TrackedEntitiesRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entities",
    component: MedicalRegistry,
    validateSearch: ClientSchema,
    loader: async ({ context: { queryClient, engine, orgUnit } }) => {
        const params = new URLSearchParams({
            pageSize: "1",
            page: "1",
            totalPages: "true",
            program: "ueBhWkWll5v",
            orgUnitMode: "ACCESSIBLE",
            fields: "trackedEntity",
        });
        const params2 = new URLSearchParams({
            pageSize: "1",
            page: "1",
            totalPages: "true",
            program: "ueBhWkWll5v",
            orgUnitMode: "ACCESSIBLE",
            fields: "trackedEntity",
            enrollmentEnrolledAfter: dayjs().format("YYYY-MM-DD"),
            enrollmentEnrolledBefore: dayjs().format("YYYY-MM-DD"),
        });
        const params3 = new URLSearchParams({
            pageSize: "1",
            page: "1",
            totalPages: "true",
            program: "ueBhWkWll5v",
            orgUnitMode: "ACCESSIBLE",
            fields: "event",
            status: "SCHEDULE",
            scheduledAfter: dayjs().format("YYYY-MM-DD"),
        });

        const {
            pager: { total },
        } = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: `tracker/trackedEntities?${params.toString()}`,
                queryKey: [
                    "trackedEntities",
                    orgUnit.id,
                    Array.from(params.values()).sort().join(","),
                ],
                refetchInterval: 1 * 60 * 1000,
            }),
        );
        const {
            pager: { total: enrollments },
        } = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: `tracker/trackedEntities?${params2.toString()}`,
                queryKey: [
                    "trackedEntities",
                    orgUnit.id,
                    Array.from(params2.values()).sort().join(","),
                ],
                refetchInterval: 1 * 60 * 1000,
            }),
        );
        const {
            pager: { total: appointments },
        } = await queryClient.ensureQueryData(
            resourceQueryOptions<TrackedEntityResponse>({
                engine,
                resource: `tracker/events?${params3.toString()}`,
                queryKey: [
                    "events",
                    orgUnit.id,
                    Array.from(params3.values()).sort().join(","),
                ],
                refetchInterval: 1 * 60 * 1000,
            }),
        );
        return { total, enrollments, appointments };
    },
});
